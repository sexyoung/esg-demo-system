import { useQuery } from '@tanstack/react-query';
import * as echarts from 'echarts/core';
import { SankeyChart as EChartsSankey } from 'echarts/charts';
import { TitleComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useMemo, useRef } from 'react';
import { dashboardApi, dashboardKeys, type FlowsResponse } from '../../api/dashboard';
import { CHART_FONT, ECHARTS_TOOLTIP_BASE } from '../../lib/chartTheme';

echarts.use([EChartsSankey, TitleComponent, TooltipComponent, CanvasRenderer]);

const NODE_COLORS: Record<string, string> = {
  PV: '#fbbf24',
  ESS: '#a78bfa',
  Grid: '#f87171',
  Load: '#00a3df',
};

interface Props {
  slug: string;
}

export function SankeyChart({ slug }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: dashboardKeys.flows(slug, '24h'),
    queryFn: () => dashboardApi.flows(slug, '24h'),
    refetchInterval: 60_000,
  });

  const option = useMemo(() => buildOption(data), [data]);

  useEffect(() => {
    if (!containerRef.current) return;
    chartRef.current = echarts.init(containerRef.current);
    const onResize = () => chartRef.current?.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.setOption(option, true);
  }, [option]);

  return (
    <section className="rounded-lg border border-border bg-bg-elevated overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-soft">
        <div className="text-xs uppercase tracking-wider text-fg-muted">
          24h 能流圖（Sankey）<span className="text-fg-subtle normal-case tracking-normal">· ECharts</span>
        </div>
        <div className="text-xs text-fg-muted tabular-nums">
          {data && (
            <>
              <span className="text-warn">PV</span> {Math.round(data.totals.pv).toLocaleString()} kWh
              <span className="mx-2 text-fg-subtle">·</span>
              <span className="text-accent-soft">Load</span> {Math.round(data.totals.load).toLocaleString()} kWh
            </>
          )}
        </div>
      </div>
      <div ref={containerRef} className="h-[300px] w-full" />
      {isLoading && <div className="px-4 pb-2 text-xs text-fg-subtle">載入中…</div>}
      {error && <div className="px-4 pb-2 text-xs text-danger">load error</div>}
    </section>
  );
}

function buildOption(data: FlowsResponse | undefined): echarts.EChartsCoreOption {
  if (!data || data.flows.length === 0) {
    return {
      tooltip: {},
      series: [{ type: 'sankey', data: [], links: [] }],
    };
  }

  const nodeNames = new Set<string>();
  for (const f of data.flows) {
    nodeNames.add(f.source);
    nodeNames.add(f.target);
  }
  const nodes = [...nodeNames].map((name) => ({
    name,
    itemStyle: { color: NODE_COLORS[name] ?? '#5e6e8a' },
  }));

  return {
    tooltip: {
      ...ECHARTS_TOOLTIP_BASE,
      trigger: 'item',
      formatter: (info: { dataType: string; data: { source?: string; target?: string; value?: number; name?: string } }) => {
        if (info.dataType === 'edge') {
          return `${info.data.source} → ${info.data.target}<br/><b>${Math.round(info.data.value ?? 0).toLocaleString()}</b> kWh`;
        }
        return info.data.name ?? '';
      },
    },
    series: [
      {
        type: 'sankey',
        nodeWidth: 18,
        nodeGap: 18,
        layoutIterations: 32,
        emphasis: { focus: 'adjacency' },
        lineStyle: { color: 'gradient', curveness: 0.5, opacity: 0.55 },
        label: { color: '#e6edf7', fontFamily: CHART_FONT, fontSize: 12 },
        data: nodes,
        links: data.flows.map((f) => ({ source: f.source, target: f.target, value: f.value })),
      },
    ],
  };
}
