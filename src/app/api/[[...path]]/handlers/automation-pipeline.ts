import { NextRequest, NextResponse } from 'next/server';
import { ActivityLog, Phone } from '@/lib/models';
import { connectDB, getAdminFromRequest, requirePermission } from './helpers';
import { handleCronUpdatePrices } from './cron-update-prices';
import { syncRumourFeeds } from '@/lib/rumour-sync';
import { revalidatePublicContent } from '@/lib/revalidate';

async function reconcileLifecycle() {
  const today = new Date().toISOString().slice(0, 10);
  const [upcomingConsistency, launched, discontinued] = await Promise.all([
    Phone.updateMany(
      {
        availabilityStatus: { $in: ['rumored', 'announced', 'coming_soon'] },
        upcoming: { $ne: true },
        deletedAt: null,
      },
      { $set: { upcoming: true } },
    ),
    Phone.updateMany(
      {
        availabilityStatus: { $in: ['rumored', 'announced', 'coming_soon'] },
        $or: [
          { availableFrom: { $ne: '', $lte: today } },
          { pakistanLaunchAt: { $ne: '', $lte: today } },
        ],
        deletedAt: null,
      },
      { $set: { availabilityStatus: 'available', upcoming: false } },
    ),
    Phone.updateMany(
      {
        discontinuedAt: { $ne: '', $lte: today },
        availabilityStatus: { $nin: ['discontinued', 'cancelled'] },
        deletedAt: null,
      },
      { $set: { availabilityStatus: 'discontinued', upcoming: false } },
    ),
  ]);

  return {
    upcomingNormalised: upcomingConsistency.modifiedCount,
    launched: launched.modifiedCount,
    discontinued: discontinued.modifiedCount,
  };
}

export async function handleAdminAutomationStatus(req: NextRequest): Promise<NextResponse> {
  const authResult = await getAdminFromRequest(req);
  if (authResult.error) return authResult.error;
  const permissionError = requirePermission(authResult.admin, 'prices:read');
  if (permissionError) return permissionError;
  await connectDB();

  const [lastRun, lifecycle] = await Promise.all([
    ActivityLog.findOne({ action: 'automation_pipeline_completed' }).sort({ createdAt: -1 }).lean(),
    Phone.aggregate([
      { $match: { deletedAt: null } },
      { $group: { _id: '$availabilityStatus', count: { $sum: 1 } } },
    ]),
  ]);

  return NextResponse.json({
    lifecycle: Object.fromEntries(lifecycle.map((row: { _id?: string; count: number }) => [row._id || 'unknown', row.count])),
    lastRun: lastRun ? {
      at: lastRun.createdAt,
      details: lastRun.details,
    } : null,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function handleAdminAutomationPipeline(req: NextRequest): Promise<NextResponse> {
  const authResult = await getAdminFromRequest(req);
  if (authResult.error) return authResult.error;
  const permissionError = requirePermission(authResult.admin, 'prices:edit');
  if (permissionError) return permissionError;
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET must be configured before running automation.' }, { status: 503 });
  }

  await connectDB();
  const startedAt = Date.now();
  const lifecycle = await reconcileLifecycle();

  const headers = new Headers(req.headers);
  headers.set('x-cron-secret', process.env.CRON_SECRET);
  const internalRequest = new NextRequest(req.url, { method: 'GET', headers });
  const priceResponse = await handleCronUpdatePrices(internalRequest);
  const prices = priceResponse ? await priceResponse.json().catch(() => ({ error: 'Price stage returned an invalid response' })) : {};

  let rumours: Record<string, unknown> = { skipped: true };
  try {
    rumours = await syncRumourFeeds() as unknown as Record<string, unknown>;
  } catch (error) {
    rumours = { error: error instanceof Error ? error.message : 'Rumour sync failed safely' };
  }

  revalidatePublicContent();
  const result = {
    lifecycle,
    prices,
    rumours,
    durationMs: Date.now() - startedAt,
  };
  await ActivityLog.create({
    adminId: authResult.admin._id,
    action: 'automation_pipeline_completed',
    entityType: 'automation',
    details: JSON.stringify(result),
  });
  return NextResponse.json(result);
}

export async function handleCronAutomationPipeline(req: NextRequest): Promise<NextResponse> {
  const priceResponse = await handleCronUpdatePrices(req);
  if (!priceResponse) return NextResponse.json({ error: 'Price stage returned no response' }, { status: 500 });
  if (priceResponse.status === 401 || priceResponse.status === 403) return priceResponse;

  await connectDB();
  const startedAt = Date.now();
  const prices = await priceResponse.json().catch(() => ({ error: 'Price stage returned an invalid response' }));
  const lifecycle = await reconcileLifecycle();
  let rumours: Record<string, unknown> = {};
  try {
    rumours = await syncRumourFeeds() as unknown as Record<string, unknown>;
  } catch (error) {
    rumours = { error: error instanceof Error ? error.message : 'Rumour sync failed safely' };
  }
  revalidatePublicContent();
  const result = { lifecycle, prices, rumours, durationMs: Date.now() - startedAt };
  await ActivityLog.create({
    action: 'automation_pipeline_completed',
    entityType: 'automation',
    details: JSON.stringify(result),
  });
  return NextResponse.json(result);
}
