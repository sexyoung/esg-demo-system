import { CheckCircle2, ClipboardEdit, Plus } from 'lucide-react';
import { useState } from 'react';

interface Props {
  slug: string;
}

const ASSET_OPTIONS: Record<string, string[]> = {
  acme: ['ACM-PV-1 PV 陣列 #1', 'ACM-ESS-1 儲能 Rack 1', 'ACM-EV-A1 EV 充電站 A1', 'ACM-LD-1 廠房負載 L1'],
  beta: ['BET-HVAC-3F 3 樓空調', 'BET-LIGHT-2F 2 樓照明', 'BET-ELEV-A 電梯 A', 'BET-METER-G1 主電表'],
  gamma: ['GAM-FAB1-A1 FAB1 蝕刻機 A1', 'GAM-CDA-1 壓縮空氣站 1', 'GAM-UTI-CHL2 冰水主機 2', 'GAM-FAB2-B3 FAB2 黃光區 B3'],
};

const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Critical · 立即處理' },
  { value: 'high', label: 'High · 4 小時內' },
  { value: 'medium', label: 'Medium · 24 小時內' },
  { value: 'low', label: 'Low · 排程處理' },
] as const;

export function WorkOrderEntry({ slug }: Props) {
  const assets = ASSET_OPTIONS[slug] ?? ASSET_OPTIONS.acme;
  const [asset, setAsset] = useState(assets[0]);
  const [severity, setSeverity] = useState<(typeof SEVERITY_OPTIONS)[number]['value']>('medium');
  const [description, setDescription] = useState('');
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  function submit() {
    if (!description.trim()) return;
    const id = `WO-${new Date().getFullYear()}-${Math.floor(Math.random() * 900 + 100)}`;
    setSubmittedId(id);
    // Auto-clear toast after 4s
    setTimeout(() => setSubmittedId(null), 4000);
    setDescription('');
  }

  return (
    <section className="rounded-lg border border-border bg-bg-elevated overflow-hidden">
      <header className="flex items-center justify-between px-4 py-2 border-b border-border-soft">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-fg-muted">
          <ClipboardEdit size={14} className="text-accent-soft" />
          <span className="font-semibold tracking-wide">建立工單 · Work Order</span>
        </div>
        <div className="text-[10px] text-fg-subtle">demo: 不寫入後端</div>
      </header>

      <div className="p-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto] items-end">
        <div>
          <label className="text-[11px] text-fg-muted block mb-1">設備</label>
          <select
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
            className="w-full text-sm rounded-md border border-border bg-bg px-3 py-2 text-fg hover:border-accent focus:outline-none focus:border-accent"
          >
            {assets.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-fg-muted block mb-1">嚴重等級</label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as typeof severity)}
            className="w-full text-sm rounded-md border border-border bg-bg px-3 py-2 text-fg hover:border-accent focus:outline-none focus:border-accent"
          >
            {SEVERITY_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={!description.trim()}
          className="inline-flex items-center gap-1.5 rounded-md border border-accent bg-accent/10 px-4 py-2 text-sm font-medium text-accent-soft hover:bg-accent/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <Plus size={14} />
          建立工單
        </button>
      </div>

      <div className="px-4 pb-4">
        <label className="text-[11px] text-fg-muted block mb-1">描述</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="例：PV-1 inverter 過熱告警，需現場檢查散熱風扇與接點。"
          rows={2}
          className="w-full text-sm rounded-md border border-border bg-bg px-3 py-2 text-fg placeholder-fg-subtle hover:border-accent focus:outline-none focus:border-accent resize-none"
        />
      </div>

      {submittedId && (
        <div className="mx-4 mb-4 px-3 py-2 rounded-md border border-success/40 bg-success/10 text-sm text-success flex items-center gap-2 animate-in">
          <CheckCircle2 size={14} />
          <span>
            工單{' '}
            <code className="font-mono text-success font-semibold">{submittedId}</code> 已建立 · 已通知排程組
          </span>
        </div>
      )}
    </section>
  );
}
