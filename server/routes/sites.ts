import { Hono } from 'hono';
import { prisma } from '../lib/prisma.js';

export const sitesRouter = new Hono();

sitesRouter.get('/', async (c) => {
  const sites = await prisma.site.findMany({
    include: { tenant: { select: { slug: true, name: true, industry: true } } },
    orderBy: { code: 'asc' },
  });
  return c.json(
    sites.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      latitude: s.latitude,
      longitude: s.longitude,
      tenantSlug: s.tenant.slug,
      tenantName: s.tenant.name,
      industry: s.tenant.industry,
    })),
  );
});
