import { useQuery } from '@tanstack/react-query';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { useMemo } from 'react';
import { dashboardApi, dashboardKeys, type EsgSummary } from '../../../api/dashboard';
import { CHART_FONT, HIGHCHARTS_TOOLTIP } from '../../../lib/chartTheme';
import { WidgetError, WidgetSkeleton } from '../WidgetState';

interface Props {
  slug: string;
}

export function BuRanking({ slug }: Props) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: dashboardKeys.esgSummary(slug),
    queryFn: () => dashboardApi.esgSummary(slug),
  });

  const options = useMemo<Highcharts.Options>(() => buildOptions(data), [data]);

  if (error && !data) {
    return (
      <section className="rounded-lg border border-border bg-bg-elevated">
        <WidgetError message={String(error)} onRetry={() => void refetch()} />
      </section>
    );
  }
  if (isLoading || !data) {
    return <WidgetSkeleton variant="chart" height={260} />;
  }

  return (
    <section className="rounded-lg border border-border bg-bg-elevated overflow-hidden">
      <header className="flex items-center justify-between px-4 py-2 border-b border-border-soft">
        <div className="text-xs uppercase tracking-wider text-fg-muted">
          BU Ranking · 各事業群減量
          <span className="text-fg-subtle normal-case tracking-normal ml-2">· Highcharts</span>
        </div>
        <div className="text-xs text-fg-subtle">
          baseline: {data.target.baselineYear}
        </div>
      </header>
      <div className="px-2 pb-2">
        <HighchartsReact highcharts={Highcharts} options={options} />
      </div>
    </section>
  );
}

function buildOptions(data: EsgSummary | undefined): Highcharts.Options {
  const rows = [...(data?.buRanking ?? [])].sort((a, b) => b.reductionPct - a.reductionPct);
  const categories = rows.map((r) => r.name);
  const reductions = rows.map((r) => r.reductionPct);
  const co2Tons = rows.map((r) => r.co2Tons);
  const colors = reductions.map((pct) => {
    if (pct >= 25) return '#34d399';
    if (pct >= 15) return '#00a3df';
    if (pct >= 8) return '#fbbf24';
    return '#f87171';
  });

  return {
    chart: {
      type: 'bar',
      backgroundColor: 'transparent',
      height: 260,
      style: { fontFamily: CHART_FONT },
    },
    title: { text: undefined },
    credits: { enabled: false },
    xAxis: {
      categories,
      lineColor: '#243049',
      tickColor: '#243049',
      labels: { style: { color: '#e6edf7', fontSize: '11px', fontWeight: '500' } },
      gridLineColor: 'transparent',
    },
    yAxis: {
      title: { text: '減量 %', style: { color: '#5e6e8a', fontSize: '10px' } },
      gridLineColor: '#1b2540',
      labels: {
        formatter() {
          return `${this.value}%`;
        },
        style: { color: '#93a3bf', fontSize: '11px' },
      },
      lineColor: '#243049',
      min: 0,
    },
    plotOptions: {
      bar: {
        borderWidth: 0,
        pointPadding: 0.1,
        groupPadding: 0.1,
        colorByPoint: true,
        colors,
        dataLabels: {
          enabled: true,
          align: 'left',
          inside: false,
          formatter() {
            return `−${this.y}%`;
          },
          style: {
            color: '#e6edf7',
            textOutline: 'none',
            fontWeight: '600',
            fontSize: '11px',
          },
        },
      },
      series: { animation: { duration: 600 } },
    },
    legend: { enabled: false },
    tooltip: {
      ...HIGHCHARTS_TOOLTIP,
      formatter(this: Highcharts.Point) {
        const i = this.index ?? 0;
        return `<b>${categories[i]}</b><br/>減量 <b>−${this.y}%</b><br/>本月 ${co2Tons[i].toLocaleString()} tCO₂e`;
      },
    },
    series: [
      {
        type: 'bar',
        name: '減量 %',
        data: reductions,
      },
    ],
  };
}
