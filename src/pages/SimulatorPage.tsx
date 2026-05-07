import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Cog, Loader2 } from 'lucide-react';
import { postSimulate } from '../api/simulator';
import { PreviewChart } from '../components/simulator/PreviewChart';
import { RingGauge } from '../components/simulator/RingGauge';
import { SliderField } from '../components/simulator/SliderField';
import {
  CAPEX,
  type EssStrategy,
  simulate,
  type SimulateInput,
  type SimulateOutput,
  type TariffPlan,
} from '../lib/formulas';

const DEBOUNCE_MS = 200;

const TARIFF_OPTIONS: TariffPlan[] = ['三段式', '二段式', '流動'];
const STRATEGY_OPTIONS: { value: EssStrategy; label: string; hint: string }[] = [
  { value: 'PEAK_SHAVE', label: 'Peak Shave', hint: '尖峰時段放電 + 離峰充電' },
  { value: 'SELF_CONSUMPTION', label: 'Self-Cons', hint: 'PV 多餘存進 ESS、缺口 ESS 補' },
  { value: 'ARBITRAGE', label: 'Arbitrage', hint: '低買高賣，能放就放' },
];

export function SimulatorPage() {
  const { slug = 'acme' } = useParams<{ slug: string }>();

  const [input, setInput] = useState<SimulateInput>({
    pvKw: 800,
    essKwh: 2000,
    tariffPlan: '三段式',
    essStrategy: 'PEAK_SHAVE',
    evPorts: 8,
    tenantSlug: slug,
  });

  useEffect(() => {
    setInput((prev) => ({ ...prev, tenantSlug: slug }));
  }, [slug]);

  const clientResult = useMemo(() => simulate(input), [input]);
  const [serverResult, setServerResult] = useState<SimulateOutput | null>(null);
  const [serverLoading, setServerLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    const seq = ++requestSeq.current;
    setServerLoading(true);
    const timer = setTimeout(() => {
      postSimulate(input)
        .then((res) => {
          if (seq !== requestSeq.current) return;
          setServerResult(res);
          setServerError(null);
        })
        .catch((err) => {
          if (seq !== requestSeq.current) return;
          setServerError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => {
          if (seq === requestSeq.current) setServerLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const result = serverResult ?? clientResult;
  const stale = serverLoading && serverResult !== null;

  const costSavingFraction =
    result.baseline.costNtd > 0 ? Math.max(0, Math.min(1, result.annualCostSavingNtd / result.baseline.costNtd)) : 0;
  const co2SavingFraction =
    result.baseline.co2Tons > 0 ? Math.max(0, Math.min(1, result.annualCo2SavingTons / result.baseline.co2Tons)) : 0;
  const roiFraction = result.roiYears !== null ? Math.max(0, Math.min(1, 1 - result.roiYears / 15)) : 0;

  const capexBreakdown = [
    { label: 'PV', kNtd: (input.pvKw * CAPEX.pvPerKw) / 1000 },
    { label: 'ESS', kNtd: (input.essKwh * CAPEX.essPerKwh) / 1000 },
    { label: 'EV chargers', kNtd: (input.evPorts * CAPEX.evChargerPerPort) / 1000 },
  ];

  return (
    <div className="p-5 space-y-5 max-w-[1600px] mx-auto">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-fg-subtle mb-1">What-if Simulator</div>
          <h1 className="text-xl font-semibold">5 拉桿 · 即時 12-month 模擬</h1>
          <div className="text-xs text-fg-muted mt-0.5">
            client-side 即時計算 · server-side debounced {DEBOUNCE_MS}ms 對齊真實值
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {serverLoading && (
            <span className="inline-flex items-center gap-1.5 text-warn">
              <Loader2 size={12} className="animate-spin" />
              syncing
            </span>
          )}
          {!serverLoading && serverResult && !serverError && (
            <span className="inline-flex items-center gap-1.5 text-success">
              <CheckCircle2 size={12} />
              server synced
            </span>
          )}
          {serverError && <span className="text-danger">server error</span>}
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
        <section className="rounded-lg border border-border bg-bg-elevated p-5 space-y-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-fg-muted">
            <Cog size={14} />
            五個拉桿
          </div>

          <SliderField
            label="PV 裝置量"
            unit="MW"
            value={input.pvKw}
            min={0}
            max={2000}
            step={50}
            formatter={(v) => (v / 1000).toFixed(2)}
            onChange={(pvKw) => setInput((prev) => ({ ...prev, pvKw }))}
          />

          <SliderField
            label="ESS 容量"
            unit="MWh"
            value={input.essKwh}
            min={0}
            max={4000}
            step={100}
            formatter={(v) => (v / 1000).toFixed(2)}
            onChange={(essKwh) => setInput((prev) => ({ ...prev, essKwh }))}
          />

          <SliderField
            label="EV 充電場規模"
            unit="DC fast ports"
            value={input.evPorts}
            min={0}
            max={20}
            step={1}
            onChange={(evPorts) => setInput((prev) => ({ ...prev, evPorts }))}
          />

          <div>
            <div className="text-sm text-fg mb-2">ToU 費率方案</div>
            <div className="grid grid-cols-3 gap-2">
              {TARIFF_OPTIONS.map((plan) => (
                <button
                  key={plan}
                  type="button"
                  onClick={() => setInput((prev) => ({ ...prev, tariffPlan: plan }))}
                  className={`text-xs px-2 py-2 rounded-md border transition ${
                    input.tariffPlan === plan
                      ? 'border-accent-soft bg-accent/10 text-accent-soft'
                      : 'border-border-soft bg-bg-soft text-fg-muted hover:text-fg'
                  }`}
                >
                  {plan}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm text-fg mb-2">ESS 充放策略</div>
            <div className="grid grid-cols-1 gap-2">
              {STRATEGY_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setInput((prev) => ({ ...prev, essStrategy: s.value }))}
                  className={`text-left text-xs px-3 py-2 rounded-md border transition ${
                    input.essStrategy === s.value
                      ? 'border-accent-soft bg-accent/10 text-accent-soft'
                      : 'border-border-soft bg-bg-soft text-fg-muted hover:text-fg'
                  }`}
                >
                  <div className="font-medium">{s.label}</div>
                  <div className="text-[10px] text-fg-subtle">{s.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-border-soft p-3 bg-bg-soft">
            <div className="text-xs uppercase tracking-wider text-fg-subtle mb-2">Capex 拆分</div>
            <div className="space-y-1 text-xs tabular-nums">
              {capexBreakdown.map((row) => (
                <div key={row.label} className="flex justify-between">
                  <span className="text-fg-muted">{row.label}</span>
                  <span className="text-fg">{row.kNtd.toLocaleString('en-US', { maximumFractionDigits: 0 })} kNT$</span>
                </div>
              ))}
              <div className="border-t border-border pt-1 mt-2 flex justify-between font-medium">
                <span className="text-fg">Total capex</span>
                <span className="text-accent-soft">
                  {(result.capexNtd / 1000).toLocaleString('en-US', { maximumFractionDigits: 0 })} kNT$
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className={`space-y-5 ${stale ? 'opacity-90' : ''}`}>
          <div className="grid grid-cols-3 gap-4">
            <RingGauge
              label="ROI 投資回收"
              value={result.roiYears ?? 0}
              unit="年 · payback"
              decimals={1}
              fraction={roiFraction}
              tone={result.roiYears !== null && result.roiYears < 8 ? 'positive' : 'neutral'}
              subLabel={
                result.roiYears === null
                  ? '無正向收益 → N/A'
                  : `capex ${(result.capexNtd / 1e6).toFixed(1)}M / 年省 ${(result.annualCostSavingNtd / 1e6).toFixed(1)}M`
              }
            />
            <RingGauge
              label="Δ 年化電費"
              value={result.annualCostSavingNtd / 1e6}
              unit="MNT$ / 年"
              decimals={2}
              prefix="−"
              fraction={costSavingFraction}
              tone={result.annualCostSavingNtd > 0 ? 'positive' : 'negative'}
              subLabel={`baseline ${(result.baseline.costNtd / 1e6).toFixed(1)}M → 模擬 ${(result.scenario.costNtd / 1e6).toFixed(1)}M`}
            />
            <RingGauge
              label="Δ 年化 CO₂"
              value={result.annualCo2SavingTons}
              unit="tCO₂e / 年"
              decimals={0}
              prefix="−"
              fraction={co2SavingFraction}
              tone={result.annualCo2SavingTons > 0 ? 'positive' : 'negative'}
              subLabel={`grid 排放係數 0.474 kgCO₂e/kWh (113 年度)`}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Stat label="自發自用率" value={`${(result.selfConsumptionRatio * 100).toFixed(1)}%`} />
            <Stat label="尖峰負載降低" value={`${result.peakReductionKw >= 0 ? '−' : '+'}${Math.abs(result.peakReductionKw).toLocaleString('en-US', { maximumFractionDigits: 0 })} kW`} tone={result.peakReductionKw >= 0 ? 'positive' : 'negative'} />
            <Stat
              label={result.roiYears !== null ? '20 年現金流' : 'ROI'}
              value={
                result.roiYears !== null
                  ? `+NT$ ${(((result.annualCostSavingNtd * CAPEX.systemLifetimeYears) - result.capexNtd) / 1e6).toFixed(1)}M`
                  : 'N/A'
              }
              tone={
                result.roiYears !== null && result.annualCostSavingNtd * CAPEX.systemLifetimeYears > result.capexNtd
                  ? 'positive'
                  : 'negative'
              }
            />
          </div>

          <PreviewChart series={result.series} baselinePeakKw={result.baseline.peakKw} />
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'positive' | 'negative' | 'neutral' }) {
  const toneClass =
    tone === 'positive' ? 'text-success' : tone === 'negative' ? 'text-danger' : 'text-fg';
  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-4">
      <div className="text-xs uppercase tracking-wider text-fg-muted">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}
