import { useEffect, useRef, useState } from 'react';
import uPlot, { type AlignedData, type Options } from 'uplot';
import 'uplot/dist/uPlot.min.css';

const MAX_POINTS = 600;
const STATS_INTERVAL_MS = 1000;

interface Props {
  slug: string;
}

interface Stats {
  evtPerSec: number;
  fps: number;
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
  const frameCountRef = useRef(0);
  const lastStatTsRef = useRef(performance.now());
  const [stats, setStats] = useState<Stats>({ evtPerSec: 0, fps: 0, buffer: 0, status: 'connecting' });

  useEffect(() => {
    if (!containerRef.current) return;

    const opts: Options = {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      pxAlign: false,
      cursor: { show: false },
      legend: { show: false },
      scales: {
        x: { time: true },
        y: { auto: true },
      },
      axes: [
        {
          stroke: '#5e6e8a',
          grid: { stroke: 'rgba(36, 48, 73, 0.5)' },
          ticks: { show: false },
          values: (_u, ticks) => ticks.map((t) => new Date(t * 1000).toLocaleTimeString('en-US', { hour12: false })),
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
    dataRef.current = { ts: [], kw: [] };
    bufferRef.current = [];
    if (plotRef.current) {
      plotRef.current.setData([[], []] as unknown as AlignedData);
    }

    const es = new EventSource(`/api/tenants/${slug}/live`);

    function flush() {
      const buf = bufferRef.current;
      if (buf.length > 0 && plotRef.current) {
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
      frameCountRef.current += 1;
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
      const fps = frameCountRef.current;
      evtCountRef.current = 0;
      frameCountRef.current = 0;
      setStats((prev) => ({
        ...prev,
        evtPerSec: Math.round(evt / elapsed),
        fps: Math.round(fps / elapsed),
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
          <span><span className="text-success">{stats.fps}</span> fps</span>
          <span>buffer: <span className="text-warn">{stats.buffer}</span></span>
        </div>
      </div>
      <div ref={containerRef} className="h-[180px] w-full" />
    </section>
  );
}
