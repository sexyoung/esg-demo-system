import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { prisma } from './lib/prisma.js';
import { closeRedis, getRedis } from './lib/redis.js';
import { tenantsRouter } from './routes/tenants.js';
import { metricsRouter } from './routes/metrics.js';
import { kpiRouter } from './routes/kpi.js';
import { esgRouter } from './routes/esg.js';
import { flowsRouter } from './routes/flows.js';
import { sitesRouter } from './routes/sites.js';
import { liveRouter } from './routes/live.js';
import { simulateRouter } from './routes/simulate.js';

const app = new Hono();

app.use('/api/*', cors());

app.get('/api/health', async (c) => {
  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);
  return c.json({
    status: 'ok',
    service: 'esg-demo-api',
    database,
    redis,
    timestamp: new Date().toISOString(),
  });
});

app.route('/api/tenants', tenantsRouter);
app.route('/api/tenants', metricsRouter);
app.route('/api/tenants', kpiRouter);
app.route('/api/tenants', esgRouter);
app.route('/api/tenants', flowsRouter);
app.route('/api/tenants', liveRouter);
app.route('/api/sites', sitesRouter);
app.route('/api/simulate', simulateRouter);

app.notFound((c) => c.json({ message: 'Not found' }, 404));

const port = Number(process.env.PORT ?? 8787);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Hono API server listening on http://localhost:${info.port}`);
  },
);

async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return 'connected';
  } catch {
    return 'unavailable';
  }
}

async function checkRedis() {
  const redis = await getRedis();
  if (!redis) return 'unavailable';
  try {
    await redis.ping();
    return 'connected';
  } catch {
    return 'unavailable';
  }
}

async function shutdown() {
  await Promise.allSettled([prisma.$disconnect(), closeRedis()]);
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown();
});

process.on('SIGTERM', () => {
  void shutdown();
});
