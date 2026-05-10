import { ArrowRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

interface Props {
  slug: string;
}

type StationStatus = 'running' | 'warn' | 'fault';
type Zone = 'safe' | 'warn' | 'fault';

/** Outer % of [low, high] that counts as the warn zone (cautionary). */
const WARN_MARGIN = 0.15;

function metricZone(m: Metric, value: number): Zone {
  if (m.low === undefined || m.high === undefined) return 'safe';
  if (value > m.high || value < m.low) return 'fault';
  const range = m.high - m.low;
  if (range <= 0) return 'safe';
  const warnLow = m.low + range * WARN_MARGIN;
  const warnHigh = m.high - range * WARN_MARGIN;
  if (value < warnLow || value > warnHigh) return 'warn';
  return 'safe';
}

function aggregateStationStatus(metrics: Metric[], values: number[]): StationStatus {
  let worst: StationStatus = 'running';
  for (let i = 0; i < metrics.length; i++) {
    const z = metricZone(metrics[i], values[i]);
    if (z === 'fault') return 'fault';
    if (z === 'warn') worst = 'warn';
  }
  return worst;
}

interface Metric {
  label: string;
  unit: string;
  base: number;
  jitter: number;
  cycleAmp?: number;
  decimals?: number;
  /** Lower threshold (warn if below). */
  low?: number;
  /** Upper threshold (warn if above). */
  high?: number;
  phase?: number;
}

interface Station {
  id: string;
  name: string;
  /** One-line role description shown under the title. */
  role: string;
  metrics: Metric[];
}

interface ProductionLine {
  title: string;
  subtitle: string;
  flowLabel: string;
  stations: Station[];
}

const PRODUCTION_LINES: Record<string, ProductionLine> = {
  acme: {
    title: '微電網能流主鏈',
    subtitle: 'ACM-01 PV → ESS → Grid 主迴路',
    flowLabel: 'DC ⇢ AC',
    stations: [
      {
        id: 'PV-1A',
        name: 'PV 陣列 1A',
        role: '光伏發電',
        metrics: [
          { label: '輸出功率', unit: 'kW', base: 480, jitter: 0.06, cycleAmp: 0.35, low: 0, high: 720, decimals: 0 },
          { label: '電池板溫', unit: '°C', base: 47, jitter: 0.04, cycleAmp: 0.18, decimals: 1, low: 25, high: 65 },
          { label: 'String 電流', unit: 'A', base: 12.4, jitter: 0.07, decimals: 1, low: 8, high: 16 },
        ],
      },
      {
        id: 'MPPT',
        name: 'MPPT 控制',
        role: '最大功率追蹤',
        metrics: [
          { label: 'DC Bus', unit: 'V', base: 750, jitter: 0.01, decimals: 0, low: 700, high: 800 },
          { label: '效率', unit: '%', base: 98.4, jitter: 0.005, decimals: 1, low: 96, high: 99.5 },
          { label: '機殼溫', unit: '°C', base: 38, jitter: 0.03, decimals: 1, low: 25, high: 55 },
        ],
      },
      {
        id: 'ESS-1',
        name: 'ESS Rack 1',
        role: '儲能 (LFP, 2 MWh)',
        metrics: [
          { label: 'SoC', unit: '%', base: 62, jitter: 0.02, cycleAmp: 0.1, decimals: 0, low: 10, high: 95 },
          { label: '充放電', unit: 'kW', base: 180, jitter: 0.08, cycleAmp: 0.5, phase: 1.2, decimals: 0, low: -500, high: 500 },
          { label: 'Cell 溫', unit: '°C', base: 31, jitter: 0.04, decimals: 1, low: 15, high: 38 },
        ],
      },
      {
        id: 'INV-1',
        name: 'Inverter',
        role: 'DC → AC 轉換',
        metrics: [
          { label: '輸出', unit: 'kW', base: 620, jitter: 0.05, cycleAmp: 0.18, decimals: 0, low: 0, high: 800 },
          { label: 'IGBT 溫', unit: '°C', base: 64, jitter: 0.04, cycleAmp: 0.16, decimals: 1, low: 30, high: 80 },
          { label: 'PF', unit: '', base: 0.98, jitter: 0.005, cycleAmp: 0.015, decimals: 3, low: 0.95, high: 1.0 },
        ],
      },
      {
        id: 'BUS-AC',
        name: 'AC 主匯流排',
        role: '380 V 三相',
        metrics: [
          { label: '電壓', unit: 'V', base: 380, jitter: 0.005, decimals: 0, low: 370, high: 390 },
          { label: '頻率', unit: 'Hz', base: 60.01, jitter: 0.001, decimals: 2, low: 59.5, high: 60.5 },
          { label: 'THD', unit: '%', base: 2.4, jitter: 0.1, decimals: 1, low: 0, high: 5 },
        ],
      },
      {
        id: 'GRID',
        name: '配電盤',
        role: '送往負載/電網',
        metrics: [
          { label: '送出', unit: 'kW', base: 1240, jitter: 0.04, cycleAmp: 0.1, decimals: 0, low: 800, high: 1500 },
          { label: '潮流', unit: '', base: 0, jitter: 0, decimals: 0 },
          { label: '功率因數', unit: '', base: 0.99, jitter: 0.001, decimals: 3, low: 0.95, high: 1.0 },
        ],
      },
    ],
  },
  beta: {
    title: '冰水主機系統',
    subtitle: 'BET 主大樓 HVAC 冷凍迴路',
    flowLabel: '冷媒 ⇢ 冷水',
    stations: [
      {
        id: 'CT-1',
        name: '冷卻塔 #1',
        role: '排熱',
        metrics: [
          { label: '出水溫', unit: '°C', base: 31.5, jitter: 0.04, decimals: 1, low: 28, high: 35 },
          { label: '進水溫', unit: '°C', base: 36.2, jitter: 0.04, decimals: 1, low: 32, high: 40 },
          { label: '風扇', unit: 'Hz', base: 48, jitter: 0.05, decimals: 0, low: 30, high: 60 },
        ],
      },
      {
        id: 'PUMP-CW',
        name: '冷卻水泵',
        role: 'CWP-1',
        metrics: [
          { label: '流量', unit: 'm³/h', base: 380, jitter: 0.04, decimals: 0, low: 300, high: 450 },
          { label: '揚程', unit: 'm', base: 28, jitter: 0.02, decimals: 1, low: 22, high: 35 },
          { label: '頻率', unit: 'Hz', base: 50, jitter: 0.01, decimals: 0, low: 40, high: 60 },
        ],
      },
      {
        id: 'CHILLER-A',
        name: '冰機 A',
        role: '螺桿式 800 RT',
        metrics: [
          { label: 'COP', unit: '', base: 5.8, jitter: 0.02, decimals: 2, low: 4.5, high: 6.5 },
          { label: '冷凍水出', unit: '°C', base: 7.0, jitter: 0.03, decimals: 1, low: 6, high: 9 },
          { label: '功率', unit: 'kW', base: 460, jitter: 0.04, decimals: 0, low: 380, high: 600 },
        ],
      },
      {
        id: 'PUMP-CHW',
        name: '冰水主泵',
        role: 'CHWP-1',
        metrics: [
          { label: '流量', unit: 'm³/h', base: 320, jitter: 0.04, decimals: 0, low: 250, high: 400 },
          { label: '揚程', unit: 'm', base: 32, jitter: 0.02, decimals: 1, low: 25, high: 40 },
          { label: 'ΔT', unit: '°C', base: 5.5, jitter: 0.04, decimals: 1, low: 4, high: 7 },
        ],
      },
      {
        id: 'AHU-3F',
        name: 'AHU 3F 機組',
        role: '送風單元',
        metrics: [
          { label: '送風溫', unit: '°C', base: 14.5, jitter: 0.03, decimals: 1, low: 12, high: 18 },
          { label: '送風量', unit: 'CMH', base: 18000, jitter: 0.04, decimals: 0, low: 14000, high: 22000 },
          { label: '風機', unit: 'Hz', base: 45, jitter: 0.02, decimals: 0, low: 30, high: 60 },
        ],
      },
      {
        id: 'ZONE-3F',
        name: '3F 室內',
        role: '末端使用',
        metrics: [
          { label: '室溫', unit: '°C', base: 24.2, jitter: 0.02, decimals: 1, low: 22, high: 27 },
          { label: '濕度', unit: '%', base: 56, jitter: 0.03, decimals: 0, low: 40, high: 65 },
          { label: 'CO₂', unit: 'ppm', base: 620, jitter: 0.06, decimals: 0, low: 400, high: 1000 },
        ],
      },
    ],
  },
  gamma: {
    title: 'Fab 12 蝕刻線',
    subtitle: 'GAM-01 ETCH-A1 製程鏈',
    flowLabel: '製程氣體 ⇢ 排氣',
    stations: [
      {
        id: 'GAS',
        name: '製程氣體供應',
        role: 'CF₄ / O₂ / Ar',
        metrics: [
          { label: 'CF₄ 流量', unit: 'sccm', base: 80, jitter: 0.02, decimals: 0, low: 60, high: 100 },
          { label: 'O₂ 流量', unit: 'sccm', base: 24, jitter: 0.03, decimals: 0, low: 18, high: 30 },
          { label: '管線溫', unit: '°C', base: 28, jitter: 0.02, decimals: 1, low: 22, high: 35 },
        ],
      },
      {
        id: 'CHAMBER',
        name: '製程腔體',
        role: 'Etch Chamber',
        metrics: [
          { label: '腔壓', unit: 'mTorr', base: 12.5, jitter: 0.04, decimals: 1, low: 10, high: 15 },
          { label: '基板溫', unit: '°C', base: 65, jitter: 0.03, decimals: 1, low: 50, high: 80 },
          { label: '電極溫', unit: '°C', base: 92, jitter: 0.03, decimals: 1, low: 70, high: 110 },
        ],
      },
      {
        id: 'PLASMA',
        name: 'Plasma Source',
        role: 'RF 13.56 MHz',
        metrics: [
          { label: 'RF 功率', unit: 'W', base: 1200, jitter: 0.02, decimals: 0, low: 1000, high: 1500 },
          { label: 'Bias', unit: 'V', base: 280, jitter: 0.03, decimals: 0, low: 220, high: 350 },
          { label: '反射功率', unit: 'W', base: 18, jitter: 0.1, decimals: 0, low: 0, high: 50 },
        ],
      },
      {
        id: 'WAFER',
        name: 'Wafer Stage',
        role: 'ESC 靜電卡盤',
        metrics: [
          { label: 'ESC 電壓', unit: 'V', base: 600, jitter: 0.01, decimals: 0, low: 550, high: 650 },
          { label: 'He 背壓', unit: 'Torr', base: 8.2, jitter: 0.02, decimals: 1, low: 7, high: 10 },
          { label: '蝕刻速率', unit: 'Å/min', base: 245, jitter: 0.03, decimals: 0, low: 200, high: 280 },
        ],
      },
      {
        id: 'EXHAUST',
        name: '排氣管路',
        role: 'Exhaust Line',
        metrics: [
          { label: '排氣溫', unit: '°C', base: 78, jitter: 0.04, decimals: 0, low: 60, high: 95 },
          { label: '管壓', unit: 'mTorr', base: 4.2, jitter: 0.03, decimals: 1, low: 3, high: 6 },
          { label: '尾氣 CO', unit: 'ppm', base: 42, jitter: 0.06, decimals: 0, low: 0, high: 80 },
        ],
      },
      {
        id: 'PUMP',
        name: '真空泵',
        role: '渦輪分子泵',
        metrics: [
          { label: '轉速', unit: 'krpm', base: 27.0, jitter: 0.005, decimals: 1, low: 25, high: 30 },
          { label: '泵體溫', unit: '°C', base: 58, jitter: 0.03, decimals: 0, low: 45, high: 75 },
          { label: '功耗', unit: 'kW', base: 4.6, jitter: 0.04, decimals: 1, low: 3, high: 7 },
        ],
      },
    ],
  },
};

const TICK_MS = 1500;

interface StationState {
  values: number[];
  status: StationStatus;
}

export function ProductionLineSchematic({ slug }: Props) {
  const line = useMemo(() => PRODUCTION_LINES[slug] ?? PRODUCTION_LINES.acme, [slug]);
  const [tick, setTick] = useState(0);
  const stateRef = useRef<StationState[]>([]);

  useEffect(() => {
    stateRef.current = line.stations.map((s) => ({
      values: s.metrics.map((m) => evalMetric(m, Date.now())),
      status: 'running',
    }));
    setTick((n) => n + 1);
  }, [line]);

  useEffect(() => {
    const interval = setInterval(() => {
      const t = Date.now();
      stateRef.current = stateRef.current.map((st, i) => {
        const station = line.stations[i];
        const values = station.metrics.map((m) => evalMetric(m, t));
        return { values, status: aggregateStationStatus(station.metrics, values) };
      });
      setTick((n) => n + 1);
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [line]);

  return (
    <section className="rounded-lg border border-border bg-bg-elevated overflow-hidden">
      <header className="flex items-center justify-between px-4 py-2 border-b border-border-soft">
        <div>
          <div className="text-xs uppercase tracking-wider text-fg-muted flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success live-dot" />
            <span className="font-semibold tracking-wide">產線即時監控 · {line.title}</span>
          </div>
          <div className="text-[10px] text-fg-subtle mt-0.5">{line.subtitle}</div>
        </div>
        <div className="text-[10px] text-fg-subtle tabular-nums flex items-center gap-1.5">
          <span className="text-fg-muted">{line.flowLabel}</span>
          <span className="inline-block px-1.5 rounded bg-bg-soft border border-border-soft">
            tick {TICK_MS}ms
          </span>
        </div>
      </header>
      <div
        className="px-3 py-3 flex items-stretch gap-1 overflow-x-auto"
        data-tick={tick}
      >
        {line.stations.map((station, i) => (
          <FragmentRow
            key={station.id}
            station={station}
            state={stateRef.current[i]}
            isLast={i === line.stations.length - 1}
          />
        ))}
      </div>
    </section>
  );
}

function FragmentRow({
  station,
  state,
  isLast,
}: {
  station: Station;
  state: StationState | undefined;
  isLast: boolean;
}) {
  return (
    <>
      <StationCard station={station} state={state} />
      {!isLast && <Connector />}
    </>
  );
}

function StationCard({ station, state }: { station: Station; state: StationState | undefined }) {
  const status = state?.status ?? 'running';
  const values = state?.values ?? station.metrics.map((m) => m.base);

  const borderClass =
    status === 'fault'
      ? 'border-danger/60 bg-danger/5'
      : status === 'warn'
        ? 'border-warn/60 bg-warn/5'
        : 'border-border-soft bg-bg/40';

  const dotClass =
    status === 'fault' ? 'bg-danger live-dot' : status === 'warn' ? 'bg-warn live-dot' : 'bg-success';

  // Compact mode: show only the first (primary) metric per station.
  // Full metric breakdown lives in the station detail drawer (future).
  const primary = station.metrics[0];
  const primaryValue = values[0];

  return (
    <article
      className={`flex-1 min-w-[110px] rounded-md border ${borderClass} p-2 flex flex-col gap-1`}
      title={`${station.name} · ${station.role}`}
    >
      <header className="flex items-start justify-between gap-1.5">
        <div className="min-w-0">
          <div className="text-[10px] font-mono text-fg-subtle truncate">{station.id}</div>
          <div className="text-xs font-medium text-fg truncate leading-tight">{station.name}</div>
        </div>
        <span className={`inline-block h-2 w-2 rounded-full mt-1 shrink-0 ${dotClass}`} />
      </header>
      {primary && <MetricRow metric={primary} value={primaryValue} />}
    </article>
  );
}

const ZONE_BAR: Record<Zone, string> = {
  safe: 'bg-success/85',
  warn: 'bg-warn',
  fault: 'bg-danger',
};

const ZONE_TEXT: Record<Zone, string> = {
  safe: 'text-fg',
  warn: 'text-warn',
  fault: 'text-danger',
};

function MetricRow({ metric, value }: { metric: Metric; value: number }) {
  const hasBand = metric.low !== undefined && metric.high !== undefined;
  const zone = metricZone(metric, value);

  let fillPct: number | null = null;
  let refMarkPct: number | null = null;
  let warnLowPct: number | null = null;
  let warnHighPct: number | null = null;
  if (hasBand) {
    const range = metric.high! - metric.low!;
    if (range > 0) {
      fillPct = Math.max(0, Math.min(1, (value - metric.low!) / range)) * 100;
      warnLowPct = WARN_MARGIN * 100;
      warnHighPct = (1 - WARN_MARGIN) * 100;
      if (metric.low! < 0 && metric.high! > 0) {
        refMarkPct = ((0 - metric.low!) / range) * 100;
      }
    }
  }

  return (
    <li className="space-y-0.5">
      <div className="flex items-baseline justify-between text-[11px] gap-2">
        <span className="text-fg-subtle truncate">{metric.label}</span>
        <span className={`tabular-nums font-medium shrink-0 ${ZONE_TEXT[zone]}`}>
          {formatNum(value, metric.decimals ?? 1)}
          <span className="text-[9px] text-fg-muted ml-0.5 font-normal">{metric.unit}</span>
        </span>
      </div>
      {fillPct !== null && (
        <div
          className="relative h-1 rounded-sm overflow-hidden"
          style={{
            // Track itself shows the 3 zones: amber margins + dark safe middle.
            background: warnLowPct !== null
              ? `linear-gradient(to right,
                  rgba(251, 191, 36, 0.45) 0%,
                  rgba(251, 191, 36, 0.45) ${warnLowPct}%,
                  rgba(24, 34, 56, 0.95) ${warnLowPct}%,
                  rgba(24, 34, 56, 0.95) ${warnHighPct}%,
                  rgba(251, 191, 36, 0.45) ${warnHighPct}%,
                  rgba(251, 191, 36, 0.45) 100%)`
              : undefined,
          }}
        >
          <div
            className={`h-full transition-all duration-500 relative ${ZONE_BAR[zone]}`}
            style={{ width: `${fillPct}%` }}
          />
          {refMarkPct !== null && (
            <div
              className="absolute top-[-1px] bottom-[-1px] w-px bg-fg-muted/70"
              style={{ left: `${refMarkPct}%` }}
            />
          )}
        </div>
      )}
    </li>
  );
}

function Connector() {
  return (
    <div className="flex items-center justify-center px-0.5 shrink-0 relative w-6 self-stretch">
      <ArrowRight size={14} className="text-accent-soft/60" />
      <span className="connector-flow absolute" />
    </div>
  );
}

function evalMetric(m: Metric, t: number): number {
  const period = 60_000;
  const cycle = m.cycleAmp ? Math.sin((t / period) * Math.PI * 2 + (m.phase ?? 0)) * m.cycleAmp : 0;
  const j = (Math.random() - 0.5) * 2 * m.jitter;
  return m.base * (1 + cycle + j);
}

function formatNum(n: number, decimals: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
