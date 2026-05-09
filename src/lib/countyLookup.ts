/**
 * Lng/lat → Taiwan county lookup via bounding-box table.
 *
 * Edge cases (cities inside surrounding counties, narrow east-coast counties,
 * 離島) are handled by:
 *   1. Order CITIES first in the table so they win against the surrounding
 *      county when bboxes overlap (台北 inside 新北, 嘉義市 inside 嘉義縣,
 *      新竹市 inside 新竹縣).
 *   2. MANUAL_OVERRIDES by site code for known classifier failures.
 *
 * Bbox coordinates approximated from the official 內政部 county boundaries;
 * accurate enough for demo coloring (real product would use point-in-polygon
 * against the GeoJSON in public/taiwan-counties.geojson).
 */

interface CountyBbox {
  county: string;
  /** [lngMin, latMin, lngMax, latMax] */
  bbox: [number, number, number, number];
}

// Order matters: cities listed before surrounding counties.
const COUNTY_BBOXES: readonly CountyBbox[] = [
  // North — cities first
  { county: '基隆市', bbox: [121.66, 25.07, 121.83, 25.21] },
  { county: '台北市', bbox: [121.45, 24.96, 121.66, 25.21] },
  { county: '新竹市', bbox: [120.93, 24.78, 121.05, 24.89] },
  { county: '嘉義市', bbox: [120.42, 23.45, 120.50, 23.52] },
  // North — counties
  { county: '新北市', bbox: [121.30, 24.65, 122.05, 25.31] }, // surrounds 台北/基隆
  // GeoJSON 仍標 "桃園縣" (2010 data, 桃園 2014 升市)。為了 data join 用 GeoJSON 名稱。
  { county: '桃園縣', bbox: [121.00, 24.62, 121.50, 25.13] },
  { county: '新竹縣', bbox: [120.85, 24.42, 121.45, 24.83] },
  { county: '苗栗縣', bbox: [120.65, 24.30, 121.20, 24.74] },
  { county: '宜蘭縣', bbox: [121.30, 24.30, 122.05, 25.00] },
  // Central
  { county: '台中市', bbox: [120.40, 24.10, 121.45, 24.45] },
  { county: '彰化縣', bbox: [120.30, 23.92, 120.70, 24.20] },
  { county: '南投縣', bbox: [120.65, 23.50, 121.40, 24.20] },
  { county: '雲林縣', bbox: [120.10, 23.50, 120.65, 23.90] },
  // South
  { county: '嘉義縣', bbox: [120.10, 23.20, 120.85, 23.55] },
  { county: '台南市', bbox: [120.05, 22.90, 120.65, 23.45] },
  { county: '高雄市', bbox: [120.10, 22.45, 121.05, 23.30] },
  { county: '屏東縣', bbox: [120.40, 21.90, 120.95, 22.85] },
  // East
  { county: '花蓮縣', bbox: [121.00, 23.10, 121.85, 24.45] },
  { county: '台東縣', bbox: [120.70, 21.90, 121.65, 23.20] },
  // Outlying islands
  { county: '澎湖縣', bbox: [119.30, 23.20, 119.80, 23.85] },
  { county: '金門縣', bbox: [118.20, 24.40, 118.60, 24.60] },
  { county: '連江縣', bbox: [119.85, 26.10, 120.55, 26.40] },
];

/**
 * Override map for sites where bbox lookup is wrong or ambiguous.
 * Add as you discover demo-time misclassifications.
 *
 * Discovered against current seed (2026-05-09): bbox overlaps at
 * 台中/彰化 (lat 24.10-24.20), 新北/桃園 (lng 121.30-121.50),
 * 高雄/屏東 (lng 120.40-120.95), 桃園/新竹縣 (lat 24.62-24.83),
 * 苗栗/新竹縣 (lat 24.42-24.74) all need site-level override
 * because the regions interleave irregularly.
 */
export const MANUAL_COUNTY_OVERRIDES: Record<string, string> = {
  // Acme
  'ACM-04': '彰化縣', // 彰化彰濱工業區 — bbox overlaps 台中 lat
  'ACM-06': '屏東縣', // 屏東農業生物科技園區 — bbox overlaps 高雄 lng

  // Beta
  'BET-12': '桃園縣', // 桃園市中心商辦 — bbox overlaps 新北 lng

  // Gamma
  'GAM-03': '新竹縣', // 新竹科學園區 Fab 8 — bbox overlaps 桃園 lat
  'GAM-04': '新竹縣', // 新竹科學園區 Fab 2
  'GAM-05': '新竹縣', // 新竹科學園區封測廠
  'GAM-07': '苗栗縣', // 苗栗竹南科學園區 — bbox overlaps 新竹縣 lat
  'GAM-18': '桃園縣', // 桃園龜山華亞 — bbox overlaps 新北 lng
  'GAM-19': '屏東縣', // 屏東加工出口區 — bbox overlaps 高雄 lng
};

/**
 * Look up the Taiwan county for a (lng, lat) point. Returns null if outside
 * Taiwan's bounding region. Always check `MANUAL_COUNTY_OVERRIDES[siteCode]`
 * before this when a site code is available.
 */
export function lookupCounty(lng: number, lat: number): string | null {
  for (const { county, bbox } of COUNTY_BBOXES) {
    const [lngMin, latMin, lngMax, latMax] = bbox;
    if (lng >= lngMin && lng <= lngMax && lat >= latMin && lat <= latMax) {
      return county;
    }
  }
  return null;
}

/**
 * Resolve county for a site, preferring manual override over bbox lookup.
 */
export function resolveSiteCounty(
  siteCode: string,
  lng: number,
  lat: number,
): string | null {
  return MANUAL_COUNTY_OVERRIDES[siteCode] ?? lookupCounty(lng, lat);
}

export const TAIWAN_COUNTIES: readonly string[] = COUNTY_BBOXES.map((b) => b.county);
