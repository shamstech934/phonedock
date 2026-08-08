import { NextRequest, NextResponse } from 'next/server';
import {
  handlePriceTrackerGet,
  handlePriceTrackerPost,
  handlePriceTrackerPut,
  handlePriceTrackerDelete,
} from '@/app/api/[[...path]]/handlers/price-tracker';
import { handleAdminRunPriceSync } from '@/app/api/[[...path]]/handlers/cron-update-prices';

// Price Control is one of the busiest admin workspaces. Keep it on a small,
// dedicated Node.js route instead of forcing every request through the very
// large catch-all API bundle (collector/import/intelligence/public APIs etc.).
// This preserves the existing /api/admin/price-tracker/* URLs while reducing
// serverless cold-start/runtime failures that surface in the browser as
// "Failed to fetch".
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type RouteContext = { params: Promise<{ path?: string[] }> };

function segmentsFrom(path?: string[]): string[] {
  return ['admin', 'price-tracker', ...(path || [])];
}

function runtimeError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[price-tracker-route]', message);

  const lower = message.toLowerCase();
  if (
    lower.includes('mongo') ||
    lower.includes('database') ||
    lower.includes('server selection') ||
    lower.includes('econnrefused') ||
    lower.includes('timed out') ||
    lower.includes('timeout')
  ) {
    return NextResponse.json(
      { error: 'Price Control database is temporarily unavailable. Please retry in a moment.' },
      { status: 503 },
    );
  }

  return NextResponse.json({ error: 'Price Control request failed on the server.' }, { status: 500 });
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { path } = await context.params;
    const result = await handlePriceTrackerGet(req, segmentsFrom(path));
    return result || NextResponse.json({ error: 'Price Control endpoint not found.' }, { status: 404 });
  } catch (error) {
    return runtimeError(error);
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { path } = await context.params;
    const localPath = path || [];

    // run-sync is implemented by the production price-sync handler and was
    // historically special-cased in the monolithic catch-all route.
    if (localPath.length === 1 && localPath[0] === 'run-sync') {
      return await handleAdminRunPriceSync(req);
    }

    const result = await handlePriceTrackerPost(req, segmentsFrom(localPath));
    return result || NextResponse.json({ error: 'Price Control endpoint not found.' }, { status: 404 });
  } catch (error) {
    return runtimeError(error);
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { path } = await context.params;
    const result = await handlePriceTrackerPut(req, segmentsFrom(path));
    return result || NextResponse.json({ error: 'Price Control endpoint not found.' }, { status: 404 });
  } catch (error) {
    return runtimeError(error);
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { path } = await context.params;
    const result = await handlePriceTrackerDelete(req, segmentsFrom(path));
    return result || NextResponse.json({ error: 'Price Control endpoint not found.' }, { status: 404 });
  } catch (error) {
    return runtimeError(error);
  }
}
