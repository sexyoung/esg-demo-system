import { useQuery } from '@tanstack/react-query';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { useMemo } from 'react';
import { dashboardApi, dashboardKeys, type EsgSummary } from '../../../api/dashboard';
import { CHART_FONT, HIGHCHARTS_TOOLTIP } from '../../../lib/chartTheme';
import { useCountUp } from '../../../lib/animateNumber';
import { WidgetError, WidgetSkeleton } from '../WidgetState';

interface Props {
  slug: string;
}

export function TargetVsActual({ slug }: Props) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: dashboardKeys.esgSummary(slug),
    queryFn: () => dashboardApi.esgSummary(slug),
  });

  if (error && !data) {
    return (
      <section className="rounded-lg border border-border bg-bg-elevated">
        <WidgetError message={String(error)} onRetry={() => void refetch()} />
      </section>
    );
  }
  if (isLoading || !data) {
    return <WidgetSkeleton variant="chart" height={320} />;
  }

  return (
    <section className="rounded-lg border border-border bg-bg-elevated overflow-hidden">
      <header className="flex items-start justify-between gap-4 px-4 py-3 border-b border-border-soft">
        <div>
          <div className="text-xs uppercase tracking-wider text-fg-muted">
            Target vs Actual <span className="text-fg-subtle normal-case tracking-normal">· Highcharts</span>
          </div>
          <div className="text-sm font-semibold mt-0.5">{data.target.label}</div>
        </div>
        <YtdReductionBadge pct={data.ytdReduction.pct} tons={data.ytdReduction.tonsAvoided} />
      </header>
      <div className="px-2 pb-2">
        <TargetVsActualChart summary={data} />
      </div>
      <footer className="px-4 py-2 border-t border-border-soft text-xs text-fg-muted flex flex-wrap gap-4">
        <span>
          Forecast EOY: <span className="tabular-nums text-fg">{data.forecastEoy.co2Tons.toLocaleString()}</span>{' '}
          tCO₂e
          <span className={`ml-1 ${data.forecastEoy.reductionPct >= data.target.reductionPctByDeadline / (data.target.deadline - data.target.baselineYear) * (new Date().getFullYear() - data.target.baselineYear) ? 'text-success' : 'text-warn'}`}>
            ({data.forecastEoy.reductionPct >= 0 ? '−' : '+'}
            {Math.abs(data.forecastEoy.reductionPct).toFixed(1)}%)
          </span>
        </span>
        <span>
          Baseline year:{' '}
          <span className="tabular-nums text-fg">{data.target.baselineYear}</span>
        </span>
        <span className="ml-auto text-fg-subtle">data: /api/tenants/{slug}/esg-summary</span>
      </footer>
    </section>
  );
}

function YtdReductionBadge({ pct, tons }: { pct: number; tons: number }) {
  const animated = useCountUp(pct, 350);
  const animatedTons = useCountUp(tons, 350);
  const isPositive = pct >= 0;
  return (
    <div className={`text-right shrink-0 ${isPositive ? 'text-success' : 'text-danger'}`}>
      <div className="text-xs uppercase tracking-wider text-fg-muted">YTD Reduction</div>
      <div className="text-3xl font-semibold tabular-nums leading-tight">
        {isPositive ? '−' : '+'}
        {Math.abs(animated).toFixed(1)}
        <span className="text-sm">%</span>
      </div>
      <div className="text-xs text-fg-subtle tabular-nums">
        {animatedTons.toLocaleString(undefined, { maximumFractionDigits: 0 })} tCO₂e avoided
      </div>
    </div>
  );
}

function TargetVsActualChart({ summary }: { summary: EsgSummary }) {
  const options = useMemo<Highcharts.Options>(() => buildOptions(summary), [summary]);
  return <HighchartsReact highcharts={Highcharts} options={options} />;
}

function buildOptions(summary: EsgSummary): Highcharts.Options {
  const actualSeries = summary.monthly.map((p) => ({
    x: monthToTs(p.month),
    y: p.co2Tons,
  }));

  // Build target line: linear slope from baseline (start of monthly window)
  // toward target reductionPctByDeadline at deadline.
  const baselineMonthlyCo2 = summary.monthly[0]?.co2Tons ?? 0;
  const totalYears = summary.target.deadline - summary.target.baselineYear;
  const reductionPerYear = summary.target.reductionPctByDeadline / 100 / Math.max(1, totalYears);
  const targetSeries = summary.monthly.map((p, i) => {
    const yearsFromStart = i / 12;
    const factor = 1 - reductionPerYear * yearsFromStart;
    return { x: monthToTs(p.month), y: round(baselineMonthlyCo2 * factor, 1) };
  });

  // Forecast: extend last 3 actual data points trend forward 3 months (dashed).
  const last = summary.monthly[summary.monthly.length - 1];
  const lastTs = monthToTs(last.month);
  const trend = (last.co2Tons - summary.monthly[summary.monthly.length - 4].co2Tons) / 3;
  const forecastSeries = [
    { x: lastTs, y: last.co2Tons },
    { x: lastTs + 30 * 24 * 3600 * 1000, y: round(last.co2Tons + trend, 1) },
    { x: lastTs + 60 * 24 * 3600 * 1000, y: round(last.co2Tons + trend * 2, 1) },
    { x: lastTs + 90 * 24 * 3600 * 1000, y: round(last.co2Tons + trend * 3, 1) },
  ];

  return {
    chart: {
      backgroundColor: 'transparent',
      height: 320,
      style: { fontFamily: CHART_FONT },
    },
    title: { text: undefined },
    credits: { enabled: false },
    xAxis: {
      type: 'datetime',
      lineColor: '#243049',
      tickColor: '#243049',
      labels: { style: { color: '#93a3bf', fontSize: '11px' } },
      gridLineColor: '#1b2540',
      gridLineWidth: 1,
    },
    yAxis: {
      title: { text: 'tCO₂e / month', style: { color: '#5e6e8a', fontSize: '10px' } },
      gridLineColor: '#1b2540',
      labels: { style: { color: '#93a3bf', fontSize: '11px' } },
      lineColor: '#243049',
      min: 0,
    },
    plotOptions: {
      line: { marker: { enabled: false }, lineWidth: 2 },
      series: {
        states: { hover: { enabled: true, lineWidth: 3 } },
        animation: { duration: 600 },
      },
    },
    legend: {
      itemStyle: { color: '#93a3bf', fontSize: '11px', fontWeight: '500' },
      itemHoverStyle: { color: '#e6edf7' },
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
        lineWidth: 2.5,
      },
      {
        type: 'line',
        name: 'Forecast EOY',
        data: forecastSeries,
        color: '#fbbf24',
        dashStyle: 'ShortDot',
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
