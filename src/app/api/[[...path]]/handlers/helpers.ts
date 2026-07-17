import { NextRequest, NextResponse } from 'next/server';
import { Admin, AdminSession } from '@/lib/models';
import { getSessionFromRequest, validateSessionVersion, createSignedSession } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { connectDB } from '@/lib/mongodb';

// Re-export for convenience — handler files import from here
export { verifyPassword, hashPassword, verifyToken, createSignedSession, getSessionFromRequest, validateSessionVersion, checkLoginRateLimitFromDB, recordFailedLoginDB, resetFailedAttempts, isStrongPassword, sanitizeInput, checkIpRateLimit, hashResetToken, verifyResetToken, sanitizeCsvValue, getCookieOptions } from '@/lib/auth';
export { hasPermission } from '@/lib/permissions';
export { connectDB, connectDBSafe } from '@/lib/mongodb';
export { Admin } from '@/lib/models';

// ============ CONSTANTS ============

export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_UPLOAD_RECORDS = 5000;
export const ALLOWED_EXTENSIONS = ['json', 'csv', 'xlsx', 'xls'];
export const ALLOWED_MIME_TYPES = new Set([
  'application/json',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);

// ============ ADMIN SESSION RECORD MANAGEMENT (server-only) ============

const SESSION_MAX_AGE = 24 * 60 * 60; // 24 hours in seconds

/** Persist an AdminSession record — call after createSignedSession */
export async function persistSessionRecord(adminId: string, jti: string, ip?: string, userAgent?: string): Promise<void> {
  try {
    await AdminSession.create({
      adminId,
      tokenJti: jti,
      ip: ip || '',
      userAgent: (userAgent || '').slice(0, 500),
      expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000),
    });
  } catch (e) {
    console.error('[AdminSession] Failed to create session record:', e);
  }
}

/** Validate an AdminSession record by jti — FAIL CLOSED */
export async function validateSessionRecord(jti: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const session = await AdminSession.findOne({ tokenJti: jti });
    if (!session) {
      return { valid: false, error: 'Session record not found' };
    }
    if (session.revokedAt) {
      return { valid: false, error: 'Session revoked' };
    }
    if (new Date(session.expiresAt) <= new Date()) {
      return { valid: false, error: 'Session expired' };
    }
    // Fire-and-forget: update lastUsedAt
    AdminSession.updateOne({ tokenJti: jti }, { $set: { lastUsedAt: new Date() } }).catch(() => {});
    return { valid: true };
  } catch {
    return { valid: false, error: 'Session validation failed' };
  }
}

/** Revoke a single session by its jti */
export async function revokeSession(jti: string): Promise<boolean> {
  try {
    const result = await AdminSession.updateOne(
      { tokenJti: jti, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    return result.modifiedCount > 0;
  } catch (e) {
    console.error('[AdminSession] revokeSession failed:', e);
    return false;
  }
}

/** Revoke ALL sessions for a given admin */
export async function revokeAllSessions(adminId: string): Promise<number> {
  try {
    const result = await AdminSession.updateMany(
      { adminId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    return result.modifiedCount;
  } catch (e) {
    console.error('[AdminSession] revokeAllSessions failed:', e);
    return 0;
  }
}

/** Revoke all sessions for an admin EXCEPT the one with the given jti */
export async function revokeOtherSessions(adminId: string, keepJti: string): Promise<number> {
  try {
    const result = await AdminSession.updateMany(
      { adminId, tokenJti: { $ne: keepJti }, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    return result.modifiedCount;
  } catch (e) {
    console.error('[AdminSession] revokeOtherSessions failed:', e);
    return 0;
  }
}

/** Get all active (non-revoked, non-expired) sessions for an admin */
export async function getActiveSessions(adminId: string): Promise<any[]> {
  try {
    return await AdminSession.find({
      adminId,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 }).lean();
  } catch (e) {
    console.error('[AdminSession] getActiveSessions failed:', e);
    return [];
  }
}

// ============ HELPERS ============

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============ IP HELPER ============

export function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

// ============ AUTH HELPERS ============

export async function getAdminFromRequest(req: NextRequest): Promise<{ admin?: any; error?: NextResponse }> {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  await connectDB();
  // Fail-closed session version check
  const versionCheck = await validateSessionVersion(session.sub, session.sessionVersion ?? 0, Admin);
  if (!versionCheck.valid) {
    const response = NextResponse.json({ error: 'Session invalid' }, { status: 401 });
    response.cookies.set('pd_session', '', { maxAge: 0, path: '/' });
    return { error: response };
  }
  // Fail-closed AdminSession record check
  const recordCheck = await validateSessionRecord(session.jti);
  if (!recordCheck.valid) {
    const response = NextResponse.json({ error: 'Session invalid' }, { status: 401 });
    response.cookies.set('pd_session', '', { maxAge: 0, path: '/' });
    return { error: response };
  }
  const admin = await Admin.findById(session.sub).select('-password -resetTokenHash -resetTokenExpires');
  if (!admin || !admin.active) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { admin };
}

/** Check if email is configured — used to gate forgot-password */
export function isEmailConfigured(): boolean {
  return !!(process.env.EMAIL_HOST && process.env.EMAIL_PORT && process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

export function requirePermission(admin: any, permission: string): NextResponse | null {
  if (!hasPermission(admin.role as any, permission as any)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export function phoneToJSON(p: any, specs?: any, benchmarks?: any, images?: any[], prices?: any[]) {
  const obj = p.toObject ? p.toObject() : p;
  return {
    id: obj._id?.toString(),
    modelName: obj.modelName,
    slug: obj.slug,
    brandId: obj.brandId?.toString(),
    brand: obj.brand ? { id: obj.brand._id?.toString(), name: obj.brand.name, slug: obj.brand.slug, logo: obj.brand.logo || '' } : undefined,
    thumbnail: obj.thumbnail || '',
    pricePKR: obj.pricePKR || 0,
    originalPricePKR: obj.originalPricePKR || 0,
    description: obj.description || '',
    overallRating: obj.overallRating || 0,
    cameraScore: obj.cameraScore || 0,
    performanceScore: obj.performanceScore || 0,
    batteryScore: obj.batteryScore || 0,
    displayScore: obj.displayScore || 0,
    valueScore: obj.valueScore || 0,
    ptaStatus: obj.ptaStatus || 'Unknown',
    ptaApproved: obj.ptaApproved || false,
    releaseDate: obj.releaseDate || '',
    trending: obj.trending || false,
    upcoming: obj.upcoming || false,
    featured: obj.featured || false,
    pros: obj.pros || '',
    cons: obj.cons || '',
    reviewSummary: obj.reviewSummary || '',
    reviewVerdict: obj.reviewVerdict || '',
    published: obj.status === 'published',
    specs: specs ? { ...specs, id: specs._id?.toString() } : undefined,
    benchmarks: benchmarks || undefined,
    images: images?.map((img: any) => ({ id: img._id?.toString(), url: img.url, altText: img.altText, sortOrder: img.sortOrder })) || [],
    prices: prices?.map((pr: any) => ({ id: pr._id?.toString(), storeName: pr.storeName, price: pr.price, url: pr.url, inStock: pr.inStock })) || [],
    // Price tracking
    priceMode: obj.priceMode || 'manual',
    manualLock: obj.manualLock || false,
    manualLockReason: obj.manualLockReason || '',
    sourceUrl: obj.sourceUrl || '',
  };
}