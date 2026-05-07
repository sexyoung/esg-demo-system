/**
 * Demo simulator math.
 *
 * Day 1: constants + stub function signatures only.
 * Day 4: full implementation with SOC clamping, RTE, ToU dispatch, ROI.
 *
 * Sources: see docs/day0-research.md §1 §2.
 */

export const TIME_STEP_HOURS = 0.25;

export const EMISSION_FACTOR_KG_PER_KWH = 0.474;

export interface TariffRates {
  peak: number;
  halfPeak: number;
  satHalfPeak: number;
  offPeak: number;
}

export const TARIFF_SUMMER: TariffRates = {
  peak: 9.39,
  halfPeak: 5.85,
  satHalfPeak: 2.6,
  offPeak: 2.53,
};

export const TARIFF_NON_SUMMER: TariffRates = {
  peak: 9.39,
  halfPeak: 5.47,
  satHalfPeak: 2.41,
  offPeak: 2.32,
};

export const CAPEX = {
  pvPerKw: 30_000,
  essPerKwh: 15_000,
  evChargerPerPort: 100_000,
  batteryReplacementYear: 10,
  batteryReplacementFraction: 0.5,
  systemLifetimeYears: 20,
} as const;

export const ESS_PHYSICS = {
  socMin: 0.1,
  socMax: 0.95,
  cRateMax: 0.5,
  roundTripEfficiency: 0.88,
  yearlyDegradation: 0.02,
  exportAllowed: false,
} as const;

export type TariffPlan = '三段式' | '二段式' | '流動';
export type EssStrategy = 'PEAK_SHAVE' | 'SELF_CONSUMPTION' | 'ARBITRAGE';

export interface SimulateInput {
  pvKw: number;
  essKwh: number;
  tariffPlan: TariffPlan;
  essStrategy: EssStrategy;
  evPorts: number;
  tenantSlug: string;
}

export interface SimulateOutput {
  annualCostNtd: number;
  annualCo2Tons: number;
  roiYears: number | null;
  selfConsumptionRatio: number;
  peakLoadReductionKw: number;
  series: Array<{ timestamp: string; load: number; pv: number; ess: number; grid: number }>;
}

export function isSummer(date: Date): boolean {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (month > 5 && month < 10) return true;
  if (month === 5 && day >= 16) return true;
  if (month === 10 && day <= 15) return true;
  return false;
}

export function tariffAt(date: Date): number {
  const rates = isSummer(date) ? TARIFF_SUMMER : TARIFF_NON_SUMMER;
  const dow = date.getDay();
  const hour = date.getHours();
  if (dow === 0) return rates.offPeak;
  if (dow === 6) return hour >= 9 ? rates.satHalfPeak : rates.offPeak;
  if (isSummer(date)) {
    if (hour >= 16 && hour < 22) return rates.peak;
    if (hour < 9) return rates.offPeak;
    return rates.halfPeak;
  }
  if ((hour >= 6 && hour < 11) || (hour >= 14 && hour < 24)) return rates.halfPeak;
  return rates.offPeak;
}

export function simulate(_input: SimulateInput): SimulateOutput {
  throw new Error('simulate() not implemented yet — Day 4 deliverable');
}
