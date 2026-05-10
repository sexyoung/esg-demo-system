import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { dataAnchor } from '../lib/time-window.js';
import { cache } from '../middleware/cache.js';
import { TIME_STEP_HOURS } from '../../src/lib/formulas.js';

export const flowsRouter = new Hono();

const querySchema = z.object({
  range: z.enum(['1h', '24h', '7d', '30d']).default('24h'),
});

const RANGE_MS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

interface FlowsResult {
  range: string;
  unit: 'kWh';
  flows: Array<{ source: string; target: string; value: number }>;
  totals: {
    pv: number;
    essCharge: number;
    essDischarge: number;
    load: number;
    grid: number;
  };
}

flowsRouter.get(
  '/:slug/flows',
  cache((c) => {
    const slug = c.req.param('slug');
    const url = new URL(c.req.url);
    return `tenant:${slug}:flows:${url.searchParams.toString()}`;
  }, 60),
  async (c) => {
    const slug = c.req.param('slug');
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
    if (!parsed.success) {
      return c.json({ message: 'invalid query', errors: parsed.error.flatten() }, 400);
    }

    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, config: true },
    });
    if (!tenant) return c.json({ message: 'tenant not found' }, 404);

    const config = tenant.config as { primarySiteCode?: string };
    const anchor = await dataAnchor(tenant.id, 'POWER');
    const since = new Date(anchor.getTime() - RANGE_MS[parsed.data.range]);

    const readings = await prisma.metricReading.findMany({
      where: {
        metric: 'POWER',
        timestamp: { gte: since },
        asset: { tenantId: tenant.id },
      },
      include: { asset: { select: { type: true, siteId: true, site: { select: { code: true } } } } },
      orderBy: { timestamp: 'asc' },
    });

    const primaryCode = config.primarySiteCode ?? null;

    interface Bucket {
      pv: number;
      essKw: number;
      loadPrimary: number;
      loadRemote: number;
    }

    const buckets = new Map<number, Bucket>();
    const ensure = (ts: number) => {
      let b = buckets.get(ts);
      if (!b) {
        b = { pv: 0, essKw: 0, loadPrimary: 0, loadRemote: 0 };
        buckets.set(ts, b);
      }
      return b;
    };

    for (const r of readings) {
      const ts = r.timestamp.getTime();
      const b = ensure(ts);
      const t = r.asset.type;
      const isPrimary = primaryCode ? r.asset.site?.code === primaryCode : true;

      if (t === 'PV') b.pv += Math.max(0, r.value);
      else if (t === 'ESS') b.essKw += r.value;
      else if (t === 'BUILDING' || t === 'EV_CHARGER' || t === 'LINE') {
        const load = Math.max(0, r.value);
        if (isPrimary) b.loadPrimary += load;
        else b.loadRemote += load;
      }
    }

    let pvTotal = 0;
    let essChargeKwh = 0;
    let essDischargeKwh = 0;
    let loadTotal = 0;
    let gridTotal = 0;

    let pvToLoad = 0;
    let pvToEss = 0;
    let essToLoad = 0;
    let gridToLoad = 0;
    let gridToEss = 0;

    for (const b of buckets.values()) {
      const pvKwh = b.pv * TIME_STEP_HOURS;
      const loadLocalKwh = b.loadPrimary * TIME_STEP_HOURS;
      const loadRemoteKwh = b.loadRemote * TIME_STEP_HOURS;
      const essCh = Math.max(0, b.essKw) * TIME_STEP_HOURS;
      const essDis = Math.max(0, -b.essKw) * TIME_STEP_HOURS;

      const pvToLoadT = Math.min(pvKwh, loadLocalKwh);
      const pvLeft = pvKwh - pvToLoadT;
      const pvToEssT = Math.min(pvLeft, essCh);
      const essToLoadT = Math.min(essDis, Math.max(0, loadLocalKwh - pvToLoadT));
      const gridToLocalT = Math.max(0, loadLocalKwh - pvToLoadT - essToLoadT);
      const gridToEssT = Math.max(0, essCh - pvToEssT);
      const gridToRemoteT = loadRemoteKwh;

      pvTotal += pvKwh;
      essChargeKwh += essCh;
      essDischargeKwh += essDis;
      loadTotal += loadLocalKwh + loadRemoteKwh;
      gridTotal += gridToLocalT + gridToEssT + gridToRemoteT;

      pvToLoad += pvToLoadT;
      pvToEss += pvToEssT;
      essToLoad += essToLoadT;
      gridToLoad += gridToLocalT + gridToRemoteT;
      gridToEss += gridToEssT;
    }

    const flows: FlowsResult['flows'] = [];
    const push = (source: string, target: string, value: number) => {
      if (value > 0.5) flows.push({ source, target, value: round1(value) });
    };
    push('PV', 'Load', pvToLoad);
    push('PV', 'ESS', pvToEss);
    push('ESS', 'Load', essToLoad);
    push('Grid', 'Load', gridToLoad);
    push('Grid', 'ESS', gridToEss);

    if (flows.length === 0 && loadTotal > 0) {
      flows.push({ source: 'Grid', target: 'Load', value: round1(loadTotal) });
    }

    const result: FlowsResult = {
      range: parsed.data.range,
      unit: 'kWh',
      flows,
      totals: {
        pv: round1(pvTotal),
        essCharge: round1(essChargeKwh),
        essDischarge: round1(essDischargeKwh),
        load: round1(loadTotal),
        grid: round1(gridTotal),
      },
    };

    return c.json(result);
  },
);

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
