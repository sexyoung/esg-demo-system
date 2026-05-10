import { Activity } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

interface Props {
  slug: string;
}

type Severity = 'info' | 'warn' | 'critical';

interface EventTemplate {
  severity: Severity;
  assetCode: string;
  text: string;
}

interface EventEntry extends EventTemplate {
  id: string;
  ts: number; // ms timestamp
}

const EVENT_POOLS: Record<string, EventTemplate[]> = {
  acme: [
    { severity: 'info', assetCode: 'ACM-01', text: 'ESS 充電啟動 · soc 32% → 48%' },
    { severity: 'info', assetCode: 'ACM-01', text: 'PV-1A 段陣列發電 240 kW' },
    { severity: 'info', assetCode: 'ACM-01', text: 'EV-A1 充電完成 · 12 kWh' },
    { severity: 'info', assetCode: 'ACM-01', text: '主電表負載 1,243 kW' },
    { severity: 'info', assetCode: 'ACM-01', text: 'ESS 削峰啟動 · 模式 PeakShave' },
    { severity: 'info', assetCode: 'ACM-02', text: '楊梅幼獅 PV 並網成功' },
    { severity: 'warn', assetCode: 'ACM-01', text: 'PV-2 inverter 風扇噪音偏高' },
    { severity: 'warn', assetCode: 'ACM-01', text: 'ESS 溫度 38°C 接近上限' },
    { severity: 'warn', assetCode: 'ACM-04', text: '彰濱 EV 充電場使用率 92%' },
    { severity: 'critical', assetCode: 'ACM-01', text: '主電表電壓波動 ±2%' },
    { severity: 'info', assetCode: 'ACM-03', text: '苗栗銅鑼 巡檢工單 #4521 完成' },
    { severity: 'info', assetCode: 'ACM-05', text: '雲林麥寮 PV 累計發電 18.4 MWh' },
    { severity: 'info', assetCode: 'ACM-06', text: '屏東 EV 充電啟動 · 4 ports' },
  ],
  beta: [
    { severity: 'info', assetCode: 'BET-01', text: '101 信義 A 區 HVAC 設定變更 → 24°C' },
    { severity: 'info', assetCode: 'BET-08', text: '內湖 3F 空調冷凍主機啟動' },
    { severity: 'info', assetCode: 'BET-12', text: '桃園商辦 主電表負載 285 kW' },
    { severity: 'warn', assetCode: 'BET-05', text: '南港軟體園區 OEE 偏離設定值' },
    { severity: 'warn', assetCode: 'BET-08', text: '內湖照明回路 #3 電流異常' },
    { severity: 'critical', assetCode: 'BET-01', text: '101 A 區 電梯機房 溫度 42°C' },
    { severity: 'info', assetCode: 'BET-10', text: '中山金融 EUI 達 RE100 階段目標' },
    { severity: 'info', assetCode: 'BET-11', text: '松山民生 巡檢完成 · 無異常' },
    { severity: 'info', assetCode: 'BET-13', text: '青埔商業中心 大樓 PV 發電 42 kW' },
    { severity: 'warn', assetCode: 'BET-14', text: '台中七期 用電尖峰超過契約 5%' },
    { severity: 'info', assetCode: 'BET-03', text: 'ATT 4 FUN 排程啟動 夜間節能模式' },
  ],
  gamma: [
    { severity: 'info', assetCode: 'GAM-01', text: 'Fab 12 蝕刻機 A1 批次 #B2407 完成' },
    { severity: 'info', assetCode: 'GAM-02', text: 'Fab 5 黃光區 製程結束 · 良率 98.2%' },
    { severity: 'info', assetCode: 'GAM-12', text: 'CDA 壓縮空氣站 壓力 7.2 bar 正常' },
    { severity: 'warn', assetCode: 'GAM-01', text: 'Fab 12 主冰機 #2 COP 下降 0.3' },
    { severity: 'warn', assetCode: 'GAM-15', text: 'Utility 機房 N+1 冗餘啟動' },
    { severity: 'critical', assetCode: 'GAM-03', text: 'Fab 8 製程冷卻 流量低於下限' },
    { severity: 'info', assetCode: 'GAM-07', text: '苗栗竹南 巡檢工單 #7821 派發' },
    { severity: 'info', assetCode: 'GAM-09', text: 'Utility 補水系統 啟動' },
    { severity: 'info', assetCode: 'GAM-18', text: '龜山華亞 PV 累計發電 8.2 MWh' },
    { severity: 'warn', assetCode: 'GAM-19', text: '屏東加工區 用電負載超門檻' },
    { severity: 'info', assetCode: 'GAM-04', text: 'Fab 2 排程批次 #B2408 啟動' },
  ],
};

