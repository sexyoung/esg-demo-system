import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ClipboardList, Wrench, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api, queryKeys } from '../../../api/client';
import { dashboardApi, dashboardKeys } from '../../../api/dashboard';
import { evaluateRules } from '../../../lib/recommendations';
import { AlertsPanel } from '../AlertsPanel';
import { SopCard } from './SopCard';
import { WorkOrderEntry } from './WorkOrderEntry';

interface Props {
  slug: string;
}

type DrawerKind = 'alerts' | 'sop' | 'wo';

const DRAWER_TITLE: Record<DrawerKind, string> = {
  alerts: '告警 · Active Alerts',
  sop: '現場操作 SOP',
  wo: '建立工單',
};

export function OperatorActions({ slug }: Props) {
  const [drawer, setDrawer] = useState<DrawerKind | null>(null);

  const alertsQuery = useQuery({
    queryKey: queryKeys.alerts(slug),
    queryFn: () => api.alerts(slug),
  });
  const kpiQuery = useQuery({
    queryKey: dashboardKeys.kpi(slug, '24h'),
    queryFn: () => dashboardApi.kpi(slug, '24h'),
  });
  const flowsQuery = useQuery({
    queryKey: dashboardKeys.flows(slug, '24h'),
    queryFn: () => dashboardApi.flows(slug, '24h'),
  });

  const alertsCount = alertsQuery.data?.length ?? 0;
  const sopCount = useMemo(
    () => evaluateRules({ slug, kpi: kpiQuery.data, flows: flowsQuery.data }).length,
    [slug, kpiQuery.data, flowsQuery.data],
  );

  // Esc closes drawer
  useEffect(() => {
    if (!drawer) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDrawer(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer]);

  return (
    <>
      <section className="rounded-lg border border-border bg-bg-elevated overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-border-soft">
          <ActionButton
            icon={<AlertTriangle size={16} />}
            label="告警"
            sublabel="Active Alerts"
            count={alertsCount}
            tone={alertsCount > 0 ? 'danger' : 'muted'}
            onClick={() => setDrawer('alerts')}
          />
          <ActionButton
            icon={<ClipboardList size={16} />}
            label="SOP"
            sublabel="現場操作"
            count={sopCount}
            tone={sopCount > 0 ? 'warn' : 'muted'}
            onClick={() => setDrawer('sop')}
          />
          <ActionButton
            icon={<Wrench size={16} />}
            label="工單"
            sublabel="Work Order"
            count={null}
            tone="accent"
            onClick={() => setDrawer('wo')}
          />
        </div>
      </section>

      {drawer && (
        <Drawer title={DRAWER_TITLE[drawer]} onClose={() => setDrawer(null)}>
          {drawer === 'alerts' && <AlertsPanel slug={slug} />}
          {drawer === 'sop' && <SopCard slug={slug} />}
          {drawer === 'wo' && <WorkOrderEntry slug={slug} />}
        </Drawer>
      )}
    </>
  );
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  count: number | null;
  tone: 'danger' | 'warn' | 'accent' | 'muted';
  onClick: () => void;
}

const TONE_CLASSES: Record<ActionButtonProps['tone'], { iconBg: string; badgeBg: string; badgeText: string }> = {
  danger: { iconBg: 'bg-danger/15 text-danger', badgeBg: 'bg-danger/20 border-danger/40', badgeText: 'text-danger' },
  warn: { iconBg: 'bg-warn/15 text-warn', badgeBg: 'bg-warn/20 border-warn/40', badgeText: 'text-warn' },
  accent: { iconBg: 'bg-accent/15 text-accent-soft', badgeBg: 'bg-accent/20 border-accent/40', badgeText: 'text-accent-soft' },
  muted: { iconBg: 'bg-bg-soft text-fg-muted', badgeBg: 'bg-bg-soft border-border-soft', badgeText: 'text-fg-muted' },
};

function ActionButton({ icon, label, sublabel, count, tone, onClick }: ActionButtonProps) {
  const t = TONE_CLASSES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-bg-soft/60 transition text-left min-w-0"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${t.iconBg}`}>
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-medium text-fg leading-tight truncate">{label}</div>
          <div className="text-[10px] text-fg-subtle leading-tight truncate">{sublabel}</div>
        </div>
      </div>
      {count !== null && (
        <span
          className={`inline-flex h-6 min-w-[24px] items-center justify-center rounded-full border px-1.5 text-xs font-semibold tabular-nums shrink-0 ${t.badgeBg} ${t.badgeText}`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function Drawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="關閉"
        onClick={onClose}
        className="absolute inset-0 bg-bg/80 backdrop-blur-sm"
      />
      <div className="relative z-10 w-full max-w-3xl mx-2 mb-2 lg:mx-auto rounded-lg border border-border bg-bg-elevated shadow-2xl flex flex-col max-h-[80vh] animate-[drawer-up_180ms_ease-out]">
        <header className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border-soft shrink-0">
          <h2 className="text-sm font-semibold tracking-wide">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted hover:text-fg hover:bg-bg-soft transition"
            aria-label="關閉"
          >
            <X size={16} />
          </button>
        </header>
        <div className="overflow-y-auto p-3">{children}</div>
      </div>
    </div>
  );
}
