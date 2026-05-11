console.log('[boot] server/app.ts loading');
import { Hono } from 'hono';
console.log('[boot] hono imported');
import { cors } from 'hono/cors';
import { prisma } from './lib/prisma.js';
console.log('[boot] prisma imported');
import { getRedis } from './lib/redis.js';
import { tenantsRouter } from './routes/tenants.js';
import { metricsRouter } from './routes/metrics.js';
import { kpiRouter } from './routes/kpi.js';
import { esgRouter } from './routes/esg.js';
import { flowsRouter } from './routes/flows.js';
import { sitesRouter } from './routes/sites.js';
import { liveRouter } from './routes/live.js';
import { simulateRouter } from './routes/simulate.js';
console.log('[boot] all routes imported');

export function createApp() {
  const app = new Hono();

  app.use('/api/*', cors());

  app.get('/api/ping', (c) => c.json({ pong: true, ts: Date.now() }));

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

  return app;
}

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
