import { PrismaClient, type AssetType, type AlertSeverity, type MetricType } from '@prisma/client';

const prisma = new PrismaClient();

const DAYS_OF_HISTORY = 30;
const QUARTERS_PER_DAY = 96;
const QUARTER_MS = 15 * 60 * 1000;
const READING_BATCH = 5000;

interface SiteSpec {
  code: string;
  name: string;
  lat: number;
  lng: number;
}

interface TenantSpec {
  slug: string;
  name: string;
  industry: string;
  config: Record<string, unknown>;
  sites: SiteSpec[];
}

const tenants: TenantSpec[] = [
  {
    slug: 'acme',
    name: 'Acme 智慧微電網園區',
    industry: 'microgrid',
    config: {
      heroLabel: '智慧微電網營運中心',
      kpiUnits: ['kWh', 'tCO₂e', 'NT$', 'RE%'],
      modules: ['dashboard', 'simulator', 'asset', 'alert', 'report'],
      primarySiteCode: 'ACM-01',
    },
    sites: [
      { code: 'ACM-01', name: '桃園觀音微電網園區（主場景）', lat: 25.034, lng: 121.082 },
      { code: 'ACM-02', name: '桃園楊梅幼獅工業區', lat: 24.917, lng: 121.187 },
      { code: 'ACM-03', name: '苗栗銅鑼科學園區', lat: 24.491, lng: 120.789 },
      { code: 'ACM-04', name: '彰化彰濱工業區崙尾區', lat: 24.107, lng: 120.451 },
      { code: 'ACM-05', name: '雲林麥寮離島工業區', lat: 23.755, lng: 120.193 },
      { code: 'ACM-06', name: '屏東農業生物科技園區', lat: 22.547, lng: 120.501 },
    ],
  },
  {
    slug: 'beta',
    name: 'Beta 綠色商辦資產管理',
    industry: 'commercial',
    config: {
      heroLabel: '商辦資產 RE100 進度中心',
      kpiUnits: ['kWh', 'tCO₂e', 'EUI', 'RE%'],
      modules: ['dashboard', 'eui_ranking', 'alert', 'report'],
      primarySiteCode: 'BET-01',
    },
    sites: [
      { code: 'BET-01', name: '台北 101 / 信義 A 區', lat: 25.0335, lng: 121.5645 },
      { code: 'BET-02', name: '台北南山廣場', lat: 25.0339, lng: 121.5654 },
      { code: 'BET-03', name: '台北信義 ATT 4 FUN', lat: 25.0356, lng: 121.568 },
      { code: 'BET-04', name: '台北富邦人壽信義金融中心', lat: 25.0352, lng: 121.567 },
      { code: 'BET-05', name: '台北南港軟體園區', lat: 25.0575, lng: 121.6144 },
      { code: 'BET-06', name: '台北南港中信金總部', lat: 25.053, lng: 121.6055 },
      { code: 'BET-07', name: '台北南港經貿園區', lat: 25.054, lng: 121.613 },
      { code: 'BET-08', name: '台北內湖瑞光商辦', lat: 25.081, lng: 121.574 },
      { code: 'BET-09', name: '台北內湖民權東路商辦', lat: 25.078, lng: 121.5775 },
      { code: 'BET-10', name: '台北中山金融大樓', lat: 25.048, lng: 121.544 },
      { code: 'BET-11', name: '台北松山民生商辦', lat: 25.057, lng: 121.544 },
      { code: 'BET-12', name: '桃園市中心商辦', lat: 25.0026, lng: 121.301 },
      { code: 'BET-13', name: '桃園青埔商業中心', lat: 25.0512, lng: 121.237 },
      { code: 'BET-14', name: '台中七期世貿大樓', lat: 24.1645, lng: 120.644 },
      { code: 'BET-15', name: '台中市政中心商辦', lat: 24.163, lng: 120.6457 },
      { code: 'BET-16', name: '台中朝富商辦', lat: 24.1655, lng: 120.647 },
      { code: 'BET-17', name: '台中烏日高鐵商辦', lat: 24.109, lng: 120.616 },
      { code: 'BET-18', name: '台南火車站前商辦', lat: 22.997, lng: 120.2125 },
      { code: 'BET-19', name: '台南安平商辦', lat: 23.001, lng: 120.175 },
      { code: 'BET-20', name: '高雄夢時代商辦', lat: 22.597, lng: 120.306 },
      { code: 'BET-21', name: '高雄亞洲新灣區', lat: 22.6133, lng: 120.287 },
      { code: 'BET-22', name: '高雄三多商圈商辦', lat: 22.623, lng: 120.305 },
    ],
  },
  {
    slug: 'gamma',
    name: 'Gamma 綠色半導體廠',
    industry: 'semiconductor',
    config: {
      heroLabel: 'Fab 設施 OEE × 用電中心',
      kpiUnits: ['kWh', 'tCO₂e', 'OEE', 'kWh/wafer'],
      modules: ['dashboard', 'oee_dual_axis', 'alert', 'report'],
      primarySiteCode: 'GAM-01',
    },
    sites: [
      { code: 'GAM-01', name: '新竹科學園區 Fab 12', lat: 24.7823, lng: 121.0063 },
      { code: 'GAM-02', name: '新竹科學園區 Fab 5', lat: 24.78, lng: 121.005 },
      { code: 'GAM-03', name: '新竹科學園區 Fab 8', lat: 24.779, lng: 121.008 },
      { code: 'GAM-04', name: '新竹科學園區 Fab 2', lat: 24.779, lng: 121.007 },
      { code: 'GAM-05', name: '新竹科學園區封測廠', lat: 24.778, lng: 121.004 },
      { code: 'GAM-06', name: '新竹科學園區 Fab 18', lat: 24.782, lng: 121.0058 },
      { code: 'GAM-07', name: '苗栗竹南科學園區', lat: 24.692, lng: 120.882 },
      { code: 'GAM-08', name: '中科台中園區 Fab', lat: 24.1965, lng: 120.6175 },
      { code: 'GAM-09', name: '中科台中園區封測', lat: 24.198, lng: 120.62 },
      { code: 'GAM-10', name: '中科虎尾園區', lat: 23.7083, lng: 120.4178 },
      { code: 'GAM-11', name: '中科二林園區', lat: 23.94, lng: 120.385 },
      { code: 'GAM-12', name: '南科 Fab 18A (3nm)', lat: 23.1013, lng: 120.2821 },
      { code: 'GAM-13', name: '南科 Fab 14B', lat: 23.089, lng: 120.278 },
      { code: 'GAM-14', name: '南科 Fab 6', lat: 23.101, lng: 120.287 },
      { code: 'GAM-15', name: '南科聯華電子廠', lat: 23.095, lng: 120.288 },
      { code: 'GAM-16', name: '南科力積電', lat: 23.09, lng: 120.2825 },
      { code: 'GAM-17', name: '南科高雄路竹園區', lat: 22.77, lng: 120.316 },
      { code: 'GAM-18', name: '桃園龜山華亞科技園區', lat: 25.047, lng: 121.359 },
      { code: 'GAM-19', name: '屏東加工出口區', lat: 22.673, lng: 120.478 },
      { code: 'GAM-20', name: '苗栗銅鑼科學園區', lat: 24.491, lng: 120.789 },
    ],
  },
];

