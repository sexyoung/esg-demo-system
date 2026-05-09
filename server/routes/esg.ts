import { Hono } from 'hono';
import { cache } from '../middleware/cache.js';

export const esgRouter = new Hono();

interface MonthlyPoint {
  /** ISO YYYY-MM */
  month: string;
  co2Tons: number;
  renewableRatio: number;
}

interface BuRow {
  id: string;
  name: string;
  reductionPct: number;
  co2Tons: number;
}

interface TargetSpec {
  kind: 'RE100' | 'SBTi-1.5C' | 'NetZero-2050';
  label: string;
  baselineYear: number;
  /** Monotonic % reduction the tenant has committed to by deadline. */
  reductionPctByDeadline: number;
  deadline: number;
}

interface EsgSummary {
  slug: string;
  generatedAt: string;
  target: TargetSpec;
  monthly: MonthlyPoint[];
  forecastEoy: { co2Tons: number; reductionPct: number };
  ytdReduction: { pct: number; tonsAvoided: number };
  currentMonth: { co2Tons: number; deltaVsLastMonthPct: number };
  buRanking: BuRow[];
}

const TENANT_PROFILES: Record<
  string,
  {
    target: TargetSpec;
    baselineCo2: number;
    progressPct: number;
    renewableStart: number;
    renewableEnd: number;
    bus: { id: string; name: string; reductionPct: number; share: number }[];
  }
> = {
  acme: {
    target: {
      kind: 'RE100',
      label: 'RE100 — 100% 再生能源 by 2030',
      baselineYear: 2020,
      reductionPctByDeadline: 100,
      deadline: 2030,
    },
    baselineCo2: 1820,
    progressPct: 22,
    renewableStart: 0.32,
    renewableEnd: 0.49,
    bus: [
      { id: 'mg-pv', name: '園區 PV 陣列', reductionPct: 32, share: 0.4 },
      { id: 'mg-ess', name: 'ESS 削峰系統', reductionPct: 24, share: 0.25 },
      { id: 'mg-load', name: '廠房主負載', reductionPct: 14, share: 0.2 },
      { id: 'mg-ev', name: 'EV 充電場', reductionPct: 9, share: 0.15 },
    ],
  },
  beta: {
    target: {
      kind: 'RE100',
      label: 'RE100 — 100% 再生能源 by 2032',
      baselineYear: 2021,
      reductionPctByDeadline: 100,
      deadline: 2032,
    },
    baselineCo2: 940,
    progressPct: 14,
    renewableStart: 0.18,
    renewableEnd: 0.31,
    bus: [
      { id: 'b-hvac', name: '空調系統 (HVAC)', reductionPct: 21, share: 0.45 },
      { id: 'b-light', name: '照明 + 插座', reductionPct: 15, share: 0.25 },
      { id: 'b-elev', name: '電梯與機房', reductionPct: 9, share: 0.18 },
      { id: 'b-misc', name: '其他公共設施', reductionPct: 5, share: 0.12 },
    ],
  },
  gamma: {
    target: {
      kind: 'SBTi-1.5C',
      label: 'SBTi 1.5°C — 2030 -42% (Scope 1+2)',
      baselineYear: 2020,
      reductionPctByDeadline: 42,
      deadline: 2030,
    },
    baselineCo2: 12480,
    progressPct: 9,
    renewableStart: 0.21,
    renewableEnd: 0.27,
    bus: [
      { id: 'g-fab1', name: '12" FAB 生產線 A', reductionPct: 11, share: 0.42 },
      { id: 'g-fab2', name: '12" FAB 生產線 B', reductionPct: 8, share: 0.32 },
      { id: 'g-cda', name: 'CDA 壓縮空氣站', reductionPct: 14, share: 0.14 },
      { id: 'g-uti', name: 'Utility 機房', reductionPct: 6, share: 0.12 },
    ],
  },
};

esgRouter.get(
  '/:slug/esg-summary',
  cache((c) => `tenant:${c.req.param('slug')}:esg-summary`, 300),
  (c) => {
    const slug = c.req.param('slug');
    const profile = TENANT_PROFILES[slug];
    if (!profile) {
      return c.json({ message: 'tenant not found' }, 404);
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthly: MonthlyPoint[] = [];
    for (let offset = 11; offset >= 0; offset--) {
      const d = new Date(currentYear, currentMonth - offset, 1);
      const monthIndex = 11 - offset;
      // Co2 trends down from baseline by progressPct over 12 months,
      // with sinusoidal seasonal variation (heaviest in summer).
      const seasonal = 0.06 * Math.sin(((d.getMonth() - 6) / 12) * Math.PI * 2);
      const reduction = (profile.progressPct / 100) * (monthIndex / 11);
      const monthlyCo2 = (profile.baselineCo2 / 12) * (1 - reduction + seasonal);
      const renewableLerp =
        profile.renewableStart + (profile.renewableEnd - profile.renewableStart) * (monthIndex / 11);
      monthly.push({
        month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        co2Tons: round(monthlyCo2, 1),
        renewableRatio: round(renewableLerp + (Math.sin(monthIndex * 1.7) * 0.015), 4),
      });
    }

    const baselineMonthlyCo2 = profile.baselineCo2 / 12;
    const ytdActualSum = monthly.reduce((acc, p) => acc + p.co2Tons, 0);
    const ytdBaselineSum = baselineMonthlyCo2 * 12;
    const ytdReductionPct = ((ytdBaselineSum - ytdActualSum) / ytdBaselineSum) * 100;

    const lastMonth = monthly[monthly.length - 2];
    const thisMonth = monthly[monthly.length - 1];
    const deltaVsLastMonthPct = lastMonth
      ? ((thisMonth.co2Tons - lastMonth.co2Tons) / lastMonth.co2Tons) * 100
      : 0;

    // Forecast EOY: project final 3-month trend forward.
    const recentTrend = (thisMonth.co2Tons - monthly[monthly.length - 4].co2Tons) / 3;
    const forecastEoyMonthly = thisMonth.co2Tons + recentTrend * (12 - monthly.length + 11);
    const forecastEoyAnnual = forecastEoyMonthly * 12;
    const forecastReductionPct =
      ((profile.baselineCo2 - forecastEoyAnnual) / profile.baselineCo2) * 100;

    const buRanking: BuRow[] = profile.bus.map((bu) => ({
      id: bu.id,
      name: bu.name,
      reductionPct: bu.reductionPct,
      co2Tons: round(profile.baselineCo2 * bu.share * (1 - bu.reductionPct / 100), 1),
    }));

    const summary: EsgSummary = {
      slug,
      generatedAt: now.toISOString(),
      target: profile.target,
      monthly,
      forecastEoy: {
        co2Tons: round(forecastEoyAnnual, 1),
        reductionPct: round(forecastReductionPct, 1),
      },
      ytdReduction: {
        pct: round(ytdReductionPct, 1),
        tonsAvoided: round(ytdBaselineSum - ytdActualSum, 1),
      },
      currentMonth: {
        co2Tons: round(thisMonth.co2Tons, 1),
        deltaVsLastMonthPct: round(deltaVsLastMonthPct, 1),
      },
      buRanking,
    };

    return c.json(summary);
  },
);

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
