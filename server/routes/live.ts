import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { prisma } from '../lib/prisma.js';

export const liveRouter = new Hono();

const TICK_INTERVAL_MS = Math.round(1000 / 30);
const CYCLE_SEC = 60;

interface LoadEvent {
  startSec: number;
  durationSec: number;
  magnitude: number;
  rampSec: number;
  label: string;
}

const TENANT_EVENTS: Record<string, LoadEvent[]> = {
  acme: [
    { startSec: 6, durationSec: 3, magnitude: 0.22, rampSec: 0.6, label: '空壓機啟動' },
    { startSec: 17, durationSec: 2, magnitude: -0.13, rampSec: 0.4, label: '製程批次切換' },
    { startSec: 29, durationSec: 4.5, magnitude: 0.34, rampSec: 0.8, label: '尖峰負載突波' },
    { startSec: 43, durationSec: 6, magnitude: -0.18, rampSec: 1.2, label: 'EV 充電場降載' },
    { startSec: 53, durationSec: 1.5, magnitude: 0.16, rampSec: 0.3, label: '冷卻塔週期啟動' },
  ],
  beta: [
    { startSec: 4, durationSec: 8, magnitude: 0.18, rampSec: 1.5, label: '辦公層上班尖峰' },
    { startSec: 22, durationSec: 3, magnitude: -0.10, rampSec: 0.5, label: '電梯休止' },
    { startSec: 33, durationSec: 5, magnitude: 0.25, rampSec: 1.0, label: '冷氣機群啟動' },
    { startSec: 47, durationSec: 4, magnitude: -0.20, rampSec: 0.8, label: '午休照明降載' },
  ],
  gamma: [
    { startSec: 5, durationSec: 2, magnitude: 0.15, rampSec: 0.3, label: 'Litho EUV 曝光' },
    { startSec: 14, durationSec: 4, magnitude: 0.08, rampSec: 0.6, label: 'Etch bay step' },
    { startSec: 26, durationSec: 3, magnitude: -0.06, rampSec: 0.5, label: '製程批次間歇' },
    { startSec: 35, durationSec: 5, magnitude: 0.12, rampSec: 0.8, label: 'CVD 沈積批次' },
    { startSec: 47, durationSec: 6, magnitude: 0.18, rampSec: 1.0, label: 'Diff 爐升溫' },
  ],
};

function eventDeviation(events: LoadEvent[], phaseSec: number): number {
  const t = phaseSec % CYCLE_SEC;
  let total = 0;
  for (const ev of events) {
    if (t < ev.startSec || t >= ev.startSec + ev.durationSec) continue;
    const local = t - ev.startSec;
    const rampUp = Math.min(1, local / ev.rampSec);
    const rampDown = Math.min(1, (ev.durationSec - local) / ev.rampSec);
    total += ev.magnitude * Math.min(rampUp, rampDown);
  }
  return total;
}

liveRouter.get('/:slug/live', async (c) => {
  const slug = c.req.param('slug');
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (!tenant) return c.json({ message: 'tenant not found' }, 404);

  const baselineKw = slug === 'acme' ? 1800 : slug === 'beta' ? 220 : 6500;
  const events = TENANT_EVENTS[slug] ?? TENANT_EVENTS.acme;
  const startMs = Date.now();

  return streamSSE(c, async (stream) => {
    let id = 0;
    let phase = 0;
    while (!stream.aborted) {
      phase += 0.05;
      const phaseSec = (Date.now() - startMs) / 1000;
      const wave = Math.sin(phase) * baselineKw * 0.04;
      const eventDev = eventDeviation(events, phaseSec) * baselineKw;
      const jitter = (Math.random() - 0.5) * baselineKw * 0.025;
      const kw = Math.round((baselineKw + wave + eventDev + jitter) * 10) / 10;
      await stream.writeSSE({
        id: String(++id),
        event: 'tick',
        data: JSON.stringify({ ts: Date.now(), kw }),
      });
      await stream.sleep(TICK_INTERVAL_MS);
    }
  });
});
