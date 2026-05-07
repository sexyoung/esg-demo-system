/**
 * Demo simulator math.
 *
 * Sources: see docs/day0-research.md §1 §2.
 */

export const TIME_STEP_HOURS = 0.25;
const QUARTERS_PER_DAY = 96;
const SIMULATION_DAYS = 365;

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

export const TARIFF_TWO_TIER_SUMMER = { peak: 8.5, offPeak: 3.2 };
export const TARIFF_TWO_TIER_NON_SUMMER = { peak: 7.2, offPeak: 2.8 };
export const TARIFF_FLAT_NTD_PER_KWH = 4.8;

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

export interface DailySeriesPoint {
  hour: number;
  loadKw: number;
  pvKw: number;
  essKw: number;
  gridKw: number;
}

export interface ScenarioSnapshot {
  costNtd: number;
  co2Tons: number;
  peakKw: number;
}

export interface SimulateOutput {
  annualCostSavingNtd: number;
  annualCo2SavingTons: number;
  roiYears: number | null;
  selfConsumptionRatio: number;
  peakReductionKw: number;
  capexNtd: number;
  baseline: ScenarioSnapshot;
  scenario: ScenarioSnapshot;
  series: DailySeriesPoint[];
}

export function isSummer(date: Date): boolean {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (month > 5 && month < 10) return true;
  if (month === 5 && day >= 16) return true;
  if (month === 10 && day <= 15) return true;
  return false;
}

export type TariffZone = 'peak' | 'halfPeak' | 'satHalfPeak' | 'offPeak';

export function tariffZoneAt(date: Date): TariffZone {
  const dow = date.getDay();
  const hour = date.getHours();
  if (dow === 0) return 'offPeak';
  if (dow === 6) return hour >= 9 ? 'satHalfPeak' : 'offPeak';
  if (isSummer(date)) {
    if (hour >= 16 && hour < 22) return 'peak';
    if (hour < 9) return 'offPeak';
    return 'halfPeak';
  }
  if ((hour >= 6 && hour < 11) || (hour >= 14 && hour < 24)) return 'halfPeak';
  return 'offPeak';
}

export function tariffAt(date: Date): number {
  const zone = tariffZoneAt(date);
  const rates = isSummer(date) ? TARIFF_SUMMER : TARIFF_NON_SUMMER;
  return rates[zone];
}

export function tariffWithPlan(plan: TariffPlan, date: Date): number {
  if (plan === '流動') return TARIFF_FLAT_NTD_PER_KWH;
  if (plan === '二段式') {
    const summer = isSummer(date);
    const dow = date.getDay();
    const hour = date.getHours();
    const isPeakWindow = dow >= 1 && dow <= 5 && hour >= 16 && hour < 22;
    const rates = summer ? TARIFF_TWO_TIER_SUMMER : TARIFF_TWO_TIER_NON_SUMMER;
    return isPeakWindow ? rates.peak : rates.offPeak;
  }
  return tariffAt(date);
}

interface TenantProfile {
  basePeakKw: number;
  baseMinKw: number;
  weekendFactor: number;
  shape: 'industrial' | 'office' | 'fab';
}

const TENANT_PROFILES: Record<string, TenantProfile> = {
  acme: { basePeakKw: 2200, baseMinKw: 1300, weekendFactor: 0.7, shape: 'industrial' },
  beta: { basePeakKw: 1800, baseMinKw: 280, weekendFactor: 0.25, shape: 'office' },
  gamma: { basePeakKw: 3000, baseMinKw: 2700, weekendFactor: 0.92, shape: 'fab' },
};

const TWO_PI = Math.PI * 2;

export function tenantBaselineLoadKw(date: Date, slug: string): number {
  const profile = TENANT_PROFILES[slug] ?? TENANT_PROFILES.acme;
  const dow = date.getDay();
  const hour = date.getHours() + date.getMinutes() / 60;
  const isWeekend = dow === 0 || dow === 6;

  if (profile.shape === 'industrial') {
    const baseline = profile.baseMinKw + (profile.basePeakKw - profile.baseMinKw) * 0.55;
    const business = !isWeekend && hour >= 8 && hour <= 18 ? (profile.basePeakKw - profile.baseMinKw) * 0.4 : 0;
    const wave = (profile.basePeakKw - profile.baseMinKw) * 0.05 * Math.sin((TWO_PI * hour) / 6);
    return Math.max(profile.baseMinKw, baseline + business + wave) * (isWeekend ? profile.weekendFactor : 1);
  }
  if (profile.shape === 'office') {
    if (isWeekend) {
      return profile.baseMinKw + profile.basePeakKw * 0.05;
    }
    if (hour < 7 || hour > 21) return profile.baseMinKw;
    const occ = Math.sin((Math.PI * (hour - 7)) / 14);
    return profile.baseMinKw + (profile.basePeakKw - profile.baseMinKw) * Math.max(0, occ);
  }
  // fab — flat with small drift
  const drift = 0.05 * Math.sin((TWO_PI * hour) / 24);
  return profile.basePeakKw * (0.92 + drift) * (isWeekend ? profile.weekendFactor : 1);
}

