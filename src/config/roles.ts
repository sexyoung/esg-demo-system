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
    // Compact iPad-friendly layout: live-tick + events stream split as hero,
    // production-line + equipment-pulse condensed strips, alerts/SOP/WO
    // tucked into a bottom action bar with slide-up drawers.
    hero: 'live-tick',
    layout: [
      // Landscape (lg+): live-tick + events as a 1.6:1 split, stretch row
      // absorbs all the extra vertical space. KPI strip is hidden here —
      // there's no room on iPad standard landscape (810h).
      { kind: 'split', left: 'live-tick', right: 'recent-events', ratio: '1.6:1', stretch: true, hideOn: 'portrait' },
      // Portrait (<lg): live-tick + events become two full-width rows —
      // live-tick stretches to absorb extra vertical room, events stays
      // natural height. KPI strip slots in between for visual rhythm.
      { kind: 'full', widget: 'live-tick', stretch: true, hideOn: 'landscape' },
      { kind: 'full', widget: 'recent-events', hideOn: 'landscape' },
      { kind: 'full', widget: 'kpi-strip', hideOn: 'landscape' },
      { kind: 'full', widget: 'production-line' },
      { kind: 'full', widget: 'equipment-pulse' },
      { kind: 'full', widget: 'operator-actions' },
    ],
    modules: ['dashboard', 'asset', 'alert'],
    defaultFilters: { dateRange: 'today', granularity: 'minute' },
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

// Field-out order: site-operator → plant-manager → esg-manager → admin.
// Mirrors the demo arc: floor reality first, then the levels above looking
// at the same data. (Demo default is still 'plant-manager' via store/role.ts
// so the Acme arc starts on the operational dashboard.)
export const ROLE_ORDER: RoleId[] = ['site-operator', 'plant-manager', 'esg-manager', 'admin'];
