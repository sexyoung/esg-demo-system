# Live Power Tick — Pause & Zoom

**Date:** 2026-05-09
**Component:** `src/components/dashboard/LivePowerTick.tsx`
**Status:** Design approved, pending implementation

## Problem

The Live Power Tick chart is currently always-live: SSE ticks stream in and the rolling 10-minute window scrolls continuously. When the user spots an anomaly or interesting moment, they can't stop the chart to investigate — the moment scrolls off-screen quickly. There is also no way to inspect a finer time slice (e.g., zoom into a 30-second window around a dip).

For the Delta interview demo, the operator needs to be able to pause the live feed at will and zoom into specific time ranges to discuss what happened.

## Goals

- Allow pausing the chart at any moment without losing background data
- Allow zooming into any sub-range of the visible window once paused
- Keep live-mode performance and visuals exactly as today (zero overhead when not paused)
- Single-click return to live (clears zoom + resumes streaming)

## Non-Goals

- Persisting paused state across page reloads or tenant switches
- Backfill animation when resuming (resume snaps directly to live)
- Y-axis zoom (X-axis only — kW range is meaningful, time range is what we want to inspect)
- Historical scrollback beyond the current rolling window

## User Decisions (recorded during brainstorming)

1. **Pause semantics:** Continue receiving SSE ticks, silently accumulate into a separate buffer. On resume, append the accumulated data and snap to live (no catch-up animation).
2. **Zoom UX:** Drag-to-select a horizontal range + quick-select buttons (1m / 5m / All).
3. **Zoom × Pause coupling:** Zoom controls are only active while paused. Live-mode hides zoom controls entirely.

## UI Design

### Layout: floating overlay on the chart

Controls live as a semi-transparent floating overlay anchored to the top of the chart area (not the header). The header keeps its existing stats (`evt/s`, `fps`, `buffer`) unchanged.

**Live state — top-right of chart:**
```
┌──────────────────────────────────────────────────────────────────────┐
│ ● Live Power Tick · uPlot · RAF batching        42 evt/s 60 fps buffer:0 │
├──────────────────────────────────────────────────────────────────────┤
│                                                              ┌─────┐ │
│      ╱╲    ╱╲       ╱╲                                       │  ⏸  │ │
│     ╱  ╲  ╱  ╲     ╱  ╲                                      └─────┘ │
│ ───╱────╲╱────╲───╱────╲────                                         │
│                  ╲╱                                                  │
└──────────────────────────────────────────────────────────────────────┘
```

A single icon-button in the top-right of the chart. Hover label: `Pause (Space)`.

**Paused state — same area expands into a toolbar:**
```
┌──────────────────────────────────────────────────────────────────────┐
│ ● Live Power Tick · uPlot · RAF batching        42 evt/s 60 fps buffer:0 │
├──────────────────────────────────────────────────────────────────────┤
│  ┌─ PAUSED 14:23:05–14:33:05 (10m) ───┐  ┌────────────┐  ┌────────┐ │
│  │ drag chart to zoom                  │  │ 1m 5m All  │  │ ▶ Live │ │
│  └─────────────────────────────────────┘  └────────────┘  └────────┘ │
│      ╱╲    ╱╲       ╱╲                                               │
│ ───╱────╲╱────╲───╱──────                                            │
└──────────────────────────────────────────────────────────────────────┘
```

- Left chip: `PAUSED` label + currently visible time range (updates live as user zooms) + small hint "drag chart to zoom"
- Middle: 1m / 5m / All quick zoom buttons
- Right: `▶ Live` (accent color, largest target — single-click resume + reset zoom)

### Visual details

- Overlay background: ~85% opacity dark surface, matches widget styling
- Subtle 100ms fade between live ↔ paused control sets
- Header bar (status dot, evt/s, fps, buffer) does **not** change between modes
- No big "PAUSED" overlay across the chart — the toolbar chip is the only indicator (data legibility wins)

### Keyboard

- `Space` — toggle pause / resume
- `Esc` — when paused, snap back to live
- Listener attached to `document.keydown`, bails if `event.target` is `input`, `textarea`, or `[contenteditable]`

## Architecture

### New state in `LivePowerTick.tsx`

```ts
const [mode, setMode] = useState<'live' | 'paused'>('live');
const pausedBufferRef = useRef<Array<[number, number]>>([]);
const frozenRangeRef = useRef<{ min: number; max: number } | null>(null);
```

`mode` drives both rendering (which overlay set is shown) and the RAF flush behavior. The two refs are only read while paused.

### Data flow (modified)

```
SSE tick arrives
   │
   ▼
bufferRef.push(tick)         ← unchanged
evtCountRef++                ← unchanged
   │
   ▼
RAF flush
   │
   ├─ mode === 'live':
   │     merge into dataRef + setData()        ← current behavior
   │
   └─ mode === 'paused':
         merge into pausedBufferRef             ← new path
         do NOT call setData()                  ← chart frozen
         (header buffer counter still ticks)
```

