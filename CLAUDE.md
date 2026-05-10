## gstack（必要 — 全域安裝）

**進行任何工作前，先確認 gstack 已安裝：**

```bash
test -d ~/.claude/skills/gstack/bin && echo "GSTACK_OK" || echo "GSTACK_MISSING"
```

如果顯示 GSTACK_MISSING：停止，不要繼續。告訴使用者：

> 這個 repo 所有 AI 協作工作都需要 gstack。
> 安裝：
> ```bash
> git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
> cd ~/.claude/skills/gstack && ./setup --team
> ```
> 然後重啟你的 AI coding 工具。

不要跳過 skill、忽略 gstack 錯誤，或繞過缺少 gstack 的狀況。

使用 gstack skill：安裝完成後可用 /qa、/ship、/review、/investigate、/browse 等 skill。所有網頁瀏覽請用 /browse。
gstack 檔案路徑請用 ~/.claude/skills/gstack/...（全域路徑）。

## 部署設定（由 /setup-deploy 產生）
- 平台：Vercel（Hono 透過 `hono/vercel` adapter，runtime: nodejs）
- 資料庫：Supabase（Postgres）— runtime 用 pooler、migration 用 direct
- 生產 URL：TBD — `vercel link` 後填入（例：`https://esg-demo-system.vercel.app`）
- 部署 workflow：`.github/workflows/deploy.yml`（只在 push 到 `main` 時觸發）
- 部署觸發方式：由 GitHub Actions 跑 `vercel deploy --prebuilt --prod`。Vercel 的 git push 自動部署**刻意關掉**——把專案的 "Connected Git Repository" 設為斷開，或保持連接但只允許 CLI 部署。
- 部署狀態指令：`vercel ls --prod`（CLI 安裝後可用）
- 部署後健康檢查：`https://<prod-url>/api/health`（回傳 DB + Redis 狀態）
- Merge 方式：squash（預設）
- 專案類型：web app（Vite SPA + Hono API on Vercel Functions）

### 客製部署 hooks
- Pre-merge：無（CI 全包）
- CI gates（全部通過才會跑 deploy 步驟）：
  1. `npx prisma generate`
  2. `npx prisma db push --skip-generate`（針對 CI Postgres service）
  3. `npm run check`（tsc -b --noEmit）
  4. `npm test`（vitest）
  5. `npm run build`（vite build 冒煙檢查）
- Deploy 步驟：`vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod`
- 健康檢查：部署後跑 `curl -fsS https://<prod-url>/api/health`

## 首次部署設定（一次性、手動）

### 1. 建立 Supabase 專案
1. 開 https://supabase.com/dashboard → 點 "New project"
2. 選一個離 Vercel region 近的地區（或離使用者近的）
3. 把 database password 存好——Supabase 只會顯示一次
4. 專案建好後，到 **Project Settings → Database → Connection string**：
   - **Connection pooling**（Transaction 模式、port `6543`）→ 這是 `DATABASE_URL`。URL 後面加上 `?pgbouncer=true&connection_limit=1`。
   - **Direct connection**（port `5432`）→ 這是 `DIRECT_URL`。給 `prisma migrate` / `prisma db push` 用。
5. 從本地把 schema 推上去：`DATABASE_URL="<direct-url>" npx prisma db push`（第一次 bootstrap 用 direct URL）
6. （可選）Seed：`DATABASE_URL="<direct-url>" npm run db:seed`

### 2. 建立 Vercel 專案
1. `npm install -g vercel`
2. 在 repo 根目錄：`vercel link` → 選 team 跟 project 名稱（會產生 `.vercel/project.json`）
3. `vercel env add DATABASE_URL production` → 貼上 **pooler** URL
4. `vercel env add DIRECT_URL production` → 貼上 **direct** URL
5. `vercel deploy --prod` — 第一次手動部，確認整體跑得起來
6. 把生產 URL 填回上面的 "生產 URL" 欄位

### 3. 關掉 Vercel 的 git push 自動部署
部署都由 GitHub Actions 驅動，為了避免 Vercel 自己也跑一次。
**已在 `vercel.json` 設定：** `git.deploymentEnabled.main = false`。
這個設定要 commit + push 到 main 後，Vercel 才會讀到並停用 auto-deploy。
（如果想在 dashboard 也手動確認：Project → Settings → **Git** → "Production Branch" 自動部署關掉。）

### 4. 設 GitHub Actions secrets
GitHub repo → Settings → Secrets and variables → Actions → New repository secret：

| Secret | 從哪裡拿 |
|---|---|
| `VERCEL_TOKEN` | https://vercel.com/account/tokens → "Create Token" |
| `VERCEL_ORG_ID` | `cat .vercel/project.json` → `orgId` |
| `VERCEL_PROJECT_ID` | `cat .vercel/project.json` → `projectId` |

`DATABASE_URL` 跟 `DIRECT_URL` 設在 **Vercel** env（不是 GitHub）—— `vercel pull` 會把它們帶進 build 階段。

### 5. 驗證
推一個小改動到 `main`，觀察：
- GitHub Actions 頁籤 → workflow 跑綠
- Vercel dashboard → 出現新的 deployment
- `curl https://<prod-url>/api/health` 回 200，且 `database: connected`

## 日常部署流程（設定完成後）
1. 開 PR、merge 到 `main`（squash）
2. GitHub Actions 跑：type check → vitest → build → vercel deploy
3. Production 自動更新
4. 要 rollback：`vercel rollback`，或在 Vercel dashboard 點選舊版本
