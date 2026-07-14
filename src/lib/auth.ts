import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';

// ============ CONFIGURATION ============

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required but not set.');
}

const secretKey = new TextEncoder().encode(JWT_SECRET);

// ============ TOKEN TYPES ============

export interface TokenPayload {
  sub: string;       // admin id
  email: string;
  role: string;
  jti: string;       // unique token id
  type: 'access' | 'refresh';
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

// ============ JWT SIGNING & VERIFICATION ============

export async function signAccessToken(payload: Omit<TokenPayload, 'type' | 'iat' | 'exp'>): Promise<string> {
  return new SignJWT({ ...payload, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .setJti(payload.jti)
    .sign(secretKey);
}

export async function signRefreshToken(payload: Omit<TokenPayload, 'type' | 'iat' | 'exp'>): Promise<string> {
  return new SignJWT({ ...payload, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .setJti(payload.jti)
    .sign(secretKey);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

// ============ SESSION MANAGEMENT ============

export interface SessionResult {
  accessToken: string;
  refreshToken: string;
  cookieOptions: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'lax' | 'strict' | 'none';
    path: string;
    maxAge: number;
  };
}

export function createSession(admin: { sub: string; email: string; role: string }): SessionResult {
  const jti = crypto.randomUUID();
  const payload = { sub: admin.sub, email: admin.email, role: admin.role, jti };

  // Synchronous generation not possible with jose — we'll use async versions
  // This is a factory; the actual signing is done asynchronously
  // We return the payload so callers can sign
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    accessToken: '', // will be filled by caller
    refreshToken: '', // will be filled by caller
    cookieOptions: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    },
    // Include raw payload for async signing
  } as any;
}

/** Create a fully signed session (async) */
export async function createSignedSession(admin: { sub: string; email: string; role: string }): Promise<{
  accessToken: string;
  refreshToken: string;
  cookieOptions: SessionResult['cookieOptions'];
}> {
  const jti = crypto.randomUUID();
  const payload = { sub: admin.sub, email: admin.email, role: admin.role, jti };
  const isProduction = process.env.NODE_ENV === 'production';

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(payload),
    signRefreshToken(payload),
  ]);

  return {
    accessToken,
    refreshToken,
    cookieOptions: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    },
  };
}

// ============ SESSION EXTRACTION FROM REQUEST ============

export function getAuthSession(req: NextRequest): TokenPayload | null {
  // 1. Check Authorization header for access token
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    // Synchronous verification not possible with jose — return null here
    // The caller should use verifyToken() for full verification
    // For the middleware pattern, we'll verify synchronously where possible
    return null; // Must use async verifyToken
  }

  // 2. Check refresh token cookie (for fallback)
  const refreshToken = req.cookies.get('pd_refresh')?.value;
  if (refreshToken) {
    return null; // Must use async verifyToken
  }

  return null;
}

/** Async version: extracts and verifies session from request */
export async function getAuthSessionAsync(req: NextRequest): Promise<TokenPayload | null> {
  // 1. Check Authorization header for access token
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = await verifyToken(token);
    if (payload && payload.type === 'access') {
      return payload;
    }
  }

  // 2. Check refresh token cookie (for fallback)
  const refreshToken = req.cookies.get('pd_refresh')?.value;
  if (refreshToken) {
    const payload = await verifyToken(refreshToken);
    if (payload && payload.type === 'refresh') {
      return payload;
    }
  }

  return null;
}

// ============ SESSION REVOCATION (in-memory) ============

const revokedTokens = new Map<string, number>(); // jti -> revoke timestamp
const REVOCATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Revoke a session by its jti */
export function revokeSession(jti: string): void {
  revokedTokens.set(jti, Date.now());
}

/** Check if a session's jti is revoked */
export function isRevoked(jti: string): boolean {
  const ts = revokedTokens.get(jti);
  if (!ts) return false;
  if (Date.now() - ts > REVOCATION_TTL_MS) {
    revokedTokens.delete(jti);
    return false;
  }
  return true;
}

// Periodically clean up expired revocations
setInterval(() => {
  const now = Date.now();
  for (const [jti, ts] of revokedTokens) {
    if (now - ts > REVOCATION_TTL_MS) {
      revokedTokens.delete(jti);
    }
  }
}, 60 * 60 * 1000).unref();

// ============ LOGIN RATE LIMITING (in-memory) ============

interface RateLimitEntry {
  attempts: number;
  lastAttempt: Date;
  lockedUntil?: Date;
}

const loginRateLimits = new Map<string, RateLimitEntry>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // Reset attempts after 15 min of inactivity

export function checkLoginRateLimit(email: string): { allowed: boolean; lockedUntil?: Date; attemptsRemaining: number } {
  const entry = loginRateLimits.get(email.toLowerCase());
  const now = new Date();

  if (!entry) {
    return { allowed: true, attemptsRemaining: MAX_LOGIN_ATTEMPTS };
  }

  // Check if locked out
  if (entry.lockedUntil && new Date(entry.lockedUntil) > now) {
    return { allowed: false, lockedUntil: new Date(entry.lockedUntil), attemptsRemaining: 0 };
  }

  // If lockout expired, reset
  if (entry.lockedUntil && new Date(entry.lockedUntil) <= now) {
    loginRateLimits.delete(email.toLowerCase());
    return { allowed: true, attemptsRemaining: MAX_LOGIN_ATTEMPTS };
  }

  // Reset attempts if window expired
  if (now.getTime() - entry.lastAttempt.getTime() > ATTEMPT_WINDOW_MS) {
    loginRateLimits.delete(email.toLowerCase());
    return { allowed: true, attemptsRemaining: MAX_LOGIN_ATTEMPTS };
  }

  const remaining = MAX_LOGIN_ATTEMPTS - entry.attempts;
  return { allowed: remaining > 0, attemptsRemaining: Math.max(0, remaining) };
}

export function recordFailedLogin(email: string): { locked: boolean; lockedUntil?: Date } {
  const key = email.toLowerCase();
  const entry = loginRateLimits.get(key) || { attempts: 0, lastAttempt: new Date() };
  entry.attempts += 1;
  entry.lastAttempt = new Date();

  if (entry.attempts >= MAX_LOGIN_ATTEMPTS) {
    entry.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    loginRateLimits.set(key, entry);
    return { locked: true, lockedUntil: new Date(entry.lockedUntil) };
  }

  loginRateLimits.set(key, entry);
  return { locked: false };
}

export function resetLoginRateLimit(email: string): void {
  loginRateLimits.delete(email.toLowerCase());
}

// ============ INPUT SANITIZATION ============

export function sanitizeInput(str: string): string {
  // Trim whitespace
  let sanitized = str.trim();
  // Limit length to 500 characters
  if (sanitized.length > 500) {
    sanitized = sanitized.slice(0, 500);
  }
  // Strip HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  return sanitized;
}