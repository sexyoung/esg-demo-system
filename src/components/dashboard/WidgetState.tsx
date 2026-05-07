import { AlertCircle, Inbox, Loader2, RefreshCw } from 'lucide-react';

interface WidgetSkeletonProps {
  height?: number;
  variant?: 'chart' | 'cards' | 'tree' | 'list';
}

export function WidgetSkeleton({ height = 240, variant = 'chart' }: WidgetSkeletonProps) {
  if (variant === 'cards') {
    return (
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-bg-elevated p-4">
            <div className="h-3 w-20 rounded bg-bg-soft animate-pulse" />
            <div className="mt-3 h-7 w-28 rounded bg-bg-soft animate-pulse" />
          </div>
        ))}
      </div>
    );
  }
  if (variant === 'list') {
    return (
      <div className="divide-y divide-border-soft">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-3 flex items-start gap-3">
            <div className="h-7 w-7 rounded-md bg-bg-soft animate-pulse shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-3/4 rounded bg-bg-soft animate-pulse" />
              <div className="h-2 w-full rounded bg-bg-soft animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (variant === 'tree') {
    return (
      <div className="p-6 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2" style={{ marginLeft: (i % 3) * 16 }}>
            <div className="h-2.5 w-2.5 rounded-full bg-bg-soft animate-pulse" />
            <div className="h-2.5 rounded bg-bg-soft animate-pulse" style={{ width: 80 + (i % 4) * 30 }} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="p-3" style={{ height }}>
      <div className="relative h-full w-full overflow-hidden rounded bg-bg-soft/40">
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-bg-soft/0 via-bg-soft/40 to-bg-soft/0" />
      </div>
    </div>
  );
}

interface WidgetErrorProps {
  message: string;
  onRetry?: () => void;
}

export function WidgetError({ message, onRetry }: WidgetErrorProps) {
  return (
    <div className="p-6 flex items-start gap-3">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-danger/40 bg-danger/10 text-danger">
        <AlertCircle size={16} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-fg">無法載入</div>
        <p className="mt-0.5 text-xs text-fg-muted leading-5 break-all">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded border border-border-soft bg-bg-soft text-fg-muted hover:text-fg hover:border-accent-soft transition"
          >
            <RefreshCw size={12} />
            重試
          </button>
        )}
      </div>
    </div>
  );
}

interface WidgetEmptyProps {
  message: string;
  hint?: string;
}

export function WidgetEmpty({ message, hint }: WidgetEmptyProps) {
  return (
    <div className="p-8 flex flex-col items-center text-center">
      <Inbox size={28} className="text-fg-subtle mb-2" />
      <div className="text-sm text-fg-muted">{message}</div>
      {hint && <div className="text-xs text-fg-subtle mt-1">{hint}</div>}
    </div>
  );
}

export function WidgetSyncing({ label = 'syncing…' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-fg-subtle">
      <Loader2 size={11} className="animate-spin" />
      {label}
    </span>
  );
}
