import { useEffect, useState } from 'react';

/**
 * Real-time screen FPS gauge.
 *
 * Drives a continuous requestAnimationFrame loop, counting actual frames
 * the browser paints — independent of any data arrival or render work.
 * Updates the returned value once per `sampleIntervalMs` window so React
 * re-renders are bounded.
 */
export function useFps(sampleIntervalMs = 500): number {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let rafId = 0;
    let frameCount = 0;
    let lastSampleAt = performance.now();
    let alive = true;

    function tick(now: number) {
      if (!alive) return;
      frameCount += 1;
      const elapsed = now - lastSampleAt;
      if (elapsed >= sampleIntervalMs) {
        setFps(Math.round((frameCount * 1000) / elapsed));
        frameCount = 0;
        lastSampleAt = now;
      }
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);

    return () => {
      alive = false;
      cancelAnimationFrame(rafId);
    };
  }, [sampleIntervalMs]);

  return fps;
}
