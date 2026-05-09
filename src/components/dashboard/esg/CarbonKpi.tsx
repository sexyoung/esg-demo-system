import { useQuery } from '@tanstack/react-query';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { dashboardApi, dashboardKeys } from '../../../api/dashboard';
import { useCountUp } from '../../../lib/animateNumber';
import { WidgetError, WidgetSkeleton } from '../WidgetState';

interface Props {
  slug: string;
}

export function CarbonKpi({ slug }: Props) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: dashboardKeys.esgSummary(slug),
    queryFn: () => dashboardApi.esgSummary(slug),
  });

  if (error && !data) {
    return (
      <section className="rounded-lg border border-border bg-bg-elevated">
        <WidgetError message={String(error)} onRetry={() => void refetch()} />
      </section>
    );
  }
  if (isLoading || !data) {
    return <WidgetSkeleton variant="cards" height={180} />;
  }

  const { currentMonth, monthly } = data;
  const isReducing = currentMonth.deltaVsLastMonthPct < 0;

  return (
    <section className="rounded-lg border border-border bg-bg-elevated p-4 flex flex-col h-full">
      <div className="text-xs uppercase tracking-wider text-fg-muted">
        Carbon · 本月排放
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <BigNumber value={currentMonth.co2Tons} />
        <span className="text-sm text-fg-muted">tCO₂e</span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        <span
          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
            isReducing ? 'text-success bg-success/10' : 'text-danger bg-danger/10'
          }`}
        >
          {isReducing ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
          <span className="tabular-nums">
            {isReducing ? '−' : '+'}
            {Math.abs(currentMonth.deltaVsLastMonthPct).toFixed(1)}%
          </span>
        </span>
        <span className="text-fg-subtle">vs 上月</span>
      </div>
      <div className="mt-3 flex-1 min-h-[44px]">
        <Sparkline values={monthly.map((p) => p.co2Tons)} />
      </div>
      <div className="text-xs text-fg-subtle tabular-nums mt-1 flex justify-between">
        <span>{monthly[0]?.month}</span>
        <span>{monthly[monthly.length - 1]?.month}</span>
      </div>
    </section>
  );
}

function BigNumber({ value }: { value: number }) {
  const animated = useCountUp(value, 350);
  return (
    <span className="text-3xl font-semibold tabular-nums">
      {animated.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}
    </span>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const path = useMemo(() => buildSparkPath(values), [values]);
  if (values.length < 2) return null;
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="w-full h-full">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path.fill} fill="url(#spark-fill)" />
      <path d={path.line} fill="none" stroke="#34d399" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

function buildSparkPath(values: number[]): { line: string; fill: string } {
  if (values.length < 2) return { line: '', fill: '' };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = 100 / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = 30 - ((v - min) / range) * 28;
    return [x, y] as const;
  });
  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const fill = `${line} L100,32 L0,32 Z`;
  return { line, fill };
}
