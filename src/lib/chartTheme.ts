/**
 * Shared chart styling tokens so Highcharts / ECharts tooltips and axes
 * line up visually with the dashboard's dark theme. Keeps every chart
 * widget on the same `#111a2e` tooltip body, `#243049` border,
 * Inter+Noto Sans TC text, 11px size, 6px radius.
 */

export const CHART_COLORS = {
  bg: '#111a2e',
  border: '#243049',
  borderSoft: '#1b2540',
  fg: '#e6edf7',
  fgMuted: '#93a3bf',
  fgSubtle: '#5e6e8a',
  accent: '#00a3df',
  warn: '#fbbf24',
  success: '#34d399',
  danger: '#f87171',
} as const;

export const CHART_FONT = 'Inter, "Noto Sans TC", sans-serif';

export const HIGHCHARTS_TOOLTIP = {
  backgroundColor: CHART_COLORS.bg,
  borderColor: CHART_COLORS.border,
  borderRadius: 6,
  borderWidth: 1,
  shadow: false,
  style: { color: CHART_COLORS.fg, fontSize: '11px', fontFamily: CHART_FONT },
  useHTML: false,
} as const;

export const ECHARTS_TOOLTIP_BASE = {
  backgroundColor: CHART_COLORS.bg,
  borderColor: CHART_COLORS.border,
  borderWidth: 1,
  textStyle: { color: CHART_COLORS.fg, fontSize: 11, fontFamily: CHART_FONT },
  extraCssText: 'border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.4);',
} as const;