export function solarProfileKw(date: Date, pvKw: number): number {
  if (pvKw <= 0) return 0;
  const hour = date.getHours() + date.getMinutes() / 60;
  if (hour < 6 || hour > 18) return 0;
  const norm = (hour - 6) / 12;
  const shape = Math.sin(Math.PI * norm);
  const seasonalFactor = isSummer(date) ? 1.05 : 0.85;
  return Math.max(0, pvKw * shape * seasonalFactor);
}

export function evLoadKw(date: Date, ports: number): number {
  if (ports <= 0) return 0;
  const dow = date.getDay();
  const hour = date.getHours() + date.getMinutes() / 60;
  if (dow === 0) return 0;
  if (hour < 17 || hour > 22) return ports * 50 * 0.05;
  const utilization = Math.min(1, (hour - 17) / 5);
  return ports * 50 * (0.4 + 0.5 * utilization);
}

interface DispatchInput {
  strategy: EssStrategy;
  socFraction: number;
  netLoadKw: number;
  pvKw: number;
  tariffZone: TariffZone;
  capacityKwh: number;
  dt: number;
}

interface DispatchOutput {
  newSocFraction: number;
  essKw: number;
}

function dispatchEss({ strategy, socFraction, netLoadKw, pvKw, tariffZone, capacityKwh, dt }: DispatchInput): DispatchOutput {
  if (capacityKwh <= 0) return { newSocFraction: socFraction, essKw: 0 };

  const maxPowerKw = capacityKwh * ESS_PHYSICS.cRateMax;
  const usableKwh = capacityKwh * (ESS_PHYSICS.socMax - ESS_PHYSICS.socMin);

  const usableKwhWindow = capacityKwh * (ESS_PHYSICS.socMax - ESS_PHYSICS.socMin);
  const peakHoursLength = 6;
  const sustainedPeakDischargeKw = Math.min(maxPowerKw, usableKwhWindow / peakHoursLength);

  let intent = 0;
  if (strategy === 'PEAK_SHAVE') {
    if (tariffZone === 'peak') intent = Math.min(sustainedPeakDischargeKw, Math.max(0, netLoadKw));
    else if (tariffZone === 'offPeak' && socFraction < 0.85) intent = -maxPowerKw;
    else intent = 0;
  } else if (strategy === 'SELF_CONSUMPTION') {
    const pvSurplus = pvKw - Math.max(0, netLoadKw + pvKw);
    if (pvSurplus > 1) {
      intent = -Math.min(maxPowerKw, pvSurplus);
    } else if (netLoadKw > 0) {
      intent = Math.min(maxPowerKw, netLoadKw);
    }
  } else if (strategy === 'ARBITRAGE') {
    if (tariffZone === 'peak') intent = maxPowerKw;
    else if (tariffZone === 'halfPeak' && socFraction > 0.4) intent = maxPowerKw * 0.5;
    else if (tariffZone === 'offPeak') intent = -maxPowerKw;
    else intent = 0;
  }
  void usableKwhWindow;
  void sustainedPeakDischargeKw;

  if (intent < 0) {
    const headroomKwh = (ESS_PHYSICS.socMax - socFraction) * capacityKwh;
    const maxChargeKwh = Math.min(headroomKwh, maxPowerKw * dt);
    const chargeKwh = Math.min(maxChargeKwh, -intent * dt);
    if (chargeKwh <= 0) return { newSocFraction: socFraction, essKw: 0 };
    const socGainFraction = (chargeKwh * ESS_PHYSICS.roundTripEfficiency) / capacityKwh;
    return { newSocFraction: Math.min(ESS_PHYSICS.socMax, socFraction + socGainFraction), essKw: chargeKwh / dt };
  }
  if (intent > 0) {
    const availableKwh = (socFraction - ESS_PHYSICS.socMin) * capacityKwh;
    const maxDischargeKwh = Math.min(availableKwh, maxPowerKw * dt);
    const dischargeKwh = Math.min(maxDischargeKwh, intent * dt);
    if (dischargeKwh <= 0) return { newSocFraction: socFraction, essKw: 0 };
    const socLossFraction = dischargeKwh / capacityKwh;
    return { newSocFraction: Math.max(ESS_PHYSICS.socMin, socFraction - socLossFraction), essKw: -(dischargeKwh / dt) };
  }
  void usableKwh;
  return { newSocFraction: socFraction, essKw: 0 };
}

interface ScenarioRun {
  costNtd: number;
  co2Tons: number;
  peakKw: number;
  peakKwInPeakHours: number;
  loadKwhTotal: number;
  pvSelfConsumedKwh: number;
  series: DailySeriesPoint[];
}

