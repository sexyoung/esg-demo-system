import { useEffect, useRef, useState } from 'react';
import { useFps } from '../lib/useFps';

const SAMPLE_BUFFER_SIZE = 80;
const SPARK_W = 80;
const SPARK_H = 28;
const NICE_MAXES = [60, 75, 90, 120, 144, 165, 240];

function ceilToNiceMax(peak: number): number {
  for (const v of NICE_MAXES) {
    if (v >= peak + 5) return v;
  }
  return Math.ceil((peak + 10) / 30) * 30;
}

export function PerfBadge() {
  const { fps } = useFps(250);
  const [hidden, setHidden] = useState(false);
  const [chartMax, setChartMax] = useState(60);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const samplesRef = useRef<number[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setHidden((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    samplesRef.current.push(fps);
    if (samplesRef.current.length > SAMPLE_BUFFER_SIZE) {
      samplesRef.current.shift();
    }
    const peak = samplesRef.current.length > 0 ? Math.max(...samplesRef.current) : 60;
    const nextMax = ceilToNiceMax(Math.max(peak, 60));
    if (nextMax !== chartMax) setChartMax(nextMax);
    drawSpark(canvasRef.current, samplesRef.current, nextMax);
  }, [fps, chartMax]);

  if (hidden) return null;

  const fpsClass = fps >= 55 ? 'text-success' : fps >= 30 ? 'text-warn' : 'text-danger';

  return (
    <div
      className="rounded-md border border-border bg-bg-soft px-2.5 py-1 text-[10px] tabular-nums flex items-center gap-2 select-none"
      title="Cmd/Ctrl+Shift+P 切換顯示"
    >
      <canvas
        ref={canvasRef}
        width={SPARK_W * 2}
        height={SPARK_H * 2}
        style={{ width: SPARK_W, height: SPARK_H }}
        className="block"
      />
      <div className="relative shrink-0" style={{ width: 14, height: SPARK_H }}>
        <span className="absolute left-0 -top-0.5 text-[8px] leading-none text-fg-subtle">{chartMax}</span>
        {chartMax > 90 && (
          <span
            className="absolute left-0 text-[8px] leading-none text-success/70"
            style={{ top: SPARK_H * (1 - 60 / chartMax) - 3 }}
          >
            60
          </span>
        )}
        <span
          className="absolute left-0 text-[8px] leading-none text-warn/70"
          style={{ top: SPARK_H * (1 - 30 / chartMax) - 3 }}
        >
          30
        </span>
        <span className="absolute left-0 -bottom-0.5 text-[8px] leading-none text-fg-subtle">0</span>
      </div>
      <span className="flex items-baseline gap-1">
        <span className={`text-base font-bold ${fpsClass}`}>{fps}</span>
        <span className="text-fg-subtle text-[10px] font-semibold uppercase tracking-wider">fps</span>
      </span>
    </div>
  );
}

function drawSpark(canvas: HTMLCanvasElement | null, samples: number[], chartMax: number) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;

  ctx.lineWidth = 1 * dpr;
  ctx.setLineDash([2 * dpr, 3 * dpr]);

  ctx.strokeStyle = 'rgba(52, 211, 153, 0.35)';
  const refY60 = h - (60 / chartMax) * h;
  ctx.beginPath();
  ctx.moveTo(0, refY60);
  ctx.lineTo(w, refY60);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
  const refY30 = h - (30 / chartMax) * h;
  ctx.beginPath();
  ctx.moveTo(0, refY30);
  ctx.lineTo(w, refY30);
  ctx.stroke();

  ctx.setLineDash([]);

  if (samples.length < 2) return;

  const stepX = w / (SAMPLE_BUFFER_SIZE - 1);
  const offsetX = (SAMPLE_BUFFER_SIZE - samples.length) * stepX;
  const points = samples.map((v, i) => {
    const x = offsetX + i * stepX;
    const y = h - (Math.min(chartMax, Math.max(0, v)) / chartMax) * h;
    return [x, y] as const;
  });

  const last = samples[samples.length - 1];
  const fillColor =
    last >= 55 ? 'rgba(52, 211, 153, 0.18)' : last >= 30 ? 'rgba(251, 191, 36, 0.18)' : 'rgba(248, 113, 113, 0.18)';
  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.moveTo(points[0][0], h);
  for (const [x, y] of points) ctx.lineTo(x, y);
  ctx.lineTo(points[points.length - 1][0], h);
  ctx.closePath();
  ctx.fill();

  const lineColor = last >= 55 ? '#34d399' : last >= 30 ? '#fbbf24' : '#f87171';
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1.5 * dpr;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.stroke();
}