const SEVERITY_COLOR: Record<Severity, string> = {
  info: 'bg-success',
  warn: 'bg-warn',
  critical: 'bg-danger',
};

const SEVERITY_TEXT: Record<Severity, string> = {
  info: 'text-success/90',
  warn: 'text-warn/90',
  critical: 'text-danger',
};

const HOLD_COUNT = 5;
const TICK_MIN_MS = 2200;
const TICK_MAX_MS = 4500;

export function RecentEventsStream({ slug }: Props) {
  const pool = useMemo(() => EVENT_POOLS[slug] ?? EVENT_POOLS.acme, [slug]);
  const [events, setEvents] = useState<EventEntry[]>(() => seedInitial(pool));
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    setEvents(seedInitial(pool));
  }, [pool]);

  useEffect(() => {
    function schedule() {
      const delay = TICK_MIN_MS + Math.random() * (TICK_MAX_MS - TICK_MIN_MS);
      tickRef.current = window.setTimeout(() => {
        setEvents((prev) => {
          const tpl = pool[Math.floor(Math.random() * pool.length)];
          const fresh: EventEntry = {
            ...tpl,
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ts: Date.now(),
          };
          return [fresh, ...prev].slice(0, HOLD_COUNT);
        });
        schedule();
      }, delay);
    }
    schedule();
    return () => {
      if (tickRef.current) window.clearTimeout(tickRef.current);
    };
  }, [pool]);

  return (
    <section className="rounded-lg border border-border bg-bg-elevated overflow-hidden h-full flex flex-col">
      <header className="flex items-center justify-between px-4 py-2 border-b border-border-soft">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-fg-muted">
          <Activity size={13} className="text-success" />
          <span className="font-semibold tracking-wide">現場事件流 · Recent Events</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-fg-subtle tabular-nums">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-success live-dot" />
          live · last {HOLD_COUNT}
        </div>
      </header>
      <ul className="flex-1 overflow-hidden divide-y divide-border-soft">
        {events.map((e, idx) => {
          // Older events fade slightly
          const opacity = 1 - idx * 0.08;
          return (
            <li
              key={e.id}
              className="flex items-center gap-2 px-3 py-1.5 text-[11px] animate-in min-w-0"
              style={{ opacity: Math.max(0.4, opacity) }}
              title={`${e.assetCode} · ${e.text}`}
            >
              <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${SEVERITY_COLOR[e.severity]}`} />
              <span className="font-mono text-[10px] text-fg-subtle tabular-nums shrink-0 w-[56px]">
                {formatTime(e.ts)}
              </span>
              <span className="font-mono text-[10px] text-accent-soft shrink-0 w-[52px]">
                {e.assetCode}
              </span>
              <span className={`flex-1 truncate leading-tight ${SEVERITY_TEXT[e.severity]}`}>{e.text}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function seedInitial(pool: EventTemplate[]): EventEntry[] {
  // Seed 6 events with timestamps stepping back from now, so the stream
  // starts populated and not empty.
  const out: EventEntry[] = [];
  const now = Date.now();
  for (let i = 0; i < HOLD_COUNT; i++) {
    const tpl = pool[Math.floor(Math.random() * pool.length)];
    out.push({
      ...tpl,
      id: `seed-${i}-${Math.random().toString(36).slice(2, 6)}`,
      ts: now - (i + 1) * (3000 + Math.random() * 2000),
    });
  }
  return out;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
