export interface TenantSummary {
  id: string;
  slug: string;
  name: string;
  industry: string;
}

export interface TenantDetail extends TenantSummary {
  config: Record<string, unknown>;
  _count: { sites: number; assets: number; alerts: number };
}

export interface SiteRow {
  id: string;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  tenantSlug: string;
  tenantName: string;
  industry: string;
}

export interface AlertRow {
  id: string;
  tenantId: string;
  severity: 'CRITICAL' | 'WARN' | 'INFO';
  title: string;
  description: string;
  triggeredAt: string;
  resolved: boolean;
}

async function jsonFetch<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    const message = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${message}`);
  }
  return (await res.json()) as T;
}

export const api = {
  tenants: () => jsonFetch<TenantSummary[]>('/api/tenants'),
  tenant: (slug: string) => jsonFetch<TenantDetail>(`/api/tenants/${slug}`),
  sites: () => jsonFetch<SiteRow[]>('/api/sites'),
  alerts: (slug: string) => jsonFetch<AlertRow[]>(`/api/tenants/${slug}/alerts`),
};

export const queryKeys = {
  tenants: ['tenants'] as const,
  tenant: (slug: string) => ['tenant', slug] as const,
  sites: ['sites'] as const,
  alerts: (slug: string) => ['alerts', slug] as const,
};
