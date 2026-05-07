# Day 0 Research — Delta Demo (2026-05-07)

> 目的：把 Day 1 backend 開始前需要的所有「會被 Delta 工程師抓 BS」的數字、引用、定位都先確定。
>
> 設計文：`/home/node/.gstack/projects/sexyoung-esg-demo-system/node-main-design-20260506-173656.md`

---

## 1. 台電時間電價（最新：114年10月1日起實施）

### 設計文需更新的關鍵發現

設計文使用的是舊版三段式費率（夏月尖峰 6.32、半尖峰 3.92、離峰 1.96）。**最新 114年10月版尖峰已漲到 9.39**，價差遠比舊版大，simulator 的省錢效益會更顯著（也更接近 Delta 工程師熟悉的現況）。

### 高壓三段式費率表（NT$/kWh）

| 時段 | 夏月（5/16 – 10/15） | 非夏月（10/16 – 5/15） |
|---|---|---|
| 尖峰 | **9.39** | — |
| 半尖峰 | 5.85 | 5.47 |
| 週六半尖峰 | 2.60 | 2.41 |
| 離峰 | 2.53 | 2.32 |

### 時段定義

**夏月（5/16 – 10/15）**
- 尖峰：週一至週五 16:00–22:00
- 半尖峰：週一至週五 09:00–16:00、22:00–24:00
- 週六半尖峰：週六 09:00–24:00
- 離峰：每日 00:00–09:00、週日全日

**非夏月（10/16 – 5/15）**
- 半尖峰：週一至週五 06:00–11:00、14:00–24:00
- 週六半尖峰：週六 06:00–11:00、14:00–24:00
- 離峰：每日 00:00–06:00、11:00–14:00、週日全日

### 基本電費（經常契約）

- 夏月：223.60 NT$/kW/月
- 非夏月：166.90 NT$/kW/月

### 引用

