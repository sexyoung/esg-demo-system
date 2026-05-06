import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { prisma } from './lib/prisma.js';
import { closeRedis, getRedis } from './lib/redis.js';

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

app.get('/api/projects', async (c) => {
  const projects = await prisma.project.findMany({
    orderBy: {
      createdAt: 'desc',
    },
  });

  return c.json(projects);
});

app.post('/api/projects', async (c) => {
  const body = await c.req.json<{
    name?: string;
    owner?: string;
    status?: 'PLANNING' | 'ACTIVE' | 'ARCHIVED';
    carbonTons?: number;
  }>();

  if (!body.name || !body.owner) {
    return c.json({ message: 'name and owner are required' }, 400);
  }

  const project = await prisma.project.create({
    data: {
      name: body.name,
      owner: body.owner,
      status: body.status ?? 'PLANNING',
      carbonTons: body.carbonTons ?? 0,
    },
  });

  return c.json(project, 201);
});

app.get('/api/cache/:key', async (c) => {
  const key = c.req.param('key');
  const redis = await getRedis();

  if (!redis) {
    return c.json({
      key,
      value: 'Redis 尚未連線，這是 fallback 資料。',
      source: 'fallback',
    });
  }

  const cached = await redis.get(key);

  if (cached) {
    return c.json({ key, value: cached, source: 'redis' });
  }

  const value = `Cached at ${new Date().toISOString()}`;
  await redis.set(key, value, { EX: 60 });

  return c.json({ key, value, source: 'redis' });
});

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

  if (!redis) {
    return 'unavailable';
  }

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
