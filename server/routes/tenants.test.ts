import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { tenantsRouter } from './tenants.js';

const app = new Hono().route('/api/tenants', tenantsRouter);

describe('GET /api/tenants', () => {
  it('returns 200', async () => {
    const res = await app.request('/api/tenants');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});

describe('GET /api/tenants/:slug', () => {
  it('returns 404 for unknown tenant', async () => {
    const res = await app.request('/api/tenants/no-such-tenant');
    expect(res.status).toBe(404);
  });
});
