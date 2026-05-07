import { useQuery } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { api, queryKeys, type AlertRow } from '../../api/client';

interface Props {
  slug: string;
}

const SEVERITY_STYLES: Record<AlertRow['severity'], { Icon: typeof AlertCircle; tint: string; label: string }> = {
  CRITICAL: { Icon: AlertCircle, tint: 'text-danger border-danger/40 bg-danger/10', label: '嚴重' },
  WARN: { Icon: AlertTriangle, tint: 'text-warn border-warn/40 bg-warn/10', label: '警告' },
  INFO: { Icon: Info, tint: 'text-accent-soft border-accent/40 bg-accent/10', label: '資訊' },
};

export function AlertsPanel({ slug }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.alerts(slug),
    queryFn: () => api.alerts(slug),
    refetchInterval: 60_000,
  });

  return (
    <section className="rounded-lg border border-border bg-bg-elevated overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-soft">
        <div className="text-xs uppercase tracking-wider text-fg-muted">
          告警 <span className="text-fg-subtle normal-case tracking-normal">· {data?.length ?? 0} 條</span>
        </div>
        {isLoading && <span className="text-xs text-fg-subtle">…</span>}
      </div>
      <div className="divide-y divide-border-soft">
        {data?.length === 0 && (
          <div className="p-6 text-center text-fg-muted text-sm">目前沒有告警</div>
        )}
        {data?.map((alert) => {
          const style = SEVERITY_STYLES[alert.severity];
          const { Icon } = style;
          return (
            <div key={alert.id} className="p-3 flex items-start gap-3">
              <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${style.tint}`}>
                <Icon size={14} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-fg truncate">{alert.title}</h3>
                  <time className="text-xs text-fg-subtle tabular-nums shrink-0">
                    {relativeTime(alert.triggeredAt)}
                  </time>
                </div>
                <p className="text-xs text-fg-muted mt-0.5 leading-5">{alert.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return '剛剛';
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} 小時前`;
  return `${Math.round(hr / 24)} 天前`;
}
