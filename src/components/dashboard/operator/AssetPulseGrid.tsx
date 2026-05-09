import { useEffect, useMemo, useRef, useState } from 'react';

interface Props {
  slug: string;
}

type AssetType = 'PV' | 'ESS' | 'METER' | 'EV' | 'COOL' | 'HVAC' | 'LIGHT' | 'ELEV' | 'FAB' | 'CDA' | 'UTIL';
type Status = 'running' | 'idle' | 'fault';

interface AssetSpec {
  code: string;
  name: string;
  type: AssetType;
  unit: string;
  /** Base value for the metric. */
  base: number;
  /** Daily-cycle amplitude (fraction of base). */
  cycleAmp: number;
  /** Random jitter amplitude (fraction of base). */
  jitter: number;
  /** Phase offset in radians. */
  phase?: number;
  /** Probability of fault flicker per tick (0-1). */
  faultRate?: number;
  decimals?: number;
  /** Lower operational limit (alarm if value drops below). */
  low: number;
  /** Upper operational limit (alarm if value rises above). */
  high: number;
  /** Optional setpoint/reference line; defaults to base if omitted. */
  ref?: number;
}

const ASSET_POOL: Record<string, AssetSpec[]> = {
  acme: [
    { code: 'ACM-PV-1A', name: 'PV 陣列 1A', type: 'PV', unit: 'kW', base: 480, cycleAmp: 0.3, jitter: 0.05, low: 0, high: 720 },
    { code: 'ACM-PV-1B', name: 'PV 陣列 1B', type: 'PV', unit: 'kW', base: 460, cycleAmp: 0.3, jitter: 0.05, phase: 0.3, low: 0, high: 720 },
    { code: 'ACM-ESS-1', name: 'ESS Rack 1', type: 'ESS', unit: 'kW', base: 320, cycleAmp: 0.5, jitter: 0.08, low: 0, high: 500 },
    { code: 'ACM-ESS-2', name: 'ESS SoC', type: 'ESS', unit: '%', base: 62, cycleAmp: 0.2, jitter: 0.02, decimals: 0, low: 10, high: 95, ref: 50 },
    { code: 'ACM-MTR-1', name: '主電表', type: 'METER', unit: 'kW', base: 1240, cycleAmp: 0.15, jitter: 0.03, low: 800, high: 1500 },
    { code: 'ACM-EV-A1', name: 'EV 充電場 A1', type: 'EV', unit: 'kW', base: 84, cycleAmp: 0.4, jitter: 0.1, low: 0, high: 160 },
    { code: 'ACM-EV-A2', name: 'EV 充電場 A2', type: 'EV', unit: 'kW', base: 56, cycleAmp: 0.5, jitter: 0.1, low: 0, high: 160 },
    { code: 'ACM-COOL-1', name: '冷卻塔 #1', type: 'COOL', unit: '°C', base: 28, cycleAmp: 0.05, jitter: 0.02, decimals: 1, low: 22, high: 35, ref: 28 },
    { code: 'ACM-LD-1', name: '廠房負載 L1', type: 'METER', unit: 'kW', base: 760, cycleAmp: 0.12, jitter: 0.03, low: 500, high: 1000 },
    { code: 'ACM-LD-2', name: '廠房負載 L2', type: 'METER', unit: 'kW', base: 540, cycleAmp: 0.12, jitter: 0.04, faultRate: 0.005, low: 350, high: 750 },
    { code: 'ACM-AUX-1', name: '空調機房', type: 'HVAC', unit: 'kW', base: 180, cycleAmp: 0.08, jitter: 0.03, low: 100, high: 280 },
    { code: 'ACM-LIT-1', name: '照明回路', type: 'LIGHT', unit: 'kW', base: 42, cycleAmp: 0.2, jitter: 0.05, low: 10, high: 80 },
  ],
  beta: [
    { code: 'BET-HVAC-3F', name: 'HVAC 3F 主機', type: 'HVAC', unit: 'kW', base: 78, cycleAmp: 0.18, jitter: 0.04, low: 40, high: 120 },
    { code: 'BET-HVAC-5F', name: 'HVAC 5F 主機', type: 'HVAC', unit: 'kW', base: 82, cycleAmp: 0.18, jitter: 0.04, phase: 0.5, low: 40, high: 120 },
    { code: 'BET-HVAC-7F', name: 'HVAC 7F 主機', type: 'HVAC', unit: 'kW', base: 74, cycleAmp: 0.2, jitter: 0.05, phase: 1.1, low: 40, high: 120 },
    { code: 'BET-LIT-2F', name: '2F 照明', type: 'LIGHT', unit: 'kW', base: 34, cycleAmp: 0.4, jitter: 0.06, low: 5, high: 60 },
    { code: 'BET-LIT-LB', name: '大廳照明', type: 'LIGHT', unit: 'kW', base: 18, cycleAmp: 0.1, jitter: 0.03, low: 8, high: 30 },
    { code: 'BET-ELEV-A', name: '電梯 A', type: 'ELEV', unit: 'kW', base: 12, cycleAmp: 0.7, jitter: 0.2, low: 0, high: 35 },
    { code: 'BET-ELEV-B', name: '電梯 B', type: 'ELEV', unit: 'kW', base: 10, cycleAmp: 0.7, jitter: 0.2, phase: 1.5, low: 0, high: 35 },
    { code: 'BET-METER-G1', name: '主電表 G1', type: 'METER', unit: 'kW', base: 285, cycleAmp: 0.15, jitter: 0.03, low: 200, high: 380 },
    { code: 'BET-COOL-RM', name: '機房 #1', type: 'COOL', unit: '°C', base: 22, cycleAmp: 0.05, jitter: 0.02, decimals: 1, low: 18, high: 28, ref: 22 },
    { code: 'BET-PV-RT', name: '屋頂 PV', type: 'PV', unit: 'kW', base: 38, cycleAmp: 0.4, jitter: 0.06, low: 0, high: 70 },
    { code: 'BET-ATC-LB', name: 'Lobby AC', type: 'HVAC', unit: '°C', base: 24, cycleAmp: 0.04, jitter: 0.02, decimals: 1, low: 22, high: 27, ref: 24 },
    { code: 'BET-AUX-1', name: '電梯機房 AC', type: 'HVAC', unit: 'kW', base: 26, cycleAmp: 0.1, jitter: 0.03, faultRate: 0.004, low: 15, high: 40 },
  ],
  gamma: [
    { code: 'GAM-FAB-A1', name: 'Fab 12 蝕刻 A1', type: 'FAB', unit: 'kW', base: 540, cycleAmp: 0.08, jitter: 0.04, low: 420, high: 680 },
    { code: 'GAM-FAB-A2', name: 'Fab 12 黃光區', type: 'FAB', unit: 'kW', base: 720, cycleAmp: 0.08, jitter: 0.03, low: 600, high: 850 },
    { code: 'GAM-FAB-B1', name: 'Fab 5 CMP', type: 'FAB', unit: 'kW', base: 480, cycleAmp: 0.08, jitter: 0.04, low: 380, high: 600 },
    { code: 'GAM-FAB-B2', name: 'Fab 5 蝕刻 B2', type: 'FAB', unit: 'kW', base: 510, cycleAmp: 0.08, jitter: 0.04, phase: 0.7, low: 380, high: 600 },
    { code: 'GAM-CDA-1', name: 'CDA #1 壓力', type: 'CDA', unit: 'bar', base: 7.2, cycleAmp: 0.03, jitter: 0.01, decimals: 2, low: 6.8, high: 7.6, ref: 7.2 },
    { code: 'GAM-CDA-2', name: 'CDA #2 壓力', type: 'CDA', unit: 'bar', base: 7.1, cycleAmp: 0.03, jitter: 0.01, decimals: 2, low: 6.8, high: 7.6, ref: 7.2 },
    { code: 'GAM-COOL-1', name: '冰機 #1', type: 'COOL', unit: 'kW', base: 320, cycleAmp: 0.12, jitter: 0.03, low: 220, high: 450 },
    { code: 'GAM-COOL-2', name: '冰機 #2', type: 'COOL', unit: 'kW', base: 305, cycleAmp: 0.12, jitter: 0.03, phase: 0.4, faultRate: 0.003, low: 220, high: 450 },
    { code: 'GAM-UTI-N2', name: 'N₂ 供應', type: 'UTIL', unit: 'm³/h', base: 850, cycleAmp: 0.06, jitter: 0.02, low: 700, high: 1000 },
    { code: 'GAM-UTI-DI', name: 'DI Water', type: 'UTIL', unit: 'L/min', base: 620, cycleAmp: 0.07, jitter: 0.02, low: 500, high: 750 },
    { code: 'GAM-MTR-G1', name: 'Utility 主電表', type: 'METER', unit: 'kW', base: 1820, cycleAmp: 0.06, jitter: 0.02, low: 1500, high: 2100 },
    { code: 'GAM-MTR-G2', name: 'Fab 主電表', type: 'METER', unit: 'kW', base: 2480, cycleAmp: 0.05, jitter: 0.02, low: 2100, high: 2800 },
  ],
};

