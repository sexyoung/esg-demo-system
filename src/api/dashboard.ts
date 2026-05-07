export interface KpiSnapshot {
  range: string;
  energyConsumedKwh: number;
  energyFromPvKwh: number;
  energyGridBuyKwh: number;
  co2Tons: number;
  costNtd: number;
  renewableRatio: number;
  peakLoadKw: number;
}

export interface MetricsResponse {
  range: string;
  metric: string;
  count: number;
  points: Array<{
    timestamp: string;
    assetId: string;
    assetName: string;
    assetType: string;
    siteId: string | null;
    value: number;
  }>;
}

export interface AssetRow {
  id: string;
  tenantId: string;
  siteId: string | null;
  parentId: string | null;
  type: string;
  name: string;
  metadata: Record<string, unknown>;
  site: { code: string; name: string } | null;
}

async function jsonFetch<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    const message = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${message}`);
  }
  return (await res.json()) as T;
}

export const dashboardApi = {
  kpi: (slug: string, range = '24h') => jsonFetch<KpiSnapshot>(`/api/tenants/${slug}/kpi?range=${range}`),
  metrics: (slug: string, range = '24h', metric = 'POWER') =>
    jsonFetch<MetricsResponse>(`/api/tenants/${slug}/metrics?range=${range}&metric=${metric}`),
  assets: (slug: string) => jsonFetch<AssetRow[]>(`/api/tenants/${slug}/assets`),
};

export const dashboardKeys = {
  kpi: (slug: string, range: string) => ['kpi', slug, range] as const,
  metrics: (slug: string, range: string, metric: string) => ['metrics', slug, range, metric] as const,
  assets: (slug: string) => ['assets', slug] as const,
};
