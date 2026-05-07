import { useQuery } from '@tanstack/react-query';
import * as d3 from 'd3';
import { useMemo } from 'react';
import { dashboardApi, dashboardKeys, type AssetRow } from '../../api/dashboard';

interface Props {
  slug: string;
}

interface TreeNode {
  id: string;
  name: string;
  kind: 'tenant' | 'site' | 'asset';
  type?: string;
  children?: TreeNode[];
}

export function AssetTree({ slug }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: dashboardKeys.assets(slug),
    queryFn: () => dashboardApi.assets(slug),
  });

  const layout = useMemo(() => (data ? buildLayout(slug, data) : null), [slug, data]);

  return (
    <section className="rounded-lg border border-border bg-bg-elevated overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-soft">
        <div className="text-xs uppercase tracking-wider text-fg-muted">
          Asset Tree <span className="text-fg-subtle normal-case tracking-normal">· D3.js</span>
        </div>
        {data && <span className="text-xs text-fg-subtle">{data.length} assets</span>}
      </div>
      <div className="overflow-x-auto overflow-y-hidden">
        {isLoading ? (
          <div className="p-6 text-fg-muted text-sm">載入中…</div>
        ) : layout ? (
          <svg width={layout.width} height={layout.height} className="block min-w-full">
            <g transform={`translate(${layout.padX},${layout.padY})`}>
              {layout.links.map((l, i) => (
                <path key={i} d={l} fill="none" stroke="#243049" strokeWidth={1.2} />
              ))}
              {layout.nodes.map((n) => (
                <g key={n.data.id} transform={`translate(${n.x},${n.y})`}>
                  <circle
                    r={n.data.kind === 'tenant' ? 7 : n.data.kind === 'site' ? 5 : 4}
                    fill={fillFor(n.data)}
                    stroke="#0b1220"
                    strokeWidth={2}
                  />
                  <text
                    x={9}
                    y={4}
                    fontSize={n.data.kind === 'tenant' ? 12 : 11}
                    fontWeight={n.data.kind === 'tenant' ? 600 : 400}
                    fill={n.data.kind === 'tenant' ? '#e6edf7' : '#93a3bf'}
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
  if (d.kind === 'tenant') return '#0083b6';
  if (d.kind === 'site') return '#00a3df';
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
    case 'LINE':
      return '#93a3bf';
    default:
      return '#5e6e8a';
  }
}

function buildLayout(slug: string, assets: AssetRow[]) {
  const sitesMap = new Map<string, TreeNode>();
  for (const a of assets) {
    if (!a.site) continue;
    if (!sitesMap.has(a.site.code)) {
      sitesMap.set(a.site.code, {
        id: `site-${a.site.code}`,
        name: a.site.code,
        kind: 'site',
        children: [],
      });
    }
  }
  for (const a of assets) {
    if (!a.site) continue;
    const site = sitesMap.get(a.site.code)!;
    site.children!.push({
      id: a.id,
      name: a.type === 'BUILDING' && site.children!.length === 0 && sitesMap.size > 5 ? a.site.name : labelFor(a),
      kind: 'asset',
      type: a.type,
    });
  }

  const root: TreeNode = {
    id: 'root',
    name: tenantLabel(slug),
    kind: 'tenant',
    children: [...sitesMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };

  const hierarchy = d3.hierarchy(root, (d) => d.children);
  const treeLayout = d3.tree<TreeNode>().nodeSize([22, 220]);
  const tree = treeLayout(hierarchy);

  const nodes = tree.descendants();
  const links = tree.links().map((l) => {
    return d3.linkHorizontal<unknown, d3.HierarchyPointNode<TreeNode>>().x((n) => n.y).y((n) => n.x)({
      source: l.source,
      target: l.target,
    } as never) ?? '';
  });

  let minX = Infinity, maxX = -Infinity, maxY = 0;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.x > maxX) maxX = n.x;
    if (n.y > maxY) maxY = n.y;
  }
  const padX = 20;
  const padY = -minX + 16;
  const width = maxY + 240;
  const height = (maxX - minX) + 32;

  return {
    nodes: nodes.map((n) => ({ ...n, x: n.y, y: n.x })),
    links: tree.links().map((l) => {
      const sx = l.source.y;
      const sy = l.source.x;
      const tx = l.target.y;
      const ty = l.target.x;
      const mx = (sx + tx) / 2;
      return `M${sx},${sy} C${mx},${sy} ${mx},${ty} ${tx},${ty}`;
    }),
    width,
    height,
    padX,
    padY,
  };
}

function labelFor(a: AssetRow): string {
  return a.name.length > 24 ? `${a.name.slice(0, 22)}…` : a.name;
}

function tenantLabel(slug: string): string {
  return slug === 'acme' ? 'Acme 微電網園區' : slug === 'beta' ? 'Beta 商辦集團' : slug === 'gamma' ? 'Gamma 半導體廠' : slug;
}
