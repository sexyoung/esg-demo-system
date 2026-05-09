import { useQueries, useQuery } from '@tanstack/react-query';
import { Building2, Cpu, SunMedium } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import type { GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, queryKeys, type SiteRow } from '../api/client';
import { dashboardApi, dashboardKeys, type EsgSummary } from '../api/dashboard';
import { ChoroplethOverlay } from '../components/map/ChoroplethOverlay';
import { SiteIconsOverlay } from '../components/map/SiteIconsOverlay';
import { SiteSidePanel } from '../components/map/SiteSidePanel';
import { TENANT_ICONS } from '../components/map/siteIcons';
import { useFps } from '../lib/useFps';

const STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const TAIWAN_CENTER: [number, number] = [121.0, 23.7];
const INITIAL_ZOOM = 7.4;
const FAKE_MARKER_COUNT = 4952;

const TENANT_LABELS: Record<string, string> = {
  acme: 'Acme 微電網',
  beta: 'Beta 商辦',
  gamma: 'Gamma 半導體',
};

/** RE% gradient stops (lng=lat order matches d3 reGradient in design doc). */
const RE_COLOR_STOPS: [number, string][] = [
  [0, '#7f1d1d'],
  [0.3, '#fbbf24'],
  [0.6, '#34d399'],
  [1.0, '#065f46'],
];

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

interface SiteFeatureProps {
  tenantSlug: string;
  code: string;
  name: string;
  industry: string;
  rePct: number;
  monthlyCo2: number;
  fake?: boolean;
}

