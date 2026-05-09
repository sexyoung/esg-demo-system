import { useQuery } from '@tanstack/react-query';
import maplibregl from 'maplibre-gl';
import type { GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, queryKeys } from '../api/client';
import { useFps } from '../lib/useFps';

const STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const TAIWAN_CENTER: [number, number] = [121.0, 23.7];
const INITIAL_ZOOM = 6.6;
const FAKE_MARKER_COUNT = 4952;

const TENANT_COLORS: Record<string, string> = {
  acme: '#fbbf24',
  beta: '#00a3df',
  gamma: '#a78bfa',
};

const TENANT_LABELS: Record<string, string> = {
  acme: 'Acme 微電網',
  beta: 'Beta 商辦',
  gamma: 'Gamma 半導體',
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

interface SiteFeatureProps {
  tenantSlug: string;
  code: string;
  name: string;
  industry: string;
  fake?: boolean;
}

export function MapPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [renderMs, setRenderMs] = useState(0);
  const { fps } = useFps();
  const navigate = useNavigate();

  const { data: sites } = useQuery({
    queryKey: queryKeys.sites,
    queryFn: () => api.sites(),
    staleTime: 5 * 60 * 1000,
  });

  const realFeatures = useMemo(() => {
    if (!sites) return [] as GeoJSON.Feature<GeoJSON.Point, SiteFeatureProps>[];
    return sites.map((s) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [s.longitude, s.latitude] satisfies [number, number] },
      properties: {
        tenantSlug: s.tenantSlug,
        code: s.code,
        name: s.name,
        industry: s.industry,
      } satisfies SiteFeatureProps,
    }));
  }, [sites]);

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

    map.on('load', () => {
      map.addSource('sites', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      map.addLayer({
        id: 'sites-clusters',
        type: 'circle',
        source: 'sites',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            'rgba(0, 131, 182, 0.6)',
            10,
            'rgba(167, 139, 250, 0.6)',
            100,
            'rgba(248, 113, 113, 0.6)',
          ],
          'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 100, 24],
          'circle-stroke-color': '#0b1220',
          'circle-stroke-width': 2,
        },
      });

      map.addLayer({
        id: 'sites-cluster-inner',
        type: 'circle',
        source: 'sites',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#0b1220',
          'circle-radius': ['step', ['get', 'point_count'], 8, 10, 11, 100, 14],
        },
      });

      map.addLayer({
        id: 'sites-points',
        type: 'circle',
        source: 'sites',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'match',
            ['get', 'tenantSlug'],
            'acme', TENANT_COLORS.acme,
            'beta', TENANT_COLORS.beta,
            'gamma', TENANT_COLORS.gamma,
            '#5e6e8a',
          ],
          'circle-radius': ['case', ['boolean', ['get', 'fake'], false], 3, 6],
          'circle-stroke-color': '#0b1220',
          'circle-stroke-width': 1,
          'circle-opacity': ['case', ['boolean', ['get', 'fake'], false], 0.6, 1],
        },
      });

      map.on('click', 'sites-clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['sites-clusters'] });
        const clusterId = features[0]?.properties?.cluster_id;
        const source = map.getSource('sites') as GeoJSONSource | undefined;
        if (clusterId !== undefined && source) {
          source.getClusterExpansionZoom(clusterId).then((zoom) => {
            const geom = features[0].geometry;
            if (geom.type === 'Point') {
              map.easeTo({ center: geom.coordinates as [number, number], zoom });
            }
          });
        }
      });

      map.on('click', 'sites-points', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const props = f.properties as SiteFeatureProps;
        if (props.fake) return;
        const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
        const tenantLabel = TENANT_LABELS[props.tenantSlug] ?? props.tenantSlug;
        const accent = TENANT_COLORS[props.tenantSlug] ?? '#5e6e8a';

        const root = document.createElement('div');
        root.className = 'energiq-popup';
        root.innerHTML = `
          <div class="popup-tag" style="color:${accent};border-color:${accent}33;background:${accent}15">${tenantLabel}</div>
          <div class="popup-code">${escapeHtml(props.code)}</div>
          <div class="popup-name">${escapeHtml(props.name)}</div>
          <button type="button" class="popup-cta" data-action="drill">
            進 ${escapeHtml(tenantLabel)} dashboard →
          </button>
        `;
        const popup = new maplibregl.Popup({
          offset: 14,
          closeButton: true,
          className: 'energiq-popup-shell',
          maxWidth: '260px',
        })
          .setLngLat(coords)
          .setDOMContent(root)
          .addTo(map);

        root.querySelector<HTMLButtonElement>('[data-action="drill"]')?.addEventListener('click', () => {
          popup.remove();
          navigate(`/tenants/${props.tenantSlug}`);
        });
      });

      map.on('mouseenter', 'sites-points', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const props = f.properties as SiteFeatureProps;
        if (props.fake) return;
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'sites-points', () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('mouseenter', 'sites-clusters', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'sites-clusters', () => {
        map.getCanvas().style.cursor = '';
      });
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [navigate]);

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

  return (
    <div className="relative w-full h-screen">
      <div ref={containerRef} className="h-full w-full" />

      <div className="absolute top-4 left-4 z-10 rounded-md border border-border bg-bg-elevated/85 backdrop-blur p-3 text-xs space-y-0.5 max-w-[300px]">
        <div className="flex items-center gap-2 text-fg uppercase tracking-wider">
          <span className="inline-block h-2 w-2 rounded-full bg-success live-dot" />
          EnergiQ Demo · 全域監控
        </div>
        <div className="text-fg-subtle text-[10px]">click marker → tenant dashboard · D 鍵切 5000 marker debug</div>
        <div className="border-t border-border-soft pt-1.5 mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
          <span><span className="inline-block h-2 w-2 rounded-full mr-1" style={{ background: TENANT_COLORS.acme }} />Acme · 微電網</span>
          <span><span className="inline-block h-2 w-2 rounded-full mr-1" style={{ background: TENANT_COLORS.beta }} />Beta · 商辦</span>
          <span><span className="inline-block h-2 w-2 rounded-full mr-1" style={{ background: TENANT_COLORS.gamma }} />Gamma · 半導體</span>
        </div>
      </div>

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
  );
}

function generateFakeFeatures(count: number): GeoJSON.Feature<GeoJSON.Point, SiteFeatureProps>[] {
  const tenants: Array<keyof typeof TENANT_COLORS> = ['acme', 'beta', 'gamma'];
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
      properties: { tenantSlug: tenant, code: `FAKE-${i}`, name: `Fake site ${i}`, industry: 'fake', fake: true },
    });
  }
  return features;
}
