import type { ComponentType } from 'react';
import type { Filters, RoleId, WidgetId } from '../config/types';

export interface WidgetProps {
  tenantSlug: string;
  roleId: RoleId;
  filters: Filters;
}

export interface WidgetDefinition {
  id: WidgetId;
  title: string;
  Component: ComponentType<WidgetProps>;
  // Default span hint for split layouts. Renderer reads layout, not this.
  // Reserved for future use; keep undefined for now.
  span?: 'full' | 'half';
}
