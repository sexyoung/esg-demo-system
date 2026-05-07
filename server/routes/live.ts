import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { prisma } from '../lib/prisma.js';

export const liveRouter = new Hono();

const TICK_INTERVAL_MS = Math.round(1000 / 30);

liveRouter.get('/:slug/live', async (c) => {
  const slug = c.req.param('slug');
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (!tenant) return c.json({ message: 'tenant not found' }, 404);

  const baselineKw = slug === 'acme' ? 1800 : slug === 'beta' ? 220 : 6500;

  return streamSSE(c, async (stream) => {
    let id = 0;
    let phase = 0;
    while (!stream.aborted) {
      phase += 0.05;
      const wave = Math.sin(phase) * baselineKw * 0.08;
      const jitter = (Math.random() - 0.5) * baselineKw * 0.04;
      const kw = Math.round((baselineKw + wave + jitter) * 10) / 10;
      await stream.writeSSE({
        id: String(++id),
        event: 'tick',
        data: JSON.stringify({ ts: Date.now(), kw }),
      });
      await stream.sleep(TICK_INTERVAL_MS);
    }
  });
});
