import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import uPlot, { type AlignedData, type Options, type Plugin } from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { useFps } from '../../lib/useFps';
import { capPausedBuffer, formatTimeRange, mergePausedBuffer } from './livePowerTickHelpers';

const MAX_POINTS = 1800;
const MAX_PAUSED_BUFFER = 1800; // 30 min @ 1Hz cap
const STATS_INTERVAL_MS = 1000;
const NORMAL_BAND_FRACTION = 0.15;

const TENANT_BASELINE_KW: Record<string, number> = {
  acme: 1800,
  beta: 220,
  gamma: 6500,
};

interface Bounds {
  upper: number;
  lower: number;
  baseline: number;
}

function boundsForSlug(slug: string): Bounds {
  const baseline = TENANT_BASELINE_KW[slug] ?? 1000;
  return {
    baseline,
    upper: baseline * (1 + NORMAL_BAND_FRACTION),
    lower: baseline * (1 - NORMAL_BAND_FRACTION),
  };
}

interface Props {
  slug: string;
}

interface Stats {
  evtPerSec: number;
  buffer: number;
  status: 'connecting' | 'live' | 'error';
}

export function LivePowerTick({ slug }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  const dataRef = useRef<{ ts: number[]; kw: number[] }>({ ts: [], kw: [] });
  const bufferRef = useRef<Array<[number, number]>>([]);
  const rafRef = useRef<number | null>(null);
  const evtCountRef = useRef(0);
  const lastStatTsRef = useRef(performance.now());
  const boundsRef = useRef<Bounds>(boundsForSlug(slug));
  const xSplitsRef = useRef<number[]>([]);
  const { fps } = useFps();
  const [stats, setStats] = useState<Stats>({ evtPerSec: 0, buffer: 0, status: 'connecting' });
  const [mode, setMode] = useState<'live' | 'paused'>('live');
  const [visibleRangeLabel, setVisibleRangeLabel] = useState<string>('');
  const modeRef = useRef<'live' | 'paused'>('live');
  const pausedBufferRef = useRef<Array<[number, number]>>([]);
  const frozenRangeRef = useRef<{ min: number; max: number } | null>(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const bounds = useMemo(() => boundsForSlug(slug), [slug]);
  useEffect(() => {
    boundsRef.current = bounds;
    plotRef.current?.redraw(false);
  }, [bounds]);

  const handlePause = useCallback(() => {
    const { ts } = dataRef.current;
    if (ts.length === 0) return;
    const min = ts[0];
    const max = ts[ts.length - 1];
    frozenRangeRef.current = { min, max };
    setVisibleRangeLabel(formatTimeRange(min, max));
    setMode('paused');
  }, []);

  const handleResume = useCallback(() => {
    const { ts, kw } = dataRef.current;
    mergePausedBuffer(ts, kw, pausedBufferRef.current, MAX_POINTS);
    pausedBufferRef.current = [];
    frozenRangeRef.current = null;
    setVisibleRangeLabel('');
    modeRef.current = 'live';
    if (plotRef.current && ts.length > 0) {
      plotRef.current.setScale('x', { min: ts[0], max: ts[ts.length - 1] });
      plotRef.current.setData([ts, kw] as unknown as AlignedData);
    }
    setMode('live');
  }, []);

  const handleQuickZoom = useCallback((seconds: number | 'all') => {
    const range = frozenRangeRef.current;
    const plot = plotRef.current;
    if (!range || !plot) return;
    const { min, max } = range;
    const newMin = seconds === 'all' ? min : Math.max(min, max - seconds);
    plot.setScale('x', { min: newMin, max });
    plot.redraw(false, true);
    setVisibleRangeLabel(formatTimeRange(newMin, max));
  }, []);

  const handleWheel = useCallback((e: WheelEvent) => {
    if (modeRef.current !== 'paused') return;
    const plot = plotRef.current;
    const range = frozenRangeRef.current;
    if (!plot || !range) return;
    e.preventDefault();
    const curMin = plot.scales.x.min;
    const curMax = plot.scales.x.max;
    if (typeof curMin !== 'number' || typeof curMax !== 'number') return;
    const rect = plot.over.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    if (cursorX < 0 || cursorX > rect.width) return;
    const cursorVal = plot.posToVal(cursorX, 'x');
    const factor = Math.exp(e.deltaY * 0.0008);
    let newMin = cursorVal - (cursorVal - curMin) * factor;
    let newMax = cursorVal + (curMax - cursorVal) * factor;
    if (newMax - newMin < 1) return;
    newMin = Math.max(range.min, newMin);
    newMax = Math.min(range.max, newMax);
    plot.setScale('x', { min: newMin, max: newMax });
    plot.redraw(false, true);
    setVisibleRangeLabel(formatTimeRange(newMin, newMax));
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  useEffect(() => {
    if (!containerRef.current) return;

    const bandsPlugin: Plugin = {
      hooks: {
        setScale: (u, key) => {
          if (key !== 'x') return;
          if (modeRef.current !== 'paused') return;
          const min = u.scales.x.min;
          const max = u.scales.x.max;
          if (typeof min === 'number' && typeof max === 'number') {
            setVisibleRangeLabel(formatTimeRange(min, max));
          }
        },
        drawClear: (u) => {
          const b = boundsRef.current;
          const ctx = u.ctx;
          const left = u.bbox.left;
          const top = u.bbox.top;
          const width = u.bbox.width;
          const height = u.bbox.height;
          const bottom = top + height;

          // anomaly fill: continuous segments where data is out of band
          const ts = (u.data[0] ?? []) as number[];
          const vs = (u.data[1] ?? []) as Array<number | null>;
          if (ts.length > 1) {
            ctx.save();
            ctx.fillStyle = 'rgba(248, 113, 113, 0.16)';
            let segStart: number | null = null;
            for (let i = 0; i < ts.length; i++) {
              const v = vs[i];
              const isOut = v != null && (v > b.upper || v < b.lower);
              if (isOut && segStart === null) segStart = i;
              else if (!isOut && segStart !== null) {
                const x1 = u.valToPos(ts[segStart], 'x', true);
                const x2 = u.valToPos(ts[i], 'x', true);
                ctx.fillRect(x1, top, Math.max(2, x2 - x1), height);
                segStart = null;
              }
            }
            if (segStart !== null) {
              const x1 = u.valToPos(ts[segStart], 'x', true);
              const x2 = u.valToPos(ts[ts.length - 1], 'x', true);
              ctx.fillRect(x1, top, Math.max(2, x2 - x1), height);
            }
            ctx.restore();
          }

          // out-of-band horizontal zones (very faint, behind everything)
          const upperY = u.valToPos(b.upper, 'y', true);
          const lowerY = u.valToPos(b.lower, 'y', true);
          ctx.save();
          ctx.fillStyle = 'rgba(248, 113, 113, 0.04)';
          if (upperY > top) ctx.fillRect(left, top, width, upperY - top);
          if (lowerY < bottom) ctx.fillRect(left, lowerY, width, bottom - lowerY);
          ctx.restore();
        },
        draw: (u) => {
          const b = boundsRef.current;
          const ctx = u.ctx;
          const dpr = window.devicePixelRatio || 1;
          const left = u.bbox.left;
          const width = u.bbox.width;
          const upperY = u.valToPos(b.upper, 'y', true);
          const lowerY = u.valToPos(b.lower, 'y', true);
          const baselineY = u.valToPos(b.baseline, 'y', true);

          ctx.save();
          ctx.lineWidth = 1 * dpr;
          ctx.setLineDash([4 * dpr, 4 * dpr]);
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
          ctx.beginPath();
          ctx.moveTo(left, upperY);
          ctx.lineTo(left + width, upperY);
          ctx.moveTo(left, lowerY);
          ctx.lineTo(left + width, lowerY);
          ctx.stroke();

          ctx.setLineDash([1 * dpr, 4 * dpr]);
          ctx.strokeStyle = 'rgba(94, 110, 138, 0.5)';
          ctx.beginPath();
          ctx.moveTo(left, baselineY);
          ctx.lineTo(left + width, baselineY);
          ctx.stroke();

          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(251, 191, 36, 0.85)';
          ctx.font = `${11 * dpr}px Inter, "Noto Sans TC"`;
          ctx.textAlign = 'right';
          ctx.textBaseline = 'alphabetic';
          ctx.fillText(`+${Math.round(NORMAL_BAND_FRACTION * 100)}% ${Math.round(b.upper)} kW`, left + width - 4 * dpr, upperY - 3 * dpr);
          ctx.fillText(`−${Math.round(NORMAL_BAND_FRACTION * 100)}% ${Math.round(b.lower)} kW`, left + width - 4 * dpr, lowerY + 12 * dpr);
          ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
          ctx.fillText(`baseline ${Math.round(b.baseline)} kW`, left + width - 4 * dpr, baselineY - 3 * dpr);
          ctx.restore();

          // staggered x-axis time labels (top row + bottom row alternating)
          const splits = xSplitsRef.current;
          if (splits.length > 0) {
            const baseY = u.bbox.top + u.bbox.height + 8 * dpr;
            const rowGap = 18 * dpr;
            ctx.save();
            ctx.font = `${13 * dpr}px Inter, "Noto Sans TC"`;
            ctx.fillStyle = '#94a3b8';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            for (let i = 0; i < splits.length; i++) {
              const t = splits[i];
              const x = u.valToPos(t, 'x', true);
              if (x < u.bbox.left - 2 || x > u.bbox.left + u.bbox.width + 2) continue;
              const label = new Date(t * 1000).toLocaleTimeString('en-US', { hour12: false });
              const y = baseY + (i % 2 === 0 ? 0 : rowGap);
              ctx.fillText(label, x, y);
            }
            ctx.restore();
          }
        },
      },
    };

    const opts: Options = {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      pxAlign: false,
      cursor: {
        show: true,
        x: false,
        y: false,
        points: { show: false },
        drag: { x: true, y: false, dist: 8, setScale: true },
      },
      legend: { show: false },
      plugins: [bandsPlugin],
      scales: {
        x: { time: true },
        y: { auto: true },
      },
      axes: [
        {
          stroke: '#5e6e8a',
          grid: { stroke: 'rgba(36, 48, 73, 0.5)' },
          ticks: { show: false },
          size: 50,
          space: 80,
          values: (_u, splits) => {
            xSplitsRef.current = splits;
            return splits.map(() => '');
          },
        },
        {
          stroke: '#5e6e8a',
          grid: { stroke: 'rgba(36, 48, 73, 0.5)' },
          ticks: { show: false },
          values: (_u, ticks) => ticks.map((t) => `${(t / 1).toLocaleString('en-US', { maximumFractionDigits: 0 })} kW`),
        },
      ],
      series: [
        {},
        {
          stroke: '#00a3df',
          width: 1.5,
          fill: 'rgba(0,163,223,0.10)',
          points: { show: false },
        },
      ],
    };

    plotRef.current = new uPlot(opts, [[], []] as unknown as AlignedData, containerRef.current);

    function onResize() {
      if (!containerRef.current || !plotRef.current) return;
      plotRef.current.setSize({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
    }
    const obs = new ResizeObserver(onResize);
    obs.observe(containerRef.current);

    return () => {
      obs.disconnect();
      plotRef.current?.destroy();
      plotRef.current = null;
    };
  }, []);

  useEffect(() => {
    setStats((s) => ({ ...s, status: 'connecting' }));
    setMode('live');
    modeRef.current = 'live';
    pausedBufferRef.current = [];
    frozenRangeRef.current = null;
    setVisibleRangeLabel('');
    dataRef.current = { ts: [], kw: [] };
    bufferRef.current = [];
    if (plotRef.current) {
      plotRef.current.setData([[], []] as unknown as AlignedData);
    }

    const es = new EventSource(`/api/tenants/${slug}/live`);

    function flush() {
      const buf = bufferRef.current;
      if (buf.length > 0 && plotRef.current) {
        if (modeRef.current === 'paused') {
          for (const entry of buf) pausedBufferRef.current.push(entry);
          capPausedBuffer(pausedBufferRef.current, MAX_PAUSED_BUFFER);
          bufferRef.current = [];
        } else {
          const { ts, kw } = dataRef.current;
          for (const [t, v] of buf) {
            ts.push(t);
            kw.push(v);
          }
          if (ts.length > MAX_POINTS) {
            const drop = ts.length - MAX_POINTS;
            ts.splice(0, drop);
            kw.splice(0, drop);
          }
          plotRef.current.setData([ts, kw] as unknown as AlignedData);
          bufferRef.current = [];
        }
      }
      rafRef.current = null;
    }

    es.addEventListener('tick', (ev) => {
      const evt = ev as MessageEvent;
      try {
        const payload = JSON.parse(evt.data) as { ts: number; kw: number };
        bufferRef.current.push([payload.ts / 1000, payload.kw]);
        evtCountRef.current += 1;
        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(flush);
        }
      } catch {
        // ignore malformed
      }
    });

    es.addEventListener('open', () => setStats((s) => ({ ...s, status: 'live' })));
    es.addEventListener('error', () => setStats((s) => ({ ...s, status: 'error' })));

    const statTimer = setInterval(() => {
      const now = performance.now();
      const elapsed = (now - lastStatTsRef.current) / 1000;
      lastStatTsRef.current = now;
      const evt = evtCountRef.current;
      evtCountRef.current = 0;
      setStats((prev) => ({
        ...prev,
        evtPerSec: Math.round(evt / elapsed),
        buffer: bufferRef.current.length,
      }));
    }, STATS_INTERVAL_MS);

    return () => {
      es.close();
      clearInterval(statTimer);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [slug]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || target.isContentEditable) return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (modeRef.current === 'live') handlePause();
        else handleResume();
      } else if (e.key === 'Escape' && modeRef.current === 'paused') {
        e.preventDefault();
        handleResume();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [handlePause, handleResume]);

  const dotClass =
    stats.status === 'live' ? 'bg-success live-dot' : stats.status === 'error' ? 'bg-danger' : 'bg-warn';

  return (
    <section className="rounded-lg border border-border bg-bg-elevated overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-soft">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-fg-muted">
          <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} />
          <span className="font-semibold tracking-wide">Live Power Tick</span>
          <span className="text-fg-subtle normal-case tracking-normal">· uPlot · RAF batching</span>
        </div>
        <div className="text-xs text-fg-muted tabular-nums flex items-center gap-3">
          <span><span className="text-accent-soft">{stats.evtPerSec}</span> evt/s</span>
          <span><span className={fps >= 55 ? 'text-success' : fps >= 30 ? 'text-warn' : 'text-danger'}>{fps}</span> fps</span>
          <span>buffer: <span className="text-warn">{stats.buffer}</span></span>
        </div>
      </div>
      <div className="relative">
        <div ref={containerRef} className="h-[180px] w-full" />
        {mode === 'live' ? (
          <button
            type="button"
            onClick={handlePause}
            title="Pause (Space)"
            aria-label="Pause live chart"
            className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 rounded-md border border-border-soft bg-bg-elevated/85 px-2 py-1 text-xs text-fg-muted backdrop-blur-sm hover:text-fg hover:border-border transition-colors"
          >
            <Pause className="h-3.5 w-3.5" />
          </button>
        ) : (
          <>
            <div className="absolute top-2 left-2 z-10 inline-flex items-center gap-2 rounded-md border border-border-soft bg-bg-elevated/85 px-2 py-1 text-xs backdrop-blur-sm">
              <span className="font-semibold tracking-wide text-warn uppercase">Paused</span>
              <span className="tabular-nums text-fg-muted">{visibleRangeLabel}</span>
              <span className="text-fg-subtle normal-case">· drag or scroll to zoom</span>
            </div>
            <div className="absolute top-2 right-2 z-10 inline-flex items-center gap-2">
              <div className="inline-flex items-center gap-1 rounded-md border border-border-soft bg-bg-elevated/85 p-0.5 text-xs backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() => handleQuickZoom(10)}
                  className="rounded px-2 py-0.5 text-fg-muted hover:text-fg hover:bg-border-soft/50 transition-colors"
                  title="Zoom to last 10 seconds"
                >
                  10s
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickZoom(30)}
                  className="rounded px-2 py-0.5 text-fg-muted hover:text-fg hover:bg-border-soft/50 transition-colors"
                  title="Zoom to last 30 seconds"
                >
                  30s
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickZoom('all')}
                  className="rounded px-2 py-0.5 text-fg-muted hover:text-fg hover:bg-border-soft/50 transition-colors"
                  title="Show full frozen range"
                >
                  All
                </button>
              </div>
              <button
                type="button"
                onClick={handleResume}
                title="Resume live (Esc)"
                aria-label="Resume live chart"
                className="inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent backdrop-blur-sm hover:bg-accent/25 hover:border-accent/60 transition-colors"
              >
                <Play className="h-3.5 w-3.5" />
                Live
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
