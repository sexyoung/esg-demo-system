import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { api, queryKeys } from '../api/client';
import { AlertsPanel } from '../components/dashboard/AlertsPanel';
import { AssetTree } from '../components/dashboard/AssetTree';
import { BetaEuiRanking } from '../components/dashboard/BetaEuiRanking';
import { EnergyMixChart } from '../components/dashboard/EnergyMixChart';
import { GammaOeeDual } from '../components/dashboard/GammaOeeDual';
import { KpiStrip } from '../components/dashboard/KpiStrip';
import { LivePowerTick } from '../components/dashboard/LivePowerTick';
import { RecommendationEngine } from '../components/dashboard/RecommendationEngine';
import { SankeyChart } from '../components/dashboard/SankeyChart';

export function DashboardPage() {
  const { slug = 'acme' } = useParams<{ slug: string }>();

  const tenantQuery = useQuery({
    queryKey: queryKeys.tenant(slug),
    queryFn: () => api.tenant(slug),
  });

  if (tenantQuery.isLoading) {
    return <div className="p-8 text-fg-muted">載入 tenant…</div>;
  }
  if (tenantQuery.error || !tenantQuery.data) {
    return <div className="p-8 text-danger">無法載入 tenant：{String(tenantQuery.error)}</div>;
  }

  const tenant = tenantQuery.data;
  const config = tenant.config as { heroLabel?: string };

  return (
    <div className="p-5 space-y-5 max-w-[1600px] mx-auto">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-fg-subtle mb-1">Tenant</div>
          <h1 className="text-xl font-semibold">{tenant.name}</h1>
          <div className="text-xs text-fg-muted mt-0.5">{config.heroLabel ?? tenant.industry}</div>
        </div>
        <div className="flex gap-3 text-xs text-fg-muted">
          <Stat label="Sites" value={tenant._count.sites} />
          <Stat label="Assets" value={tenant._count.assets} />
          <Stat label="Alerts" value={tenant._count.alerts} />
        </div>
      </header>

      <LivePowerTick slug={slug} />

      <KpiStrip slug={slug} />

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <TenantHeroWidget slug={slug} />
        <RecommendationEngine slug={slug} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <EnergyMixChart slug={slug} />
        <AlertsPanel slug={slug} />
      </div>

      <AssetTree slug={slug} />
    </div>
  );
}

function TenantHeroWidget({ slug }: { slug: string }) {
  if (slug === 'acme') return <SankeyChart slug={slug} />;
  if (slug === 'beta') return <BetaEuiRanking slug={slug} />;
  if (slug === 'gamma') return <GammaOeeDual slug={slug} />;
  return <SankeyChart slug={slug} />;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border-soft bg-bg-soft px-3 py-1.5">
      <span className="text-fg-subtle">{label}</span>
      <span className="ml-2 tabular-nums text-fg">{value}</span>
    </div>
  );
}
