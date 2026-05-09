# ESG 平台角色需求整理

以下內容可作為 Claude Code 調整 ESG / Energy Management Platform 介面與資訊架構的需求輸入。

## 角色與關注重點

### ESG Manager / 永續長

**核心需求**
- 需要查看各區域、各事業群的碳排 KPI。
- 需要掌握再生能源比例。
- 需要追蹤淨零路徑進度，例如 RE100、SBTi target。

**關注功能**
- 多層級碳排與能源 KPI。
- Region / BU 切換。
- Scenario 分析。
- 目標 vs 實際比較。
- ESG 報告匯出。

### Facility / Plant Manager

**核心需求**
- 在工廠或園區管理能耗與電費。
- 關注尖峰負載。
- 關注設備異常。
- 關注節能專案成效。

**關注功能**
- 即時能耗監控。
- 警報與異常通知。
- 節能專案前後對比圖。
- 排程與控制。

### Site Operator / Engineer

**核心需求**
- 主要盯設備狀態與告警。
- 例如某條產線耗電突然飆高。
- 例如空調異常或設備異常。

**關注功能**
- 設備清單。
- 告警列表。
- 工單。
- 操作建議。
- SOP 查閱。

### Admin / 顧問

**核心需求**
- 管理 tenant。
- 管理權限。
- 管理資料來源。
- 管理碳係數。
- 管理公式與 dashboard 配置。

**關注功能**
- RBAC 設定。
- 多租戶隔離。
- 整合第三方系統。
- 計算邊界管理。
- 係數管理。

請根據上述四種角色，調整平台的資訊架構、首頁 widget 組成、權限控制與預設視圖，並遵守以下原則：

- 同一個平台，共用 app shell。
- 依角色切換不同首頁內容與預設重點。
- 不要把角色判斷散落在各元件內，請採用 config-driven 設計。
- 角色至少包含 ESG Manager、Facility / Plant Manager、Site Operator / Engineer、Admin / Consultant。
- 請特別處理多租戶、RBAC、region / BU 切換、KPI 展示、警報、報表匯出與設定管理。
- 若適合，請重新整理 component tree、page layout、widgets config、types 與 mock data 結構。