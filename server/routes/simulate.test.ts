import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { simulateRouter } from './simulate';

const app = new Hono().route('/api/simulate', simulateRouter);

const validBody = {
  pvKw: 800,
  essKwh: 2000,
  tariffPlan: '三段式',
  essStrategy: 'PEAK_SHAVE',
  evPorts: 8,
  tenantSlug: 'acme',
};

async function postJson(body: unknown) {
  return app.request('/api/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/simulate', () => {
  it('rejects invalid body with 400 (negative pvKw)', async () => {
    const res = await postJson({ ...validBody, pvKw: -1 });
    expect(res.status).toBe(400);
  });

  it('rejects invalid body with 400 (out-of-range essKwh)', async () => {
    const res = await postJson({ ...validBody, essKwh: 99999 });
    expect(res.status).toBe(400);
  });

  it('rejects body with missing field with 400', async () => {
    const { pvKw: _omit, ...rest } = validBody;
    void _omit;
    const res = await postJson(rest);
    expect(res.status).toBe(400);
  });

  it('rejects unknown tariffPlan with 400', async () => {
    const res = await postJson({ ...validBody, tariffPlan: '夏月' });
    expect(res.status).toBe(400);
  });

  it('rejects unknown essStrategy with 400', async () => {
    const res = await postJson({ ...validBody, essStrategy: 'GRID_FORMING' });
    expect(res.status).toBe(400);
  });

  it('accepts Acme default and returns full SimulateOutput', async () => {
    const res = await postJson(validBody);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      annualCostSavingNtd: expect.any(Number),
      annualCo2SavingTons: expect.any(Number),
      capexNtd: expect.any(Number),
      selfConsumptionRatio: expect.any(Number),
      peakReductionKw: expect.any(Number),
    });
    expect(body.series).toHaveLength(96);
    expect(body.baseline.costNtd).toBeGreaterThan(0);
  });

  it('all-zero scenario returns null ROI', async () => {
    const res = await postJson({ ...validBody, pvKw: 0, essKwh: 0, evPorts: 0 });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.roiYears).toBeNull();
    expect(body.capexNtd).toBe(0);
  });

  it('rejects empty body with 400', async () => {
    const res = await app.request('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '',
    });
    expect(res.status).toBe(400);
  });
});
