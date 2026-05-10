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
    <div className="flex flex-col gap-3 xl:gap-5 flex-1 min-h-0" key={roleId}>
      {layout.map((row, idx) => {
        // Stretch rows absorb extra vertical space (flex-1); the rest keep
        // their natural height (shrink-0). On short viewports min-h-0 lets
        // the stretch row also compress if needed.
        const stretchClass = row.stretch ? 'flex-1 min-h-0 flex flex-col' : 'shrink-0';
        // Visibility is orientation-driven (matches @media
        // orientation:portrait/landscape). Width breakpoints don't cleanly
        // separate iPad orientations — iPad Pro 12.9" portrait is 1024w,
        // exactly Tailwind's lg breakpoint.
        const visibilityClass =
          row.hideOn === 'landscape'
            ? 'landscape:hidden'
            : row.hideOn === 'portrait'
              ? 'portrait:hidden'
              : '';
        return (
          <div
            key={`${roleId}-${idx}`}
            className={`role-row-mount ${stretchClass} ${visibilityClass}`}
            style={{ animationDelay: `${idx * 30}ms` }}
          >
            <LayoutRowView
              row={row}
              tenantSlug={tenantSlug}
              roleId={roleId}
              filters={filters}
            />
          </div>
        );
      })}
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
  // When a row stretches, the inner element is a flex item of the row
  // wrapper (flex-col) — flex-1 + min-h-0 makes it fill the wrapper without
  // pushing siblings out.
  const stretchInner = row.stretch ? 'flex-1 min-h-0' : '';

  if (row.kind === 'full') {
    // For stretch + full, inner div must be a flex container so the widget's
    // h-full / flex-1 inside resolves against a definite parent height.
    const fullStretchClass = row.stretch ? `${stretchInner} flex flex-col` : stretchInner;
    return (
      <div className={fullStretchClass}>
        <RenderWidget id={row.widget} tenantSlug={tenantSlug} roleId={roleId} filters={filters} />
      </div>
    );
  }
  const ratioClass = SPLIT_RATIO_CLASS[row.ratio ?? '1:1'];
  return (
    <div className={`grid gap-3 xl:gap-5 ${ratioClass} ${stretchInner}`}>
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
