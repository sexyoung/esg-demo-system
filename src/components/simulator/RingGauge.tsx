import * as d3 from 'd3';
import { useMemo } from 'react';
import { useCountUp } from '../../lib/animateNumber';

interface Props {
  label: string;
  value: number;
  unit: string;
  fraction: number;
  tone?: 'positive' | 'negative' | 'neutral';
  size?: number;
  decimals?: number;
  prefix?: string;
  subLabel?: string;
}

export function RingGauge({
  label,
  value,
  unit,
  fraction,
  tone = 'positive',
  size = 160,
  decimals = 1,
  prefix = '',
  subLabel,
}: Props) {
  const animatedValue = useCountUp(value, 350);
  const animatedFraction = useCountUp(Math.max(0, Math.min(1, fraction)), 350);

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 12;

  const trackPath = useMemo(() => {
    const arc = d3.arc<null>().innerRadius(radius - 8).outerRadius(radius).startAngle(-Math.PI * 0.75).endAngle(Math.PI * 0.75);
    return arc(null) ?? '';
  }, [radius]);

  const fillPath = useMemo(() => {
    const arc = d3
      .arc<null>()
      .innerRadius(radius - 8)
      .outerRadius(radius)
      .startAngle(-Math.PI * 0.75)
      .endAngle(-Math.PI * 0.75 + (Math.PI * 1.5) * animatedFraction);
    return arc(null) ?? '';
  }, [radius, animatedFraction]);

  const fillColor = tone === 'positive' ? '#34d399' : tone === 'negative' ? '#f87171' : '#00a3df';
  const isFinite = Number.isFinite(value);

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-4 flex flex-col items-center">
      <div className="text-xs uppercase tracking-wider text-fg-muted">{label}</div>
      <svg width={size} height={size} className="mt-2">
        <g transform={`translate(${cx},${cy})`}>
          <path d={trackPath} fill="#243049" />
          <path d={fillPath} fill={fillColor} />
          <text textAnchor="middle" y={-2} className="tabular-nums" fill="#e6edf7" fontSize={size > 140 ? 22 : 18} fontWeight={600}>
            {!isFinite ? 'N/A' : `${prefix}${formatNumber(animatedValue, decimals)}`}
          </text>
          <text textAnchor="middle" y={20} fill="#93a3bf" fontSize={11}>
            {unit}
          </text>
        </g>
      </svg>
      {subLabel && <div className="text-xs text-fg-subtle mt-1 text-center">{subLabel}</div>}
    </div>
  );
}

function formatNumber(n: number, decimals: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
