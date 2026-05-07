import { useQuery } from '@tanstack/react-query';
import { Building2, Layers, Bell as BellIcon } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { api, queryKeys } from '../api/client';

export function DashboardPage() {
  const { slug = 'acme' } = useParams<{ slug: string }>();

  const tenantQuery = useQuery({ queryKey: queryKeys.tenant(slug), queryFn: () => api.tenant(slug) });

  if (tenantQuery.isLoading) {
    return <div className="p-8 text-fg-muted">載入 tenant…</div>;
  }
  if (tenantQuery.error || !tenantQuery.data) {
    return <div className="p-8 text-danger">無法載入 tenant：{String(tenantQuery.error)}</div>;
  }

  const tenant = tenantQuery.data;
  const config = tenant.config as { heroLabel?: string; modules?: string[] };

  return (
    <div className="p-6 space-y-6">
      <section>
        <div className="text-xs uppercase tracking-wider text-fg-subtle mb-1">Tenant</div>
        <h1 className="text-2xl font-semibold">{tenant.name}</h1>
        <div className="text-sm text-fg-muted mt-1">{config.heroLabel ?? tenant.industry}</div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <ScaffoldCard icon={<Building2 size={18} />} label="Sites" value={tenant._count.sites} />
        <ScaffoldCard icon={<Layers size={18} />} label="Assets" value={tenant._count.assets} />
        <ScaffoldCard icon={<BellIcon size={18} />} label="Active Alerts" value={tenant._count.alerts} />
      </section>

      <section className="rounded-lg border border-border bg-bg-elevated p-5">
        <div className="text-xs uppercase tracking-wider text-fg-subtle mb-2">Day 1 Shell</div>
        <p className="text-sm text-fg-muted leading-6">
          Day 1 只交付這層骨架：tenant switcher、router、API、SSE 已串好。Day 2 會把 KPI Strip、24h Energy Mix（Highcharts）、Asset Tree（D3）、Live Power Tick（uPlot）放進來。
        </p>
        {config.modules && (
          <div className="mt-4 flex flex-wrap gap-2">
            {config.modules.map((m) => (
              <span key={m} className="rounded-md border border-border-soft bg-bg-soft px-2 py-1 text-xs text-fg-muted">
                {m}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ScaffoldCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-4">
      <div className="flex items-center gap-2 text-fg-muted text-xs uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tabular-nums">{value.toLocaleString()}</div>
    </div>
  );
}
