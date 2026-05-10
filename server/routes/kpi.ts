import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { dataAnchor } from '../lib/time-window.js';
import { cache } from '../middleware/cache.js';
import { EMISSION_FACTOR_KG_PER_KWH, TIME_STEP_HOURS, tariffAt } from '../../src/lib/formulas.js';

export const kpiRouter = new Hono();

const querySchema = z.object({
  range: z.enum(['1h', '24h', '7d', '30d']).default('24h'),
});

const RANGE_MS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

interface KpiResult {
  range: string;
  energyConsumedKwh: number;
  energyFromPvKwh: number;
  energyGridBuyKwh: number;
  co2Tons: number;
  costNtd: number;
  renewableRatio: number;
  peakLoadKw: number;
}

const LOAD_TYPES = new Set(['BUILDING', 'EV_CHARGER', 'LINE']);

kpiRouter.get(
  '/:slug/kpi',
  cache((c) => {
    const slug = c.req.param('slug');
    const url = new URL(c.req.url);
    return `tenant:${slug}:kpi:${url.searchParams.toString()}`;
  }, 60),
  async (c) => {
    const slug = c.req.param('slug');
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
    if (!parsed.success) {
      return c.json({ message: 'invalid query', errors: parsed.error.flatten() }, 400);
    }

    const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
    if (!tenant) return c.json({ message: 'tenant not found' }, 404);

    const anchor = await dataAnchor(tenant.id, 'POWER');
    const since = new Date(anchor.getTime() - RANGE_MS[parsed.data.range]);

    const readings = await prisma.metricReading.findMany({
      where: {
        metric: 'POWER',
        timestamp: { gte: since },
        asset: { tenantId: tenant.id },
      },
      include: { asset: { select: { type: true } } },
      orderBy: { timestamp: 'asc' },
    });

    const consumedByTs = new Map<number, number>();
    const pvByTs = new Map<number, number>();
    let peakLoadKw = 0;

    for (const r of readings) {
      const tsKey = r.timestamp.getTime();
      const t = r.asset.type;
      if (LOAD_TYPES.has(t)) {
        consumedByTs.set(tsKey, (consumedByTs.get(tsKey) ?? 0) + Math.max(0, r.value));
        if (r.value > peakLoadKw) peakLoadKw = r.value;
      } else if (t === 'PV') {
        pvByTs.set(tsKey, (pvByTs.get(tsKey) ?? 0) + Math.max(0, r.value));
      }
    }

    let consumedKwh = 0;
    let pvKwh = 0;
    let pvSelfConsumedKwh = 0;
    let gridBuyKwh = 0;
    let costNtd = 0;

    const allTs = new Set([...consumedByTs.keys(), ...pvByTs.keys()]);
    for (const tsKey of allTs) {
      const loadKw = consumedByTs.get(tsKey) ?? 0;
      const pvKw = pvByTs.get(tsKey) ?? 0;
      const pvSelfKw = Math.min(pvKw, loadKw);
      const gridKw = Math.max(0, loadKw - pvKw);

      const loadKwh = loadKw * TIME_STEP_HOURS;
      const pvSelfKwh = pvSelfKw * TIME_STEP_HOURS;
      const pvAllKwh = pvKw * TIME_STEP_HOURS;
      const gridKwh = gridKw * TIME_STEP_HOURS;

      consumedKwh += loadKwh;
      pvSelfConsumedKwh += pvSelfKwh;
      pvKwh += pvAllKwh;
      gridBuyKwh += gridKwh;
      costNtd += gridKwh * tariffAt(new Date(tsKey));
    }

    const co2Tons = (gridBuyKwh * EMISSION_FACTOR_KG_PER_KWH) / 1000;
    const renewableRatio = consumedKwh > 0 ? Math.min(1, pvSelfConsumedKwh / consumedKwh) : 0;

    const result: KpiResult = {
      range: parsed.data.range,
      energyConsumedKwh: round1(consumedKwh),
      energyFromPvKwh: round1(pvKwh),
      energyGridBuyKwh: round1(gridBuyKwh),
      co2Tons: round1(co2Tons),
      costNtd: Math.round(costNtd),
      renewableRatio: round3(renewableRatio),
      peakLoadKw: round1(peakLoadKw),
    };

    return c.json(result);
  },
);

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
