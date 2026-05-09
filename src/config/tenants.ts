import type { TenantConfig } from './types';

// Static dashboard config for each tenant.
// Note: live tenant data (name/industry counts) still comes from the API.
// This file only describes role defaults and tenant-specific layout overrides.
export const TENANT_CONFIGS: Record<string, TenantConfig> = {
  acme: {
    slug: 'acme',
    name: 'Acme 微電網園區',
    industry: 'microgrid',
    defaultRoleId: 'plant-manager',
  },

  beta: {
    slug: 'beta',
    name: 'Beta 商業大樓',
    industry: 'commercial-building',
    defaultRoleId: 'plant-manager',
    roleOverrides: {
      'plant-manager': {
        appendLayout: [{ kind: 'full', widget: 'beta-eui-ranking' }],
      },
    },
  },

  gamma: {
    slug: 'gamma',
    name: 'Gamma 半導體廠',
    industry: 'fab',
    defaultRoleId: 'plant-manager',
    roleOverrides: {
      'plant-manager': {
        appendLayout: [{ kind: 'full', widget: 'oee-energy-dual-axis' }],
      },
    },
  },
};

export function getTenantConfig(slug: string): TenantConfig | undefined {
  return TENANT_CONFIGS[slug];
}
