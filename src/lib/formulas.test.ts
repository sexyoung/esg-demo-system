import { describe, expect, it } from 'vitest';
import {
  EMISSION_FACTOR_KG_PER_KWH,
  TARIFF_NON_SUMMER,
  TARIFF_SUMMER,
  TIME_STEP_HOURS,
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

  it('time step is 15 minutes (0.25 hr)', () => {
    expect(TIME_STEP_HOURS).toBe(0.25);
  });
});

describe('isSummer', () => {
  it('classifies July as summer', () => {
    expect(isSummer(new Date('2026-07-15T10:00:00'))).toBe(true);
  });
  it('classifies May 16 as summer (boundary in)', () => {
    expect(isSummer(new Date('2026-05-16T10:00:00'))).toBe(true);
  });
  it('classifies May 15 as non-summer (day before)', () => {
    expect(isSummer(new Date('2026-05-15T10:00:00'))).toBe(false);
  });
  it('classifies October 15 as summer (last day)', () => {
    expect(isSummer(new Date('2026-10-15T10:00:00'))).toBe(true);
  });
  it('classifies October 16 as non-summer (boundary out)', () => {
    expect(isSummer(new Date('2026-10-16T10:00:00'))).toBe(false);
  });
  it('classifies February as non-summer', () => {
    expect(isSummer(new Date('2026-02-10T10:00:00'))).toBe(false);
  });
});

describe('tariffAt (summer)', () => {
  it('peak rate for weekday 18:00', () => {
    expect(tariffAt(new Date('2026-07-15T18:00:00'))).toBe(TARIFF_SUMMER.peak);
  });
  it('peak start at 16:00 weekday', () => {
    expect(tariffAt(new Date('2026-07-15T16:00:00'))).toBe(TARIFF_SUMMER.peak);
  });
  it('half-peak just before peak (15:30 weekday)', () => {
    expect(tariffAt(new Date('2026-07-15T15:30:00'))).toBe(TARIFF_SUMMER.halfPeak);
  });
  it('half-peak weekday after peak (22:30)', () => {
    expect(tariffAt(new Date('2026-07-15T22:30:00'))).toBe(TARIFF_SUMMER.halfPeak);
  });
  it('off-peak weekday early morning (03:00)', () => {
    expect(tariffAt(new Date('2026-07-15T03:00:00'))).toBe(TARIFF_SUMMER.offPeak);
  });
  it('Saturday half-peak (Sat 14:00)', () => {
    expect(tariffAt(new Date('2026-07-18T14:00:00'))).toBe(TARIFF_SUMMER.satHalfPeak);
  });
  it('Saturday off-peak before 09:00 (Sat 06:00)', () => {
    expect(tariffAt(new Date('2026-07-18T06:00:00'))).toBe(TARIFF_SUMMER.offPeak);
  });
  it('Sunday is off-peak all day (Sun 18:00)', () => {
    expect(tariffAt(new Date('2026-07-19T18:00:00'))).toBe(TARIFF_SUMMER.offPeak);
  });
});

describe('tariffAt (non-summer)', () => {
  it('half-peak weekday morning (Wed 09:00)', () => {
    expect(tariffAt(new Date('2026-02-04T09:00:00'))).toBe(TARIFF_NON_SUMMER.halfPeak);
  });
  it('off-peak weekday midday gap (Wed 12:00)', () => {
    expect(tariffAt(new Date('2026-02-04T12:00:00'))).toBe(TARIFF_NON_SUMMER.offPeak);
  });
  it('half-peak weekday night (Wed 20:00)', () => {
    expect(tariffAt(new Date('2026-02-04T20:00:00'))).toBe(TARIFF_NON_SUMMER.halfPeak);
  });
  it('off-peak weekday early morning (Wed 03:00)', () => {
    expect(tariffAt(new Date('2026-02-04T03:00:00'))).toBe(TARIFF_NON_SUMMER.offPeak);
  });
  it('Sunday is off-peak (Sun 18:00)', () => {
    expect(tariffAt(new Date('2026-02-08T18:00:00'))).toBe(TARIFF_NON_SUMMER.offPeak);
  });
  it('non-summer rate < summer rate at same hour', () => {
    expect(TARIFF_NON_SUMMER.halfPeak).toBeLessThan(TARIFF_SUMMER.halfPeak);
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
