import { useQuery } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, queryKeys, type AlertRow } from '../api/client';
import { WidgetEmpty, WidgetError, WidgetSkeleton } from '../components/dashboard/WidgetState';

type SeverityFilter = AlertRow['severity'] | 'ALL';

const SEVERITY_META: Record<AlertRow['severity'], { Icon: typeof AlertCircle; label: string; tint: string; pill: string }> = {
  CRITICAL: { Icon: AlertCircle, label: '嚴重', tint: 'text-danger', pill: 'border-danger/40 bg-danger/10 text-danger' },
  WARN: { Icon: AlertTriangle, label: '警告', tint: 'text-warn', pill: 'border-warn/40 bg-warn/10 text-warn' },
  INFO: { Icon: Info, label: '資訊', tint: 'text-accent-soft', pill: 'border-accent/40 bg-accent/10 text-accent-soft' },
};

export function AlertsPage() {
  const { slug = 'acme' } = useParams<{ slug: string }>();
  const [filter, setFilter] = useState<SeverityFilter>('ALL');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.alerts(slug),
    queryFn: () => api.alerts(slug),
    refetchInterval: 60_000,
  });

  const counts = useMemo(() => {
    const out = { CRITICAL: 0, WARN: 0, INFO: 0, ALL: data?.length ?? 0 } as Record<SeverityFilter, number>;
    if (data) for (const a of data) out[a.severity] += 1;
    return out;
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const list = filter === 'ALL' ? data : data.filter((a) => a.severity === filter);
    return [...list].sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime());
  }, [data, filter]);

  return (
    <div className="p-5 space-y-5 max-w-[1600px] mx-auto">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-fg-subtle mb-1">Alerts Center</div>
          <h1 className="text-xl font-semibold">告警中心 · {data?.length ?? 0} 條</h1>
          <div className="text-xs text-fg-muted mt-0.5">按嚴重度篩選、依時間排序、最新在前</div>
        </div>
        <div className="flex gap-2">
          <FilterChip label={`全部 (${counts.ALL})`} active={filter === 'ALL'} onClick={() => setFilter('ALL')} tone="neutral" />
          <FilterChip label={`嚴重 (${counts.CRITICAL})`} active={filter === 'CRITICAL'} onClick={() => setFilter('CRITICAL')} tone="danger" />
          <FilterChip label={`警告 (${counts.WARN})`} active={filter === 'WARN'} onClick={() => setFilter('WARN')} tone="warn" />
          <FilterChip label={`資訊 (${counts.INFO})`} active={filter === 'INFO'} onClick={() => setFilter('INFO')} tone="accent" />
        </div>
      </header>

      <section className="rounded-lg border border-border bg-bg-elevated overflow-hidden">
        {error && !data ? (
          <WidgetError message={String(error)} onRetry={() => void refetch()} />
        ) : isLoading && !data ? (
          <WidgetSkeleton variant="list" />
        ) : filtered.length === 0 ? (
          <WidgetEmpty message="此篩選下沒有告警" hint={data && data.length > 0 ? '試試其他 severity' : '系統運轉正常'} />
        ) : (
          <ul className="divide-y divide-border-soft">
            {filtered.map((alert) => {
              const meta = SEVERITY_META[alert.severity];
              const { Icon } = meta;
              return (
                <li key={alert.id} className="p-4 flex gap-4 hover:bg-bg-soft/40 transition">
                  <span className={`shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-md border ${meta.pill}`}>
                    <Icon size={16} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${meta.pill}`}>
                          {meta.label}
                        </span>
                        <h3 className="text-sm font-semibold text-fg truncate">{alert.title}</h3>
                      </div>
                      <time className="text-xs text-fg-subtle tabular-nums shrink-0">
                        {formatTime(alert.triggeredAt)}
                      </time>
                    </div>
                    <p className="mt-1.5 text-xs text-fg-muted leading-6">{alert.description}</p>
                    {alert.resolved && (
                      <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-success">
                        <CheckCircle2 size={11} />
                        已解決
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  tone,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  tone: 'neutral' | 'danger' | 'warn' | 'accent';
}) {
  const activeClass =
    tone === 'danger'
      ? 'border-danger/40 bg-danger/10 text-danger'
      : tone === 'warn'
        ? 'border-warn/40 bg-warn/10 text-warn'
        : tone === 'accent'
          ? 'border-accent/40 bg-accent/10 text-accent-soft'
          : 'border-fg-muted/30 bg-bg-soft text-fg';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-md border transition tabular-nums ${
        active ? activeClass : 'border-border-soft bg-bg-soft text-fg-muted hover:text-fg'
      }`}
    >
      {label}
    </button>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return '剛剛';
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} 小時前`;
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}
