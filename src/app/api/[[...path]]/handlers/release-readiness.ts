import { NextRequest, NextResponse } from 'next/server';
import { DataQualityIssue, MonitoringRun, Phone, PhoneImage, PhoneSpecs } from '@/lib/models';
import { connectDB, getAdminFromRequest, requirePermission } from './helpers';

type CheckStatus = 'pass' | 'warning' | 'fail';
interface ReleaseCheck { key: string; label: string; status: CheckStatus; detail: string; }

function envPresent(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

export async function handleReleaseReadinessGet(req: NextRequest): Promise<NextResponse> {
  const auth = await getAdminFromRequest(req);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth.admin, 'settings:read');
  if (denied) return denied;
  await connectDB();

  const now = Date.now();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
  const requiredEnv = ['JWT_SECRET', 'CRON_SECRET'];
  const databaseConfigured = envPresent('MONGODB_URI') || envPresent('MONGO_URL');

  const [
    phoneCount,
    publishedCount,
    draftCount,
    missingPriceCount,
    specsPhoneIds,
    imagePhoneIds,
    criticalIssues,
    openIssues,
    latestMonitoring,
  ] = await Promise.all([
    Phone.countDocuments({}),
    Phone.countDocuments({ status: 'published' }),
    Phone.countDocuments({ status: { $ne: 'published' } }),
    Phone.countDocuments({ status: 'published', $or: [{ pricePKR: { $exists: false } }, { pricePKR: { $lte: 0 } }] }),
    PhoneSpecs.distinct('phoneId'),
    PhoneImage.distinct('phoneId'),
    DataQualityIssue.countDocuments({ status: 'open', severity: 'critical' }),
    DataQualityIssue.countDocuments({ status: 'open' }),
    MonitoringRun.findOne().sort({ createdAt: -1 }).lean(),
  ]);

  const publishedIds = await Phone.distinct('_id', { status: 'published' });
  const specsSet = new Set(specsPhoneIds.map(String));
  const imagesSet = new Set(imagePhoneIds.map(String));
  const missingSpecsCount = publishedIds.filter((id) => !specsSet.has(String(id))).length;
  const missingImagesCount = publishedIds.filter((id) => !imagesSet.has(String(id))).length;

  const checks: ReleaseCheck[] = [];
  checks.push({ key: 'database', label: 'Database configuration', status: databaseConfigured ? 'pass' : 'fail', detail: databaseConfigured ? 'MongoDB environment is configured.' : 'MONGODB_URI or MONGO_URL is missing.' });
  for (const name of requiredEnv) checks.push({ key: `env-${name}`, label: name, status: envPresent(name) ? 'pass' : 'fail', detail: envPresent(name) ? 'Configured.' : 'Required production secret is missing.' });
  checks.push({ key: 'base-url', label: 'Production base URL', status: baseUrl === 'https://specsdekh.com' ? 'pass' : baseUrl.startsWith('https://') ? 'warning' : 'fail', detail: baseUrl || 'NEXT_PUBLIC_BASE_URL is missing.' });
  checks.push({ key: 'content', label: 'Published phone catalog', status: publishedCount > 0 ? 'pass' : 'fail', detail: `${publishedCount} published of ${phoneCount} total phones.` });
  checks.push({ key: 'critical-quality', label: 'Critical data-quality issues', status: criticalIssues === 0 ? 'pass' : 'fail', detail: `${criticalIssues} critical and ${openIssues} total open issues.` });
  checks.push({ key: 'missing-specs', label: 'Published phones with specs', status: missingSpecsCount === 0 ? 'pass' : missingSpecsCount <= 5 ? 'warning' : 'fail', detail: `${missingSpecsCount} published phones have no specs record.` });
  checks.push({ key: 'missing-images', label: 'Published phones with images', status: missingImagesCount === 0 ? 'pass' : missingImagesCount <= 5 ? 'warning' : 'fail', detail: `${missingImagesCount} published phones have no image record.` });
  checks.push({ key: 'missing-prices', label: 'Published phones with prices', status: missingPriceCount === 0 ? 'pass' : missingPriceCount <= 5 ? 'warning' : 'fail', detail: `${missingPriceCount} published phones have no valid PKR price.` });

  const monitoringAgeHours = latestMonitoring?.createdAt ? (now - new Date(latestMonitoring.createdAt).getTime()) / 3_600_000 : null;
  checks.push({
    key: 'monitoring',
    label: 'Continuous monitoring freshness',
    status: monitoringAgeHours === null ? 'warning' : monitoringAgeHours <= 36 ? 'pass' : monitoringAgeHours <= 72 ? 'warning' : 'fail',
    detail: monitoringAgeHours === null ? 'No monitoring run found.' : `Latest run was ${Math.round(monitoringAgeHours)} hours ago (${latestMonitoring?.status || 'unknown'}).`,
  });
  checks.push({ key: 'search-console', label: 'Google verification meta token', status: envPresent('NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION') ? 'pass' : 'warning', detail: envPresent('NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION') ? 'Meta verification token configured.' : 'Optional because DNS verification can be used instead.' });

  const weights = { pass: 1, warning: 0.5, fail: 0 } as const;
  const score = Math.round((checks.reduce((sum, check) => sum + weights[check.status], 0) / checks.length) * 100);
  const failed = checks.filter((check) => check.status === 'fail').length;
  const warnings = checks.filter((check) => check.status === 'warning').length;
  const ready = failed === 0 && score >= 80;

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    ready,
    score,
    failed,
    warnings,
    summary: { phoneCount, publishedCount, draftCount, openIssues, criticalIssues, missingSpecsCount, missingImagesCount, missingPriceCount },
    checks,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