const TWO_PI = Math.PI * 2;

function noise(scale: number): number {
  return (Math.random() - 0.5) * 2 * scale;
}

function solarKw(tsHour: number, peakKw: number): number {
  if (tsHour < 6 || tsHour > 18) return 0;
  const norm = (tsHour - 6) / 12;
  const profile = Math.sin(Math.PI * norm);
  return Math.max(0, peakKw * profile * (0.85 + Math.random() * 0.2));
}

function industrialLoadKw(date: Date, basePeak: number): number {
  const hour = date.getHours() + date.getMinutes() / 60;
  const dow = date.getDay();
  const business = dow >= 1 && dow <= 5 && hour >= 8 && hour <= 18;
  const baseline = basePeak * 0.55;
  const surge = business ? basePeak * 0.35 : 0;
  const microWave = basePeak * 0.05 * Math.sin(TWO_PI * hour / 6);
  return baseline + surge + microWave + noise(basePeak * 0.04);
}

function officeLoadKw(date: Date, basePeak: number): number {
  const hour = date.getHours() + date.getMinutes() / 60;
  const dow = date.getDay();
  const isWeekday = dow >= 1 && dow <= 5;
  if (!isWeekday) return basePeak * 0.18 + noise(basePeak * 0.03);
  if (hour < 7 || hour > 21) return basePeak * 0.22 + noise(basePeak * 0.03);
  const occupancy = Math.sin(Math.PI * (hour - 7) / 14);
  return basePeak * (0.32 + 0.6 * Math.max(0, occupancy)) + noise(basePeak * 0.04);
}

function fabLoadKw(date: Date, basePeak: number): number {
  const hour = date.getHours() + date.getMinutes() / 60;
  const drift = 0.04 * Math.sin(TWO_PI * hour / 24);
  return basePeak * (0.92 + drift) + noise(basePeak * 0.025);
}

