import type { WidgetId } from '../config/types';
import { AlertsPanel } from '../components/dashboard/AlertsPanel';
import { AssetTree } from '../components/dashboard/AssetTree';
import { BetaEuiRanking } from '../components/dashboard/BetaEuiRanking';
import { EnergyMixChart } from '../components/dashboard/EnergyMixChart';
import { GammaOeeDual } from '../components/dashboard/GammaOeeDual';
import { KpiStrip } from '../components/dashboard/KpiStrip';
import { LivePowerTick } from '../components/dashboard/LivePowerTick';
import { RecommendationEngine } from '../components/dashboard/RecommendationEngine';
import { SankeyChart } from '../components/dashboard/SankeyChart';
import { WidgetEmpty } from '../components/dashboard/WidgetState';
import { BuRanking } from '../components/dashboard/esg/BuRanking';
import { CarbonKpi } from '../components/dashboard/esg/CarbonKpi';
import { RenewableRatio } from '../components/dashboard/esg/RenewableRatio';
import { ReportExport } from '../components/dashboard/esg/ReportExport';
import { TargetVsActual } from '../components/dashboard/esg/TargetVsActual';
import { AssetPulseGrid } from '../components/dashboard/operator/AssetPulseGrid';
import { ProductionLineSchematic } from '../components/dashboard/operator/ProductionLineSchematic';
import { RecentEventsStream } from '../components/dashboard/operator/RecentEventsStream';
import { SopCard } from '../components/dashboard/operator/SopCard';
import { WorkOrderEntry } from '../components/dashboard/operator/WorkOrderEntry';
import { ConfigInspector } from '../components/dashboard/admin/ConfigInspector';
import type { WidgetDefinition, WidgetProps } from './types';

// Placeholder for widgets to be built Day 4-5.
function PendingWidget({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-bg-soft/50 p-6">
      <WidgetEmpty
        message={`${label} (Day 4-5 待補)`}
        hint="此 widget 已在 role config 註冊，元件實作待完成"
      />
    </div>
  );
}

// Existing widgets: thin wrappers that adapt WidgetProps -> { slug }
const wrap = (
  Comp: React.ComponentType<{ slug: string }>,
): React.ComponentType<WidgetProps> =>
  function WrappedWidget({ tenantSlug }: WidgetProps) {
    return <Comp slug={tenantSlug} />;
  };

const pending = (label: string): React.ComponentType<WidgetProps> =>
  function PendingWrapped() {
    return <PendingWidget label={label} />;
  };

export const WIDGET_REGISTRY: Record<WidgetId, WidgetDefinition> = {
  // Plant Manager pool — existing
  'live-tick': { id: 'live-tick', title: 'Live Power Tick', Component: wrap(LivePowerTick) },
  'kpi-strip': { id: 'kpi-strip', title: 'KPI Strip', Component: wrap(KpiStrip) },
  'energy-mix': { id: 'energy-mix', title: 'Energy Mix', Component: wrap(EnergyMixChart) },
  'energy-flow': { id: 'energy-flow', title: 'Energy Flow (Sankey)', Component: wrap(SankeyChart) },
  'recommendation-card': {
    id: 'recommendation-card',
    title: 'Recommendation',
    Component: wrap(RecommendationEngine),
  },
  // Plant Manager pool — Day 4
  'savings-compare': {
    id: 'savings-compare',
    title: 'Savings Before / After',
    Component: pending('Savings Compare'),
  },
  'simulator-drawer': {
    id: 'simulator-drawer',
    title: 'What-if Simulator',
    Component: pending('Simulator Drawer (existing /simulator page)'),
  },

  // ESG Manager pool — Day 4 (live)
  'carbon-kpi': { id: 'carbon-kpi', title: 'Carbon KPI', Component: wrap(CarbonKpi) },
  'renewable-ratio': {
    id: 'renewable-ratio',
    title: 'Renewable Ratio',
    Component: wrap(RenewableRatio),
  },
  'target-vs-actual': {
    id: 'target-vs-actual',
    title: 'Target vs Actual',
    Component: wrap(TargetVsActual),
  },
  'bu-ranking': { id: 'bu-ranking', title: 'BU Ranking', Component: wrap(BuRanking) },
  'report-export': {
    id: 'report-export',
    title: 'Report Export',
    Component: wrap(ReportExport),
  },

  // Site Operator pool — partly existing, partly Day 5
  'active-alerts': { id: 'active-alerts', title: 'Active Alerts', Component: wrap(AlertsPanel) },
  'equip-status': {
    id: 'equip-status',
    title: 'Equipment Status (Tree)',
    Component: wrap(AssetTree),
  },
  'equipment-pulse': {
    id: 'equipment-pulse',
    title: 'Equipment Pulse',
    Component: wrap(AssetPulseGrid),
  },
  'production-line': {
    id: 'production-line',
    title: 'Production Line',
    Component: wrap(ProductionLineSchematic),
  },
  'realtime-trend': {
    id: 'realtime-trend',
    title: 'Realtime Trend',
    Component: wrap(LivePowerTick),
  },
  'recent-events': {
    id: 'recent-events',
    title: 'Recent Events Stream',
    Component: wrap(RecentEventsStream),
  },
  'sop-card': {
    id: 'sop-card',
    title: 'SOP Action',
    Component: wrap(SopCard),
  },
  'work-order-entry': {
    id: 'work-order-entry',
    title: 'Work Order',
    Component: wrap(WorkOrderEntry),
  },

  // Admin pool — Day 5 (live)
  'config-inspector': {
    id: 'config-inspector',
    title: 'Config Inspector',
    Component: wrap(ConfigInspector),
  },

  // Tenant-specific — existing
  'beta-eui-ranking': {
    id: 'beta-eui-ranking',
    title: 'EUI Ranking (Beta)',
    Component: wrap(BetaEuiRanking),
  },
  'oee-energy-dual-axis': {
    id: 'oee-energy-dual-axis',
    title: 'OEE × Energy (Gamma)',
    Component: wrap(GammaOeeDual),
  },
  'usage-by-floor': {
    id: 'usage-by-floor',
    title: 'Usage by Floor (Beta)',
    Component: pending('Usage by Floor — placeholder until Day 5'),
  },
};

export function getWidget(id: WidgetId): WidgetDefinition {
  return WIDGET_REGISTRY[id];
}
