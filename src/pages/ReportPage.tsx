import { useQuery } from '@tanstack/react-query';
import { Calendar, Download, FileText, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, queryKeys } from '../api/client';
import { dashboardApi, dashboardKeys } from '../api/dashboard';

interface ReportTemplate {
  id: string;
  title: string;
  subtitle: string;
  framework: string;
  defaultPeriod: string;
  formats: string[];
  includes: string[];
}

const TEMPLATES: ReportTemplate[] = [
  {
    id: 'esg-annual',
    title: '2026 年度 ESG 永續報告書',
    subtitle: '配合 GRI Standards 2021 + 上市櫃公司編製規範',
    framework: 'GRI · SASB · TCFD',
    defaultPeriod: '2025/01–2025/12',
    formats: ['PDF', 'XBRL', 'docx'],
    includes: ['治理結構', '碳盤查 (Scope 1/2/3)', '能源使用強度', '人力資本', '供應鏈管理'],
  },
  {
    id: 'energy-monthly',
    title: '月度能源稽核報告',
    subtitle: 'ISO 50001 能源管理系統節點檢核',
    framework: 'ISO 50001',
    defaultPeriod: '2026/04',
    formats: ['PDF', 'xlsx'],
    includes: ['EUI 趨勢', '尖峰負載', 'PV/ESS 績效', 'KPI 達成率', '異常事件'],
  },
  {
    id: 're100',
    title: 'RE100 進度報告',
    subtitle: '再生能源占比追蹤 + 路徑分析',
    framework: 'RE100 · CDP',
    defaultPeriod: '2026 H1',
    formats: ['PDF'],
    includes: ['自發自用率', 'PPA / REC 採購', '剩餘 Gap 分析', '2030 路徑模擬'],
  },
  {
    id: 'iso-14064',
    title: 'ISO 14064-1 溫室氣體盤查報告',
    subtitle: '組織型 GHG 量化與報告',
    framework: 'ISO 14064-1:2018',
    defaultPeriod: '2025 全年',
    formats: ['PDF', 'docx'],
    includes: ['組織邊界', '排放源清單', '直接 + 間接排放', '排放係數來源', '查證聲明'],
  },
];

export function ReportPage() {
  const { slug = 'acme' } = useParams<{ slug: string }>();
  const [activeId, setActiveId] = useState<string>(TEMPLATES[0].id);
  const [generated, setGenerated] = useState<string | null>(null);

  const tenantQuery = useQuery({
    queryKey: queryKeys.tenant(slug),
    queryFn: () => api.tenant(slug),
  });
  const kpiQuery = useQuery({
    queryKey: dashboardKeys.kpi(slug, '30d'),
    queryFn: () => dashboardApi.kpi(slug, '30d'),
  });

  const active = TEMPLATES.find((t) => t.id === activeId)!;

  function fakeGenerate() {
    setGenerated(`${active.title}-${slug}-${Date.now()}.${active.formats[0].toLowerCase()}`);
    setTimeout(() => setGenerated(null), 4000);
  }

  return (
    <div className="p-5 space-y-5 max-w-[1600px] mx-auto">
      <header>
        <div className="text-xs uppercase tracking-wider text-fg-subtle mb-1">Reports</div>
        <h1 className="text-xl font-semibold">ESG 報表中心</h1>
        <div className="text-xs text-fg-muted mt-0.5">
          tenant: <span className="text-fg">{tenantQuery.data?.name ?? slug}</span>
          <span className="mx-2 text-fg-subtle">·</span>
          選擇樣本 → 設定期間 → 生成（demo 為 mock 輸出）
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-3">
          {TEMPLATES.map((t) => {
            const isActive = t.id === activeId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveId(t.id)}
                className={`w-full text-left rounded-lg border p-4 transition ${
                  isActive ? 'border-accent-soft bg-accent/5' : 'border-border bg-bg-elevated hover:border-border-soft'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${isActive ? 'bg-accent text-white' : 'bg-bg-soft text-fg-muted'}`}>
                    <FileText size={16} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold ${isActive ? 'text-accent-soft' : 'text-fg'}`}>{t.title}</div>
                    <div className="text-[11px] text-fg-muted mt-0.5">{t.framework}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </aside>

        <section className="rounded-lg border border-border bg-bg-elevated overflow-hidden">
          <div className="px-5 py-4 border-b border-border-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-fg">{active.title}</h2>
                <p className="text-xs text-fg-muted mt-0.5">{active.subtitle}</p>
                <div className="mt-2 flex gap-2 flex-wrap">
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-border-soft bg-bg-soft text-fg-muted uppercase tracking-wider">
                    {active.framework}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={fakeGenerate}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent-soft transition"
              >
                <Download size={13} />
                生成 {active.formats[0]}
              </button>
            </div>
          </div>

          <div className="p-5 space-y-5">
            <div className="grid grid-cols-3 gap-4">
              <Field label="期間" value={active.defaultPeriod} icon={<Calendar size={13} />} />
              <Field label="輸出格式" value={active.formats.join(' · ')} icon={<FileText size={13} />} />
              <Field
                label="預期來源"
                value={kpiQuery.data ? `${(kpiQuery.data.energyConsumedKwh / 1000).toFixed(1)} MWh / 30d` : '計算中…'}
                icon={<Sparkles size={13} />}
              />
            </div>

            <div>
              <div className="text-xs uppercase tracking-wider text-fg-subtle mb-2">本報告涵蓋</div>
              <ul className="grid grid-cols-2 gap-2">
                {active.includes.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-fg">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent-soft shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-md border border-border-soft bg-bg-soft/50 p-4">
              <div className="text-xs uppercase tracking-wider text-fg-subtle mb-2">範本預覽（mock）</div>
              <div className="space-y-2 text-xs text-fg-muted leading-6 font-mono">
                <div>1. 報告摘要：{tenantQuery.data?.name} {active.defaultPeriod}</div>
                <div>2. 總用電 {kpiQuery.data ? Math.round(kpiQuery.data.energyConsumedKwh).toLocaleString() : '—'} kWh，CO₂ {kpiQuery.data ? kpiQuery.data.co2Tons.toFixed(1) : '—'} tCO₂e</div>
                <div>3. PV 自發自用率 {kpiQuery.data ? (kpiQuery.data.renewableRatio * 100).toFixed(1) : '—'} %</div>
                <div>4. 排放係數來源：經濟部能源署 113 年度公告 0.474 kgCO₂e/kWh</div>
                <div className="text-fg-subtle">…（實際輸出含 14 個章節 + 圖表 + 簽證頁）</div>
              </div>
            </div>

            {generated && (
              <div className="rounded-md border border-success/40 bg-success/10 p-3 text-xs text-success flex items-center gap-2">
                <Download size={14} />
                已生成（demo mock）：<code className="font-mono">{generated}</code>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border-soft bg-bg-soft/50 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-fg-subtle">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-sm text-fg tabular-nums">{value}</div>
    </div>
  );
}
