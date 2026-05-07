import { useQuery } from '@tanstack/react-query';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { useMemo } from 'react';
import { dashboardApi, dashboardKeys, type AssetRow, type MetricsResponse } from '../../api/dashboard';

interface Props {
  slug: string;
}

export function BetaEuiRanking({ slug }: Props) {
  const assetsQuery = useQuery({
    queryKey: dashboardKeys.assets(slug),
    queryFn: () => dashboardApi.assets(slug),
  });
  const metricsQuery = useQuery({
    queryKey: dashboardKeys.metrics(slug, '24h', 'POWER'),
    queryFn: () => dashboardApi.metrics(slug, '24h', 'POWER'),
  });

  const options = useMemo(
    () => buildOptions(assetsQuery.data, metricsQuery.data),
    [assetsQuery.data, metricsQuery.data],
  );

  return (
    <section className="rounded-lg border border-border bg-bg-elevated overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-soft">
        <div className="text-xs uppercase tracking-wider text-fg-muted">
          22 棟商辦 EUI 排名 <span className="text-fg-subtle normal-case tracking-normal">· kWh/m² · Highcharts</span>
        </div>
        {(assetsQuery.isLoading || metricsQuery.isLoading) && (
          <span className="text-xs text-fg-subtle">…</span>
        )}
      </div>
      <div className="px-2 pb-2">
        <HighchartsReact highcharts={Highcharts} options={options} />
      </div>
    </section>
  );
}

interface Row {
  code: string;
  name: string;
  euiKwhPerM2: number;
}

function buildOptions(assets: AssetRow[] | undefined, metrics: MetricsResponse | undefined): Highcharts.Options {
  const assetsByName = new Map<string, { floorAreaM2: number; site: string }>();
  if (assets) {
    for (const a of assets) {
      if (a.type !== 'BUILDING' || !a.site) continue;
      const floorAreaM2 = (a.metadata as { floorAreaM2?: number }).floorAreaM2 ?? 10000;
      assetsByName.set(a.id, { floorAreaM2, site: a.site.code });
    }
  }

  const kwhByAsset = new Map<string, number>();
  if (metrics?.points) {
    for (const p of metrics.points) {
      if (p.assetType !== 'BUILDING') continue;
      kwhByAsset.set(p.assetId, (kwhByAsset.get(p.assetId) ?? 0) + p.value * 0.25);
    }
  }

  const rows: Row[] = [];
  for (const [assetId, kwh] of kwhByAsset.entries()) {
    const assetMeta = assetsByName.get(assetId);
    if (!assetMeta) continue;
    rows.push({
      code: assetMeta.site,
      name: assetMeta.site,
      euiKwhPerM2: round2(kwh / assetMeta.floorAreaM2),
    });
  }
  rows.sort((a, b) => b.euiKwhPerM2 - a.euiKwhPerM2);

  const avg = rows.length > 0 ? rows.reduce((s, r) => s + r.euiKwhPerM2, 0) / rows.length : 0;

  return {
    chart: {
      type: 'bar',
      backgroundColor: 'transparent',
      height: Math.max(320, rows.length * 22 + 80),
      style: { fontFamily: 'Inter, "Noto Sans TC", sans-serif' },
    },
    title: { text: undefined },
    credits: { enabled: false },
    xAxis: {
      categories: rows.map((r) => r.code),
      lineColor: '#243049',
      tickColor: '#243049',
      labels: { style: { color: '#93a3bf', fontSize: '11px' } },
    },
    yAxis: {
      title: { text: 'kWh/m² (24h)', style: { color: '#5e6e8a', fontSize: '10px' } },
      gridLineColor: '#1b2540',
      labels: { style: { color: '#93a3bf', fontSize: '11px' } },
      lineColor: '#243049',
      plotLines: [
        {
          value: avg,
          color: '#a78bfa',
          dashStyle: 'Dash',
          width: 1,
          label: {
            text: `平均 ${avg.toFixed(2)}`,
            style: { color: '#a78bfa', fontSize: '10px' },
            align: 'right',
          },
        },
      ],
    },
    plotOptions: {
      bar: {
        borderRadius: 3,
        pointPadding: 0.05,
        groupPadding: 0.1,
        dataLabels: {
          enabled: true,
          style: { color: '#93a3bf', fontSize: '10px', fontWeight: '500', textOutline: 'none' },
          format: '{y:.2f}',
        },
        colorByPoint: false,
        color: '#00a3df',
        states: { hover: { color: '#00c2ff' } },
      },
    },
    legend: { enabled: false },
    tooltip: {
      backgroundColor: '#111a2e',
      borderColor: '#243049',
      borderRadius: 6,
      style: { color: '#e6edf7', fontSize: '11px' },
      pointFormat: '<b>{point.y:.2f}</b> kWh/m²',
    },
    series: [
      {
        type: 'bar',
        name: 'EUI',
        data: rows.map((r) => ({
          y: r.euiKwhPerM2,
          color: r.euiKwhPerM2 > avg * 1.15 ? '#f87171' : r.euiKwhPerM2 < avg * 0.85 ? '#34d399' : '#00a3df',
        })),
      },
    ],
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
