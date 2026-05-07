import { Hono } from 'hono';
import { prisma } from '../lib/prisma.js';

export const tenantsRouter = new Hono();

tenantsRouter.get('/', async (c) => {
  const tenants = await prisma.tenant.findMany({
    orderBy: { slug: 'asc' },
    select: { id: true, slug: true, name: true, industry: true },
  });
  return c.json(tenants);
});

tenantsRouter.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    include: {
      _count: { select: { sites: true, assets: true, alerts: true } },
    },
  });
  if (!tenant) return c.json({ message: 'tenant not found' }, 404);
  return c.json(tenant);
});

tenantsRouter.get('/:slug/assets', async (c) => {
  const slug = c.req.param('slug');
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return c.json({ message: 'tenant not found' }, 404);
  const assets = await prisma.asset.findMany({
    where: { tenantId: tenant.id },
    include: { site: { select: { code: true, name: true } } },
    orderBy: [{ siteId: 'asc' }, { type: 'asc' }],
  });
  return c.json(assets);
});

tenantsRouter.get('/:slug/alerts', async (c) => {
  const slug = c.req.param('slug');
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return c.json({ message: 'tenant not found' }, 404);
  const alerts = await prisma.alert.findMany({
    where: { tenantId: tenant.id },
    orderBy: { triggeredAt: 'desc' },
  });
  return c.json(alerts);
});
