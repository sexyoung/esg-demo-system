import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { dataAnchor } from '../lib/time-window.js';
import { cache } from '../middleware/cache.js';

export const metricsRouter = new Hono();

const querySchema = z.object({
  range: z.enum(['1h', '24h', '7d', '30d']).default('24h'),
  granularity: z.enum(['15m', '1h', '1d']).default('15m'),
  metric: z.enum(['POWER', 'ENERGY', 'CO2', 'TEMP', 'OEE']).default('POWER'),
});

const RANGE_MS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

metricsRouter.get(
  '/:slug/metrics',
  cache((c) => {
    const slug = c.req.param('slug');
    const url = new URL(c.req.url);
    return `tenant:${slug}:metrics:${url.searchParams.toString()}`;
  }, 60),
  async (c) => {
    const slug = c.req.param('slug');
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
    if (!parsed.success) {
      return c.json({ message: 'invalid query', errors: parsed.error.flatten() }, 400);
    }
    const { range, metric } = parsed.data;

    const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
    if (!tenant) return c.json({ message: 'tenant not found' }, 404);

    const anchor = await dataAnchor(tenant.id, metric);
    const since = new Date(anchor.getTime() - RANGE_MS[range]);
    const readings = await prisma.metricReading.findMany({
      where: {
        metric,
        timestamp: { gte: since },
        asset: { tenantId: tenant.id },
      },
      include: { asset: { select: { id: true, name: true, type: true, siteId: true } } },
      orderBy: { timestamp: 'asc' },
    });

    return c.json({
      range,
      metric,
      count: readings.length,
      points: readings.map((r) => ({
        timestamp: r.timestamp.toISOString(),
        assetId: r.assetId,
        assetName: r.asset.name,
        assetType: r.asset.type,
        siteId: r.asset.siteId,
        value: r.value,
      })),
    });
  },
);
