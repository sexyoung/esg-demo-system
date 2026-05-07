import { useQuery } from '@tanstack/react-query';
import { CircuitBoard, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { dashboardApi, dashboardKeys } from '../../api/dashboard';
import { evaluateRules, type Recommendation } from '../../lib/recommendations';

interface Props {
  slug: string;
}

const CONFIDENCE_LABEL: Record<Recommendation['confidence'], { label: string; tint: string }> = {
  high: { label: 'high', tint: 'text-success border-success/40' },
  medium: { label: 'medium', tint: 'text-warn border-warn/40' },
  low: { label: 'low', tint: 'text-fg-muted border-border-soft' },
};

export function RecommendationEngine({ slug }: Props) {
  const kpiQuery = useQuery({
    queryKey: dashboardKeys.kpi(slug, '24h'),
    queryFn: () => dashboardApi.kpi(slug, '24h'),
  });
  const flowsQuery = useQuery({
    queryKey: dashboardKeys.flows(slug, '24h'),
    queryFn: () => dashboardApi.flows(slug, '24h'),
  });

  const recs = useMemo(
    () => evaluateRules({ slug, kpi: kpiQuery.data, flows: flowsQuery.data }),
    [slug, kpiQuery.data, flowsQuery.data],
  );

  return (
    <section className="rounded-lg border border-accent/30 bg-gradient-to-br from-accent/5 to-bg-elevated overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-soft">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-fg-muted">
          <Sparkles size={14} className="text-accent-soft" />
          <span className="font-semibold tracking-wide">Recommendation Engine</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-fg-subtle">
          <CircuitBoard size={11} />
          Rule-based · LLM-ready
        </div>
      </div>
      <div className="divide-y divide-border-soft">
        {recs.length === 0 && (
          <div className="p-5 text-fg-muted text-sm">目前沒有觸發的建議</div>
        )}
        {recs.map((r) => {
          const c = CONFIDENCE_LABEL[r.confidence];
          return (
            <article key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-fg leading-snug">{r.title}</h3>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${c.tint} tabular-nums whitespace-nowrap`}>
                  {c.label}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-fg-muted leading-6">{r.detail}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="text-xs text-accent-soft tabular-nums">{r.impact}</div>
                <code className="text-[10px] text-fg-subtle font-mono">rule: {r.rule}</code>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
