import { Construction } from 'lucide-react';

export function PlaceholderPage({ title, day }: { title: string; day: string }) {
  return (
    <div className="p-6">
      <div className="rounded-lg border border-dashed border-border bg-bg-elevated p-10 text-center">
        <Construction size={32} className="mx-auto text-fg-subtle mb-3" />
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-fg-muted">{day} 才會交付</p>
      </div>
    </div>
  );
}
