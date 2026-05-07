import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { simulateRouter } from './simulate';

const app = new Hono().route('/api/simulate', simulateRouter);

describe('POST /api/simulate', () => {
  it('rejects invalid body with 400', async () => {
    const res = await app.request('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pvKw: -1 }),
    });
    expect(res.status).toBe(400);
  });

  it('accepts valid body and returns 501 (stub)', async () => {
    const res = await app.request('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pvKw: 800,
        essKwh: 2000,
        tariffPlan: '三段式',
        essStrategy: 'PEAK_SHAVE',
        evPorts: 8,
        tenantSlug: 'acme',
      }),
    });
    expect(res.status).toBe(501);
  });
});
