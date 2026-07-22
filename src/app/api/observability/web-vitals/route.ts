import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/observability/logger';
import { recordMetric } from '@/lib/observability/metrics';

export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.enum(['LCP', 'INP', 'CLS', 'FCP', 'TTFB']),
  value: z.number().finite().nonnegative().max(600_000),
  rating: z.enum(['good', 'needs-improvement', 'poor']).optional(),
  navigationType: z.string().max(40).optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid metric' }, { status: 400 });
  recordMetric(`web_vital.${parsed.data.name.toLowerCase()}`, parsed.data.value, parsed.data.name === 'CLS' ? 'ratio' : 'ms', {
    route: new URL(request.url).pathname,
    rating: parsed.data.rating,
    navigationType: parsed.data.navigationType,
  });
  logger.debug('Web vital accepted', { metric: parsed.data.name });
  return new NextResponse(null, { status: 204 });
}
