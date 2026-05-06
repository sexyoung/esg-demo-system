import { Activity, Database, Leaf, RefreshCw, Server, Wifi } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type HealthResponse = {
  status: string;
  service: string;
  database: string;
  redis: string;
  timestamp: string;
};

type Project = {
  id: string;
  name: string;
  owner: string;
  status: 'PLANNING' | 'ACTIVE' | 'ARCHIVED';
  carbonTons: number;
  createdAt: string;
};

type CacheResponse = {
  key: string;
  value: string | null;
  source: 'redis' | 'fallback';
};

const statusLabel: Record<Project['status'], string> = {
  PLANNING: '規劃中',
  ACTIVE: '執行中',
  ARCHIVED: '已封存',
};

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [cache, setCache] = useState<CacheResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    return {
      active: projects.filter((project) => project.status === 'ACTIVE').length,
      carbon: projects.reduce((sum, project) => sum + project.carbonTons, 0),
    };
  }, [projects]);

  async function loadDashboard() {
    setLoading(true);
    setError(null);

    try {
      const [healthResponse, projectsResponse, cacheResponse] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/projects'),
        fetch('/api/cache/demo-message'),
      ]);

      if (!healthResponse.ok || !projectsResponse.ok || !cacheResponse.ok) {
        throw new Error('API 回應失敗，請確認 Hono server 是否已啟動。');
      }

      setHealth(await healthResponse.json());
      setProjects(await projectsResponse.json());
      setCache(await cacheResponse.json());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '發生未知錯誤');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
              <Leaf size={16} />
              ESG Demo System
            </div>
            <h1 className="text-3xl font-semibold tracking-normal md:text-5xl">
              Vite React + Hono API 基礎專案
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
              已串好前端頁面、後端 API、Prisma model 與 Redis 讀寫範例，可作為 ESG 資料產品的起始骨架。
            </p>
          </div>

          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
            onClick={() => void loadDashboard()}
            type="button"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            重新整理
          </button>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 py-6 md:grid-cols-3">
        <MetricCard icon={<Activity size={20} />} label="執行中專案" value={totals.active.toString()} />
        <MetricCard icon={<Database size={20} />} label="專案總數" value={projects.length.toString()} />
        <MetricCard icon={<Leaf size={20} />} label="碳排放噸數" value={totals.carbon.toLocaleString()} />
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-10 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="rounded-lg border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 px-5 py-4">
            <h2 className="text-lg font-semibold">ESG 專案</h2>
          </div>
          {error ? (
            <div className="p-5 text-sm text-red-600">{error}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">專案</th>
                    <th className="px-5 py-3 font-medium">負責人</th>
                    <th className="px-5 py-3 font-medium">狀態</th>
                    <th className="px-5 py-3 text-right font-medium">碳排放</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {projects.map((project) => (
                    <tr key={project.id}>
                      <td className="px-5 py-4 font-medium">{project.name}</td>
                      <td className="px-5 py-4 text-zinc-600">{project.owner}</td>
                      <td className="px-5 py-4">
                        <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                          {statusLabel[project.status]}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums">{project.carbonTons.toLocaleString()} t</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid gap-6">
          <StatusPanel health={health} />
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <Wifi size={18} />
              <h2 className="text-lg font-semibold">Redis 範例</h2>
            </div>
            <dl className="space-y-3 text-sm">
              <InfoRow label="Key" value={cache?.key ?? '-'} />
              <InfoRow label="Value" value={cache?.value ?? '-'} />
              <InfoRow label="Source" value={cache?.source ?? '-'} />
            </dl>
          </div>
        </div>
      </section>
    </main>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
        {icon}
      </div>
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function StatusPanel({ health }: { health: HealthResponse | null }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        <Server size={18} />
        <h2 className="text-lg font-semibold">系統狀態</h2>
      </div>
      <dl className="space-y-3 text-sm">
        <InfoRow label="Service" value={health?.service ?? '-'} />
        <InfoRow label="API" value={health?.status ?? '-'} />
        <InfoRow label="Database" value={health?.database ?? '-'} />
        <InfoRow label="Redis" value={health?.redis ?? '-'} />
      </dl>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="break-all text-right font-medium">{value}</dd>
    </div>
  );
}

export default App;
