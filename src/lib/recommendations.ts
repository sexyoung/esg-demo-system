import type { FlowsResponse, KpiSnapshot } from '../api/dashboard';

export interface Recommendation {
  id: string;
  title: string;
  detail: string;
  impact: string;
  rule: string;
  confidence: 'high' | 'medium' | 'low';
}

interface Inputs {
  slug: string;
  kpi: KpiSnapshot | undefined;
  flows: FlowsResponse | undefined;
}

export function evaluateRules({ slug, kpi, flows }: Inputs): Recommendation[] {
  if (!kpi) return [];
  const out: Recommendation[] = [];

  if (slug === 'acme') {
    pushAcmePvSizing(out, kpi);
    pushAcmeEssWindow(out, kpi, flows);
    pushAcmeTariffSwitch(out, kpi);
  } else if (slug === 'beta') {
    pushBetaRe100Roof(out, kpi);
    pushBetaEuiCluster(out, kpi);
  } else if (slug === 'gamma') {
    pushGammaPeakShave(out, kpi);
    pushGammaOeeFloor(out, kpi);
  }

  return out.slice(0, 3);
}

function pushAcmePvSizing(out: Recommendation[], kpi: KpiSnapshot) {
  if (kpi.energyConsumedKwh <= 0) return;
  const re = kpi.renewableRatio;
  if (re < 0.15) {
    const targetRe = 0.12;
    const additionalPvMw = 0.7;
    const additionalCo2Tons = Math.round((kpi.energyConsumedKwh * (targetRe - re) * 0.474) / 1000 * 365);
    out.push({
      id: 'acme_pv_sizing',
      title: '擴增 PV 0.7 MW 可將 RE 比拉到 12%',
      detail: `目前再生能源占比僅 ${(re * 100).toFixed(1)}%（PV 0.8 MW vs 廠房 ~2 MW 負載）。在 ACM-01 屋頂與廠區頂棚再加裝 ${additionalPvMw} MW PV，可將 24h RE 比提升至約 ${(targetRe * 100).toFixed(0)}%。`,
      impact: `預估年減 ~${additionalCo2Tons.toLocaleString()} tCO₂e、capex ${(additionalPvMw * 1000 * 30).toLocaleString()} kNT$`,
      rule: 'low_re_ratio_with_capacity_headroom',
      confidence: 'high',
    });
  }
}

function pushAcmeEssWindow(out: Recommendation[], kpi: KpiSnapshot, flows: FlowsResponse | undefined) {
  if (!flows) return;
  const essToLoad = flows.flows.find((f) => f.source === 'ESS' && f.target === 'Load')?.value ?? 0;
  const essCapacityKwh = 2000;
  const utilization = essToLoad / essCapacityKwh;
  if (utilization < 0.5) {
    const monthlySaving = Math.round(((kpi.energyGridBuyKwh * 0.05) * (9.39 - 2.53)) * 30);
    out.push({
      id: 'acme_ess_window',
      title: 'ESS 利用率僅 ' + (utilization * 100).toFixed(0) + '%，可延長削峰時段',
      detail: `當前 ESS 24h 放電 ${Math.round(essToLoad)} kWh、未達容量 ${essCapacityKwh} kWh 的 50%。建議將離峰充電窗口從 4 hr 延長至 6 hr，並把削峰啟動門檻從 1500 kW 降至 1300 kW。`,
      impact: `預估月省 ~NT$ ${monthlySaving.toLocaleString()}（夏月尖離峰價差 6.86 NT$/kWh）`,
      rule: 'ess_underutilized',
      confidence: 'medium',
    });
  }
}