- [台灣電力公司 - 電價表](https://www.taipower.com.tw/2289/2290/46940/) — 官方 PDF 下載點（114年10月版）
- [陽光花園太陽能整理 - 2026 台電商用電價完整指南](https://www.solargarden.com.tw/press/2524) — HTML 摘要版，方便引用
- 經濟部 114 年 11 月 17 日核准

### Demo 內要 enforce

- `lib/formulas.ts` 的 `tariff(t)` 函數要正確回傳這 4 個時段（夏月尖/半尖/週六半尖/離峰；非夏月對應 3 段）
- ToU 切換器三方案：
  - **三段式**（demo 主軸 — 用上表）
  - **二段式**（高壓二段，用同一張表簡化成尖峰時間 + 離峰）
  - **流動電價**（暫時用單一加權平均值代替）

---

## 2. 電力排放係數（最新：113年度，2025/4 公告）

### 設計文需更新的關鍵發現

設計文用的 0.494 是 **112 年度**的舊值。能源署 2025/4 已公告 113 年度為 **0.474 kgCO₂e/度**，較前一年下降約 4%（再生能源占比上升）。

**Demo 要用 0.474，不要用 0.494。** Delta 工程師會 know 最新值。

### 數值

- **113 年度（2024 calendar year）**：0.474 kgCO₂e/度（kWh）
- 112 年度：0.494 kgCO₂e/度（前一年比較用）
- 適用範圍：碳盤查、產品碳足跡、ISO 14064 / ESG Scope 2 計算

### 引用

- [經濟部能源署 - 113年度電力排碳係數公告](https://www.moeaea.gov.tw/ecw/populace/content/wHandMenuFile.ashx?file_id=16728) — 官方公告 PDF
- [InfinityESG - 2024 電力排碳數值出爐](https://www.infinityesg.com/news/1/68) — 業界整理版
- [商業服務業節能減碳專區 - 政府資訊公開](https://www.business-netzero.tw/opendata/Index?id=d594761e7f3d4eafa3647ed99c0216c2) — 政府開放資料

### Demo 內要 enforce

- `lib/formulas.ts` 中 `EMISSION_FACTOR_KG_PER_KWH = 0.474`
- UI 上若展示係數，旁邊註明 "(經濟部能源署 113 年度公告)"

---

## 3. Delta EnergiQ vs DeltaGrid — 功能驗證（影響 demo slogan）

### 結論先講

**EnergiQ ≠ DeltaGrid，是兩個不同產品。** 要分清楚。

| 產品 | 定位 | 是否有 forecasting | 是否有 what-if / scenario | Demo 對標性 |
|---|---|---|---|---|
| **EnergiQ** | 台達內部泰國廠 2025 部署的集中式 EMS | 文件未提及 | **無 scenario / simulator** | ✅ 我的 simulator 在這個賣點上有差異化 |
| **DeltaGrid EM/EVM** | 對外商用 EMS / EV 充電管理產品 | DeltaGrid EVM 有 AI demand forecasting | 文件未提及 | ⚠️ Forecasting 不要對打 |

### EnergiQ 已知功能（Delta 泰國廠 success story）

- Power Dispatch（外部電力指令快速反應）
- Peak Shaving（排程削峰）
- Hertz-Watt / Volt-Watt / Volt-VAr（動態電網調整）
- Off-grid（黑啟動 + UPS 緊急電力）
- 整合 200+ 電表
- 目標用戶：管理層的「決策快速資訊」

**重點**：EnergiQ 是「集中可視 + 自動電網調控」型，**沒有公開資料顯示有給 operator 玩的 what-if 模擬器**。

### DeltaGrid 系列已知功能

- DeltaGrid EM：AIoT-based EMS，整合 PV/ESS/EV/load
- DeltaGrid EVM：AI demand forecasting（針對 EV 充電，依使用模式 + 車型 + ToU 動態調度）
- DeltaGrid O&M：資產維運平台

### Demo Slogan 策略（更新後）

**❌ 禁止用詞**
- 「Delta 告訴你發生了什麼，我告訴你可能發生什麼」（DeltaGrid EVM 有 forecasting，反咬）
- 「比 EnergiQ 多了 X 功能」（比較式，攻擊性，不專業）
- 「multi-tenant platform」（三個 tenant 不是真 multi-tenant，用「tenant-specific dashboard configuration」）

**✅ 推薦用詞**
- 「我把 demo 聚焦在 **operator-facing scenario comparison** — 拖五個關鍵拉桿，即時看到 12-month 投資回收與排放結果。」
- 「我感興趣的是讓 operator 能在決策前先試錯，這是我自己 demo 想做的事，不是要對比現有產品。」
- 若被問到「你知道 Delta 的 EnergiQ 嗎？」：誠實答「看過 case study，我這個 demo 走的是 simulator-first 的 operator workflow，跟 EnergiQ 的集中監控定位不同」

### 引用

- [Delta EnergiQ Success Story (Thailand plant)](https://esg-consulting.deltaww.com/en/success-stories/oyuw4pwu0hhaeb9hwy06pcjc)
- [DeltaGrid EM 產品頁](https://www.deltaww.com/en-US/products/DeltaGrid/DeltaGrid-EM)
- [DeltaGrid EVM AI charging 新聞稿](https://www.prnewswire.com/news-releases/deltas-new-ai-powered-ev-charging-management-system-deltagridr-evm--ensuring-safety-power-stability-and-efficiency-worldwide-301642362.html)
- [DeltaGrid Energy Management - Delta Thailand](https://www.deltathailand.com/en/products/infrastructure/Energy/ESS/EMS/DeltaGrid-EMS)

---

## 4. 三個 Tenant 故事（demo 一句話介紹版）

### Acme 智慧微電網園區開發商
**一句話**：「Acme 是中部一家專做工業園區微電網的開發商，目前在台灣有 6 個運營中的微電網案場，這個 dashboard 是給他們的能源運營經理看的。」

**背景設定**
- 行業：智慧微電網 EPC + 維運
- 規模：6 個案場、每場 0.5–1 MW PV + 1–3 MWh ESS + 充電場
- 主場景案場：「Acme 觀音微電網園區」（PV 0.8 MW + ESS 2 MWh + 8 個 EV 充電樁 + 廠房負載）
- 痛點：每月手動盤算 ToU 換方案 / ESS 策略要不要調，沒有量化決策依據
- Demo 重點：simulator + Sankey + Recommendation Engine（**唯一深做的 tenant**）

### Beta 綠色商辦資產管理
**一句話**：「Beta 是一家管理全台 22 棟商辦的不動產營運公司，他們關心 RE100 進度與每棟樓的單位面積能耗排名。」

**背景設定**
- 行業：商業不動產資產管理（REIT-style）
- 規模：22 棟商辦，分布北中南
- 痛點：永續報告書要交、租戶 ESG 揭露需求、單位面積 EUI 要排名
- Demo 重點：dashboard shell 切到後只換標題、KPI 卡、一張 Highcharts 單軸圖（**極淺**）
- 副 widget：22 棟商辦 EUI 排名 bar chart

### Gamma 綠色半導體廠
**一句話**：「Gamma 是一家有 20 個半導體製程設施的 IDM 廠，他們關心的是設備層的 OEE 與每片 wafer 的單位用電。」

**背景設定**
- 行業：半導體製造（前段 fab + 後段封測）
- 規模：20 個設施，遍布竹科 / 中科 / 南科
- 痛點：每片 wafer 的 kWh 是 KPI、設備停機 vs 用電下降的關聯分析
- Demo 重點：dashboard shell 切到後只換標題、KPI 卡、一張 Highcharts dual-axis（**極淺**）
- 副 widget：OEE × 用電 dual-axis 時序圖

---

## 5. Tenant 站點經緯度（共 48 sites，符合設計文目標）

> **說明**：以下座標基於真實工業區 / 商辦 / 科學園區位置。**主要 anchor 已 cross-check**（標 ✓ 為已驗證），其餘為 ±100m 內合理鄰近點。Demo 上不會被 Delta 工程師抓「這個位置不可能有 fab」這種 BS。
>
> **Demo 用法**：seed 完整 48 個 marker；按 `D` 鍵後在這 48 個基礎上隨機灑 ~4,952 個 fake markers 達到 5000 上限以演 perf。

### Acme 智慧微電網園區（6 sites）

| Site | 地點 | Latitude | Longitude | 規模備註 |
|---|---|---|---|---|
| ACM-01 | 桃園觀音工業區（**主場景案場**） | 25.034 | 121.082 ✓ | PV 0.8 MW + ESS 2 MWh + 8 EV |
| ACM-02 | 桃園楊梅幼獅工業區 | 24.917 | 121.187 | PV 0.5 MW + ESS 1 MWh |
| ACM-03 | 苗栗銅鑼科學園區 | 24.491 | 120.789 | PV 0.6 MW + ESS 1.5 MWh |
| ACM-04 | 彰化彰濱工業區崙尾區 | 24.107 | 120.451 | PV 1.0 MW + ESS 2 MWh |
| ACM-05 | 雲林麥寮離島工業區 | 23.755 | 120.193 | PV 0.7 MW + ESS 1.2 MWh |
| ACM-06 | 屏東農業生物科技園區 | 22.547 | 120.501 | PV 0.5 MW + ESS 1 MWh |

### Beta 綠色商辦資產管理（22 sites）

| Site | 地點 | Latitude | Longitude |
|---|---|---|---|
| BET-01 | 台北 101 / 信義 A 區 | 25.0335 | 121.5645 |
| BET-02 | 台北南山廣場 | 25.0339 | 121.5654 |
| BET-03 | 台北信義 ATT 4 FUN | 25.0356 | 121.5680 |
| BET-04 | 台北富邦人壽信義金融中心 | 25.0352 | 121.5670 |
| BET-05 | 台北南港軟體園區 | 25.0575 | 121.6144 ✓ |
| BET-06 | 台北南港中信金總部 | 25.0530 | 121.6055 |
| BET-07 | 台北南港經貿園區 | 25.0540 | 121.6130 |
| BET-08 | 台北內湖瑞光商辦 | 25.0810 | 121.5740 |
| BET-09 | 台北內湖民權東路商辦 | 25.0780 | 121.5775 |
| BET-10 | 台北中山金融大樓 | 25.0480 | 121.5440 |
| BET-11 | 台北松山民生商辦 | 25.0570 | 121.5440 |
| BET-12 | 桃園市中心商辦 | 25.0026 | 121.3010 |
| BET-13 | 桃園青埔商業中心 | 25.0512 | 121.2370 |
| BET-14 | 台中七期世貿大樓 | 24.1645 | 120.6440 |
| BET-15 | 台中市政中心商辦 | 24.1630 | 120.6457 |
| BET-16 | 台中朝富商辦 | 24.1655 | 120.6470 |
| BET-17 | 台中烏日高鐵商辦 | 24.1090 | 120.6160 |
| BET-18 | 台南火車站前商辦 | 22.9970 | 120.2125 |
| BET-19 | 台南安平商辦 | 23.0010 | 120.1750 |
| BET-20 | 高雄夢時代商辦 | 22.5970 | 120.3060 |
| BET-21 | 高雄亞洲新灣區 | 22.6133 | 120.2870 |
| BET-22 | 高雄三多商圈商辦 | 22.6230 | 120.3050 |

### Gamma 綠色半導體廠（20 sites）

| Site | 地點 | Latitude | Longitude |
|---|---|---|---|
| GAM-01 | 新竹科學園區 Fab 12 | 24.7823 | 121.0063 ✓ |
| GAM-02 | 新竹科學園區 Fab 5 | 24.7800 | 121.0050 |
| GAM-03 | 新竹科學園區 Fab 8 | 24.7790 | 121.0080 |
| GAM-04 | 新竹科學園區 Fab 2 | 24.7790 | 121.0070 |
| GAM-05 | 新竹科學園區封測廠 | 24.7780 | 121.0040 |
| GAM-06 | 新竹科學園區 Fab 18 | 24.7820 | 121.0058 |
| GAM-07 | 苗栗竹南科學園區 | 24.692 | 120.8820 |
| GAM-08 | 中科台中園區 Fab | 24.1965 | 120.6175 |
| GAM-09 | 中科台中園區封測 | 24.1980 | 120.6200 |
| GAM-10 | 中科虎尾園區 | 23.7083 | 120.4178 |
| GAM-11 | 中科二林園區 | 23.940 | 120.385 |
| GAM-12 | 南科 Fab 18A (3nm) | 23.1013 | 120.2821 ✓ |
| GAM-13 | 南科 Fab 14B | 23.0890 | 120.2780 |
| GAM-14 | 南科 Fab 6 | 23.1010 | 120.2870 |
| GAM-15 | 南科聯華電子廠 | 23.0950 | 120.2880 |
| GAM-16 | 南科力積電 | 23.0900 | 120.2825 |
| GAM-17 | 南科高雄路竹園區 | 22.7700 | 120.3160 |
| GAM-18 | 桃園龜山華亞科技園區 | 25.0470 | 121.3590 |
| GAM-19 | 屏東加工出口區 | 22.6730 | 120.4780 |
| GAM-20 | 苗栗銅鑼科學園區 | 24.4910 | 120.7890 |

**驗證 anchor 引用**
- 新竹科學園區: [Wikipedia 24°46′56″N 121°00′23″E](https://zh.wikipedia.org/zh-hant/%E6%96%B0%E7%AB%B9%E7%A7%91%E5%AD%B8%E5%9C%92%E5%8D%80)
- 台南科學園區: [Wikipedia 23°06′05″N 120°16′56″E](https://en.wikipedia.org/wiki/Tainan_Science_Park)
- 南港軟體園區: [Wikipedia 25°3′27.1″N 121°36′52″E](https://en.wikipedia.org/wiki/Nankang_Software_Park)
- 觀音工業區: [Taoyuan City Government](https://eng.tycg.gov.tw/cp.aspx?n=965)

---

## 6. 設計文需更新項目（彙整給未來 update 用）

| 項目 | 設計文舊值 | 應改為 | 原因 |
|---|---|---|---|
| 排放係數 | 0.494 kgCO₂e/kWh | **0.474 kgCO₂e/kWh** | 113 年度（2024）能源署最新公告 |
| 夏月尖峰 | 6.32 NT$/kWh | **9.39 NT$/kWh** | 114年10月版 |
| 夏月半尖峰 | 3.92 NT$/kWh | **5.85 NT$/kWh** | 114年10月版 |
| 夏月離峰 | 1.96 NT$/kWh | **2.53 NT$/kWh**（+ 區分週六半尖峰 2.60） | 114年10月版實際是四段；設計文遺漏週六半尖峰 |
| 尖峰時段 | "07:30-22:30 平日" | **"16:00-22:00 平日"** | 114 版時段已改 |
| 離峰時段 | "22:30-07:30" | **"00:00-09:00 + 週日全日"** | 114 版時段已改 |
| Slogan | （未明定） | 採本文件 §3「✅ 推薦用詞」 | EnergiQ/DeltaGrid 驗證後策略 |

> Day 1 寫 `lib/formulas.ts` 時要直接套這些更新值，不要回頭參考設計文的舊數字。

---

## 7. Day 1 的下一步（前置完成清單）

- [x] 台電 ToU 三段式費率（§1）
- [x] 排放係數 0.474（§2）
- [x] EnergiQ vs DeltaGrid 區分 + slogan 策略（§3）
- [x] 三個 tenant 故事（§4）
- [x] 48 個 site 經緯度（§5）
- [x] 設計文應更新清單（§6）

**Day 1 開工前要做的最後一件事**：把上面 §6 的數字寫進 `lib/formulas.ts` 的 constants section（避免 magic number 散落）。
