import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';
import { closeRedis } from './lib/redis.js';

const app = createApp();
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
