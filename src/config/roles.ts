import type { RoleId, RolePreset } from './types';

export const ROLES: Record<RoleId, RolePreset> = {
  'esg-manager': {
    id: 'esg-manager',
    name: 'ESG Manager / 永續長',
    shortName: 'ESG Manager',
    hero: 'target-vs-actual',
    layout: [
      { kind: 'full', widget: 'target-vs-actual' },
      { kind: 'split', left: 'carbon-kpi', right: 'renewable-ratio', ratio: '1:1' },
      { kind: 'split', left: 'bu-ranking', right: 'report-export', ratio: '1.6:1' },
    ],
    modules: ['dashboard', 'report', 'map'],
    defaultFilters: { dateRange: 'YTD', granularity: 'month', region: 'all', buId: 'all' },
    topBarExtras: ['region-bu-switcher', 'date-range-picker'],
    accent: 'green',
  },

  'plant-manager': {
    id: 'plant-manager',
    name: 'Facility / Plant Manager',
    shortName: 'Plant Manager',
    hero: 'live-tick',
    layout: [
      { kind: 'full', widget: 'live-tick' },
      { kind: 'full', widget: 'kpi-strip' },
      { kind: 'split', left: 'energy-flow', right: 'recommendation-card', ratio: '1.6:1' },
      { kind: 'split', left: 'energy-mix', right: 'active-alerts', ratio: '1.6:1' },
      { kind: 'full', widget: 'savings-compare' },
    ],
    modules: ['dashboard', 'simulator', 'asset', 'alert'],
    defaultFilters: { dateRange: 'today', granularity: 'minute' },
    accent: 'blue',
  },

  'site-operator': {
    id: 'site-operator',
    name: 'Site Operator / Engineer',
    shortName: 'Site Operator',
    hero: 'active-alerts',
    layout: [
      { kind: 'full', widget: 'active-alerts' },
      { kind: 'full', widget: 'equip-status' },
      { kind: 'split', left: 'realtime-trend', right: 'sop-card', ratio: '1.6:1' },
      { kind: 'full', widget: 'work-order-entry' },
    ],
    modules: ['dashboard', 'asset', 'alert'],
    defaultFilters: { dateRange: 'today', granularity: 'hour' },
    accent: 'orange',
  },

  admin: {
    id: 'admin',
    name: 'Admin / 顧問',
    shortName: 'Admin',
    hero: 'config-inspector',
    layout: [{ kind: 'full', widget: 'config-inspector' }],
    modules: ['dashboard'],
    defaultFilters: {},
    accent: 'gray',
  },
};

export const ROLE_ORDER: RoleId[] = ['plant-manager', 'esg-manager', 'site-operator', 'admin'];
