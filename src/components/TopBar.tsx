import { Bell, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PerfBadge } from './PerfBadge';
import { RoleSwitcher } from './RoleSwitcher';
import { TenantSwitcher } from './TenantSwitcher';

export function TopBar() {
  return (
    <header className="h-14 border-b border-border bg-bg-elevated flex items-center justify-between gap-3 px-3 lg:px-5">
      <Link to="/" className="flex items-center gap-3 text-sm min-w-0 shrink-0">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent text-white font-semibold tabular-nums">EQ</span>
        <span className="font-semibold tracking-wide whitespace-nowrap hidden lg:inline">EnergiQ Demo</span>
        <span className="text-fg-subtle text-xs ml-2 hidden xl:inline whitespace-nowrap">· operator-facing scenario comparison</span>
      </Link>
      <div className="flex items-center gap-2 lg:gap-3 shrink-0">
        <PerfBadge />
        <TenantSwitcher />
        <RoleSwitcher />
        <button type="button" className="h-9 w-9 hidden sm:inline-flex items-center justify-center rounded-md border border-border text-fg-muted hover:text-fg hover:border-accent transition">
          <Bell size={16} />
        </button>
        <button type="button" className="h-9 w-9 hidden sm:inline-flex items-center justify-center rounded-md border border-border text-fg-muted hover:text-fg hover:border-accent transition">
          <User size={16} />
        </button>
      </div>
    </header>
  );
}
