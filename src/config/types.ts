export type WidgetId =
  // ESG Manager pool
  | 'carbon-kpi'
  | 'renewable-ratio'
  | 'target-vs-actual'
  | 'bu-ranking'
  | 'report-export'
  // Plant Manager pool
  | 'live-tick'
  | 'kpi-strip'
  | 'energy-mix'
  | 'energy-flow'
  | 'recommendation-card'
  | 'savings-compare'
  | 'simulator-drawer'
  // Site Operator pool
  | 'active-alerts'
  | 'equip-status'
  | 'equipment-pulse'
  | 'production-line'
  | 'realtime-trend'
  | 'recent-events'
  | 'sop-card'
  | 'work-order-entry'
  // Admin pool
  | 'config-inspector'
  // Tenant-specific (carried over from prior design)
  | 'beta-eui-ranking'
  | 'oee-energy-dual-axis'
  | 'usage-by-floor';

export type RoleId = 'esg-manager' | 'plant-manager' | 'site-operator' | 'admin';

export type ModuleId = 'dashboard' | 'simulator' | 'asset' | 'alert' | 'report' | 'map';

export type Filters = {
  dateRange?: 'today' | '7d' | '30d' | 'YTD' | 'all';
  granularity?: 'minute' | 'hour' | 'day' | 'month';
  region?: string;
  buId?: string;
};

export type LayoutRow =
  | { kind: 'full'; widget: WidgetId }
  | { kind: 'split'; left: WidgetId; right: WidgetId; ratio?: '1.6:1' | '1:1' | '2:1' };

export type RolePreset = {
  id: RoleId;
  name: string;
  shortName: string;
  hero: WidgetId;
  layout: LayoutRow[];
  modules: ModuleId[];
  defaultFilters: Filters;
  topBarExtras?: ('region-bu-switcher' | 'date-range-picker')[];
  accent: 'blue' | 'green' | 'orange' | 'gray';
};

export type TenantConfig = {
  slug: string;
  name: string;
  industry: string;
  defaultRoleId: RoleId;
  roleOverrides?: Partial<Record<RoleId, { appendLayout?: LayoutRow[] }>>;
};
