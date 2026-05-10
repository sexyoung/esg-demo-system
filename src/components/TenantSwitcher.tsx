import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, queryKeys, type TenantSummary } from '../api/client';

export function TenantSwitcher() {
  const params = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.tenants,
    queryFn: api.tenants,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const current = data?.find((t) => t.slug === params.slug) ?? data?.[0];

  function pick(t: TenantSummary) {
    setOpen(false);
    navigate(`/tenants/${t.slug}`);
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-md border border-border bg-bg-soft px-3 py-1.5 text-sm font-medium text-fg hover:border-accent transition whitespace-nowrap"
        title={current?.name}
      >
        <span className="text-fg-muted text-xs uppercase tracking-wide hidden sm:inline">Tenant</span>
        <span className="tabular-nums max-w-[140px] lg:max-w-none truncate">
          {isLoading ? '載入中…' : current?.name ?? '未選擇'}
        </span>
        <ChevronDown size={14} className="text-fg-muted shrink-0" />
      </button>
      {open && data && (
        <div className="absolute right-0 top-full mt-1 z-30 min-w-[260px] rounded-md border border-border bg-bg-elevated shadow-lg">
          {data.map((t) => (
            <button
              key={t.slug}
              type="button"
              onClick={() => pick(t)}
              className={`w-full text-left px-3 py-2 text-sm border-b border-border-soft last:border-b-0 hover:bg-bg-soft transition ${
                t.slug === current?.slug ? 'text-accent-soft' : 'text-fg'
              }`}
            >
              <div className="font-medium">{t.name}</div>
              <div className="text-xs text-fg-muted">{t.industry}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
