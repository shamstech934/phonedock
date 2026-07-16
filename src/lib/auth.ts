/**
 * Production Authentication System — PhoneDock
 *
 * SECURITY DESIGN (simplified single-cookie architecture):
 *  - Single signed HttpOnly session cookie (pd_session)
 *  - JWT contains: sub, email, role, jti, sessionVersion
 *  - Session revocation via sessionVersion on Admin model (serverless-safe)
 *  - Login rate limiting: DB-backed (Admin.failedAttempts + Admin.lockedUntil)
 *  - IP rate limiting: MongoDB-backed (RateLimit collection with TTL)
 *  - No localStorage tokens, no access/refresh token split
 *  - No in-memory Maps for serverless compatibility
 *  - Session rotation: silent re-issue when < 50% TTL remains
 */

import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

// ============ CONFIGURATION ============

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required but not set.');
  }
  return new TextEncoder().encode(secret);
}

const SESSION_MAX_AGE = 24 * 60 * 60; // 24 hours in seconds

// ============ TOKEN TYPES ============

export interface TokenPayload {
  sub: string;         // admin id
  email: string;
  role: string;
  jti: string;         // unique session id
  sessionVersion: number;
  iat?: number;
  exp?: number;
}

// ============ PASSWORD UTILITIES ============

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Strong password validation */
export function isStrongPassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 12) errors.push('at least 12 characters');
  if (!/[A-Z]/.test(password)) errors.push('one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('one number');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('one special character');
  return { valid: errors.length === 0, errors };
}

// ============ JWT SIGNING & VERIFICATION ============

export async function signSessionToken(payload: { sub: string; email: string; role: string; sessionVersion: number }): Promise<{ token: string; jti: string }> {
  const jti = crypto.randomUUID();
  const token = await new SignJWT({
    sub: payload.sub,
    email: payload.email,
    role: payload.role,
    jti,
    sessionVersion: payload.sessionVersion,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .setJti(jti)
    .sign(getSecretKey());

  return { token, jti };
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

// ============ SESSION MANAGEMENT ============

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
  maxAge: number;
}

export function getCookieOptions(): CookieOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  };
}

/** Create a signed session for an admin — returns token + jti + cookie options */
export async function createSignedSession(admin: {
  sub: string;
  email: string;
  role: string;
  sessionVersion?: number;
}): Promise<{ token: string; jti: string; cookieOptions: CookieOptions }> {
  const { token, jti } = await signSessionToken({
    sub: admin.sub,
    email: admin.email,
    role: admin.role,
    sessionVersion: admin.sessionVersion ?? 0,
  });

  return { token, jti, cookieOptions: getCookieOptions() };
}

// ============ SESSION EXTRACTION FROM REQUEST ============

/** Extract and verify session from pd_session cookie */
export async function getSessionFromRequest(req: NextRequest): Promise<TokenPayload | null> {
  const sessionToken = req.cookies.get('pd_session')?.value;
  if (!sessionToken) return null;

  const payload = await verifyToken(sessionToken);
  if (!payload) return null;

  return payload;
}



// ============ SESSION VERSION CHECK (FAIL-CLOSED) ============
// Compares token's sessionVersion with the admin's current sessionVersion in DB.
// If DB check fails → REJECTS the session (fail-closed, never allows on error).

export async function validateSessionVersion(
  adminId: string,
  tokenSessionVersion: number,
  AdminModel: any,
): Promise<{ valid: boolean; currentVersion?: number; error?: string }> {
  try {
    const admin = await AdminModel.findById(adminId)
      .select('sessionVersion active')
      .lean();

    if (!admin) {
      return { valid: false, error: 'Admin not found' };
    }

    if (!admin.active) {
      return { valid: false, error: 'Account disabled' };
    }

    const currentVersion = (admin as any).sessionVersion ?? 0;
    if (tokenSessionVersion < currentVersion) {
      return { valid: false, currentVersion, error: 'Session version mismatch (password changed or sessions revoked)' };
    }

    return { valid: true, currentVersion };
  } catch (err: any) {
    // FAIL CLOSED: on any DB error, reject the session
    return { valid: false, error: 'Session validation failed' };
  }
}

