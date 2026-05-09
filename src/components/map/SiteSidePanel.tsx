import { useQuery } from '@tanstack/react-query';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { ChevronRight, MapPin } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  dashboardApi,
  dashboardKeys,
  type EsgSummary,
} from '../../api/dashboard';
import type { SiteRow } from '../../api/client';
import { CHART_FONT, HIGHCHARTS_TOOLTIP } from '../../lib/chartTheme';
import { WidgetError, WidgetSkeleton } from '../dashboard/WidgetState';

interface Props {
  /** Currently hovered/selected site, or null for empty state. */
  hovered: SiteRow | null;
}

export function SiteSidePanel({ hovered }: Props) {
  return (
    <aside className="w-[360px] shrink-0 border-l border-border bg-bg-elevated overflow-y-auto h-full">
      {hovered ? <ActivePanel site={hovered} /> : <EmptyHover />}
    </aside>
  );
}

function EmptyHover() {
  return (
    <div className="p-6 flex flex-col items-center text-center text-fg-muted h-full justify-center">
      <MapPin size={28} className="text-fg-subtle mb-3" />
      <div className="text-sm font-medium text-fg-muted">尚未選擇站點</div>
      <div className="text-xs text-fg-subtle mt-1.5 leading-5">
        hover 任一 marker 即時看
        <br />
        該站所屬廠群的減碳走勢
      </div>
    </div>
  );
}

function ActivePanel({ site }: { site: SiteRow }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: dashboardKeys.esgSummary(site.tenantSlug),
    queryFn: () => dashboardApi.esgSummary(site.tenantSlug),
  });

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 py-3 border-b border-border-soft">
        <div className="text-xs uppercase tracking-wider text-fg-muted flex items-center gap-2">
          <MapPin size={12} />
          {site.tenantName} · 廠群視角
        </div>
        <div className="mt-1 text-sm font-semibold text-fg leading-snug">
          hovered from {site.name}
        </div>
        <div className="text-xs text-fg-muted tabular-nums mt-0.5">
          {site.code} · {site.industry}
          {site.county && <> · {site.county}</>}
        </div>
      </header>

      <div className="flex-1 px-2 py-3 min-h-0">
        {error && !data && (
          <WidgetError message={String(error)} onRetry={() => void refetch()} />
        )}
        {isLoading && !data && <WidgetSkeleton variant="chart" height={220} />}
        {data && <CarbonTrendChart summary={data} />}
      </div>

      {data && (
        <footer className="px-4 py-3 border-t border-border-soft space-y-2">
          <YtdBadge ytd={data.ytdReduction} target={data.target} />
          <Link
            to={`/tenants/${site.tenantSlug}`}
            className="flex items-center justify-between rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft hover:bg-accent/20 transition"
          >
            <span>進 {site.tenantName} dashboard</span>
            <ChevronRight size={14} />
          </Link>
        </footer>
      )}
    </div>
  );
}

function CarbonTrendChart({ summary }: { summary: EsgSummary }) {
  const options = useMemo<Highcharts.Options>(() => buildOptions(summary), [summary]);
  return <HighchartsReact highcharts={Highcharts} options={options} />;
}

function YtdBadge({
  ytd,
  target,
}: {
  ytd: EsgSummary['ytdReduction'];
  target: EsgSummary['target'];
}) {
  const isPositive = ytd.pct >= 0;
  return (
    <div
      className={`rounded-md border px-3 py-2 ${
        isPositive ? 'border-success/40 bg-success/5' : 'border-danger/40 bg-danger/5'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-fg-muted">YTD Reduction</span>
        <span className="text-[10px] text-fg-subtle">{target.kind}</span>
      </div>
      <div className="mt-0.5 flex items-baseline gap-2">
        <span
          className={`text-2xl font-semibold tabular-nums ${
            isPositive ? 'text-success' : 'text-danger'
          }`}
        >
          {isPositive ? '−' : '+'}
          {Math.abs(ytd.pct).toFixed(1)}%
        </span>
        <span className="text-[11px] text-fg-muted tabular-nums">
          {Math.abs(ytd.tonsAvoided).toLocaleString(undefined, { maximumFractionDigits: 0 })} tCO₂e
        </span>
      </div>
    </div>
  );
}

function buildOptions(summary: EsgSummary): Highcharts.Options {
  const actualSeries = summary.monthly.map((p) => ({
    x: monthToTs(p.month),
    y: p.co2Tons,
  }));

  // Linear target slope from baseline year to deadline.
  const baselineMonthlyCo2 = summary.monthly[0]?.co2Tons ?? 0;
  const totalYears = summary.target.deadline - summary.target.baselineYear;
  const reductionPerYear = summary.target.reductionPctByDeadline / 100 / Math.max(1, totalYears);
  const targetSeries = summary.monthly.map((p, i) => {
    const yearsFromStart = i / 12;
    const factor = 1 - reductionPerYear * yearsFromStart;
    return { x: monthToTs(p.month), y: round(baselineMonthlyCo2 * factor, 1) };
  });

  return {
    chart: {
      backgroundColor: 'transparent',
      height: 240,
      style: { fontFamily: CHART_FONT },
      spacing: [8, 8, 8, 8],
    },
    title: { text: undefined },
    credits: { enabled: false },
    xAxis: {
      type: 'datetime',
      lineColor: '#243049',
      tickColor: '#243049',
      labels: { style: { color: '#93a3bf', fontSize: '10px' } },
      gridLineColor: '#1b2540',
      gridLineWidth: 1,
    },
    yAxis: {
      title: { text: 'tCO₂e', style: { color: '#5e6e8a', fontSize: '10px' } },
      gridLineColor: '#1b2540',
      labels: { style: { color: '#93a3bf', fontSize: '10px' } },
      lineColor: '#243049',
      min: 0,
    },
    plotOptions: {
      line: { marker: { enabled: false }, lineWidth: 2 },
      series: { animation: { duration: 350 } },
    },
    legend: {
      enabled: true,
      itemStyle: { color: '#93a3bf', fontSize: '10px' },
      itemHoverStyle: { color: '#e6edf7' },
      align: 'right',
      verticalAlign: 'top',
      y: -8,
    },
    tooltip: {
      ...HIGHCHARTS_TOOLTIP,
      shared: true,
      xDateFormat: '%Y-%m',
      valueDecimals: 1,
      valueSuffix: ' tCO₂e',
    },
    series: [
      {
        type: 'line',
        name: `Target (${summary.target.kind})`,
        data: targetSeries,
        color: '#34d399',
        dashStyle: 'Dash',
        lineWidth: 1.5,
      },
      {
        type: 'line',
        name: 'Actual',
        data: actualSeries,
        color: '#00a3df',
        lineWidth: 2,
      },
    ],
  };
}

function monthToTs(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, 15).getTime();
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
