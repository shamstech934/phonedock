import { NextRequest, NextResponse } from 'next/server';
import { ActivityLog, MonitoringRun } from '@/lib/models';
import { runContinuousMonitoring } from '@/lib/continuous-monitoring';
import { connectDB, getAdminFromRequest, requirePermission } from './helpers';

export async function handleContinuousMonitoringGet(req: NextRequest): Promise<NextResponse> {
  const auth = await getAdminFromRequest(req);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth.admin, 'phones:read');
  if (denied) return denied;
  await connectDB();

  const limit = Math.min(50, Math.max(5, Number(req.nextUrl.searchParams.get('limit') || 15)));
  const [runs, latest] = await Promise.all([
    MonitoringRun.find().sort({ createdAt: -1 }).limit(limit).lean(),
    MonitoringRun.findOne().sort({ createdAt: -1 }).lean(),
  ]);
  return NextResponse.json({ latest, runs }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function handleContinuousMonitoringPost(req: NextRequest): Promise<NextResponse> {
  const auth = await getAdminFromRequest(req);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth.admin, 'phones:edit');
  if (denied) return denied;
  await connectDB();

  const body = await req.json().catch(() => ({}));
  const result = await runContinuousMonitoring({
    trigger: 'manual',
    createdBy: auth.admin._id,
    syncFeeds: body.syncFeeds !== false,
  });
  await ActivityLog.create({
    adminId: auth.admin._id,
    action: 'continuous_monitoring_run',
    entityType: 'monitoring',
    entityId: result._id,
    details: `Monitoring completed with status ${result.status}`,
  });
  return NextResponse.json({ success: true, run: result });
}
