# ESG Demo System

Vite + React TS + Tailwind CSS + Hono.js + Prisma + Redis 的空白全端專案骨架。

## 技術組成

- Frontend: Vite, React, TypeScript, Tailwind CSS
- Backend: Hono.js on Node.js
- Database: Prisma with PostgreSQL for local development
- Cache: Redis

## 快速開始

```bash
npm install
cp .env.example .env
docker compose up -d postgres redis
npm run db:generate
npm run db:push
npm run db:seed
npm run dev:api
npm run dev
```

前端預設為 `http://localhost:5173`，API 預設為 `http://localhost:8787`。

## API

- `GET /api/health`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/cache/:key`

## 專案結構

```text
src/              React 前端
server/           Hono API 與 Prisma/Redis client
prisma/           Prisma schema 與 seed data
docker-compose.yml PostgreSQL 與 Redis local services
```
