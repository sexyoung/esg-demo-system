export function mergePausedBuffer(
  ts: number[],
  kw: number[],
  pausedBuffer: ReadonlyArray<[number, number]>,
  maxPoints: number,
): void {
  for (const [t, v] of pausedBuffer) {
    ts.push(t);
    kw.push(v);
  }
  if (ts.length > maxPoints) {
    const drop = ts.length - maxPoints;
    ts.splice(0, drop);
    kw.splice(0, drop);
  }
}

export function capPausedBuffer(
  buffer: Array<[number, number]>,
  maxEntries: number,
): void {
  if (buffer.length > maxEntries) {
    const drop = buffer.length - maxEntries;
    buffer.splice(0, drop);
  }
}

export function formatTimeRange(minSec: number, maxSec: number): string {
  const fmt = (sec: number) =>
    new Date(sec * 1000).toLocaleTimeString('en-US', { hour12: false });
  const durationSec = Math.round(maxSec - minSec);
  let durationLabel: string;
  if (durationSec < 60) {
    durationLabel = `${durationSec}s`;
  } else {
    const mins = Math.floor(durationSec / 60);
    const secs = durationSec % 60;
    durationLabel = secs === 0 ? `${mins}m` : `${mins}m ${secs}s`;
  }
  return `${fmt(minSec)}–${fmt(maxSec)} (${durationLabel})`;
}
