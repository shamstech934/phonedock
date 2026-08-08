import { NextRequest } from 'next/server';
import { publicGet } from '@/app/api/_public-route';
export const runtime = 'nodejs';
export const maxDuration = 15;
type RouteContext = { params: Promise<{ path?: string[] }> };
export async function GET(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return publicGet(req, ['news', ...(path || [])]);
}
