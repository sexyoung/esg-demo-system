import { Boxes, ChevronRight, Database, Eye, ScrollText, Settings, ShieldCheck, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ROLES, ROLE_ORDER } from '../../../config/roles';
import { TENANT_CONFIGS } from '../../../config/tenants';
import type { RoleId, WidgetId } from '../../../config/types';
import { WIDGET_REGISTRY } from '../../../widgets/registry';

interface Props {
  slug: string;
}

interface AdminConcern {
  key: string;
  label: string;
  icon: typeof ShieldCheck;
  inspector: string;
}

const ADMIN_CONCERNS: AdminConcern[] = [
  {
    key: 'rbac',
    label: 'RBAC 設定',
    icon: ShieldCheck,
    inspector: 'roles[] config tree → 每 role 的 modules / defaultWidgets / topBarExtras',
  },
  {
    key: 'tenant',
    label: '多租戶隔離',
    icon: Boxes,
    inspector: 'tenants[] config 並排顯示 → roleOverrides 展開可見',
  },
  {
    key: 'integration',
    label: '整合第三方系統',
    icon: Database,
    inspector: 'Data Sources 節點：Modbus / OPC UA / API（demo 模式 read-only）',
  },
  {
    key: 'boundary',
    label: '計算邊界管理',
    icon: Settings,
    inspector: 'Constants 節點：SOC bound / RTE / efficiency / 公式版本',
  },
  {
    key: 'factor',
    label: '係數管理',
    icon: ScrollText,
    inspector: 'Constants 節點：0.474 kgCO₂e/kWh、ToU rates、capex 假設',
  },
];

// Admin Inspector renders previews using Acme as the data source so charts
// reflect realistic content. Tenant param of the wrapping page is ignored
// because Admin is a system-level view, not a tenant-scoped one.
const PREVIEW_TENANT_SLUG = 'acme';
const PREVIEW_ROLE_ID: RoleId = 'plant-manager';

