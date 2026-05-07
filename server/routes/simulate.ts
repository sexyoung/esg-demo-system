import { Hono } from 'hono';
import { z } from 'zod';
import { simulate } from '../../src/lib/formulas.js';

export const simulateRouter = new Hono();

const inputSchema = z.object({
  pvKw: z.number().min(0).max(2000),
  essKwh: z.number().min(0).max(4000),
  tariffPlan: z.enum(['三段式', '二段式', '流動']),
  essStrategy: z.enum(['PEAK_SHAVE', 'SELF_CONSUMPTION', 'ARBITRAGE']),
  evPorts: z.number().int().min(0).max(20),
  tenantSlug: z.string().min(1),
});

simulateRouter.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ message: 'invalid input', errors: parsed.error.flatten() }, 400);
  }
  const result = simulate(parsed.data);
  return c.json(result);
});