export function MapPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [renderMs, setRenderMs] = useState(0);
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);
  const [hoveredSite, setHoveredSite] = useState<SiteRow | null>(null);
  const [zoom, setZoom] = useState(INITIAL_ZOOM);

  // Detail threshold: below = county choropleth + dots; at/above = township choropleth + icons + cluster.
  const DETAIL_ZOOM = 10;
  const isDetail = zoom >= DETAIL_ZOOM;
  const { fps } = useFps();
  const navigate = useNavigate();

  const { data: rawSites } = useQuery({
    queryKey: queryKeys.sites,
    queryFn: () => api.sites(),
    staleTime: 5 * 60 * 1000,
  });

  /** Sites with co-located duplicates spread in a small ring (~50m) so they
   *  remain individually clickable at high zoom. Same lng/lat (5dp grid) =
   *  duplicate; spread radius scales mildly with group size. Pure-visual
   *  jitter; original lng/lat preserved on `_originalLngLat` for debug. */
  const sites = useMemo(() => {
    if (!rawSites) return rawSites;
    const groups = new Map<string, SiteRow[]>();
    for (const s of rawSites) {
      const key = `${s.longitude.toFixed(5)},${s.latitude.toFixed(5)}`;
      const arr = groups.get(key);
      if (arr) arr.push(s);
      else groups.set(key, [s]);
    }
    const out: SiteRow[] = [];
    for (const group of groups.values()) {
      if (group.length === 1) {
        out.push(group[0]);
        continue;
      }
      // 0.0005° ≈ 55m. Lat varies by tenant lat but rough enough for 22°-25°.
      const r = 0.0005;
      const baseLng = group[0].longitude;
      const baseLat = group[0].latitude;
      group.forEach((s, i) => {
        const angle = (2 * Math.PI * i) / group.length;
        out.push({
          ...s,
          longitude: baseLng + r * Math.cos(angle),
          latitude: baseLat + r * Math.sin(angle),
        });
      });
    }
    return out;
  }, [rawSites]);

  // Fetch ESG summary for all 3 tenants in parallel — 1 round-trip each, all cached.
  const tenantSlugs = ['acme', 'beta', 'gamma'] as const;
  const esgQueries = useQueries({
    queries: tenantSlugs.map((slug) => ({
      queryKey: dashboardKeys.esgSummary(slug),
      queryFn: () => dashboardApi.esgSummary(slug),
      staleTime: 5 * 60 * 1000,
    })),
  });

  /** Per-tenant aggregate from monthly[last]: RE% + monthly co2 per site. */
  const tenantMetrics = useMemo(() => {
    const acc: Record<string, { rePct: number; co2PerSite: number }> = {};
    if (!sites) return acc;
    const sitesByTenant = sites.reduce<Record<string, number>>((m, s) => {
      m[s.tenantSlug] = (m[s.tenantSlug] ?? 0) + 1;
      return m;
    }, {});
    tenantSlugs.forEach((slug, i) => {
      const data = esgQueries[i].data as EsgSummary | undefined;
      if (!data) return;
      const last = data.monthly[data.monthly.length - 1];
      acc[slug] = {
        rePct: last?.renewableRatio ?? 0,
        co2PerSite: (last?.co2Tons ?? 0) / Math.max(1, sitesByTenant[slug] ?? 1),
      };
    });
    return acc;
  }, [esgQueries, sites]);

  /** Per-county avg RE% for choropleth fill, built from sites + tenantMetrics. */
  const countyRePct = useMemo(() => {
    if (!sites) return new Map<string, number>();
    const sums = new Map<string, { sum: number; n: number }>();
    for (const s of sites) {
      if (!s.county) continue;
      const m = tenantMetrics[s.tenantSlug];
      if (!m) continue;
      const cur = sums.get(s.county) ?? { sum: 0, n: 0 };
      cur.sum += m.rePct;
      cur.n += 1;
      sums.set(s.county, cur);
    }
    const out = new Map<string, number>();
    for (const [county, { sum, n }] of sums) out.set(county, sum / n);
    return out;
  }, [sites, tenantMetrics]);

  const realFeatures = useMemo(() => {
    if (!sites) return [] as GeoJSON.Feature<GeoJSON.Point, SiteFeatureProps>[];
    return sites.map((s) => {
      const m = tenantMetrics[s.tenantSlug] ?? { rePct: 0.3, co2PerSite: 10 };
      return {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [s.longitude, s.latitude] satisfies [number, number] },
        properties: {
          tenantSlug: s.tenantSlug,
          code: s.code,
          name: s.name,
          industry: s.industry,
          rePct: m.rePct,
          monthlyCo2: m.co2PerSite,
        } satisfies SiteFeatureProps,
      };
    });
  }, [sites, tenantMetrics]);

  const fakeFeatures = useMemo(() => generateFakeFeatures(FAKE_MARKER_COUNT), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') setDebugMode((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: TAIWAN_CENTER,
      zoom: INITIAL_ZOOM,
      attributionControl: { compact: true },
      pitchWithRotate: false,
      dragRotate: false,
    });
    mapRef.current = map;
    map.on('load', () => setMapInstance(map));
    map.on('zoom', () => setZoom(map.getZoom()));

    map.on('load', () => {
      // Site aggregation moved to client-side D3 (SiteIconsOverlay) — MapLibre
      // source is flat. The fake debug 5000-marker layer still uses this source.
      map.addSource('sites', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'sites-fake-dots',
        type: 'circle',
        source: 'sites',
        filter: ['boolean', ['get', 'fake'], false],
        paint: {
          'circle-color': '#5e6e8a',
          'circle-radius': 2.5,
          'circle-opacity': 0.5,
        },
      });
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [navigate]);

  // Hover/click for individual sites is wired in SiteIconsOverlay (SVG events).
  // The setHoveredSite callback is passed in via the onHover prop below.

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const source = map.getSource('sites') as GeoJSONSource | undefined;
      if (!source) return;
      const features = debugMode ? [...realFeatures, ...fakeFeatures] : realFeatures;
      const t0 = performance.now();
      source.setData({ type: 'FeatureCollection', features });
      const t1 = performance.now();
      setRenderMs(Math.round((t1 - t0) * 100) / 100);
    };
    if (map.isStyleLoaded() && map.getSource('sites')) apply();
    else map.once('load', apply);
  }, [debugMode, realFeatures, fakeFeatures]);

  const visibleCount = debugMode ? realFeatures.length + fakeFeatures.length : realFeatures.length;
  const fpsClass = fps >= 55 ? 'text-success' : fps >= 30 ? 'text-warn' : 'text-danger';

  const choroplethFill = (feature: GeoJSON.Feature): string => {
    const name = (feature.properties as { COUNTYNAME?: string })?.COUNTYNAME;
    if (!name) return 'rgba(94, 110, 138, 0.15)';
    const re = countyRePct.get(name);
    if (re === undefined) return 'rgba(94, 110, 138, 0.10)';
    return interpolateColor(re);
  };

  return (
    <div className="flex w-full h-full overflow-hidden">
      <div className="relative flex-1 min-w-0">
        <div ref={containerRef} className="h-full w-full" />
        {mapInstance && (
          <ChoroplethOverlay
            map={mapInstance}
            resolution={isDetail ? 'township' : 'county'}
            fillFor={choroplethFill}
          />
        )}
        {mapInstance && sites && (
          <SiteIconsOverlay
            map={mapInstance}
            sites={sites.filter((s) => !s.code.startsWith('FAKE-'))}
            clusterPxRadius={26}
            mode={isDetail ? 'icons' : 'dots'}
            activeSiteCode={hoveredSite?.code}
            onHover={setHoveredSite}
            onClick={(site) => navigate(`/tenants/${site.tenantSlug}`)}
          />
        )}

        <div className="absolute top-4 left-4 z-10 rounded-md border border-border bg-bg-elevated/85 backdrop-blur p-3 text-xs space-y-1.5 max-w-[280px]">
          <div className="flex items-center gap-2 text-fg uppercase tracking-wider">
            <span className="inline-block h-2 w-2 rounded-full bg-success live-dot" />
            EnergiQ · ESG portfolio
          </div>
          <div className="border-t border-border-soft pt-1.5 grid grid-cols-1 gap-1 text-[11px]">
            <span className="flex items-center gap-2">
              <SunMedium size={13} style={{ color: TENANT_ICONS.acme.color }} />
              <span className="text-fg-muted">Acme · {TENANT_ICONS.acme.label}</span>
            </span>
            <span className="flex items-center gap-2">
              <Building2 size={13} style={{ color: TENANT_ICONS.beta.color }} />
              <span className="text-fg-muted">Beta · {TENANT_ICONS.beta.label}</span>
            </span>
            <span className="flex items-center gap-2">
              <Cpu size={13} style={{ color: TENANT_ICONS.gamma.color }} />
              <span className="text-fg-muted">Gamma · {TENANT_ICONS.gamma.label}</span>
            </span>
          </div>
          <div className="text-fg-subtle text-[10px] border-t border-border-soft pt-1">
            縣市色階 = 平均再生能源占比 · 按 D 切 5000 marker debug
          </div>
        </div>

        <ChoroplethLegend />

        <div className="absolute bottom-4 left-4 z-10 rounded-md border border-border bg-bg-elevated/85 backdrop-blur p-2 text-[11px] tabular-nums flex items-center gap-3">
          <span>markers: <span className="text-accent-soft">{visibleCount.toLocaleString()}</span></span>
          <span>render: <span className="text-warn">{renderMs}</span> ms</span>
          <span>fps: <span className={fpsClass}>{fps}</span></span>
          <span className="text-fg-subtle">·</span>
          <button
            type="button"
            onClick={() => setDebugMode((v) => !v)}
            className={`px-1.5 py-0.5 rounded border text-[10px] ${
              debugMode ? 'border-warn/60 text-warn bg-warn/10' : 'border-border-soft text-fg-muted hover:text-fg'
            }`}
          >
            {debugMode ? `Debug ON (${FAKE_MARKER_COUNT.toLocaleString()} fake)` : 'Press D for Debug'}
          </button>
        </div>
      </div>

      <SiteSidePanel hovered={hoveredSite} />
    </div>
  );
}

