import * as d3 from 'd3';
import type maplibregl from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import type { SiteRow } from '../../api/client';
import { TENANT_ICONS } from './siteIcons';

export type SiteMarkerMode = 'dots' | 'icons';

interface Props {
  map: maplibregl.Map;
  sites: SiteRow[];
  /** Hide the overlay at zoom ≤ this. */
  hideAtZoomBelow?: number;
  /** Pixel radius for nearest-neighbor clustering on screen. */
  clusterPxRadius?: number;
  /** Currently active site (the one whose data is in the side panel). Drives marker highlight. */
  activeSiteCode?: string | null;
  /** 'dots' = small colored circles, no clustering, no hover. 'icons' = industry icons + cluster bubbles. */
  mode?: SiteMarkerMode;
  onHover: (site: SiteRow | null) => void;
  onClick?: (site: SiteRow) => void;
}

const ICON_SIZE = 28;
const HALF = ICON_SIZE / 2;
const ACTIVE_RADIUS = HALF + 4;
const ACTIVE_STROKE = 2.6;
const DEFAULT_STROKE = 1.8;

interface Cluster {
  /** Stable key for d3 data join across renders. */
  key: string;
  x: number;
  y: number;
  members: SiteRow[];
}

/**
 * Site overlay with client-side clustering: sites within `clusterPxRadius`
 * screen pixels are aggregated into a numbered bubble. Singles render as
 * industry icons (sun / building / cpu) on dark theme bg with tenant ring.
 *
 * Recomputed on every map move/zoom — O(N²) is fine for 48 sites.
 */