### Pause action

```ts
function handlePause() {
  const { ts } = dataRef.current;
  if (ts.length === 0) return; // nothing to freeze
  frozenRangeRef.current = { min: ts[0], max: ts[ts.length - 1] };
  setMode('paused');
  // enable uPlot drag-zoom
  plotRef.current?.setCursor({ left: -10, top: -10 }); // hide initial cursor
  // cursor.drag is enabled via opts (see uPlot config below)
}
```

### Resume action (▶ Live button or Esc)

```ts
function handleResume() {
  // append paused buffer to dataRef, respecting MAX_POINTS
  const { ts, kw } = dataRef.current;
  for (const [t, v] of pausedBufferRef.current) {
    ts.push(t);
    kw.push(v);
  }
  if (ts.length > MAX_POINTS) {
    const drop = ts.length - MAX_POINTS;
    ts.splice(0, drop);
    kw.splice(0, drop);
  }
  pausedBufferRef.current = [];
  frozenRangeRef.current = null;
  // reset uPlot x-scale to auto
  plotRef.current?.setScale('x', { min: ts[0], max: ts[ts.length - 1] });
  plotRef.current?.setData([ts, kw] as unknown as AlignedData);
  setMode('live');
}
```

### Quick zoom buttons (1m / 5m / All)

```ts
function handleQuickZoom(seconds: number | 'all') {
  if (!frozenRangeRef.current || !plotRef.current) return;
  const { min, max } = frozenRangeRef.current;
  if (seconds === 'all') {
    plotRef.current.setScale('x', { min, max });
  } else {
    plotRef.current.setScale('x', { min: max - seconds, max });
  }
}
```

`max` is locked to `frozenRangeRef.max` (the last data point at pause time), **not** wall-clock now. This avoids showing an empty right strip after pause.

### Drag-to-zoom

uPlot built-in. Configure cursor in the initial `Options`:

```ts
cursor: {
  show: false, // overridden when paused
  drag: { x: true, y: false, dist: 8, setScale: true },
}
```

When `mode === 'paused'`, we toggle cursor visibility via `plotRef.current.setCursor` or by recreating the cursor config. uPlot doesn't expose a clean runtime toggle for `cursor.show`, so the simplest approach: **leave `cursor.drag` configured at all times, but only render the overlay UI when paused.** Drag will still technically work in live mode, but since the chart is constantly redrawing with new data, the zoom would be immediately overwritten on next `setData()`. Net effect: drag-to-zoom is a no-op in live mode, even though uPlot's handler is wired.

If that proves visually janky during testing (cursor showing in live mode), fall back to recreating the uPlot instance on mode change — but expect this to not be needed.

### Tenant switch (slug change)

Existing `useEffect([slug])` already resets `dataRef` and reopens SSE. Add:

```ts
setMode('live');
pausedBufferRef.current = [];
frozenRangeRef.current = null;
```

at the top of that effect, so switching tenants always lands in live mode.

### Buffer cap when paused

```ts
const MAX_PAUSED_BUFFER = 1800; // 30 min @ 1Hz
```

In the RAF flush, when appending to `pausedBufferRef`, FIFO-drop the oldest if length exceeds cap. Demo unlikely to hit it, but prevents unbounded memory growth if the user walks away.

## Edge Cases

| # | Case | Handling |
|---|------|----------|
| 1 | SSE disconnects while paused | Header dot turns red as today; paused view unaffected; on resume, paused buffer flushes normally |
| 2 | Tenant switched while paused | Force reset to live mode + clear paused refs |
| 3 | Pause held for > 30 min | `pausedBufferRef` FIFO-caps at 1800 entries |
| 4 | Drag-zoom region < 8 px | uPlot's `dist: 8` rejects |
| 5 | Quick zoom button pressed when already zoomed | Overwrites scale, no need to reset first |
| 6 | Resume fills past MAX_POINTS | Existing splice trims oldest — expected |
| 7 | uPlot cursor cost when paused | Negligible — chart not redrawing |
| 8 | Keyboard shortcut while typing in input | `document.keydown` checks `event.target.tagName` |
| 9 | Pause when chart is empty (no data yet) | `handlePause` early-returns; pause button stays in live state |
| 10 | Reduced motion | 100ms fade only; no large motion |

## Files Changed

- `src/components/dashboard/LivePowerTick.tsx` — primary change
- (Possibly) extract `LivePowerTickOverlay.tsx` if the overlay JSX grows large; decide during implementation

No new dependencies. uPlot already supports drag-zoom natively.

## Out of Scope (explicit)

- Y-axis zoom
- Mouse wheel zoom (deferred — drag + buttons cover the demo need)
- Persistent zoom across resume cycles
- Backfill animation
- Pan after zoom (uPlot supports it via right-drag, but not part of MVP)
- Showing a mini-map of the full range while zoomed
