import * as d3 from 'd3';
import type maplibregl from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';

export type ChoroplethResolution = 'county' | 'township';

interface Props {
  map: maplibregl.Map;
  resolution: ChoroplethResolution;
  /** Optional fn to compute fill color per region feature. Default: 0.18 alpha accent. */
  fillFor?: (feature: GeoJSON.Feature) => string;
}

const RESOLUTION_URLS: Record<ChoroplethResolution, string> = {
  county: '/taiwan-counties.geojson',
  township: '/taiwan-townships.geojson',
};

/**
 * SVG choropleth overlay for MapLibre. Switches between county-level (22) and
 * township-level (366) GeoJSON based on `resolution`. Both files are lazy-
 * loaded and cached. Vertices project via d3.geoTransform → map.project, so
 * polygons stay locked to the basemap on every move/zoom.
 *
 * Pattern: Mike Bostock "Using D3 with Mapbox GL"
 *   https://bl.ocks.org/d3noob/c4b9472ff9a01958296fb6cc7d40b9a4
 */
export function ChoroplethOverlay({ map, resolution, fillFor }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const cacheRef = useRef<Partial<Record<ChoroplethResolution, GeoJSON.Feature[]>>>({});
  const activeFeaturesRef = useRef<GeoJSON.Feature[]>([]);
  const [, forceRender] = useState(0);

  // Load on resolution change (cached after first fetch)
  useEffect(() => {
    let cancelled = false;
    const cached = cacheRef.current[resolution];
    if (cached) {
      activeFeaturesRef.current = cached;
      reproject();
      return;
    }
    fetch(RESOLUTION_URLS[resolution])
      .then((r) => r.json() as Promise<GeoJSON.FeatureCollection>)
      .then((fc) => {
        if (cancelled) return;
        cacheRef.current[resolution] = fc.features;
        activeFeaturesRef.current = fc.features;
        forceRender((n) => n + 1);
        reproject();
      })
      .catch((err) => console.error(`[ChoroplethOverlay] load ${resolution} failed`, err));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolution]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = () => reproject();
    map.on('move', handler);
    map.on('moveend', handler);
    map.on('resize', handler);
    return () => {
      map.off('move', handler);
      map.off('moveend', handler);
      map.off('resize', handler);
    };
  }, [map]);

  function reproject() {
    const svg = svgRef.current;
    const features = activeFeaturesRef.current;
    if (!svg || features.length === 0) return;

    const transform = d3.geoTransform({
      point(this: { stream: d3.GeoStream }, lng: number, lat: number) {
        const p = map.project([lng, lat]);
        this.stream.point(p.x, p.y);
      },
    });
    const path = d3.geoPath().projection(transform);

    const sel = d3.select(svg).selectAll<SVGPathElement, GeoJSON.Feature>('path').data(features);
    sel
      .enter()
      .append('path')
      .merge(sel)
      .attr('d', (f) => path(f) ?? '')
      .attr('fill', (f) => (fillFor ? fillFor(f) : 'rgba(0, 163, 223, 0.18)'))
      .attr('stroke', 'rgba(0, 163, 223, 0.55)')
      .attr('stroke-width', 0.6)
      .attr('vector-effect', 'non-scaling-stroke');
    sel.exit().remove();
  }

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%' }}
      aria-hidden="true"
    />
  );
}
