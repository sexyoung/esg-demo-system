import { useQuery } from '@tanstack/react-query';
import { Activity, Coins, Leaf, Zap } from 'lucide-react';
import { dashboardApi, dashboardKeys, type KpiSnapshot } from '../../api/dashboard';
import { useCountUp } from '../../lib/animateNumber';

interface Props {
  slug: string;
}

export function KpiStrip({ slug }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: dashboardKeys.kpi(slug, '24h'),
    queryFn: () => dashboardApi.kpi(slug, '24h'),
    refetchInterval: 60_000,
  });

  if (error) {
    return (
      <div className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
        無法載入 KPI：{String(error)}
      </div>
    );
  }

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      <KpiCard
        icon={<Zap size={16} />}
        label="今日總用電"
        value={data?.energyConsumedKwh ?? 0}
        unit="kWh"
        tone="accent"
        loading={isLoading}
        decimals={0}
      />
      <KpiCard
        icon={<Leaf size={16} />}
        label="碳排放"
        value={data?.co2Tons ?? 0}
        unit="tCO₂e"
        tone="success"
        loading={isLoading}
        decimals={1}
      />
      <KpiCard
        icon={<Coins size={16} />}
        label="電費"
        value={data?.costNtd ?? 0}
        unit="NT$"
        tone="warn"
        loading={isLoading}
        prefix="$"
        decimals={0}
      />
      <KpiCard
        icon={<Activity size={16} />}
        label={renewableLabel(data)}
        value={renewableValue(data)}
        unit={renewableUnit(data)}
        tone="accent"
        loading={isLoading}
        decimals={1}
      />
    </div>
  );
}

function renewableLabel(data: KpiSnapshot | undefined): string {
  if (!data) return '再生能源占比';
  if (data.energyFromPvKwh > 0) return '再生能源占比';
  return '尖峰負載';
}

function renewableValue(data: KpiSnapshot | undefined): number {
  if (!data) return 0;
  if (data.energyFromPvKwh > 0) return data.renewableRatio * 100;
  return data.peakLoadKw;
}

function renewableUnit(data: KpiSnapshot | undefined): string {
  if (!data) return '%';
  if (data.energyFromPvKwh > 0) return '%';
  return 'kW';
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  tone: 'accent' | 'success' | 'warn' | 'danger';
  loading?: boolean;
  decimals?: number;
  prefix?: string;
}

function KpiCard({ icon, label, value, unit, tone, loading, decimals = 1, prefix = '' }: KpiCardProps) {
  const animated = useCountUp(value, 250);
  const toneClass =
    tone === 'success'
      ? 'border-success/30 bg-success/5'
      : tone === 'warn'
        ? 'border-warn/30 bg-warn/5'
        : tone === 'danger'
          ? 'border-danger/30 bg-danger/5'
          : 'border-accent/30 bg-accent/5';
  const iconClass =
    tone === 'success' ? 'text-success' : tone === 'warn' ? 'text-warn' : tone === 'danger' ? 'text-danger' : 'text-accent-soft';

  return (
    <div className={`rounded-lg border ${toneClass} p-4`}>
      <div className="flex items-center justify-between text-xs uppercase tracking-wider text-fg-muted">
        <span className="flex items-center gap-2">
          <span className={iconClass}>{icon}</span>
          {label}
        </span>
        {loading && <span className="text-fg-subtle">…</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums">
          {prefix}
          {formatNumber(animated, decimals)}
        </span>
        <span className="text-xs text-fg-muted">{unit}</span>
      </div>
    </div>
  );
}

function formatNumber(n: number, decimals: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