export function SiteIconsOverlay({
  map,
  sites,
  hideAtZoomBelow = 6.1,
  clusterPxRadius = 32,
  activeSiteCode,
  mode = 'icons',
  onHover,
  onClick,
}: Props) {
  const modeRef = useRef<SiteMarkerMode>(mode);
  useEffect(() => {
    modeRef.current = mode;
    // Re-render entire overlay when mode flips so DOM matches new visual.
    const svg = svgRef.current;
    if (svg) d3.select(svg).selectAll('g.site-marker').remove();
    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const activeCodeRef = useRef<string | null | undefined>(activeSiteCode);

  useEffect(() => {
    activeCodeRef.current = activeSiteCode;
    applyActiveStyles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSiteCode]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = () => render();
    map.on('move', handler);
    map.on('moveend', handler);
    map.on('resize', handler);
    map.on('zoom', handler);
    render();
    return () => {
      map.off('move', handler);
      map.off('moveend', handler);
      map.off('resize', handler);
      map.off('zoom', handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, sites]);

  function projectAll(): { site: SiteRow; x: number; y: number }[] {
    return sites.map((s) => {
      const p = map.project([s.longitude, s.latitude]);
      return { site: s, x: p.x, y: p.y };
    });
  }

  function computeClusters(): Cluster[] {
    if (sites.length === 0) return [];
    const projected = projectAll();

    const used = new Set<string>();
    const clusters: Cluster[] = [];
    const r2 = clusterPxRadius * clusterPxRadius;

    for (const p of projected) {
      if (used.has(p.site.code)) continue;
      const members: typeof projected = [p];
      used.add(p.site.code);
      for (const o of projected) {
        if (used.has(o.site.code)) continue;
        const dx = o.x - p.x;
        const dy = o.y - p.y;
        if (dx * dx + dy * dy <= r2) {
          members.push(o);
          used.add(o.site.code);
        }
      }
      const cx = members.reduce((a, m) => a + m.x, 0) / members.length;
      const cy = members.reduce((a, m) => a + m.y, 0) / members.length;
      const codes = members.map((m) => m.site.code).sort();
      clusters.push({
        key: codes.length === 1 ? `single:${codes[0]}` : `cluster:${codes.join(',')}`,
        x: cx,
        y: cy,
        members: members.map((m) => m.site),
      });
    }
    return clusters;
  }

  /** Each site is its own "cluster" of 1 — used by dots mode (no aggregation). */
  function computeDots(): Cluster[] {
    return projectAll().map((p) => ({
      key: `dot:${p.site.code}`,
      x: p.x,
      y: p.y,
      members: [p.site],
    }));
  }

  function applyActiveStyles() {
    const svg = svgRef.current;
    if (!svg) return;
    const activeCode = activeCodeRef.current;
    d3.select(svg)
      .selectAll<SVGGElement, Cluster>('g.site-marker')
      .each(function (c) {
        const isSingle = c.members.length === 1;
        const isActive = isSingle && c.members[0].code === activeCode;
        const g = d3.select(this);
        const bg = g.select<SVGCircleElement>('circle.site-icon-bg');
        if (!bg.empty()) {
          bg.transition()
            .duration(140)
            .attr('r', isActive ? ACTIVE_RADIUS : HALF)
            .attr('stroke-width', isActive ? ACTIVE_STROKE : DEFAULT_STROKE);
        }
        g.attr('data-active', isActive ? 'true' : null);
      });
  }

  function render() {
    const svg = svgRef.current;
    if (!svg) return;
    const zoom = map.getZoom();
    const currentMode = modeRef.current;
    const visibleClusters =
      zoom < hideAtZoomBelow ? [] : currentMode === 'dots' ? computeDots() : computeClusters();

    const sel = d3
      .select(svg)
      .selectAll<SVGGElement, Cluster>('g.site-marker')
      .data(visibleClusters, (d) => d.key);

    const enter = sel.enter().append('g').attr('class', 'site-marker');

    enter
      .style('cursor', currentMode === 'dots' ? 'default' : 'pointer')
      .style('pointer-events', currentMode === 'dots' ? 'none' : 'auto')
      .each(function (c) {
        if (currentMode === 'dots') {
          renderDot(d3.select(this), c.members[0]);
        } else if (c.members.length === 1) {
          renderSingle(d3.select(this), c.members[0]);
        } else {
          renderCluster(d3.select(this), c);
        }
      })
      .on('mouseenter', (_event, c) => {
        if (modeRef.current !== 'icons') return;
        if (c.members.length === 1) onHover(c.members[0]);
      })
      .on('click', (_event, c) => {
        if (modeRef.current !== 'icons') return;
        if (c.members.length === 1) {
          onClick?.(c.members[0]);
        } else {
          const currentZoom = map.getZoom();
          const targetZoom = Math.min(currentZoom + 2, 13);
          const lngLat = map.unproject([c.x, c.y]);
          map.easeTo({ center: lngLat, zoom: targetZoom, duration: 600 });
        }
      });

    sel
      .merge(enter)
      .attr('transform', (c) => `translate(${c.x}, ${c.y})`);

    sel.exit().remove();

    applyActiveStyles();
  }

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0"
      style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
      aria-hidden="true"
    />
  );
}

function renderDot(g: d3.Selection<SVGGElement, unknown, null, undefined>, site: SiteRow) {
  const tenant = TENANT_ICONS[site.tenantSlug as keyof typeof TENANT_ICONS];
  const color = tenant?.color ?? '#5e6e8a';
  g.attr('class', 'site-marker site-dot').attr('data-kind', 'dot');
  g.append('circle')
    .attr('r', 3.5)
    .attr('fill', color)
    .attr('opacity', 0.85)
    .attr('stroke', '#0b1220')
    .attr('stroke-width', 0.8);
}

function renderSingle(g: d3.Selection<SVGGElement, unknown, null, undefined>, site: SiteRow) {
  const tenant = TENANT_ICONS[site.tenantSlug as keyof typeof TENANT_ICONS];
  const color = tenant?.color ?? '#5e6e8a';

  g.attr('class', 'site-marker site-icon')
    .attr('data-kind', 'single');

  g.append('circle')
    .attr('class', 'site-icon-bg')
    .attr('r', HALF)
    .attr('fill', '#0b1220')
    .attr('stroke', color)
    .attr('stroke-width', DEFAULT_STROKE);

  const innerSize = ICON_SIZE * 0.6;
  const inner = g
    .append('svg')
    .attr('x', -innerSize / 2)
    .attr('y', -innerSize / 2)
    .attr('width', innerSize)
    .attr('height', innerSize)
    .attr('viewBox', '0 0 24 24')
    .attr('fill', 'none')
    .attr('stroke', color)
    .attr('stroke-width', 2.2)
    .attr('stroke-linecap', 'round')
    .attr('stroke-linejoin', 'round');

  if (tenant) {
    const innerPaths = tenant.svg.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '');
    (inner.node() as SVGSVGElement).innerHTML = innerPaths;
  }
}

function renderCluster(g: d3.Selection<SVGGElement, unknown, null, undefined>, cluster: Cluster) {
  const count = cluster.members.length;
  // Predominant tenant by member count.
  const tally = new Map<string, number>();
  for (const m of cluster.members) {
    tally.set(m.tenantSlug, (tally.get(m.tenantSlug) ?? 0) + 1);
  }
  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  const dominantSlug = sorted[0][0];
  const dominant = TENANT_ICONS[dominantSlug as keyof typeof TENANT_ICONS];
  const color = dominant?.color ?? '#5e6e8a';

  // Radius scales mildly with count: 2 members → ~18, 5 → ~21, 11 → ~24.
  const r = Math.min(28, 14 + Math.sqrt(count) * 3);

  g.attr('class', 'site-marker site-cluster').attr('data-kind', 'cluster');

  // Outer halo for legibility on top of choropleth
  g.append('circle')
    .attr('class', 'site-cluster-halo')
    .attr('r', r + 3)
    .attr('fill', `${color}22`)
    .attr('stroke', 'none');

  g.append('circle')
    .attr('class', 'site-cluster-bg')
    .attr('r', r)
    .attr('fill', '#0b1220')
    .attr('stroke', color)
    .attr('stroke-width', 2.4);

  g.append('text')
    .attr('class', 'site-cluster-count')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('y', 1)
    .attr('fill', '#e6edf7')
    .attr('font-weight', '600')
    .attr('font-size', count >= 10 ? 13 : 14)
    .style('font-family', 'Inter, "Noto Sans TC", sans-serif')
    .text(count);
}
