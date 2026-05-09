import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { dashboardApi, dashboardKeys, type EsgSummary } from '../../../api/dashboard';
import { WidgetError, WidgetSkeleton } from '../WidgetState';

interface Props {
  slug: string;
}

type Format = 'pdf' | 'csv' | 'xbrl';
type Scope = 'YTD' | 'quarterly' | 'monthly';

const FORMAT_META: Record<Format, { label: string; icon: typeof FileText; ext: string; mime: string }> = {
  pdf: { label: 'PDF', icon: FileText, ext: 'pdf', mime: 'application/pdf' },
  csv: { label: 'CSV', icon: FileSpreadsheet, ext: 'csv', mime: 'text/csv' },
  xbrl: { label: 'XBRL', icon: FileText, ext: 'xbrl', mime: 'application/xml' },
};

const SCOPE_META: Record<Scope, { label: string; description: string }> = {
  YTD: { label: 'YTD 2026', description: '今年初到本月，月粒度' },
  quarterly: { label: 'Q1-Q2 2026', description: '前兩季彙總' },
  monthly: { label: '本月 (2026-05)', description: '單月明細' },
};

export function ReportExport({ slug }: Props) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: dashboardKeys.esgSummary(slug),
    queryFn: () => dashboardApi.esgSummary(slug),
  });

  const [format, setFormat] = useState<Format>('pdf');
  const [scope, setScope] = useState<Scope>('YTD');
  const [exporting, setExporting] = useState(false);
  const [lastExportName, setLastExportName] = useState<string | null>(null);

  if (error && !data) {
    return (
      <section className="rounded-lg border border-border bg-bg-elevated">
        <WidgetError message={String(error)} onRetry={() => void refetch()} />
      </section>
    );
  }
  if (isLoading || !data) {
    return <WidgetSkeleton variant="cards" height={280} />;
  }

  function exportReport() {
    if (!data) return;
    setExporting(true);
    // Simulate export delay (real PDF would take this long)
    setTimeout(() => {
      const filename = downloadMock(data, format, scope, slug);
      setLastExportName(filename);
      setExporting(false);
      setTimeout(() => setLastExportName(null), 5000);
    }, 800);
  }

  return (
    <section className="rounded-lg border border-border bg-bg-elevated p-4 flex flex-col h-full">
      <header className="text-xs uppercase tracking-wider text-fg-muted mb-3 flex items-center justify-between">
        <span>ESG Report Export</span>
        <span className="text-[10px] text-fg-subtle normal-case tracking-normal">
          {data.target.kind} · baseline {data.target.baselineYear}
        </span>
      </header>

      <div className="space-y-3 flex-1">
        <div>
          <div className="text-[11px] text-fg-muted mb-1.5">格式</div>
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(FORMAT_META) as Format[]).map((f) => {
              const meta = FORMAT_META[f];
              const Icon = meta.icon;
              const active = f === format;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={`flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition ${
                    active
                      ? 'border-accent bg-accent/10 text-accent-soft'
                      : 'border-border bg-bg/50 text-fg-muted hover:border-accent/50 hover:text-fg'
                  }`}
                >
                  <Icon size={12} />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-[11px] text-fg-muted mb-1.5">範圍</div>
          <div className="space-y-1">
            {(Object.keys(SCOPE_META) as Scope[]).map((s) => {
              const meta = SCOPE_META[s];
              const active = s === scope;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={`w-full text-left rounded-md border px-2.5 py-1.5 text-xs transition ${
                    active
                      ? 'border-accent bg-accent/10'
                      : 'border-border bg-bg/50 hover:border-accent/50'
                  }`}
                >
                  <div className={`font-medium ${active ? 'text-accent-soft' : 'text-fg'}`}>{meta.label}</div>
                  <div className="text-[10px] text-fg-muted mt-0.5">{meta.description}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={exportReport}
        disabled={exporting}
        className={`mt-3 inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition ${
          exporting
            ? 'border-border bg-bg-soft text-fg-muted cursor-default'
            : 'border-success bg-success/10 text-success hover:bg-success/20'
        }`}
      >
        {exporting ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            產生報表中…
          </>
        ) : (
          <>
            <Download size={14} />
            匯出 {FORMAT_META[format].label}
          </>
        )}
      </button>

      {lastExportName && (
        <div className="mt-2 px-2.5 py-1.5 rounded-md border border-success/40 bg-success/10 text-[11px] text-success flex items-start gap-1.5">
          <CheckCircle2 size={12} className="mt-0.5 shrink-0" />
          <span>
            已下載: <code className="font-mono break-all">{lastExportName}</code>
          </span>
        </div>
      )}
    </section>
  );
}

function downloadMock(summary: EsgSummary, format: Format, scope: Scope, slug: string): string {
  const meta = FORMAT_META[format];
  const date = new Date().toISOString().slice(0, 10);
  const filename = `ESG-${slug}-${scope}-${date}.${meta.ext}`;

  let content = '';
  let mime = meta.mime;
  if (format === 'csv') {
    const header = 'month,co2_tons,renewable_ratio\n';
    const rows = summary.monthly.map((p) => `${p.month},${p.co2Tons},${p.renewableRatio}`).join('\n');
    content = header + rows + '\n';
  } else {
    // For PDF/XBRL, write a text mock so demo download is non-empty.
    mime = 'text/plain';
    content = [
      `ESG Report — ${summary.slug}`,
      `Target: ${summary.target.label}`,
      `Baseline year: ${summary.target.baselineYear}`,
      `Scope: ${scope}`,
      `Generated: ${summary.generatedAt}`,
      ``,
      `YTD reduction: ${summary.ytdReduction.pct}% (${summary.ytdReduction.tonsAvoided} tCO2e avoided)`,
      `Forecast EOY: ${summary.forecastEoy.co2Tons} tCO2e (${summary.forecastEoy.reductionPct}% vs baseline)`,
      ``,
      `Monthly:`,
      ...summary.monthly.map((p) => `  ${p.month}  ${p.co2Tons.toFixed(1)} tCO2e  RE ${(p.renewableRatio * 100).toFixed(1)}%`),
      ``,
      `BU ranking:`,
      ...summary.buRanking.map((b) => `  ${b.name}  -${b.reductionPct}%  ${b.co2Tons} tCO2e`),
      ``,
      `[Demo placeholder — real ${meta.label} export would render this content as ${format}.]`,
    ].join('\n');
  }

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}