const TYPE_ACCENT: Record<AssetType, string> = {
  PV: 'text-warn',
  ESS: 'text-accent-soft',
  METER: 'text-fg-muted',
  EV: 'text-success',
  COOL: 'text-accent-soft',
  HVAC: 'text-accent-soft',
  LIGHT: 'text-warn',
  ELEV: 'text-fg-muted',
  FAB: 'text-success',
  CDA: 'text-fg-muted',
  UTIL: 'text-fg-muted',
};

const STATUS_PILL: Record<Status, { dot: string; text: string; label: string }> = {
  running: { dot: 'bg-success', text: 'text-success/90', label: 'running' },
  idle: { dot: 'bg-fg-subtle', text: 'text-fg-muted', label: 'idle' },
  fault: { dot: 'bg-danger', text: 'text-danger', label: 'fault' },
};

const HISTORY_LEN = 24;
const TICK_MS = 1500;
const SPARK_W = 100;
const SPARK_H = 24;

interface AssetState {
  spec: AssetSpec;
  history: number[];
  status: Status;
  startedAt: number;
}

export function AssetPulseGrid({ slug }: Props) {
  const pool = useMemo(() => ASSET_POOL[slug] ?? ASSET_POOL.acme, [slug]);
  const [tick, setTick] = useState(0);
  const stateRef = useRef<AssetState[]>([]);

  // Initialize state when pool changes
  useEffect(() => {
    stateRef.current = pool.map((spec) => ({
      spec,
      history: seedHistory(spec, HISTORY_LEN),
      status: 'running',
      startedAt: Date.now(),
    }));
    setTick((n) => n + 1);
  }, [pool]);

  // Single shared interval drives all cards
  useEffect(() => {
    const interval = setInterval(() => {
      const t = Date.now();
      for (const s of stateRef.current) {
        const next = nextValue(s.spec, t);
        s.history = [...s.history.slice(1), next];
        // Out-of-band → fault. Otherwise random flicker for fault-rate'd assets.
        if (next > s.spec.high || next < s.spec.low) {
          s.status = 'fault';
        } else if (s.spec.faultRate && Math.random() < s.spec.faultRate) {
          s.status = 'fault';
        } else if (s.status === 'fault' && Math.random() < 0.3) {
          s.status = 'running';
        }
      }
      setTick((n) => n + 1);
    }, TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const states = stateRef.current;

  return (
    <section className="rounded-lg border border-border bg-bg-elevated overflow-hidden">
      <header className="flex items-center justify-between px-4 py-2 border-b border-border-soft">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-fg-muted">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-success live-dot" />
          <span className="font-semibold tracking-wide">設備脈動 · Equipment Pulse</span>
        </div>
        <div className="text-[10px] text-fg-subtle tabular-nums">
          {states.length} assets · tick {TICK_MS} ms · last {HISTORY_LEN} samples
        </div>
      </header>
      <div className="p-3 grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {states.map((s) => (
          <AssetCard key={s.spec.code} state={s} tickKey={tick} />
        ))}
      </div>
    </section>
  );
}

