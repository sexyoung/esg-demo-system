# Live Power Tick — Pause & Zoom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pause/resume + drag-to-zoom + 1m/5m/All quick-zoom controls to the Live Power Tick chart, as a floating overlay on the chart area.

**Architecture:** Pure data helpers extracted to a separate file with vitest coverage; React state (`mode: 'live' | 'paused'`) drives RAF flush branching and overlay rendering. uPlot's native `cursor.drag.setScale` provides drag-zoom; quick zoom buttons call `setScale('x', ...)`. Background SSE keeps accumulating into a separate `pausedBufferRef` while paused; resume merges and snaps to live.

**Tech Stack:** React 19, TypeScript, uPlot 1.6, Tailwind v4, lucide-react icons, vitest (node env, no RTL — UI verified manually via gstack /browse).

**Spec:** `docs/superpowers/specs/2026-05-09-live-power-tick-pause-zoom-design.md`

---

## File Structure

- **Create:** `src/components/dashboard/livePowerTickHelpers.ts` — pure helpers (mergePausedBuffer, capPausedBuffer, formatTimeRange)
- **Create:** `src/components/dashboard/livePowerTickHelpers.test.ts` — vitest unit tests for helpers
- **Modify:** `src/components/dashboard/LivePowerTick.tsx` — state, handlers, RAF flush branching, overlay UI, keyboard shortcuts, uPlot cursor config

