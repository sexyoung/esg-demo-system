import { Outlet } from 'react-router-dom';
import { PerfBadge } from './PerfBadge';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function Layout() {
  return (
    <div className="flex h-screen flex-col bg-bg text-fg">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 min-h-0 overflow-auto">
          <Outlet />
        </main>
      </div>
      <PerfBadge />
    </div>
  );
}