function AssetCard({ state, tickKey }: { state: AssetState; tickKey: number }) {
  const { spec, history, status } = state;
  const value = history[history.length - 1] ?? spec.base;
  const prev = history[history.length - 2] ?? value;
  const delta = value - prev;
  const pill = STATUS_PILL[status];
  const accent = TYPE_ACCENT[spec.type];
  const decimals = spec.decimals ?? 1;

  return (
    <article
      className="rounded-md border border-border-soft bg-bg/40 p-2.5 flex flex-col gap-1.5"
      data-testid={`asset-${spec.code}`}
      // Subtle key so animations re-fire on tick (used by spark fade-in)
      data-tick={tickKey}
    >
      <header className="flex items-center justify-between gap-2 min-w-0">
        <div className="min-w-0">
          <div className="text-[10px] font-mono text-fg-subtle truncate">{spec.code}</div>
          <div className={`text-xs font-medium truncate ${accent}`}>{spec.name}</div>
        </div>
        <span className={`inline-flex items-center gap-1 text-[9px] uppercase tracking-wider ${pill.text}`}>
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${pill.dot} ${status === 'fault' ? 'live-dot' : ''}`} />
          {pill.label}
        </span>
      </header>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-base font-semibold tabular-nums">
          {formatNum(value, decimals)}
          <span className="text-[10px] text-fg-muted ml-1 font-normal">{spec.unit}</span>
        </span>
        <span
          className={`text-[10px] tabular-nums ${
            Math.abs(delta) < 0.001 ? 'text-fg-subtle' : delta >= 0 ? 'text-success' : 'text-danger'
          }`}
        >
          {delta >= 0 ? '+' : ''}
          {formatNum(delta, decimals)}
        </span>
      </div>
      <Sparkline values={history} status={status} spec={spec} />
    </article>
  );
}

function Sparkline({
  values,
  status,
  spec,
}: {
  values: number[];
  status: Status;
  spec: AssetSpec;
}) {
  const path = useMemo(() => buildSparkPath(values, spec.low, spec.high), [values, spec.low, spec.high]);
  if (values.length < 2) {
    return <div style={{ height: SPARK_H }} />;
  }
  const stroke = status === 'fault' ? '#f87171' : status === 'idle' ? '#5e6e8a' : '#34d399';
  const fillId = `pulse-fill-${spec.code}-${status}`;

  // Reference lines: high (top y=0.5px), low (bottom y=h-0.5px), ref (middle proportionally)
  const refValue = spec.ref ?? spec.base;
  const range = spec.high - spec.low;
  const refY = range > 0 ? SPARK_H - 0.5 - ((refValue - spec.low) / range) * (SPARK_H - 1) : SPARK_H / 2;

  return (
    <svg
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height: SPARK_H }}
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.3" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Upper limit (red dashed at top) */}
      <line
        x1={0}
        x2={SPARK_W}
        y1={0.5}
        y2={0.5}
        stroke="rgba(248, 113, 113, 0.45)"
        strokeWidth={0.7}
        strokeDasharray="2 2"
      />
      {/* Lower limit (red dashed at bottom) */}
      <line
        x1={0}
        x2={SPARK_W}
        y1={SPARK_H - 0.5}
        y2={SPARK_H - 0.5}
        stroke="rgba(248, 113, 113, 0.45)"
        strokeWidth={0.7}
        strokeDasharray="2 2"
      />
      {/* Reference / setpoint (gray dashed in middle) */}
      <line
        x1={0}
        x2={SPARK_W}
        y1={refY}
        y2={refY}
        stroke="rgba(147, 163, 191, 0.3)"
        strokeWidth={0.6}
        strokeDasharray="3 3"
      />
      <path d={path.fill} fill={`url(#${fillId})`} />
      <path d={path.line} fill="none" stroke={stroke} strokeWidth={1.4} strokeLinejoin="round" />
    </svg>
  );
}

function nextValue(spec: AssetSpec, t: number): number {
  // Slow daily-ish cycle (period ~120s for visible motion in demo) + jitter
  const period = 120_000; // ms
  const cycle = Math.sin((t / period) * Math.PI * 2 + (spec.phase ?? 0));
  const j = (Math.random() - 0.5) * 2;
  return spec.base * (1 + cycle * spec.cycleAmp + j * spec.jitter);
}

function seedHistory(spec: AssetSpec, n: number): number[] {
  const out: number[] = [];
  const now = Date.now();
  for (let i = n - 1; i >= 0; i--) {
    out.push(nextValue(spec, now - i * TICK_MS));
  }
  return out;
}

/** Sparkline path scaled to [low, high] band so the reference + limit lines
 *  stay at fixed positions regardless of the data window. Out-of-band values
 *  visibly clip into the top/bottom margin. */
function buildSparkPath(values: number[], low: number, high: number): { line: string; fill: string } {
  if (values.length < 2) return { line: '', fill: '' };
  const range = high - low || 1;
  const stepX = SPARK_W / (values.length - 1);
  const innerH = SPARK_H - 2; // 1px margin top/bottom for limit lines
  const points = values.map((v, i) => {
    const x = i * stepX;
    const clamped = Math.max(low - range * 0.05, Math.min(high + range * 0.05, v));
    const y = SPARK_H - 1 - ((clamped - low) / range) * innerH;
    return [x, y] as const;
  });
  const line = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
  const fill = `${line} L${SPARK_W},${SPARK_H} L0,${SPARK_H} Z`;
  return { line, fill };
}

function formatNum(n: number, decimals: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