No new dependencies. Overlay JSX kept inline in LivePowerTick.tsx (~50 lines, doesn't justify a separate file).

---

## Task 1: Pure helper functions + tests

**Files:**
- Create: `src/components/dashboard/livePowerTickHelpers.ts`
- Create: `src/components/dashboard/livePowerTickHelpers.test.ts`

- [ ] **Step 1.1: Write failing tests**

Create `src/components/dashboard/livePowerTickHelpers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { capPausedBuffer, formatTimeRange, mergePausedBuffer } from './livePowerTickHelpers';

describe('mergePausedBuffer', () => {
  it('appends paused entries to data arrays', () => {
    const ts = [1, 2, 3];
    const kw = [10, 20, 30];
    const buf: Array<[number, number]> = [[4, 40], [5, 50]];
    mergePausedBuffer(ts, kw, buf, 100);
    expect(ts).toEqual([1, 2, 3, 4, 5]);
    expect(kw).toEqual([10, 20, 30, 40, 50]);
  });

  it('trims oldest entries when result exceeds maxPoints', () => {
    const ts = [1, 2, 3];
    const kw = [10, 20, 30];
    const buf: Array<[number, number]> = [[4, 40], [5, 50], [6, 60]];
    mergePausedBuffer(ts, kw, buf, 4);
    expect(ts).toEqual([3, 4, 5, 6]);
    expect(kw).toEqual([30, 40, 50, 60]);
  });

  it('handles empty paused buffer (no-op)', () => {
    const ts = [1, 2];
    const kw = [10, 20];
    mergePausedBuffer(ts, kw, [], 100);
    expect(ts).toEqual([1, 2]);
    expect(kw).toEqual([10, 20]);
  });

  it('handles empty data with non-empty buffer', () => {
    const ts: number[] = [];
    const kw: number[] = [];
    mergePausedBuffer(ts, kw, [[1, 10], [2, 20]], 100);
    expect(ts).toEqual([1, 2]);
    expect(kw).toEqual([10, 20]);
  });
});

describe('capPausedBuffer', () => {
  it('returns buffer unchanged when under cap', () => {
    const buf: Array<[number, number]> = [[1, 10], [2, 20]];
    capPausedBuffer(buf, 5);
    expect(buf).toEqual([[1, 10], [2, 20]]);
  });

  it('FIFO-drops oldest entries when over cap', () => {
    const buf: Array<[number, number]> = [[1, 10], [2, 20], [3, 30], [4, 40]];
    capPausedBuffer(buf, 2);
    expect(buf).toEqual([[3, 30], [4, 40]]);
  });

  it('handles cap exactly equal to length (no drop)', () => {
    const buf: Array<[number, number]> = [[1, 10], [2, 20]];
    capPausedBuffer(buf, 2);
    expect(buf).toEqual([[1, 10], [2, 20]]);
  });
});

describe('formatTimeRange', () => {
  it('formats 10-minute range', () => {
    // 14:23:05 to 14:33:05 in seconds since epoch (use UTC for determinism)
    const min = Date.UTC(2026, 4, 9, 14, 23, 5) / 1000;
    const max = Date.UTC(2026, 4, 9, 14, 33, 5) / 1000;
    const result = formatTimeRange(min, max);
    expect(result).toContain('10m');
    expect(result).toContain('–');
  });

  it('formats sub-minute range with seconds', () => {
    const min = Date.UTC(2026, 4, 9, 14, 23, 5) / 1000;
    const max = Date.UTC(2026, 4, 9, 14, 23, 28) / 1000;
    const result = formatTimeRange(min, max);
    expect(result).toContain('23s');
  });

  it('formats minute+second range', () => {
    const min = Date.UTC(2026, 4, 9, 14, 23, 5) / 1000;
    const max = Date.UTC(2026, 4, 9, 14, 24, 35) / 1000;
    const result = formatTimeRange(min, max);
    expect(result).toContain('1m 30s');
  });

  it('formats whole-minute range without seconds suffix', () => {
    const min = Date.UTC(2026, 4, 9, 14, 23, 0) / 1000;
    const max = Date.UTC(2026, 4, 9, 14, 28, 0) / 1000;
    const result = formatTimeRange(min, max);
    expect(result).toContain('5m');
    expect(result).not.toContain('5m 0s');
  });
});
```

- [ ] **Step 1.2: Run tests to verify they fail**

Run: `npx vitest run src/components/dashboard/livePowerTickHelpers.test.ts`
Expected: FAIL with "Cannot find module './livePowerTickHelpers'" or similar.

- [ ] **Step 1.3: Implement helpers**

Create `src/components/dashboard/livePowerTickHelpers.ts`:

```ts
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
```

- [ ] **Step 1.4: Run tests to verify they pass**

Run: `npx vitest run src/components/dashboard/livePowerTickHelpers.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 1.5: Commit**

```bash
git add src/components/dashboard/livePowerTickHelpers.ts src/components/dashboard/livePowerTickHelpers.test.ts
git commit -m "Add pure helpers for Live Power Tick pause/zoom (mergePausedBuffer, capPausedBuffer, formatTimeRange)"
```

---

## Task 2: Add pause/resume state + RAF flush branching (no UI yet)

**Files:**
- Modify: `src/components/dashboard/LivePowerTick.tsx`

This task adds the internal state machine but no visible UI. After this task the chart still behaves identically to before (mode is always `'live'`).

- [ ] **Step 2.1: Add constants and imports**

In `src/components/dashboard/LivePowerTick.tsx`, update the imports at the top:

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import uPlot, { type AlignedData, type Options, type Plugin } from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { useFps } from '../../lib/useFps';
import { capPausedBuffer, formatTimeRange, mergePausedBuffer } from './livePowerTickHelpers';
```

Below the existing constants, add:

```ts
const MAX_PAUSED_BUFFER = 1800; // 30 min @ 1Hz cap
```

- [ ] **Step 2.2: Add new state and refs inside the component**

Inside `LivePowerTick`, after the existing `useState<Stats>` line, add:

```ts
const [mode, setMode] = useState<'live' | 'paused'>('live');
const [visibleRangeLabel, setVisibleRangeLabel] = useState<string>('');
const modeRef = useRef<'live' | 'paused'>('live');
const pausedBufferRef = useRef<Array<[number, number]>>([]);
const frozenRangeRef = useRef<{ min: number; max: number } | null>(null);
```

Add a small effect right below to keep `modeRef` synced (so the RAF closure can read the latest mode without stale closure issues):

```ts
useEffect(() => {
  modeRef.current = mode;
}, [mode]);
```

- [ ] **Step 2.3: Branch the RAF flush by mode**

Inside the SSE `useEffect(() => { ... }, [slug])`, replace the existing `flush` function with:

```ts
function flush() {
  const buf = bufferRef.current;
  if (buf.length > 0 && plotRef.current) {
    if (modeRef.current === 'paused') {
      // accumulate silently into paused buffer; do not redraw
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
```

- [ ] **Step 2.4: Reset pause state on tenant switch**

At the very top of the SSE `useEffect(() => { ... }, [slug])` body (right after `setStats((s) => ({ ...s, status: 'connecting' }));`), add:

```ts
setMode('live');
modeRef.current = 'live';
pausedBufferRef.current = [];
frozenRangeRef.current = null;
setVisibleRangeLabel('');
```

- [ ] **Step 2.5: Add handlePause / handleResume / handleQuickZoom (still no UI)**

Below the `useMemo`/effect that syncs `boundsRef`, add (above the SSE effect is fine):

```ts
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
  if (plotRef.current && ts.length > 0) {
    plotRef.current.setScale('x', { min: ts[0], max: ts[ts.length - 1] });
    plotRef.current.setData([ts, kw] as unknown as AlignedData);
  }
  setMode('live');
}, []);

const handleQuickZoom = useCallback((seconds: number | 'all') => {
  const range = frozenRangeRef.current;
  if (!range || !plotRef.current) return;
  const { min, max } = range;
  const newMin = seconds === 'all' ? min : Math.max(min, max - seconds);
  plotRef.current.setScale('x', { min: newMin, max });
  setVisibleRangeLabel(formatTimeRange(newMin, max));
}, []);
```

- [ ] **Step 2.6: Type-check**

Run: `npm run check`
Expected: PASS (no type errors).

- [ ] **Step 2.7: Run existing tests**

Run: `npx vitest run`
Expected: All tests pass (helpers + formulas).

- [ ] **Step 2.8: Commit**

```bash
git add src/components/dashboard/LivePowerTick.tsx
git commit -m "Add pause/resume state and RAF flush branching (no UI yet)"
```

---

## Task 3: Add overlay UI — Live mode pause button

**Files:**
- Modify: `src/components/dashboard/LivePowerTick.tsx`

- [ ] **Step 3.1: Update lucide-react import**

Add `Pause` and `Play` to the imports (already importing other lucide icons elsewhere is fine; if no other lucide import exists in this file, add a fresh line). At the top of `LivePowerTick.tsx`:

```ts
import { Pause, Play } from 'lucide-react';
```

- [ ] **Step 3.2: Restructure the chart container to allow overlay**

Replace the current return JSX:

```tsx
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
    <div ref={containerRef} className="h-[180px] w-full" />
  </section>
);
```

with:

```tsx
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
          className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-md border border-border-soft bg-bg-elevated/85 px-2 py-1 text-xs text-fg-muted backdrop-blur-sm hover:text-fg hover:border-border transition-colors"
        >
          <Pause className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  </section>
);
```

- [ ] **Step 3.3: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3.4: Verify the dev server still starts and chart renders**

Run in background: `npm run demo`
Wait for "ready" output, then visit `http://localhost:5173/<tenant-slug>` (e.g., `/acme`) and confirm: chart renders, pause button visible top-right of chart. Don't click it yet — full behavior tested in Task 7.

Stop the dev server.

- [ ] **Step 3.5: Commit**

```bash
git add src/components/dashboard/LivePowerTick.tsx
git commit -m "Add Live Power Tick pause button overlay (live mode)"
```

---

## Task 4: Add overlay UI — Paused mode toolbar

**Files:**
- Modify: `src/components/dashboard/LivePowerTick.tsx`

- [ ] **Step 4.1: Replace the conditional overlay block**

Find the JSX block:

```tsx
{mode === 'live' ? (
  <button
    type="button"
    onClick={handlePause}
    title="Pause (Space)"
    className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-md border border-border-soft bg-bg-elevated/85 px-2 py-1 text-xs text-fg-muted backdrop-blur-sm hover:text-fg hover:border-border transition-colors"
  >
    <Pause className="h-3.5 w-3.5" />
  </button>
) : null}
```

Replace with:

```tsx
{mode === 'live' ? (
  <button
    type="button"
    onClick={handlePause}
    title="Pause (Space)"
    className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-md border border-border-soft bg-bg-elevated/85 px-2 py-1 text-xs text-fg-muted backdrop-blur-sm hover:text-fg hover:border-border transition-colors"
  >
    <Pause className="h-3.5 w-3.5" />
  </button>
) : (
  <>
    <div className="absolute top-2 left-2 inline-flex items-center gap-2 rounded-md border border-border-soft bg-bg-elevated/85 px-2 py-1 text-xs backdrop-blur-sm">
      <span className="font-semibold tracking-wide text-warn uppercase">Paused</span>
      <span className="tabular-nums text-fg-muted">{visibleRangeLabel}</span>
      <span className="text-fg-subtle normal-case">· drag chart to zoom</span>
    </div>
    <div className="absolute top-2 right-2 inline-flex items-center gap-2">
      <div className="inline-flex items-center gap-1 rounded-md border border-border-soft bg-bg-elevated/85 p-0.5 text-xs backdrop-blur-sm">
        <button
          type="button"
          onClick={() => handleQuickZoom(60)}
          className="rounded px-2 py-0.5 text-fg-muted hover:text-fg hover:bg-border-soft/50 transition-colors"
          title="Zoom to last 1 minute"
        >
          1m
        </button>
        <button
          type="button"
          onClick={() => handleQuickZoom(300)}
          className="rounded px-2 py-0.5 text-fg-muted hover:text-fg hover:bg-border-soft/50 transition-colors"
          title="Zoom to last 5 minutes"
        >
          5m
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
        className="inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent backdrop-blur-sm hover:bg-accent/25 hover:border-accent/60 transition-colors"
      >
        <Play className="h-3.5 w-3.5" />
        Live
      </button>
    </div>
  </>
)}
```

Note: this assumes Tailwind `accent` color is defined in the theme. If type-check or visual inspection reveals it's not, fall back to `text-accent-soft` and `border-accent-soft/40` etc. (these are confirmed present in the existing file via `text-accent-soft`).

- [ ] **Step 4.2: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 4.3: Commit**

```bash
git add src/components/dashboard/LivePowerTick.tsx
git commit -m "Add paused-mode toolbar with quick zoom and live button"
```

---

## Task 5: Wire up uPlot drag-to-zoom

**Files:**
- Modify: `src/components/dashboard/LivePowerTick.tsx`

uPlot's `cursor.drag.setScale = true` enables box-select zoom natively. The cursor stays disabled visually in live mode (chart redraws constantly so any zoom is overwritten on next setData), and effectively only does work in paused mode.

- [ ] **Step 5.1: Update uPlot cursor config**

Find the `cursor: { show: false },` line in the `opts` definition (around line 176). Replace with:

```ts
cursor: {
  show: true,
  x: false,
  y: false,
  points: { show: false },
  drag: { x: true, y: false, dist: 8, setScale: true },
},
```

(`x: false`, `y: false`, `points: { show: false }` keep the cursor crosshair invisible — only the drag handler is active. This avoids any visual change in live mode while enabling drag-zoom in paused mode.)

- [ ] **Step 5.2: After drag-zoom, sync the visible range label**

uPlot fires `setSelect` hook when a drag-zoom completes. Add a hook to the existing `bandsPlugin` so we can update the label. Find the `bandsPlugin: Plugin = { hooks: { ... } }` block. Add a `setScale` hook entry alongside `drawClear` and `draw`:

```ts
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
      // ... existing implementation, unchanged ...
    },
    draw: (u) => {
      // ... existing implementation, unchanged ...
    },
  },
};
```

Important: only paste the `setScale` hook into the existing object — keep the existing `drawClear` and `draw` hooks exactly as they are (the placeholder comments above are just for orientation).

- [ ] **Step 5.3: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 5.4: Commit**

```bash
git add src/components/dashboard/LivePowerTick.tsx
git commit -m "Enable uPlot drag-to-zoom + sync visible range label on scale change"
```

---

## Task 6: Keyboard shortcuts (Space / Esc)

**Files:**
- Modify: `src/components/dashboard/LivePowerTick.tsx`

- [ ] **Step 6.1: Add keyboard listener effect**

Below the SSE `useEffect`, add a new effect:

```ts
useEffect(() => {
  function onKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (target) {
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
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
```

- [ ] **Step 6.2: Type-check + run all tests**

Run: `npm run check && npx vitest run`
Expected: type-check passes, all tests pass.

- [ ] **Step 6.3: Commit**

```bash
git add src/components/dashboard/LivePowerTick.tsx
git commit -m "Add Space/Esc keyboard shortcuts for Live Power Tick pause/resume"
```

---

## Task 7: Manual QA in browser

**Files:** none (verification only)

- [ ] **Step 7.1: Start dev server**

Run in background: `npm run demo`
Wait for both `api` and `web` to report ready (typically `http://localhost:5173`).

- [ ] **Step 7.2: Use gstack /browse to verify all flows**

Use the `/browse` skill (from gstack) to:

1. Navigate to `http://localhost:5173/acme` (or whichever tenant route renders LivePowerTick)
2. Wait ~5 seconds so the chart accumulates data
3. Verify: Pause button visible top-right of chart
4. Click Pause → verify: chart freezes, PAUSED chip appears top-left with time range, 1m/5m/All + Live buttons appear top-right
5. Click `1m` → verify: chart x-scale narrows to last 60 seconds, range label updates
6. Click `All` → verify: chart returns to 10-minute view
7. Drag-select a horizontal region on the chart → verify: chart zooms into that region, range label updates to match
8. Click `▶ Live` → verify: chart resumes, snaps to live, all paused buffer data is visible (continuous line, no gap), only Pause button shown again
9. Press `Space` → verify: pause toggles
10. Press `Esc` while paused → verify: returns to live
11. Type `Space` while focus is in any input on the page (if reachable) → verify: pause does NOT toggle

Take a screenshot of (a) live state, (b) paused state with visible quick-zoom toolbar.

- [ ] **Step 7.3: Stop dev server**

Stop the background `npm run demo` process.

- [ ] **Step 7.4: Final commit (if any tweaks needed during QA)**

If QA revealed visual or behavioral issues, fix them and commit:

```bash
git add -p
git commit -m "Polish Live Power Tick pause/zoom after QA"
```

If no issues, skip this step.

---

## Self-Review Notes (filled in during plan authoring)

**Spec coverage check:**
- Pause semantics (continue receiving + silent accumulate) → Task 2 (RAF branch) + Task 1 (capPausedBuffer)
- Drag-zoom → Task 5
- 1m/5m/All quick zoom → Task 4 (UI) + Task 2 (handler)
- Zoom only when paused → enforced by hiding controls in live mode (Task 3/4) + by `frozenRangeRef` null-check in `handleQuickZoom`
- `▶ Live` single click resets zoom + resumes → Task 2 `handleResume` (calls `setScale` to full data range) + Task 4 (button wiring)
- Floating overlay (not header) → Task 3/4
- Header unchanged → confirmed in Task 3 JSX
- Keyboard Space/Esc → Task 6
- Tenant switch reset → Task 2 step 2.4
- Paused buffer cap (1800) → Task 1 (helper) + Task 2 (RAF branch calls capPausedBuffer)
- Frozen range max (not wall clock) → Task 2 `handleQuickZoom` uses `frozenRangeRef`
- Edge case: pause when empty → Task 2 `handlePause` early-returns
- Edge case: SSE error while paused → no special handling needed (header dot logic unchanged)

**Type/name consistency check:**
- `mode` (state) / `modeRef.current` — consistent across all tasks
- `pausedBufferRef` / `frozenRangeRef` / `visibleRangeLabel` — consistent
- `handlePause` / `handleResume` / `handleQuickZoom` — consistent
- `mergePausedBuffer(ts, kw, buffer, max)` — same signature in Task 1 test, Task 1 impl, Task 2 use
- `capPausedBuffer(buffer, max)` — same signature throughout
- `formatTimeRange(minSec, maxSec)` — same signature throughout

**No placeholders detected.** All steps contain runnable code or exact commands.