// ============ LOGIN RATE LIMITING (DB-BACKED) ============

export interface RateLimitCheck {
  allowed: boolean;
  lockedUntil?: Date;
  attemptsRemaining: number;
}

/** Check login rate limit from DB-stored admin record */
export function checkLoginRateLimitFromDB(admin: any): RateLimitCheck {
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

  // If lockout has expired, reset the counter so the user can try again
  if (admin.lockedUntil && new Date(admin.lockedUntil) <= new Date()) {
    admin.failedAttempts = 0;
    admin.lockedUntil = null;
  }

  if (admin.lockedUntil && new Date(admin.lockedUntil) > new Date()) {
    return { allowed: false, lockedUntil: new Date(admin.lockedUntil), attemptsRemaining: 0 };
  }

  const remaining = MAX_ATTEMPTS - (admin.failedAttempts || 0);
  return { allowed: remaining > 0, attemptsRemaining: Math.max(0, remaining) };
}

/** Record failed login attempt — returns true if account is now locked */
export function recordFailedLoginDB(admin: any): boolean {
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MS = 15 * 60 * 1000;

  admin.failedAttempts = (admin.failedAttempts || 0) + 1;

  if (admin.lockedUntil && new Date(admin.lockedUntil) <= new Date()) {
    admin.failedAttempts = 1;
    admin.lockedUntil = null;
  }

  if (admin.failedAttempts >= MAX_ATTEMPTS) {
    admin.lockedUntil = new Date(Date.now() + LOCKOUT_MS);
    return true;
  }

  return false;
}

/** Reset failed attempts on successful login */
export function resetFailedAttempts(admin: any): void {
  admin.failedAttempts = 0;
  admin.lockedUntil = null;
}

// ============ IP RATE LIMITING (MONGODB-BACKED) ============
// Uses RateLimit collection with TTL — works on serverless, no in-memory Map

export async function checkIpRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  RateLimitModel: any,
): Promise<boolean> {
  try {
    const now = new Date();

    // Step 1: Try to increment an existing non-expired doc
    const existing = await RateLimitModel.findOneAndUpdate(
      { key, expiresAt: { $gt: now } },
      { $inc: { count: 1 } },
      { new: true, lean: true },
    );

    if (existing) {
      // Found a valid window entry — check count
      return (existing as any).count <= limit;
    }

    // Step 2: No valid window doc. Upsert by KEY ALONE so the unique index
    // always matches (never a duplicate insert). Reset count to 1.
    const result = await RateLimitModel.findOneAndUpdate(
      { key },
      { $set: { count: 1, expiresAt: new Date(now.getTime() + windowMs) } },
      { upsert: true, new: true, lean: true },
    );

    return (result as any).count <= limit;
  } catch {
    // FAIL CLOSED: on DB error, reject the request
    return false;
  }
}

// ============ RESET TOKEN UTILITIES ============

/** Hash a reset token for storage — never store raw token */
export function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Verify a reset token against its stored hash */
export function verifyResetToken(rawToken: string, storedHash: string): boolean {
  const computedHash = hashResetToken(rawToken);
  return crypto.timingSafeEqual(
    Buffer.from(computedHash, 'hex'),
    Buffer.from(storedHash, 'hex'),
  );
}

// ============ INPUT SANITIZATION ============

export function sanitizeInput(str: string): string {
  let sanitized = str.trim();
  if (sanitized.length > 500) {
    sanitized = sanitized.slice(0, 500);
  }
  // Strip HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  return sanitized;
}

// ============ CSV FORMULA INJECTION PROTECTION ============

/** Sanitize CSV cell values to prevent formula injection */
export function sanitizeCsvValue(value: string): string {
  if (!value) return value;
  const trimmed = value.trim();
  const dangerous = ['=', '+', '-', '@', "\t", "\r"];
  if (dangerous.includes(trimmed[0])) {
    return "'" + trimmed; // Prefix with single quote to neutralize formula
  }
  return value;
}