function pushAcmeTariffSwitch(out: Recommendation[], kpi: KpiSnapshot) {
  if (kpi.energyGridBuyKwh <= 0) return;
  const avgTariff = kpi.costNtd / kpi.energyGridBuyKwh;
  if (avgTariff > 4.5) {
    const annualSaving = Math.round(((avgTariff - 4.0) * kpi.energyGridBuyKwh) * 365);
    out.push({
      id: 'acme_tariff_review',
      title: `平均購電單價 ${avgTariff.toFixed(2)} NT$/kWh，可重新評估方案`,
      detail: `當前用電型態白天比例偏高、買電平均單價 ${avgTariff.toFixed(2)} NT$/kWh。若搭配 ESS 將更多負載往離峰時段移轉、或評估「契約容量 + 二段式」混合，可望降至 ~4.0 NT$/kWh。`,
      impact: `預估年省 ~NT$ ${annualSaving.toLocaleString()}`,
      rule: 'tariff_arbitrage',
      confidence: 'low',
    });
  }
}

function pushBetaRe100Roof(out: Recommendation[], kpi: KpiSnapshot) {
  if (kpi.energyFromPvKwh > 0) return;
  out.push({
    id: 'beta_re100_roof',
    title: 'RE100 起步：BET-05 / BET-08 屋頂可裝 350 kW PV',
    detail: `Beta 旗下 22 棟商辦目前 0% 再生能源。南港軟體園區（BET-05）與內湖瑞光（BET-08）兩棟屋頂面積足夠裝設總計 ~350 kW PV，配合 ToU 用電型態自發自用率可達 ~30%。`,
    impact: `預估首年省 NT$ 1.4M、年減 ~190 tCO₂e；capex ~NT$ 10.5M`,
    rule: 'commercial_re100_roof_potential',
    confidence: 'medium',
  });
}

function pushBetaEuiCluster(out: Recommendation[], kpi: KpiSnapshot) {
  if (kpi.energyConsumedKwh <= 0) return;
  out.push({
    id: 'beta_eui_outlier',
    title: '台中七期 BET-14 EUI 顯著高於群組平均',
    detail: `BET-14 台中七期世貿大樓單位面積能耗（0.85 kWh/m²/day）較 22 棟商辦中位數高出約 55%，主要差距發生在週末空調運作。建議將週末空調預冷邏輯改為 on-demand 並重新校正設定點。`,
    impact: `預估月省 NT$ 65,000、年減 ~22 tCO₂e`,
    rule: 'eui_outlier_zscore',
    confidence: 'high',
  });
}

function pushGammaPeakShave(out: Recommendation[], kpi: KpiSnapshot) {
  if (kpi.peakLoadKw <= 0) return;
  const annualSaving = Math.round(kpi.peakLoadKw * 0.05 * 12 * 223.6);
  out.push({
    id: 'gamma_peak_shave',
    title: `尖峰負載 ${Math.round(kpi.peakLoadKw / 1000 * 10) / 10} MW，可降契約容量`,
    detail: `近 24h 最高瞬時負載 ${Math.round(kpi.peakLoadKw).toLocaleString()} kW。若搭配 0.5 MWh 廠級 ESS 削峰 5%，可降契約容量約 ${Math.round(kpi.peakLoadKw * 0.05).toLocaleString()} kW。`,
    impact: `預估年省契約容量電費 ~NT$ ${annualSaving.toLocaleString()}`,
    rule: 'demand_charge_reduction',
    confidence: 'medium',
  });
}

function pushGammaOeeFloor(out: Recommendation[], _kpi: KpiSnapshot) {
  out.push({
    id: 'gamma_oee_kwh_per_wafer',
    title: '加入 kWh/wafer 單位耗能 KPI 追蹤',
    detail: `目前 dashboard 顯示總用電與 OEE 為兩條獨立指標。建議將兩者合併為「kWh/wafer」單位耗能 KPI，便於跨設施比較與製程改善優先序。`,
    impact: `Day 4 simulator 已可預先試算單位耗能在 PV+ESS 介入後的下降幅度`,
    rule: 'kpi_metric_design',
    confidence: 'low',
  });
}
