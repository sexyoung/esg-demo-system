import { describe, expect, it } from 'vitest';
import {
  EMISSION_FACTOR_KG_PER_KWH,
  TARIFF_NON_SUMMER,
  TARIFF_SUMMER,
  isSummer,
  simulate,
  tariffAt,
} from './formulas';

describe('constants', () => {
  it('emission factor matches 113-yr official value', () => {
    expect(EMISSION_FACTOR_KG_PER_KWH).toBe(0.474);
  });

  it('summer peak rate matches 114-10 official', () => {
    expect(TARIFF_SUMMER.peak).toBe(9.39);
    expect(TARIFF_NON_SUMMER.halfPeak).toBe(5.47);
  });
});

describe('isSummer', () => {
  it('classifies July as summer', () => {
    expect(isSummer(new Date('2026-07-15T10:00:00'))).toBe(true);
  });
  it('classifies May 16 as summer', () => {
    expect(isSummer(new Date('2026-05-16T10:00:00'))).toBe(true);
  });
  it('classifies May 15 as non-summer', () => {
    expect(isSummer(new Date('2026-05-15T10:00:00'))).toBe(false);
  });
  it('classifies October 16 as non-summer', () => {
    expect(isSummer(new Date('2026-10-16T10:00:00'))).toBe(false);
  });
});

describe('tariffAt (summer)', () => {
  it('returns peak rate for weekday 18:00', () => {
    expect(tariffAt(new Date('2026-07-15T18:00:00'))).toBe(TARIFF_SUMMER.peak);
  });
  it('returns half-peak for weekday 10:00', () => {
    expect(tariffAt(new Date('2026-07-15T10:00:00'))).toBe(TARIFF_SUMMER.halfPeak);
  });
  it('returns off-peak for Sunday', () => {
    expect(tariffAt(new Date('2026-07-19T18:00:00'))).toBe(TARIFF_SUMMER.offPeak);
  });
  it('returns off-peak for weekday 03:00', () => {
    expect(tariffAt(new Date('2026-07-15T03:00:00'))).toBe(TARIFF_SUMMER.offPeak);
  });
});

describe('simulate (Day 4 deliverable)', () => {
  it('throws until implemented', () => {
    expect(() =>
      simulate({
        pvKw: 800,
        essKwh: 2000,
        tariffPlan: '三段式',
        essStrategy: 'PEAK_SHAVE',
        evPorts: 8,
        tenantSlug: 'acme',
      }),
    ).toThrow();
  });
});
