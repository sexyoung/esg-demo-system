import { useQuery } from '@tanstack/react-query';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { useMemo, useState } from 'react';
import { dashboardApi, dashboardKeys, type MetricsResponse } from '../../api/dashboard';

interface Props {
  slug: string;
}

export function GammaOeeDual({ slug }: Props) {
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const assetsQuery = useQuery({
    queryKey: dashboardKeys.assets(slug),
    queryFn: () => dashboardApi.assets(slug),
  });
  const powerQuery = useQuery({
    queryKey: dashboardKeys.metrics(slug, '24h', 'POWER'),
    queryFn: () => dashboardApi.metrics(slug, '24h', 'POWER'),
  });
  const oeeQuery = useQuery({
    queryKey: dashboardKeys.metrics(slug, '24h', 'OEE'),
    queryFn: () => dashboardApi.metrics(slug, '24h', 'OEE'),
  });

  const fabAssets = useMemo(() => {
    if (!assetsQuery.data) return [];
    return assetsQuery.data.filter((a) => a.type === 'LINE');
  }, [assetsQuery.data]);

  const activeAssetId = selectedAssetId ?? fabAssets[0]?.id ?? null;
  const activeAsset = fabAssets.find((a) => a.id === activeAssetId) ?? fabAssets[0];

  const options = useMemo(
    () => buildOptions(activeAssetId, powerQuery.data, oeeQuery.data),
    [activeAssetId, powerQuery.data, oeeQuery.data],
  );

  return (
    <section className="rounded-lg border border-border bg-bg-elevated overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-soft gap-3">
        <div className="text-xs uppercase tracking-wider text-fg-muted">
          Fab 用電 × OEE 雙軸 <span className="text-fg-subtle normal-case tracking-normal">· Highcharts dual-axis</span>
        </div>
        <select
          className="bg-bg-soft border border-border-soft text-xs text-fg rounded px-2 py-1"
          value={activeAssetId ?? ''}
          onChange={(e) => setSelectedAssetId(e.target.value)}
        >
          {fabAssets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.site?.code ?? a.name}
            </option>
          ))}
        </select>
      </div>
      <div className="px-2 pb-2">
        {activeAsset && <div className="px-2 py-1 text-xs text-fg-subtle">{activeAsset.name}</div>}
        <HighchartsReact highcharts={Highcharts} options={options} />
      </div>
    </section>
  );
}

function buildOptions(
  assetId: string | null,
  power: MetricsResponse | undefined,
  oee: MetricsResponse | undefined,
): Highcharts.Options {
  const powerSeries: Array<[number, number]> = [];
  const oeeSeries: Array<[number, number]> = [];

  if (assetId && power?.points) {
    for (const p of power.points) {
      if (p.assetId !== assetId) continue;
      powerSeries.push([new Date(p.timestamp).getTime(), p.value]);
    }
  }
  if (assetId && oee?.points) {
    for (const p of oee.points) {
      if (p.assetId !== assetId) continue;
      oeeSeries.push([new Date(p.timestamp).getTime(), p.value * 100]);
    }
  }

  return {
    chart: {
      backgroundColor: 'transparent',
      height: 280,
      style: { fontFamily: 'Inter, "Noto Sans TC", sans-serif' },
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
    yAxis: [
      {
        title: { text: 'kW', style: { color: '#00a3df', fontSize: '10px' } },
        gridLineColor: '#1b2540',
        labels: { style: { color: '#93a3bf', fontSize: '11px' } },
        lineColor: '#243049',
      },
      {
        title: { text: 'OEE %', style: { color: '#34d399', fontSize: '10px' } },
        labels: { format: '{value}%', style: { color: '#93a3bf', fontSize: '11px' } },
        opposite: true,
        gridLineWidth: 0,
        min: 60,
        max: 100,
      },
    ],
    tooltip: {
      shared: true,
      backgroundColor: '#111a2e',
      borderColor: '#243049',
      borderRadius: 6,
      style: { color: '#e6edf7', fontSize: '11px' },
    },
    legend: {
      itemStyle: { color: '#93a3bf', fontSize: '11px', fontWeight: '500' },
    },
    plotOptions: {
      series: {
        marker: { enabled: false },
        animation: { duration: 400 },
      },
    },
    series: [
      {
        type: 'area',
        name: '用電功率 (kW)',
        yAxis: 0,
        data: powerSeries,
        color: '#00a3df',
        fillOpacity: 0.18,
        lineWidth: 1.4,
        tooltip: { valueDecimals: 0, valueSuffix: ' kW' },
      },
      {
        type: 'line',
        name: 'OEE',
        yAxis: 1,
        data: oeeSeries,
        color: '#34d399',
        lineWidth: 2,
        tooltip: { valueDecimals: 1, valueSuffix: ' %' },
      },
    ],
  };
}
