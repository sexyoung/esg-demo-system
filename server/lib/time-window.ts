import type { MetricType } from '@prisma/client';
import { prisma } from './prisma.js';

/**
 * Anchor the rolling time window to the tenant's most recent reading instead
 * of wallclock. Demo seed data ages out within days; with wallclock anchoring
 * every dashboard goes empty. Anchoring to last-available data keeps the
 * dashboard alive regardless of when the seed was last refreshed.
 *
 * Falls back to wallclock when the tenant has no readings.
 */
export async function dataAnchor(tenantId: string, metric?: MetricType): Promise<Date> {
  const latest = await prisma.metricReading.findFirst({
    where: {
      asset: { tenantId },
      ...(metric ? { metric } : {}),
    },
    orderBy: { timestamp: 'desc' },
    select: { timestamp: true },
  });
  return latest?.timestamp ?? new Date();
}