function evChargerKw(date: Date, ports: number): number {
  const hour = date.getHours() + date.getMinutes() / 60;
  const dow = date.getDay();
  if (dow === 0) return 0;
  if (hour < 17 || hour > 22) return ports * 50 * 0.05 + noise(ports * 1);
  const utilization = Math.min(1, (hour - 17) / 5);
  return ports * 50 * (0.4 + 0.5 * utilization) + noise(ports * 2);
}

function fabOee(date: Date, base: number): number {
  const hour = date.getHours() + date.getMinutes() / 60;
  const drift = 0.03 * Math.sin(TWO_PI * hour / 24 + Math.PI / 3);
  return Math.max(0.6, Math.min(0.99, base + drift + noise(0.01)));
}

async function chunkInsertReadings(rows: { assetId: string; timestamp: Date; metric: MetricType; value: number }[]) {
  for (let i = 0; i < rows.length; i += READING_BATCH) {
    const chunk = rows.slice(i, i + READING_BATCH);
    await prisma.metricReading.createMany({ data: chunk });
  }
}

async function main() {
  console.log('Wiping existing data...');
  await prisma.metricReading.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.site.deleteMany();
  await prisma.tenant.deleteMany();

  const now = new Date();
  now.setSeconds(0, 0);
  now.setMinutes(Math.floor(now.getMinutes() / 15) * 15);
  const startTs = now.getTime() - DAYS_OF_HISTORY * QUARTERS_PER_DAY * QUARTER_MS;

  for (const t of tenants) {
    console.log(`Seeding tenant ${t.slug}...`);
    const tenant = await prisma.tenant.create({
      data: {
        slug: t.slug,
        name: t.name,
        industry: t.industry,
        config: t.config,
      },
    });

    const sites = await Promise.all(
      t.sites.map((s) =>
        prisma.site.create({
          data: {
            tenantId: tenant.id,
            code: s.code,
            name: s.name,
            latitude: s.lat,
            longitude: s.lng,
          },
        }),
      ),
    );

    const readings: { assetId: string; timestamp: Date; metric: MetricType; value: number }[] = [];

    if (t.slug === 'acme') {
      const mainSite = sites.find((s) => s.code === 'ACM-01')!;
      const pv = await prisma.asset.create({
        data: { tenantId: tenant.id, siteId: mainSite.id, type: 'PV' as AssetType, name: 'PV Array 0.8 MW', metadata: { capacityKw: 800 } },
      });
      const ess = await prisma.asset.create({
        data: { tenantId: tenant.id, siteId: mainSite.id, type: 'ESS' as AssetType, name: 'ESS 2 MWh', metadata: { capacityKwh: 2000, maxChargeKw: 1000 } },
      });
      const load = await prisma.asset.create({
        data: { tenantId: tenant.id, siteId: mainSite.id, type: 'BUILDING' as AssetType, name: '園區廠房負載', metadata: { peakLoadKw: 2200 } },
      });
      const grid = await prisma.asset.create({
        data: { tenantId: tenant.id, siteId: mainSite.id, type: 'METER' as AssetType, name: '台電進線電表', metadata: {} },
      });
      const ev = await prisma.asset.create({
        data: { tenantId: tenant.id, siteId: mainSite.id, type: 'EV_CHARGER' as AssetType, name: 'EV 充電場 (8 ports)', metadata: { ports: 8, kwPerPort: 50 } },
      });

      for (let q = 0; q < DAYS_OF_HISTORY * QUARTERS_PER_DAY; q++) {
        const ts = new Date(startTs + q * QUARTER_MS);
        const tsHour = ts.getHours() + ts.getMinutes() / 60;
        const pvKw = solarKw(tsHour, 800);
        const loadKw = industrialLoadKw(ts, 2200);
        const evKw = evChargerKw(ts, 8);
        const totalLoad = loadKw + evKw;
        const net = totalLoad - pvKw;
        const essKw = net > 1500 ? -Math.min(800, net - 1500) : net < 0 ? Math.min(600, -net) : 0;
        const gridKw = totalLoad - pvKw + essKw;
        readings.push(
          { assetId: pv.id, timestamp: ts, metric: 'POWER' as MetricType, value: round2(pvKw) },
          { assetId: load.id, timestamp: ts, metric: 'POWER' as MetricType, value: round2(loadKw) },
          { assetId: ev.id, timestamp: ts, metric: 'POWER' as MetricType, value: round2(evKw) },
          { assetId: ess.id, timestamp: ts, metric: 'POWER' as MetricType, value: round2(essKw) },
          { assetId: grid.id, timestamp: ts, metric: 'POWER' as MetricType, value: round2(gridKw) },
        );
      }

      for (const otherSite of sites.filter((s) => s.code !== 'ACM-01')) {
        const peak = 600 + (otherSite.code.charCodeAt(otherSite.code.length - 1) % 5) * 100;
        const building = await prisma.asset.create({
          data: { tenantId: tenant.id, siteId: otherSite.id, type: 'BUILDING' as AssetType, name: `${otherSite.code} ${otherSite.name}`, metadata: { peakKw: peak } },
        });
        for (let q = 0; q < DAYS_OF_HISTORY * QUARTERS_PER_DAY; q++) {
          const ts = new Date(startTs + q * QUARTER_MS);
          const v = industrialLoadKw(ts, peak);
          readings.push({ assetId: building.id, timestamp: ts, metric: 'POWER' as MetricType, value: round2(v) });
        }
      }
    } else if (t.slug === 'beta') {
      for (const site of sites) {
        const idx = parseInt(site.code.split('-')[1] ?? '0', 10);
        const peak = 80 + (idx % 7) * 35;
        const meter = await prisma.asset.create({
          data: { tenantId: tenant.id, siteId: site.id, type: 'BUILDING' as AssetType, name: `${site.code} ${site.name}`, metadata: { peakKw: peak } },
        });
        for (let q = 0; q < DAYS_OF_HISTORY * QUARTERS_PER_DAY; q++) {
          const ts = new Date(startTs + q * QUARTER_MS);
          const v = officeLoadKw(ts, peak);
          readings.push({ assetId: meter.id, timestamp: ts, metric: 'POWER' as MetricType, value: round2(v) });
        }
      }
    } else if (t.slug === 'gamma') {
      for (const site of sites) {
        const idx = parseInt(site.code.split('-')[1] ?? '0', 10);
        const peak = 3000 + (idx % 6) * 2500;
        const oeeBase = 0.78 + (idx % 5) * 0.025;
        const fab = await prisma.asset.create({
          data: { tenantId: tenant.id, siteId: site.id, type: 'LINE' as AssetType, name: `${site.code} ${site.name}`, metadata: { peakKw: peak, oeeBase } },
        });
        for (let q = 0; q < DAYS_OF_HISTORY * QUARTERS_PER_DAY; q++) {
          const ts = new Date(startTs + q * QUARTER_MS);
          readings.push(
            { assetId: fab.id, timestamp: ts, metric: 'POWER' as MetricType, value: round2(fabLoadKw(ts, peak)) },
            { assetId: fab.id, timestamp: ts, metric: 'OEE' as MetricType, value: round2(fabOee(ts, oeeBase)) },
          );
        }
      }
    }

    console.log(`  inserting ${readings.length.toLocaleString()} readings`);
    await chunkInsertReadings(readings);
  }

  console.log('Seeding alerts...');
  const acme = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'acme' } });
  const beta = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'beta' } });
  const gamma = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'gamma' } });
  const alertNow = new Date();
  await prisma.alert.createMany({
    data: [
      { tenantId: acme.id, severity: 'CRITICAL' as AlertSeverity, title: 'ACM-01 ESS SOC 偏低', description: '電池 SOC 連續 3 小時低於 25%，可能影響今晚削峰能力。', triggeredAt: new Date(alertNow.getTime() - 1000 * 60 * 35) },
      { tenantId: acme.id, severity: 'WARN' as AlertSeverity, title: 'PV 發電低於預期', description: '雲量增加，今日 PV 發電預計低於季節平均 18%。', triggeredAt: new Date(alertNow.getTime() - 1000 * 60 * 90) },
      { tenantId: acme.id, severity: 'INFO' as AlertSeverity, title: 'EV 充電場使用率高', description: '今晚 18:00–22:00 預計 7/8 樁同時充電。', triggeredAt: new Date(alertNow.getTime() - 1000 * 60 * 120) },
      { tenantId: beta.id, severity: 'WARN' as AlertSeverity, title: 'BET-14 EUI 異常', description: '台中七期世貿大樓本月每平方米能耗超出群組平均 22%。', triggeredAt: new Date(alertNow.getTime() - 1000 * 60 * 60 * 4) },
      { tenantId: gamma.id, severity: 'CRITICAL' as AlertSeverity, title: 'GAM-01 用電量飆升', description: '新竹 Fab 12 過去 1 小時用電較基準上升 35%，請確認是否進入新製程批次。', triggeredAt: new Date(alertNow.getTime() - 1000 * 60 * 18) },
      { tenantId: gamma.id, severity: 'INFO' as AlertSeverity, title: 'OEE 達月新高', description: 'GAM-12 南科 Fab 18A 本週 OEE 達 91.2%，創 6 個月新高。', triggeredAt: new Date(alertNow.getTime() - 1000 * 60 * 60 * 12) },
    ],
  });

  console.log('Done.');
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
