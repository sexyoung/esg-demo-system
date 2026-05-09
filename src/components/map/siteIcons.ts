import type maplibregl from 'maplibre-gl';

/**
 * Industry SVG icons for site markers. Paths transcribed from lucide-react
 * (SunMedium / Building2 / Cpu). 24×24 viewBox, stroke-only, currentColor.
 */
const SVG_SUN_MEDIUM = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="4"/>
  <path d="M12 3v1"/><path d="M12 20v1"/>
  <path d="M3 12h1"/><path d="M20 12h1"/>
  <path d="m18.364 5.636-.707.707"/><path d="m6.343 17.657-.707.707"/>
  <path d="m5.636 5.636.707.707"/><path d="m17.657 17.657.707.707"/>
</svg>`;

const SVG_BUILDING_2 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
  <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
  <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
  <path d="M10 6h4"/><path d="M10 10h4"/>
  <path d="M10 14h4"/><path d="M10 18h4"/>
</svg>`;

const SVG_CPU = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect width="16" height="16" x="4" y="4" rx="2"/>
  <rect width="6" height="6" x="9" y="9" rx="1"/>
  <path d="M15 2v2"/><path d="M15 20v2"/>
  <path d="M2 15h2"/><path d="M2 9h2"/>
  <path d="M20 15h2"/><path d="M20 9h2"/>
  <path d="M9 2v2"/><path d="M9 20v2"/>
</svg>`;

/** Tenant icon design: name → SVG + color. Color is the icon's stroke color
 *  (replaces `currentColor`); tenant identity returns via icon shape AND color. */
export const TENANT_ICONS = {
  acme: { id: 'site-icon-acme', svg: SVG_SUN_MEDIUM, color: '#fbbf24', label: '微電網 / PV' },
  beta: { id: 'site-icon-beta', svg: SVG_BUILDING_2, color: '#00a3df', label: '商辦' },
  gamma: { id: 'site-icon-gamma', svg: SVG_CPU, color: '#a78bfa', label: '半導體 fab' },
} as const;

/** Render an SVG string as a canvas-rasterized PNG Image at given pixel size
 *  with stroke colored. Uses canvas because MapLibre's addImage uses the
 *  intrinsic image size — SVGs with only viewBox have intrinsic 0×0. */
function svgToImage(svg: string, color: string, size: number): Promise<HTMLImageElement> {
  const colored = svg.replace(/currentColor/g, color);
  const dataUri = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(colored)));

  return new Promise((resolve, reject) => {
    const svgImg = new Image();
    svgImg.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('canvas 2d context unavailable'));
        return;
      }
      ctx.drawImage(svgImg, 0, 0, size, size);

      const pngImg = new Image();
      pngImg.onload = () => resolve(pngImg);
      pngImg.onerror = (e) => reject(e);
      pngImg.src = canvas.toDataURL('image/png');
    };
    svgImg.onerror = (e) => reject(e);
    svgImg.src = dataUri;
  });
}

/**
 * Register all 3 tenant icons on the map. Idempotent — safe to call multiple
 * times; existing images are skipped via `hasImage`.
 */
export async function registerSiteIcons(map: maplibregl.Map, size = 36): Promise<void> {
  await Promise.all(
    Object.values(TENANT_ICONS).map(async (icon) => {
      if (map.hasImage(icon.id)) return;
      try {
        const img = await svgToImage(icon.svg, icon.color, size);
        if (!map.hasImage(icon.id)) map.addImage(icon.id, img);
      } catch (err) {
        console.error(`[siteIcons] failed to load ${icon.id}`, err);
      }
    }),
  );
}
