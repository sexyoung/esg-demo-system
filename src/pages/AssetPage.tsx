import { useQuery } from '@tanstack/react-query';
import * as d3 from 'd3';
import { Building2, ChevronRight, Network } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { dashboardApi, dashboardKeys, type AssetRow } from '../api/dashboard';

interface TreeNode {
  id: string;
  name: string;
  kind: 'site' | 'asset';
  type?: string;
  children?: TreeNode[];
}

export function AssetPage() {
  const { slug = 'acme' } = useParams<{ slug: string }>();

  const { data: assets, isLoading } = useQuery({
    queryKey: dashboardKeys.assets(slug),
    queryFn: () => dashboardApi.assets(slug),
  });

  const siteSummaries = useMemo(() => buildSiteSummaries(assets ?? []), [assets]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const activeCode = selectedCode ?? siteSummaries[0]?.code ?? null;
  const activeAssets = useMemo(
    () => (assets ?? []).filter((a) => a.site?.code === activeCode),
    [assets, activeCode],
  );

  const layout = useMemo(
    () => (activeCode && activeAssets.length > 0 ? buildLayout(activeCode, activeAssets) : null),
    [activeCode, activeAssets],
  );

  return (
    <div className="p-5 space-y-5 max-w-[1600px] mx-auto">
      <header>
        <div className="text-xs uppercase tracking-wider text-fg-subtle mb-1">Asset Inventory</div>
        <h1 className="text-xl font-semibold">資產階層 · {siteSummaries.length} sites · {assets?.length ?? 0} assets</h1>
        <div className="text-xs text-fg-muted mt-0.5">點左側 site 切換 → 右側顯示該 site 完整子設備樹</div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <aside className="rounded-lg border border-border bg-bg-elevated overflow-hidden max-h-[640px] overflow-y-auto">
          <div className="px-4 py-2 border-b border-border-soft text-xs uppercase tracking-wider text-fg-muted sticky top-0 bg-bg-elevated">
            Sites
          </div>
          {isLoading ? (
            <div className="p-4 text-fg-muted text-sm">載入中…</div>
          ) : (
            <ul className="divide-y divide-border-soft">
              {siteSummaries.map((s) => {
                const active = s.code === activeCode;
                return (
                  <li key={s.code}>
                    <button
                      type="button"
                      onClick={() => setSelectedCode(s.code)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left transition ${
                        active ? 'bg-accent/10' : 'hover:bg-bg-soft'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className={`flex items-center gap-2 text-sm font-medium ${active ? 'text-accent-soft' : 'text-fg'}`}>
                          <Building2 size={14} className={active ? 'text-accent-soft' : 'text-fg-muted'} />
                          {s.code}
                        </div>
                        <div className="text-[11px] text-fg-muted truncate mt-0.5">{s.name}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs tabular-nums text-fg-muted">{s.count}</div>
                        <ChevronRight size={12} className="text-fg-subtle ml-auto" />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="rounded-lg border border-border bg-bg-elevated overflow-hidden">
          <div className="px-4 py-2 border-b border-border-soft flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-fg-muted flex items-center gap-2">
              <Network size={14} />
              {activeCode ?? '—'} · 子系統階層
            </div>
            {layout && (
              <span className="text-xs text-fg-subtle tabular-nums">
                {layout.nodeCount} nodes · {layout.depth} levels
              </span>
            )}
          </div>
          <div className="overflow-auto max-h-[640px]">
            {layout ? (
              <svg width={layout.width} height={layout.height} className="block">
                <g transform={`translate(${layout.padX},${layout.padY})`}>
                  {layout.links.map((d, i) => (
                    <path key={i} d={d} fill="none" stroke="#243049" strokeWidth={1.2} />
                  ))}
                  {layout.nodes.map((n) => (
                    <g key={n.id} transform={`translate(${n.x},${n.y})`}>
                      <circle
                        r={n.depth === 0 ? 7 : n.depth === 1 ? 5 : 3.5}
                        fill={fillFor(n.data)}
                        stroke="#0b1220"
                        strokeWidth={2}
                      />
                      <text
                        x={n.depth === 0 ? 11 : 9}
                        y={4}
                        fontSize={n.depth === 0 ? 12 : 11}
                        fontWeight={n.depth === 0 ? 600 : n.depth === 1 ? 500 : 400}
                        fill={n.depth === 0 ? '#e6edf7' : n.depth === 1 ? '#c0cce0' : '#93a3bf'}
                      >
                        {n.data.name}
                      </text>
                    </g>
                  ))}
                </g>
              </svg>
            ) : (
              <div className="p-8 text-fg-muted text-sm text-center">無資產資料</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

interface SiteSummary {
  code: string;
  name: string;
  count: number;
}

function buildSiteSummaries(assets: AssetRow[]): SiteSummary[] {
  const map = new Map<string, SiteSummary>();
  for (const a of assets) {
    if (!a.site) continue;
    const existing = map.get(a.site.code);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(a.site.code, { code: a.site.code, name: a.site.name, count: 1 });
    }
  }
  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
}

function fillFor(d: TreeNode): string {
  if (d.kind === 'site') return '#0083b6';
  switch (d.type) {
    case 'PV':
      return '#fbbf24';
    case 'ESS':
      return '#a78bfa';
    case 'EV_CHARGER':
      return '#34d399';
    case 'METER':
      return '#f87171';
    case 'BUILDING':
      return '#00a3df';
    case 'LINE':
      return '#60a5fa';
    case 'FLOOR':
      return '#94a3b8';
    default:
      return '#5e6e8a';
  }
}

function buildLayout(siteCode: string, assets: AssetRow[]) {
  const nodeMap = new Map<string, TreeNode>();
  for (const a of assets) {
    nodeMap.set(a.id, {
      id: a.id,
      name: a.name,
      kind: 'asset',
      type: a.type,
      children: [],
    });
  }

  const root: TreeNode = {
    id: 'root',
    name: siteCode,
    kind: 'site',
    children: [],
  };

  for (const a of assets) {
    const node = nodeMap.get(a.id)!;
    if (a.parentId && nodeMap.has(a.parentId)) {
      nodeMap.get(a.parentId)!.children!.push(node);
    } else {
      root.children!.push(node);
    }
  }

  const hierarchy = d3.hierarchy(root, (d) => d.children);
  const treeLayout = d3.tree<TreeNode>().nodeSize([24, 220]);
  const tree = treeLayout(hierarchy);

  const nodes = tree.descendants().map((n) => ({
    id: n.data.id,
    data: n.data,
    depth: n.depth,
    x: n.y,
    y: n.x,
  }));
  const links = tree.links().map((l) => {
    const sx = l.source.y;
    const sy = l.source.x;
    const tx = l.target.y;
    const ty = l.target.x;
    const mx = (sx + tx) / 2;
    return `M${sx},${sy} C${mx},${sy} ${mx},${ty} ${tx},${ty}`;
  });

  let minY = Infinity, maxY = -Infinity, maxX = 0;
  for (const n of nodes) {
    if (n.y < minY) minY = n.y;
    if (n.y > maxY) maxY = n.y;
    if (n.x > maxX) maxX = n.x;
  }
  const padX = 20;
  const padY = -minY + 24;
  const width = maxX + 280;
  const height = (maxY - minY) + 48;
  const depth = Math.max(...nodes.map((n) => n.depth));

  return { nodes, links, width, height, padX, padY, nodeCount: nodes.length, depth };
}
