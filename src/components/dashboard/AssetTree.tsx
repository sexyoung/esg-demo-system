import { useQuery } from '@tanstack/react-query';
import * as d3 from 'd3';
import { useMemo } from 'react';
import { api, queryKeys } from '../../api/client';
import { dashboardApi, dashboardKeys, type AssetRow } from '../../api/dashboard';

interface Props {
  slug: string;
}

interface TreeNode {
  id: string;
  name: string;
  kind: 'site' | 'asset';
  type?: string;
  children?: TreeNode[];
}

export function AssetTree({ slug }: Props) {
  const tenantQuery = useQuery({
    queryKey: queryKeys.tenant(slug),
    queryFn: () => api.tenant(slug),
  });
  const assetsQuery = useQuery({
    queryKey: dashboardKeys.assets(slug),
    queryFn: () => dashboardApi.assets(slug),
  });

  const primarySiteCode = (tenantQuery.data?.config as { primarySiteCode?: string } | undefined)?.primarySiteCode ?? null;

  const layout = useMemo(
    () => (assetsQuery.data && primarySiteCode ? buildLayout(primarySiteCode, assetsQuery.data) : null),
    [primarySiteCode, assetsQuery.data],
  );

  return (
    <section className="rounded-lg border border-border bg-bg-elevated overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-soft">
        <div className="text-xs uppercase tracking-wider text-fg-muted">
          {primarySiteCode ?? '主場景'} 子系統階層 <span className="text-fg-subtle normal-case tracking-normal">· D3.js tree</span>
        </div>
        {layout && (
          <span className="text-xs text-fg-subtle tabular-nums">
            {layout.nodeCount} nodes · {layout.depth} levels
          </span>
        )}
      </div>
      <div className="overflow-auto max-h-[480px]">
        {assetsQuery.isLoading || tenantQuery.isLoading ? (
          <div className="p-6 text-fg-muted text-sm">載入中…</div>
        ) : layout ? (
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
          <div className="p-6 text-fg-muted text-sm">無資產資料</div>
        )}
      </div>
    </section>
  );
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

function buildLayout(primarySiteCode: string, assets: AssetRow[]) {
  const primarySiteAssets = assets.filter((a) => a.site?.code === primarySiteCode);
  if (primarySiteAssets.length === 0) {
    return null;
  }

  const nodeMap = new Map<string, TreeNode>();
  for (const a of primarySiteAssets) {
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
    name: primarySiteCode,
    kind: 'site',
    children: [],
  };

  for (const a of primarySiteAssets) {
    const node = nodeMap.get(a.id)!;
    if (a.parentId && nodeMap.has(a.parentId)) {
      nodeMap.get(a.parentId)!.children!.push(node);
    } else {
      root.children!.push(node);
    }
  }

  const hierarchy = d3.hierarchy(root, (d) => d.children);
  const treeLayout = d3.tree<TreeNode>().nodeSize([22, 200]);
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
  const padY = -minY + 20;
  const width = maxX + 240;
  const height = (maxY - minY) + 40;
  const depth = Math.max(...nodes.map((n) => n.depth));

  return { nodes, links, width, height, padX, padY, nodeCount: nodes.length, depth };
}