function runScenario(input: SimulateInput): ScenarioRun {
  const pvKw = clampNonNeg(input.pvKw);
  const essKwh = clampNonNeg(input.essKwh);
  const evPorts = Math.max(0, Math.floor(input.evPorts ?? 0));

  const start = new Date(2026, 0, 1, 0, 0, 0);
  let socFraction = 0.5;
  let costNtd = 0;
  let co2Tons = 0;
  let peakKw = 0;
  let loadKwhTotal = 0;
  let pvSelfConsumedKwh = 0;

  const previewDayIndex = 195;
  const series: DailySeriesPoint[] = [];
  let peakKwInPeakHours = 0;

  for (let day = 0; day < SIMULATION_DAYS; day++) {
    const captureSeries = day === previewDayIndex;
    for (let q = 0; q < QUARTERS_PER_DAY; q++) {
      const ts = new Date(start.getTime() + ((day * QUARTERS_PER_DAY + q) * 15 * 60 * 1000));
      const baseLoad = tenantBaselineLoadKw(ts, input.tenantSlug);
      const evLoad = evLoadKw(ts, evPorts);
      const totalLoad = baseLoad + evLoad;
      const pv = solarProfileKw(ts, pvKw);
      const netLoad = totalLoad - pv;

      const zone = tariffZoneAt(ts);
      const dispatch = dispatchEss({
        strategy: input.essStrategy,
        socFraction,
        netLoadKw: netLoad,
        pvKw: pv,
        tariffZone: zone,
        capacityKwh: essKwh,
        dt: TIME_STEP_HOURS,
      });
      socFraction = dispatch.newSocFraction;
      const essKw = dispatch.essKw;
      const gridKw = totalLoad - pv + essKw;

      const gridBuyKw = Math.max(0, gridKw);
      const gridKwh = gridBuyKw * TIME_STEP_HOURS;
      costNtd += gridKwh * tariffWithPlan(input.tariffPlan, ts);
      co2Tons += (gridKwh * EMISSION_FACTOR_KG_PER_KWH) / 1000;
      if (gridBuyKw > peakKw) peakKw = gridBuyKw;
      if (zone === 'peak' && gridBuyKw > peakKwInPeakHours) peakKwInPeakHours = gridBuyKw;
      loadKwhTotal += totalLoad * TIME_STEP_HOURS;
      pvSelfConsumedKwh += Math.min(pv, totalLoad) * TIME_STEP_HOURS;

      if (captureSeries) {
        series.push({
          hour: q * 0.25,
          loadKw: round1(totalLoad),
          pvKw: round1(pv),
          essKw: round1(essKw),
          gridKw: round1(gridKw),
        });
      }
    }
  }

  return { costNtd, co2Tons, peakKw, peakKwInPeakHours, loadKwhTotal, pvSelfConsumedKwh, series };
}

export function simulate(input: SimulateInput): SimulateOutput {
  const sanitized: SimulateInput = {
    ...input,
    pvKw: clampNonNeg(input.pvKw),
    essKwh: clampNonNeg(input.essKwh),
    evPorts: Math.max(0, Math.floor(input.evPorts ?? 0)),
  };

  const baseline = runScenario({ ...sanitized, pvKw: 0, essKwh: 0, evPorts: 0 });
  const scenario = runScenario(sanitized);

  const capexNtd =
    sanitized.pvKw * CAPEX.pvPerKw +
    sanitized.essKwh * CAPEX.essPerKwh +
    sanitized.evPorts * CAPEX.evChargerPerPort;

  const annualCostSavingNtd = baseline.costNtd - scenario.costNtd;
  const annualCo2SavingTons = baseline.co2Tons - scenario.co2Tons;
  const peakReductionKw = baseline.peakKwInPeakHours - scenario.peakKwInPeakHours;

  const roiYears = annualCostSavingNtd > 0 && capexNtd > 0 ? capexNtd / annualCostSavingNtd : null;

  const selfConsumptionRatio =
    scenario.loadKwhTotal > 0 ? Math.min(1, scenario.pvSelfConsumedKwh / scenario.loadKwhTotal) : 0;

  return {
    annualCostSavingNtd: round0(annualCostSavingNtd),
    annualCo2SavingTons: round1(annualCo2SavingTons),
    roiYears: roiYears !== null ? round2(roiYears) : null,
    selfConsumptionRatio: round3(selfConsumptionRatio),
    peakReductionKw: round1(peakReductionKw),
    capexNtd: round0(capexNtd),
    baseline: { costNtd: round0(baseline.costNtd), co2Tons: round1(baseline.co2Tons), peakKw: round1(baseline.peakKwInPeakHours) },
    scenario: { costNtd: round0(scenario.costNtd), co2Tons: round1(scenario.co2Tons), peakKw: round1(scenario.peakKwInPeakHours) },
    series: scenario.series,
  };
}

function clampNonNeg(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}
function round0(n: number): number { return Math.round(n); }
function round1(n: number): number { return Math.round(n * 10) / 10; }
function round2(n: number): number { return Math.round(n * 100) / 100; }
function round3(n: number): number { return Math.round(n * 1000) / 1000; }
