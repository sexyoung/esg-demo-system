import { Activity, AlertTriangle, FileText, LayoutDashboard, Map, Network, Sliders } from 'lucide-react';
import { NavLink, useParams } from 'react-router-dom';
import { ROLES } from '../config/roles';
import type { ModuleId } from '../config/types';
import { useRole } from '../store/role';

interface NavItem {
  moduleId: ModuleId;
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const ALL_ITEMS: readonly NavItem[] = [
  { moduleId: 'dashboard', to: '', label: 'Dashboard', icon: LayoutDashboard },
  { moduleId: 'simulator', to: 'simulator', label: 'What-if Simulator', icon: Sliders },
  { moduleId: 'asset', to: 'asset', label: 'Asset Tree', icon: Network },
  { moduleId: 'alert', to: 'alert', label: 'Alerts', icon: AlertTriangle },
  { moduleId: 'report', to: 'report', label: 'Reports', icon: FileText },
] as const;

export function Sidebar() {
  const params = useParams<{ slug?: string }>();
  const slug = params.slug ?? 'acme';
  const currentRoleId = useRole((s) => s.currentRoleId);
  const role = ROLES[currentRoleId];
  const items = ALL_ITEMS.filter((item) => role.modules.includes(item.moduleId));

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-bg-elevated">
      <div className="p-4 border-b border-border">
        <div className="text-xs uppercase tracking-wider text-fg-subtle mb-1">Navigation</div>
        <div className="text-sm text-fg-muted">{role.shortName} 模組</div>
      </div>
      <nav className="p-2">
        {items.map((item) => {
          const Icon = item.icon;
          const path = `/tenants/${slug}${item.to ? `/${item.to}` : ''}`;
          return (
            <NavLink
              key={item.label}
              to={path}
              end={item.to === ''}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                  isActive ? 'bg-bg-soft text-accent-soft border border-border' : 'text-fg-muted hover:bg-bg-soft hover:text-fg'
                }`
              }
            >
              <Icon size={16} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
      <div className="mt-2 mx-2 p-3 rounded-md border border-border-soft text-xs text-fg-subtle">
        <NavLink to="/map" className={({ isActive }) => `flex items-center gap-2 ${isActive ? 'text-accent-soft' : 'hover:text-fg'}`}>
          <Map size={14} />
          全域監控地圖
        </NavLink>
      </div>
      <div className="mt-2 mx-2 p-3 rounded-md border border-border-soft text-xs text-fg-subtle flex items-center gap-2">
        <Activity size={12} className="text-success" />
        Build: Day 4 — role-aware shell
      </div>
    </aside>
  );
}
