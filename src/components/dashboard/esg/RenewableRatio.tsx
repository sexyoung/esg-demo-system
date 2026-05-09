import { useQuery } from '@tanstack/react-query';
import * as d3 from 'd3';
import { useMemo } from 'react';
import { dashboardApi, dashboardKeys } from '../../../api/dashboard';
import { useCountUp } from '../../../lib/animateNumber';
import { WidgetError, WidgetSkeleton } from '../WidgetState';

interface Props {
  slug: string;
}

export function RenewableRatio({ slug }: Props) {
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
    return <WidgetSkeleton variant="cards" height={180} />;
  }

  const last = data.monthly[data.monthly.length - 1];
  const first = data.monthly[0];
  const ratio = last?.renewableRatio ?? 0;
  const yearStartRatio = first?.renewableRatio ?? 0;
  const ytdGain = (ratio - yearStartRatio) * 100;
  const targetPct =
    data.target.kind === 'RE100'
      ? 100
      : data.target.kind === 'SBTi-1.5C'
        ? 50
        : 50;

  return (
    <section className="rounded-lg border border-border bg-bg-elevated p-4 flex flex-col h-full">
      <div className="text-xs uppercase tracking-wider text-fg-muted">
        再生能源占比
      </div>
      <div className="flex-1 flex items-center justify-center min-h-[140px]">
        <Donut ratio={ratio} targetPct={targetPct} />
      </div>
      <div className="text-xs text-fg-muted tabular-nums flex items-center justify-between">
        <span>
          年初:{' '}
          <span className="text-fg">{(yearStartRatio * 100).toFixed(1)}%</span>
        </span>
        <span className={ytdGain >= 0 ? 'text-success' : 'text-danger'}>
          YTD: {ytdGain >= 0 ? '+' : ''}
          {ytdGain.toFixed(1)} pp
        </span>
        <span>
          目標:{' '}
          <span className="text-success">{targetPct}%</span>
        </span>
      </div>
    </section>
  );
}

function Donut({ ratio, targetPct }: { ratio: number; targetPct: number }) {
  const animated = useCountUp(ratio, 450);
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 12;

  const trackPath = useMemo(() => {
    const arc = d3
      .arc<null>()
      .innerRadius(radius - 10)
      .outerRadius(radius)
      .startAngle(0)
      .endAngle(Math.PI * 2);
    return arc(null) ?? '';
  }, [radius]);

  const targetMarkAngle = (targetPct / 100) * Math.PI * 2;
  const targetPath = useMemo(() => {
    const arc = d3
      .arc<null>()
      .innerRadius(radius - 12)
      .outerRadius(radius + 2)
      .startAngle(targetMarkAngle - 0.02)
      .endAngle(targetMarkAngle + 0.02);
    return arc(null) ?? '';
  }, [radius, targetMarkAngle]);

  const fillPath = useMemo(() => {
    const arc = d3
      .arc<null>()
      .innerRadius(radius - 10)
      .outerRadius(radius)
      .startAngle(0)
      .endAngle(animated * Math.PI * 2);
    return arc(null) ?? '';
  }, [radius, animated]);

  return (
    <svg width={size} height={size}>
      <g transform={`translate(${cx},${cy}) rotate(-90)`}>
        <path d={trackPath} fill="#243049" />
        <path d={fillPath} fill="#34d399" />
        <path d={targetPath} fill="#fbbf24" />
      </g>
      <g transform={`translate(${cx},${cy})`}>
        <text
          textAnchor="middle"
          y={-4}
          fill="#e6edf7"
          fontSize={28}
          fontWeight={600}
          className="tabular-nums"
        >
          {(animated * 100).toFixed(1)}
        </text>
        <text textAnchor="middle" y={16} fill="#93a3bf" fontSize={11}>
          % 再生
        </text>
      </g>
    </svg>
  );
}
