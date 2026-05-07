import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { useMemo } from 'react';
import type { DailySeriesPoint } from '../../lib/formulas';

interface Props {
  series: DailySeriesPoint[];
  baselinePeakKw: number;
}

export function PreviewChart({ series, baselinePeakKw }: Props) {
  const options = useMemo<Highcharts.Options>(() => buildOptions(series, baselinePeakKw), [series, baselinePeakKw]);

  return (
    <section className="rounded-lg border border-border bg-bg-elevated overflow-hidden">
      <div className="px-4 py-2 border-b border-border-soft flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-fg-muted">
          典型日 24h preview · 模擬天 7/15 (summer weekday) <span className="text-fg-subtle normal-case tracking-normal">· Highcharts</span>
        </div>
        <div className="text-xs text-fg-subtle">PV 黃 / Load 青 / ESS 紫 / Grid 紅</div>
      </div>
      <div className="px-2 pb-2">
        <HighchartsReact highcharts={Highcharts} options={options} />
      </div>
    </section>
  );
}

function buildOptions(points: DailySeriesPoint[], baselinePeakKw: number): Highcharts.Options {
  const cat = points.map((p) => p.hour);
  return {
    chart: {
      backgroundColor: 'transparent',
      height: 280,
      style: { fontFamily: 'Inter, "Noto Sans TC", sans-serif' },
    },
    title: { text: undefined },
    credits: { enabled: false },
    xAxis: {
      categories: cat.map((h) => `${Math.floor(h).toString().padStart(2, '0')}:${((h % 1) * 60).toString().padStart(2, '0')}`),
      tickInterval: 12,
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
      plotLines: baselinePeakKw > 0
        ? [
            {
              value: baselinePeakKw,
              color: '#5e6e8a',
              dashStyle: 'Dash',
              width: 1,
              label: { text: `Baseline peak ${Math.round(baselinePeakKw)} kW`, style: { color: '#5e6e8a', fontSize: '10px' }, align: 'right' },
            },
          ]
        : [],
    },
    plotOptions: {
      series: {
        marker: { enabled: false },
        animation: { duration: 200 },
      },
    },
    legend: {
      itemStyle: { color: '#93a3bf', fontSize: '11px' },
      itemHoverStyle: { color: '#e6edf7' },
      itemHiddenStyle: { color: '#5e6e8a' },
    },
    tooltip: {
      shared: true,
      backgroundColor: '#111a2e',
      borderColor: '#243049',
      borderRadius: 6,
      style: { color: '#e6edf7', fontSize: '11px' },
      valueDecimals: 0,
      valueSuffix: ' kW',
    },
    series: [
      { type: 'area', name: 'PV', data: points.map((p) => p.pvKw), color: '#fbbf24', fillOpacity: 0.18, lineWidth: 1.4 },
      { type: 'line', name: 'Load', data: points.map((p) => p.loadKw), color: '#00a3df', lineWidth: 2 },
      { type: 'line', name: 'ESS (+charge / -discharge)', data: points.map((p) => p.essKw), color: '#a78bfa', lineWidth: 1.5, dashStyle: 'ShortDash' },
      { type: 'line', name: 'Grid', data: points.map((p) => p.gridKw), color: '#f87171', lineWidth: 1.5, dashStyle: 'Dot' },
    ],
  };
}
