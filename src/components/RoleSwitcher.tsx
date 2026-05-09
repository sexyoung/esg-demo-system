import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ROLES, ROLE_ORDER } from '../config/roles';
import type { RoleId } from '../config/types';
import { useRole } from '../store/role';

const ACCENT_DOT: Record<string, string> = {
  blue: 'bg-accent',
  green: 'bg-success',
  orange: 'bg-warn',
  gray: 'bg-fg-subtle',
};

const ACCENT_BORDER: Record<string, string> = {
  blue: 'border-accent/50 hover:border-accent',
  green: 'border-success/50 hover:border-success',
  orange: 'border-warn/50 hover:border-warn',
  gray: 'border-border hover:border-fg-subtle',
};

export function RoleSwitcher() {
  const currentRoleId = useRole((s) => s.currentRoleId);
  const setRole = useRole((s) => s.setRole);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const current = ROLES[currentRoleId];

  function pick(roleId: RoleId) {
    setOpen(false);
    setRole(roleId);
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-2 rounded-md border bg-bg-soft px-3 py-1.5 text-sm font-medium text-fg transition ${ACCENT_BORDER[current.accent]}`}
      >
        <span className={`inline-block h-2 w-2 rounded-full ${ACCENT_DOT[current.accent]}`} />
        <span className="text-fg-muted text-xs uppercase tracking-wide">Role</span>
        <span className="tabular-nums">{current.shortName}</span>
        <ChevronDown size={14} className="text-fg-muted" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 min-w-[280px] rounded-md border border-border bg-bg-elevated shadow-lg">
          {ROLE_ORDER.map((roleId) => {
            const role = ROLES[roleId];
            const active = roleId === currentRoleId;
            return (
              <button
                key={roleId}
                type="button"
                onClick={() => pick(roleId)}
                className={`w-full text-left px-3 py-2 text-sm border-b border-border-soft last:border-b-0 hover:bg-bg-soft transition flex items-center gap-3 ${
                  active ? 'text-accent-soft' : 'text-fg'
                }`}
              >
                <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${ACCENT_DOT[role.accent]}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{role.name}</div>
                  <div className="text-xs text-fg-muted truncate">
                    {role.modules.length} modules · hero: {role.hero}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
