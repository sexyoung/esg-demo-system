import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ClipboardList, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';
import { dashboardApi, dashboardKeys } from '../../../api/dashboard';
import { evaluateRules, type Recommendation } from '../../../lib/recommendations';

interface Props {
  slug: string;
}

const SEVERITY_TINT: Record<Recommendation['confidence'], string> = {
  high: 'border-danger/50 bg-danger/5 text-danger',
  medium: 'border-warn/50 bg-warn/5 text-warn',
  low: 'border-fg-subtle/40 bg-bg-soft text-fg-muted',
};

const SEVERITY_LABEL: Record<Recommendation['confidence'], string> = {
  high: '即時處置',
  medium: '建議檢查',
  low: '排程巡檢',
};

export function SopCard({ slug }: Props) {
  const kpiQuery = useQuery({
    queryKey: dashboardKeys.kpi(slug, '24h'),
    queryFn: () => dashboardApi.kpi(slug, '24h'),
  });
  const flowsQuery = useQuery({
    queryKey: dashboardKeys.flows(slug, '24h'),
    queryFn: () => dashboardApi.flows(slug, '24h'),
  });

  const sops = useMemo(
    () => evaluateRules({ slug, kpi: kpiQuery.data, flows: flowsQuery.data }),
    [slug, kpiQuery.data, flowsQuery.data],
  );

  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());

  function ack(id: string) {
    setAcknowledged((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  return (
    <section className="rounded-lg border border-warn/30 bg-gradient-to-br from-warn/5 to-bg-elevated overflow-hidden">
      <header className="flex items-center justify-between px-4 py-2 border-b border-border-soft">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-fg-muted">
          <ClipboardList size={14} className="text-warn" />
          <span className="font-semibold tracking-wide">現場操作 SOP</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-fg-subtle tabular-nums">
          {sops.length - acknowledged.size} 待處理 · {acknowledged.size} 已確認
        </div>
      </header>
      <div className="divide-y divide-border-soft">
        {sops.length === 0 && (
          <div className="p-5 text-fg-muted text-sm">目前沒有待處理的 SOP</div>
        )}
        {sops.map((r) => {
          const tint = SEVERITY_TINT[r.confidence];
          const isAck = acknowledged.has(r.id);
          return (
            <article key={r.id} className={`p-4 transition ${isAck ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Wrench size={14} className="text-fg-muted mt-0.5 shrink-0" />
                  <h3 className="text-sm font-semibold text-fg leading-snug">{r.title}</h3>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded border ${tint} whitespace-nowrap`}>
                  {SEVERITY_LABEL[r.confidence]}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-fg-muted leading-6 pl-6">{r.detail}</p>
              <div className="mt-2 pl-6 flex items-center justify-between gap-2">
                <div className="text-xs text-accent-soft tabular-nums">{r.impact}</div>
                <button
                  type="button"
                  onClick={() => ack(r.id)}
                  disabled={isAck}
                  className={`text-[11px] px-2 py-1 rounded border transition inline-flex items-center gap-1 ${
                    isAck
                      ? 'border-success/30 bg-success/10 text-success cursor-default'
                      : 'border-border hover:border-accent text-fg-muted hover:text-fg'
                  }`}
                >
                  <CheckCircle2 size={11} />
                  {isAck ? '已確認' : '確認執行'}
                </button>
              </div>
              <div className="mt-1 pl-6 text-[10px] text-fg-subtle font-mono">SOP ref: {r.rule}</div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
