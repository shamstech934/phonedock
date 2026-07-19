import { NextRequest, NextResponse } from 'next/server';
import { Admin, AdminSession } from '@/lib/models';
import { getSessionFromRequest, validateSessionVersion, createSignedSession } from '@/lib/auth';
import { hasPermission, type AdminRole, type Permission } from '@/lib/permissions';
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

// ============ LOCAL INTERFACES ============

/** Admin document with sensitive fields excluded (via .select('-password -resetTokenHash -resetTokenExpires')) */
interface AdminPublicDoc {
  _id: { toString(): string };
  role: string;
  active: boolean;
  customPermissions?: string[];
  [key: string]: unknown;
}

/** Lean plain-object shape of an AdminSession (from .lean()) */
interface LeanAdminSession {
  _id?: { toString(): string };
  adminId?: { toString(): string };
  tokenJti: string;
  ip: string;
  userAgent: string;
  expiresAt: Date | string;
  lastUsedAt: Date | string;
  revokedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/** Plain-object representation of a phone (output of phoneToJSON) */
export interface PhoneJson {
  id?: string;
  modelName?: string;
  slug?: string;
  brandId?: string;
  brand?: { id?: string; name?: string; slug?: string; logo?: string };
  thumbnail?: string;
  pricePKR?: number;
  originalPricePKR?: number;
  description?: string;
  overallRating?: number;
  cameraScore?: number;
  performanceScore?: number;
  batteryScore?: number;
  displayScore?: number;
  valueScore?: number;
  ptaStatus?: string;
  ptaApproved?: boolean;
  releaseDate?: string;
  trending?: boolean;
  upcoming?: boolean;
  featured?: boolean;
  pros?: string;
  cons?: string;
  reviewSummary?: string;
  reviewVerdict?: string;
  published?: boolean;
  specs?: Record<string, string | number | null> | null;
  benchmarks?: Record<string, unknown>;
  images?: Array<{ id?: string; url?: string; altText?: string; sortOrder?: number }>;
  prices?: Array<{ id?: string; storeName?: string; price?: number; url?: string; inStock?: boolean }>;
  priceMode?: string;
  manualLock?: boolean;
  manualLockReason?: string;
  sourceUrl?: string;
}

/** Shape of a raw phone Mongoose doc / .toObject() output */
interface RawPhoneObject {
  _id?: { toString(): string };
  brandId?: { toString(): string };
  modelName?: string;
  slug?: string;
  brand?: { _id?: { toString(): string }; name?: string; slug?: string; logo?: string };
  thumbnail?: string;
  pricePKR?: number;
  originalPricePKR?: number;
  description?: string;
  overallRating?: number;
  cameraScore?: number;
  performanceScore?: number;
  batteryScore?: number;
  displayScore?: number;
  valueScore?: number;
  ptaStatus?: string;
  ptaApproved?: boolean;
  releaseDate?: string;
  trending?: boolean;
  upcoming?: boolean;
  featured?: boolean;
  pros?: string;
  cons?: string;
  reviewSummary?: string;
  reviewVerdict?: string;
  status?: string;
  priceMode?: string;
  manualLock?: boolean;
  manualLockReason?: string;
  sourceUrl?: string;
}

/** A Mongoose document or a plain object — supports both raw docs and already-serialized JSON */
export interface PhoneDocOrJson extends RawPhoneObject {
  toObject?(...args: unknown[]): unknown;
}

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
export async function getActiveSessions(adminId: string): Promise<LeanAdminSession[]> {
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

/** Discriminated union: success has `admin`, failure has `error`. After checking `.error`, TS narrows `.admin` to non-undefined. */
export type AuthResult =
  | { admin: AdminPublicDoc; error?: undefined }
  | { admin?: undefined; error: NextResponse };

export async function getAdminFromRequest(req: NextRequest): Promise<AuthResult> {
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
  return { admin: admin as unknown as AdminPublicDoc };
}

/** Check if email is configured — used to gate forgot-password */
export function isEmailConfigured(): boolean {
  return !!(process.env.EMAIL_HOST && process.env.EMAIL_PORT && process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

export function requirePermission(admin: AdminPublicDoc, permission: string): NextResponse | null {
  if (!hasPermission(admin.role as AdminRole, permission as Permission)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

// ============ SHARED PHONE SPECS SERIALIZATION ============
// Single source of truth for converting a raw PhoneSpecs MongoDB document
// into the normalized PhoneSpecs shape used everywhere (listings, detail, Quick View).

const SPECS_FIELDS = [
  'display','displayType','resolution','refreshRate','protection','brightness',
  'chipset','cpu','gpu','process','ram','ramType','storage','cardSlot',
  'mainCamera','mainCameraSensor','aperture','ois','eis','ultrawide','telephoto','zoom','cameraFeatures','videoRecording',
  'selfieCamera','selfieSensor','selfieVideo',
  'battery','charging','chargingSpeed','wirelessCharge','wirelessSpeed','reverseCharge',
  'weight','dimensions','build','sim','ipRating','network','fiveG','wifi','bluetooth','nfc','usb','infrared',
  'fingerprint','faceUnlock','sensors','colors',
  'os','osVersion','osUI','updatePolicy','specialFeatures',
] as const;

const NUMERIC_SPECS_FIELDS = ['ramGB','storageGB','screenSizeInch','mainCameraMP','batteryMAh'] as const;

/** Serialize a raw PhoneSpecs document into the normalized frontend shape.
 *  Returns null when rawSpecs is falsy (no specs document exists).
 *  Strips MongoDB metadata (_id, __v, phoneId, createdAt, updatedAt). */
export function serializePhoneSpecs(rawSpecs: Record<string, unknown>): Record<string, string | number | null> | null {
  if (!rawSpecs) return null;
  const result: Record<string, string | number | null> = {};
  for (const f of SPECS_FIELDS) {
    const val = rawSpecs[f];
    result[f] = (typeof val === 'string' && val) ? val : '';
  }
  for (const f of NUMERIC_SPECS_FIELDS) {
    const val = rawSpecs[f];
    result[f] = (val !== undefined && val !== null) ? (val as string | number) : null;
  }
  return result;
}

/** Create a phoneId-to-specs Map from an array of PhoneSpecs lean docs. */
export function buildSpecsMap(specsArr: Record<string, unknown>[]): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  for (const s of specsArr) {
    const pid = s.phoneId as { toString(): string } | undefined;
    const key = pid?.toString?.() || String(s.phoneId);
    if (key) map.set(key, s);
  }
  return map;
}

/** Attach serialized specs to an array of phone JSON objects (already run through phoneToJSON).
 *  Generic over T so callers preserve their own phone JSON type.
 *  Used by listing endpoints and fetch-home-data. */
export function attachSpecsToJsonPhones<T extends Record<string, unknown>>(phones: T[], specsMap: Map<string, Record<string, unknown>>): T[] {
  return phones.map(p => {
    const rawSpec = specsMap.get((p.id as string | undefined) || (p._id as { toString(): string } | undefined)?.toString() || '');
    if (rawSpec) {
      return { ...p, specs: serializePhoneSpecs(rawSpec) } as T;
    }
    return p;
  });
}

/** Attach serialized specs to raw Mongoose phone docs (before phoneToJSON).
 *  Used by API listing handlers that call phoneToJSON inside. */
export function attachSpecsToRawPhones(phones: PhoneDocOrJson[], specsMap: Map<string, Record<string, unknown>>): PhoneJson[] {
  return phones.map(p => {
    const json = phoneToJSON(p);
    const rawSpec = specsMap.get((p._id as { toString(): string } | undefined)?.toString() || '');
    if (rawSpec) {
      json.specs = serializePhoneSpecs(rawSpec);
    }
    return json;
  });
}

export function phoneToJSON(p: PhoneDocOrJson, specs?: Record<string, unknown>, benchmarks?: Record<string, unknown>, images?: Record<string, unknown>[], prices?: Record<string, unknown>[]): PhoneJson {
  const obj = p.toObject ? p.toObject() : p;
  const r = obj as RawPhoneObject;
  return {
    id: r._id?.toString(),
    modelName: r.modelName,
    slug: r.slug,
    brandId: r.brandId?.toString(),
    brand: r.brand ? { id: r.brand._id?.toString(), name: r.brand.name, slug: r.brand.slug, logo: r.brand.logo || '' } : undefined,
    thumbnail: r.thumbnail || '',
    pricePKR: r.pricePKR || 0,
    originalPricePKR: r.originalPricePKR || 0,
    description: r.description || '',
    overallRating: r.overallRating || 0,
    cameraScore: r.cameraScore || 0,
    performanceScore: r.performanceScore || 0,
    batteryScore: r.batteryScore || 0,
    displayScore: r.displayScore || 0,
    valueScore: r.valueScore || 0,
    ptaStatus: r.ptaStatus || 'Unknown',
    ptaApproved: r.ptaApproved || false,
    releaseDate: r.releaseDate || '',
    trending: r.trending || false,
    upcoming: r.upcoming || false,
    featured: r.featured || false,
    pros: r.pros || '',
    cons: r.cons || '',
    reviewSummary: r.reviewSummary || '',
    reviewVerdict: r.reviewVerdict || '',
    published: r.status === 'published',
    // Use the shared serializer for full specs (detail page path)
    specs: specs ? serializePhoneSpecs(specs) : undefined,
    benchmarks: benchmarks || undefined,
    images: images?.map((img: Record<string, unknown>) => ({ id: (img._id as { toString(): string } | undefined)?.toString(), url: img.url as string, altText: img.altText as string, sortOrder: img.sortOrder as number })) || [],
    prices: prices?.map((pr: Record<string, unknown>) => ({ id: (pr._id as { toString(): string } | undefined)?.toString(), storeName: pr.storeName as string, price: pr.price as number, url: pr.url as string, inStock: pr.inStock as boolean })) || [],
    // Price tracking
    priceMode: r.priceMode || 'manual',
    manualLock: r.manualLock || false,
    manualLockReason: r.manualLockReason || '',
    sourceUrl: r.sourceUrl || '',
  };
}