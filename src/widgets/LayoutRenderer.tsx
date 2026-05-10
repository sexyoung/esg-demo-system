import type { Filters, LayoutRow, RoleId, WidgetId } from '../config/types';
import { getWidget } from './registry';

interface LayoutRendererProps {
  layout: LayoutRow[];
  tenantSlug: string;
  roleId: RoleId;
  filters: Filters;
}

const SPLIT_RATIO_CLASS: Record<NonNullable<Extract<LayoutRow, { kind: 'split' }>['ratio']>, string> = {
  '1.6:1': 'lg:grid-cols-[1.6fr_1fr]',
  '1:1': 'lg:grid-cols-2',
  '2:1': 'lg:grid-cols-[2fr_1fr]',
};

export function LayoutRenderer({ layout, tenantSlug, roleId, filters }: LayoutRendererProps) {
  return (
    <div className="space-y-3 xl:space-y-5" key={roleId}>
      {layout.map((row, idx) => (
        <div
          key={`${roleId}-${idx}`}
          className="role-row-mount"
          style={{ animationDelay: `${idx * 30}ms` }}
        >
          <LayoutRowView
            row={row}
            tenantSlug={tenantSlug}
            roleId={roleId}
            filters={filters}
          />
        </div>
      ))}
    </div>
  );
}

function LayoutRowView({
  row,
  tenantSlug,
  roleId,
  filters,
}: {
  row: LayoutRow;
  tenantSlug: string;
  roleId: RoleId;
  filters: Filters;
}) {
  if (row.kind === 'full') {
    return <RenderWidget id={row.widget} tenantSlug={tenantSlug} roleId={roleId} filters={filters} />;
  }
  const ratioClass = SPLIT_RATIO_CLASS[row.ratio ?? '1:1'];
  return (
    <div className={`grid gap-3 xl:gap-5 ${ratioClass}`}>
      <RenderWidget id={row.left} tenantSlug={tenantSlug} roleId={roleId} filters={filters} />
      <RenderWidget id={row.right} tenantSlug={tenantSlug} roleId={roleId} filters={filters} />
    </div>
  );
}

function RenderWidget({
  id,
  tenantSlug,
  roleId,
  filters,
}: {
  id: WidgetId;
  tenantSlug: string;
  roleId: RoleId;
  filters: Filters;
}) {
  const widget = getWidget(id);
  if (!widget) {
    return (
      <div className="rounded-md border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
        Unknown widget id: <code className="font-mono">{id}</code>
      </div>
    );
  }
  const { Component } = widget;
  return <Component tenantSlug={tenantSlug} roleId={roleId} filters={filters} />;
}