export function ConfigInspector(_: Props) {
  const [selectedWidget, setSelectedWidget] = useState<WidgetId | null>(null);

  const widgetRows = useMemo(
    () =>
      (Object.keys(WIDGET_REGISTRY) as WidgetId[]).map((id) => {
        const def = WIDGET_REGISTRY[id];
        const usedBy = ROLE_ORDER.filter((roleId) => roleUsesWidget(roleId, id));
        const overrideTenants = Object.values(TENANT_CONFIGS)
          .filter((t) => Object.values(t.roleOverrides ?? {}).some((ov) => ov.appendLayout?.some((row) => layoutRowIncludes(row, id))))
          .map((t) => t.slug);
        // Heuristic for "live" vs "pending": pending widgets render via the
        // shared PendingWidget component which embeds "(Day" in label.
        const compName = def.Component.displayName ?? def.Component.name ?? '';
        const isLive = !compName.includes('Pending');
        return { id, title: def.title, usedBy, overrideTenants, isLive };
      }),
    [],
  );

  return (
    <section className="rounded-lg border border-border bg-bg-elevated overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border-soft">
        <div>
          <div className="text-xs uppercase tracking-wider text-fg-muted flex items-center gap-2">
            <Settings size={14} className="text-fg-muted" />
            Config Inspector
          </div>
          <div className="text-sm font-semibold mt-0.5">Self-documenting · 即時讀取系統 config</div>
        </div>
        <div className="text-[10px] text-fg-subtle text-right tabular-nums">
          {ROLE_ORDER.length} roles · {Object.keys(TENANT_CONFIGS).length} tenants ·{' '}
          {widgetRows.length} widgets
        </div>
      </header>

      <div className="grid lg:grid-cols-[1fr_1.4fr] divide-y lg:divide-y-0 lg:divide-x divide-border-soft">
        {/* LEFT: Roles + Tenants tree */}
        <div className="p-4 space-y-4">
          <Section title="Roles config" subtitle="src/config/roles.ts">
            <div className="space-y-1.5">
              {ROLE_ORDER.map((roleId) => (
                <RoleNode key={roleId} roleId={roleId} />
              ))}
            </div>
          </Section>

          <Section title="Tenants config" subtitle="src/config/tenants.ts">
            <div className="space-y-1.5">
              {Object.values(TENANT_CONFIGS).map((tenant) => (
                <TenantNode key={tenant.slug} tenant={tenant} />
              ))}
            </div>
          </Section>
        </div>

        {/* RIGHT: Widget registry + Admin concerns */}
        <div className="p-4 space-y-4">
          <Section title="Widget registry" subtitle="src/widgets/registry.tsx">
            <div className="rounded-md border border-border-soft overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-bg-soft text-fg-muted text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-2.5 py-1.5">id</th>
                    <th className="text-left px-2.5 py-1.5">title</th>
                    <th className="text-left px-2.5 py-1.5">used by</th>
                    <th className="text-right px-2.5 py-1.5">status</th>
                  </tr>
                </thead>
                <tbody>
                  {widgetRows.map((row) => {
                    const isSelected = selectedWidget === row.id;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedWidget(isSelected ? null : row.id)}
                        className={`border-t border-border-soft cursor-pointer transition ${
                          isSelected ? 'bg-accent/10' : 'hover:bg-bg-soft/50'
                        }`}
                      >
                        <td className="px-2.5 py-1.5 font-mono text-fg-muted">{row.id}</td>
                        <td className="px-2.5 py-1.5 text-fg">{row.title}</td>
                        <td className="px-2.5 py-1.5 text-fg-muted">
                          {row.usedBy.length === 0 && row.overrideTenants.length === 0 && (
                            <span className="text-fg-subtle">—</span>
                          )}
                          {row.usedBy.map((r) => (
                            <span key={r} className="inline-block mr-1 px-1.5 rounded bg-bg-soft border border-border-soft">
                              {ROLES[r].shortName}
                            </span>
                          ))}
                          {row.overrideTenants.map((t) => (
                            <span key={t} className="inline-block mr-1 px-1.5 rounded bg-warn/10 border border-warn/30 text-warn">
                              tenant:{t}
                            </span>
                          ))}
                        </td>
                        <td className="px-2.5 py-1.5 text-right">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${
                              row.isLive
                                ? 'bg-success/10 text-success border border-success/30'
                                : 'bg-warn/10 text-warn border border-warn/30'
                            }`}
                          >
                            {row.isLive ? 'live' : 'pending'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {selectedWidget && <LivePreviewPane widgetId={selectedWidget} onClose={() => setSelectedWidget(null)} />}
          </Section>

          <Section title="Admin concerns mapping" subtitle="docs/role.md → Config Inspector">
            <div className="space-y-1.5">
              {ADMIN_CONCERNS.map((c) => {
                const Icon = c.icon;
                return (
                  <div
                    key={c.key}
                    className="flex items-start gap-2.5 px-3 py-2 rounded-md border border-border-soft bg-bg/50"
                  >
                    <Icon size={14} className="text-fg-muted mt-0.5 shrink-0" />
                    <div className="text-xs flex-1">
                      <div className="font-semibold text-fg">{c.label}</div>
                      <div className="text-fg-muted mt-0.5">{c.inspector}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>
      </div>
    </section>
  );
}

function LivePreviewPane({ widgetId, onClose }: { widgetId: WidgetId; onClose: () => void }) {
  const def = WIDGET_REGISTRY[widgetId];
  if (!def) return null;
  const { Component } = def;
  const usedBy = ROLE_ORDER.filter((r) => roleUsesWidget(r, widgetId));

  return (
    <div className="mt-3 rounded-md border border-accent/40 bg-accent/5 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-accent/20 bg-accent/10">
        <div className="flex items-center gap-2 text-xs text-accent-soft">
          <Eye size={12} />
          <span className="uppercase tracking-wider font-semibold">Live Preview</span>
          <code className="font-mono text-fg-muted normal-case tracking-normal">{widgetId}</code>
          <span className="text-fg-subtle">·</span>
          <span className="text-fg-muted">{def.title}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-fg-subtle">
          <span>data: {PREVIEW_TENANT_SLUG}</span>
          {usedBy.length > 0 && (
            <span>· used by {usedBy.map((r) => ROLES[r].shortName).join(', ')}</span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded text-fg-muted hover:text-fg hover:bg-bg-soft transition"
            aria-label="關閉預覽"
          >
            <X size={12} />
          </button>
        </div>
      </div>
      <div className="p-3 bg-bg/40">
        <Component
          tenantSlug={PREVIEW_TENANT_SLUG}
          roleId={PREVIEW_ROLE_ID}
          filters={ROLES[PREVIEW_ROLE_ID].defaultFilters}
        />
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-xs uppercase tracking-wider text-fg-muted font-semibold">{title}</h3>
        <code className="text-[10px] text-fg-subtle font-mono">{subtitle}</code>
      </div>
      {children}
    </div>
  );
}

function RoleNode({ roleId }: { roleId: RoleId }) {
  const [open, setOpen] = useState(false);
  const role = ROLES[roleId];
  const widgetIds = role.layout.flatMap((row) =>
    row.kind === 'full' ? [row.widget] : [row.left, row.right],
  );

  return (
    <div className="rounded-md border border-border-soft bg-bg/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-bg-soft/50 transition"
      >
        <ChevronRight
          size={12}
          className={`text-fg-subtle transition ${open ? 'rotate-90' : ''}`}
        />
        <span className="font-mono text-accent-soft">{roleId}</span>
        <span className="text-fg-muted truncate">{role.name}</span>
        <span className="ml-auto text-[10px] text-fg-subtle tabular-nums shrink-0">
          {widgetIds.length} widgets · {role.modules.length} modules
        </span>
      </button>
      {open && (
        <div className="px-3 pb-2 pt-1 text-[11px] space-y-1 border-t border-border-soft">
          <KeyValue k="hero" v={role.hero} mono />
          <KeyValue k="modules" v={role.modules.join(', ')} mono />
          <KeyValue k="accent" v={role.accent} />
          <KeyValue k="defaultFilters" v={JSON.stringify(role.defaultFilters)} mono />
          {role.topBarExtras && (
            <KeyValue k="topBarExtras" v={role.topBarExtras.join(', ')} mono />
          )}
          <div className="text-fg-subtle mt-1.5">layout:</div>
          <div className="font-mono text-[10px] text-fg-muted pl-2 space-y-0.5">
            {role.layout.map((row, i) => (
              <div key={i}>
                {row.kind === 'full' ? `· ${row.widget}` : `· split (${row.ratio ?? '1:1'}): ${row.left} | ${row.right}`}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TenantNode({
  tenant,
}: {
  tenant: (typeof TENANT_CONFIGS)[keyof typeof TENANT_CONFIGS];
}) {
  const [open, setOpen] = useState(false);
  const overrideCount = Object.keys(tenant.roleOverrides ?? {}).length;

  return (
    <div className="rounded-md border border-border-soft bg-bg/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-bg-soft/50 transition"
      >
        <ChevronRight
          size={12}
          className={`text-fg-subtle transition ${open ? 'rotate-90' : ''}`}
        />
        <span className="font-mono text-accent-soft">{tenant.slug}</span>
        <span className="text-fg-muted truncate">{tenant.name}</span>
        <span className="ml-auto text-[10px] text-fg-subtle tabular-nums shrink-0">
          {overrideCount > 0 ? `${overrideCount} override` : 'standard'}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-2 pt-1 text-[11px] space-y-1 border-t border-border-soft">
          <KeyValue k="industry" v={tenant.industry} />
          <KeyValue k="defaultRoleId" v={tenant.defaultRoleId} mono />
          {tenant.roleOverrides &&
            Object.entries(tenant.roleOverrides).map(([roleId, override]) => (
              <div key={roleId}>
                <div className="text-fg-subtle mt-1">override · {roleId}:</div>
                <div className="font-mono text-[10px] text-warn pl-2">
                  {override.appendLayout?.map((row, i) => (
                    <div key={i}>
                      {row.kind === 'full'
                        ? `+ ${row.widget}`
                        : `+ split: ${row.left} | ${row.right}`}
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function KeyValue({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-fg-subtle min-w-[88px] shrink-0">{k}:</span>
      <span className={`text-fg-muted ${mono ? 'font-mono text-[10px]' : ''}`}>{v}</span>
    </div>
  );
}

function roleUsesWidget(roleId: RoleId, widgetId: WidgetId): boolean {
  return ROLES[roleId].layout.some((row) => layoutRowIncludes(row, widgetId));
}

function layoutRowIncludes(
  row: ReturnType<typeof JSON.parse>,
  widgetId: WidgetId,
): boolean {
  if (row.kind === 'full') return row.widget === widgetId;
  if (row.kind === 'split') return row.left === widgetId || row.right === widgetId;
  return false;
}
