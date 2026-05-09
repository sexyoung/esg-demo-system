import { useEffect, useState } from 'react';

const TARGET_FRAME_MS = 1000 / 60;
const DROP_THRESHOLD_MS = TARGET_FRAME_MS * 1.5;
const DELTA_WINDOW_SIZE = 30;
const DROPS_WINDOW_MS = 1000;

export interface FpsStats {
  fps: number;
  drops: number;
}

/**
 * Frame-delta based FPS gauge with dropped-frame detection.
 *
 * On every browser animation frame, measures `delta = now - lastFrame`.
 * FPS is the rolling average of the last 30 deltas, refreshed every
 * `sampleIntervalMs` (default 200ms) so the displayed value reacts
 * within ~250ms of a stutter starting. Frames with delta > 25ms (1.5×
 * the 60fps period) are counted as dropped — those drops are reported
 * as "drops in the last 1 second" on a separate fixed window so the
 * faster FPS updates don't rescale the drop count noisily.
 */
export function useFps(sampleIntervalMs = 200): FpsStats {
  const [stats, setStats] = useState<FpsStats>({ fps: 0, drops: 0 });

  useEffect(() => {
    let rafId = 0;
    let lastFrame = performance.now();
    let fpsWindowStart = lastFrame;
    let dropsWindowStart = lastFrame;
    let dropsInWindow = 0;
    let lastReportedDrops = 0;
    const recentDeltas: number[] = [];
    let alive = true;

    function tick(now: number) {
      if (!alive) return;
      const delta = now - lastFrame;
      lastFrame = now;

      recentDeltas.push(delta);
      if (recentDeltas.length > DELTA_WINDOW_SIZE) recentDeltas.shift();
      if (delta > DROP_THRESHOLD_MS) dropsInWindow += 1;

      let pendingFps: number | null = null;
      let pendingDrops: number | null = null;

      if (now - fpsWindowStart >= sampleIntervalMs && recentDeltas.length > 0) {
        const avgDelta = recentDeltas.reduce((a, b) => a + b, 0) / recentDeltas.length;
        pendingFps = Math.round(1000 / avgDelta);
        fpsWindowStart = now;
      }

      if (now - dropsWindowStart >= DROPS_WINDOW_MS) {
        lastReportedDrops = dropsInWindow;
        pendingDrops = dropsInWindow;
        dropsInWindow = 0;
        dropsWindowStart = now;
      }

      if (pendingFps !== null || pendingDrops !== null) {
        setStats((prev) => ({
          fps: pendingFps ?? prev.fps,
          drops: pendingDrops ?? lastReportedDrops,
        }));
      }

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);

    return () => {
      alive = false;
      cancelAnimationFrame(rafId);
    };
  }, [sampleIntervalMs]);

  return stats;
}
