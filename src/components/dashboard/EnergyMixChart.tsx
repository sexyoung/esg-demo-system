import { useQuery } from '@tanstack/react-query';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { useMemo } from 'react';
import { dashboardApi, dashboardKeys, type MetricsResponse } from '../../api/dashboard';
import { CHART_FONT, HIGHCHARTS_TOOLTIP } from '../../lib/chartTheme';
import { WidgetEmpty, WidgetError, WidgetSkeleton } from './WidgetState';

interface Props {
  slug: string;
}

export function EnergyMixChart({ slug }: Props) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: dashboardKeys.metrics(slug, '24h', 'POWER'),
    queryFn: () => dashboardApi.metrics(slug, '24h', 'POWER'),
    refetchInterval: 60_000,
  });

  const options = useMemo<Highcharts.Options>(() => buildOptions(slug, data), [slug, data]);

  const showError = !data && !!error;
  const showLoading = !data && !showError && isLoading;
  const showEmpty = !!data && (!data.points || data.points.length === 0);

  return (
    <section className="rounded-lg border border-border bg-bg-elevated overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-soft">
        <div className="text-xs uppercase tracking-wider text-fg-muted">
          24h 能源組合 <span className="text-fg-subtle normal-case tracking-normal">· Highcharts</span>
        </div>
      </div>
      {showError ? (
        <WidgetError
          message={error instanceof Error ? error.message : String(error)}
          onRetry={() => void refetch()}
        />
      ) : showLoading ? (
        <WidgetSkeleton height={280} variant="chart" />
      ) : showEmpty ? (
        <WidgetEmpty message="此時段尚無能源組合資料" hint="後端回傳的 metrics 為空" />
      ) : (
        <div className="px-2 pb-2">
          <HighchartsReact highcharts={Highcharts} options={options} />
        </div>
      )}
    </section>
  );
}

interface Bucket {
  pv: number;
  load: number;
  grid: number;
  ess: number;
}

function buildOptions(slug: string, data: MetricsResponse | undefined): Highcharts.Options {
  const buckets = new Map<number, Bucket>();
  if (data?.points) {
    for (const p of data.points) {
      const tsMs = new Date(p.timestamp).getTime();
      const bucket = buckets.get(tsMs) ?? { pv: 0, load: 0, grid: 0, ess: 0 };
      switch (p.assetType) {
        case 'PV':
          bucket.pv += Math.max(0, p.value);
          break;
        case 'BUILDING':
        case 'EV_CHARGER':
        case 'LINE':
          bucket.load += Math.max(0, p.value);
          break;
        case 'METER':
          bucket.grid += Math.max(0, p.value);
          break;
        case 'ESS':
          bucket.ess += p.value;
          break;
      }
      buckets.set(tsMs, bucket);
    }
  }

  const sortedTs = [...buckets.keys()].sort((a, b) => a - b);
  const pvSeries: Array<[number, number]> = [];
  const loadSeries: Array<[number, number]> = [];
  const gridSeries: Array<[number, number]> = [];
  for (const t of sortedTs) {
    const b = buckets.get(t)!;
    pvSeries.push([t, round1(b.pv)]);
    loadSeries.push([t, round1(b.load)]);
    gridSeries.push([t, round1(b.grid)]);
  }

  const isAcme = slug === 'acme';
  const series: Highcharts.SeriesOptionsType[] = isAcme
    ? [
        { type: 'area', name: 'PV (太陽能)', data: pvSeries, color: '#fbbf24' },
        { type: 'area', name: 'ESS (儲能)', data: [], color: '#a78bfa' },
        { type: 'line', name: '園區負載', data: loadSeries, color: '#00a3df', lineWidth: 2 },
        { type: 'line', name: 'Grid (電網)', data: gridSeries, color: '#f87171', dashStyle: 'ShortDot', lineWidth: 1.5 },
      ]
    : [
        { type: 'area', name: '用電負載', data: loadSeries, color: '#00a3df' },
      ];

  return {
    chart: {
      type: 'area',
      backgroundColor: 'transparent',
      height: 280,
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
      title: { text: 'kW', style: { color: '#5e6e8a', fontSize: '10px' } },
      gridLineColor: '#1b2540',
      labels: { style: { color: '#93a3bf', fontSize: '11px' } },
      lineColor: '#243049',
    },
    plotOptions: {
      area: {
        fillOpacity: 0.18,
        marker: { enabled: false },
        lineWidth: 1.5,
      },
      line: {
        marker: { enabled: false },
      },
      series: {
        states: { hover: { enabled: true, lineWidth: 2 } },
        animation: { duration: 400 },
      },
    },
    legend: {
      itemStyle: { color: '#93a3bf', fontSize: '11px', fontWeight: '500' },
      itemHoverStyle: { color: '#e6edf7' },
      itemHiddenStyle: { color: '#5e6e8a' },
    },
    tooltip: {
      ...HIGHCHARTS_TOOLTIP,
      shared: true,
      xDateFormat: '%H:%M',
      valueDecimals: 0,
      valueSuffix: ' kW',
    },
    series,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