function ChoroplethLegend() {
  const stops = RE_COLOR_STOPS;
  const gradient = `linear-gradient(to right, ${stops.map(([t, c]) => `${c} ${t * 100}%`).join(', ')})`;
  return (
    <div className="absolute top-4 right-4 z-10 rounded-md border border-border bg-bg-elevated/85 backdrop-blur p-2.5 text-[10px] w-[180px]">
      <div className="text-fg-muted uppercase tracking-wider mb-1.5">縣市再生能源 %</div>
      <div className="h-2 rounded" style={{ background: gradient }} />
      <div className="flex justify-between text-fg-subtle tabular-nums mt-1">
        <span>0%</span>
        <span>30%</span>
        <span>60%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

function generateFakeFeatures(count: number): GeoJSON.Feature<GeoJSON.Point, SiteFeatureProps>[] {
  const tenants = ['acme', 'beta', 'gamma'] as const;
  const features: GeoJSON.Feature<GeoJSON.Point, SiteFeatureProps>[] = [];
  const minLat = 22.0;
  const maxLat = 25.3;
  const minLng = 120.05;
  const maxLng = 121.95;
  for (let i = 0; i < count; i++) {
    const lat = minLat + Math.random() * (maxLat - minLat);
    const lng = minLng + Math.random() * (maxLng - minLng);
    const tenant = tenants[i % 3];
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        tenantSlug: tenant,
        code: `FAKE-${i}`,
        name: `Fake site ${i}`,
        industry: 'fake',
        rePct: 0.3 + Math.random() * 0.5,
        monthlyCo2: 5 + Math.random() * 30,
        fake: true,
      },
    });
  }
  return features;
}

/** Linear interpolation through RE_COLOR_STOPS, returns rgba string at 0.55 alpha. */
function interpolateColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const stops = RE_COLOR_STOPS;
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i];
    if (clamped <= t1) {
      const [t0, c0] = stops[i - 1];
      const f = (clamped - t0) / (t1 - t0);
      return mixHex(c0, c1, f, 0.55);
    }
  }
  return hexToRgba(stops[stops.length - 1][1], 0.55);
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mixHex(a: string, b: string, t: number, alpha: number): string {
  const ah = a.replace('#', '');
  const bh = b.replace('#', '');
  const ar = parseInt(ah.slice(0, 2), 16);
  const ag = parseInt(ah.slice(2, 4), 16);
  const ab = parseInt(ah.slice(4, 6), 16);
  const br = parseInt(bh.slice(0, 2), 16);
  const bg = parseInt(bh.slice(2, 4), 16);
  const bb = parseInt(bh.slice(4, 6), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const b2 = Math.round(ab + (bb - ab) * t);
  return `rgba(${r}, ${g}, ${b2}, ${alpha})`;
}
