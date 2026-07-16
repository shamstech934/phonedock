/**
 * First Superadmin Setup Handler — PhoneDock
 *
 * SECURITY DESIGN:
 *  - One-time only: permanently locks after first superadmin creation
 *  - Requires FIRST_ADMIN_SETUP_KEY env var (never exposed to client)
 *  - Timing-safe key comparison via crypto.timingSafeEqual
 *  - Persistent bootstrap lock in SystemState collection (serverless-safe)
 *  - IP rate limiting: max 5 failed attempts per hour
 *  - Zod validation on all inputs
 *  - bcrypt with cost factor 12 for password hashing
 *  - 14-char minimum password with complexity rules
 *  - Common password rejection
 *  - Audit logging for success and failure
 *  - Generic error messages (no information leakage)
 *  - HttpOnly, Secure, SameSite=Strict auth cookie
 *  - MongoDB transaction where supported
 *  - CSRF: Origin header + setup key both required
 *  - Request body size limit enforced by route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { Admin, ActivityLog, RateLimit, SystemState } from '@/lib/models';
import {
  connectDB,
  checkIpRateLimit,
  getClientIp,
  hashPassword,
  createSignedSession,
  sanitizeInput,
} from './helpers';

// ============ CONSTANTS ============

const SETUP_RATE_LIMIT_KEY = 'first_setup:';
const SETUP_MAX_ATTEMPTS_PER_HOUR = 5;
const SETUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MIN_PASSWORD_LENGTH = 14;
const MAX_NAME_LENGTH = 100;

// Commonly used passwords — rejection list (subset of well-known lists)
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwerty', 'abc123', 'letmein', 'welcome', 'monkey', 'dragon', 'master',
  'login', 'princess', 'admin', 'admin123', 'root', 'toor', 'passw0rd',
  'iloveyou', 'trustno1', 'sunshine', 'football', 'baseball', 'shadow',
  'michael', 'jennifer', 'hunter', 'hunter2', 'buster', 'joshua', 'pepper',
  'whatever', 'donald', 'batman', 'access', 'hello', 'charlie', 'superman',
  'qwerty123', 'password!', 'p@ssword', 'p@ssw0rd', 'pass1234', 'test1234',
  'changeme', 'secret', 'secret123', 'Pa$$w0rd', 'P@ssw0rd', 'P@ssword1',
]);

// ============ ZOD SCHEMAS ============

const setupSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(MAX_NAME_LENGTH, `Name must be under ${MAX_NAME_LENGTH} characters`)
    .transform(v => sanitizeInput(v).trim()),
  email: z.string()
    .email('Invalid email address')
    .max(200, 'Email too long')
    .transform(v => v.toLowerCase().trim()),
  password: z.string()
    .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    .max(128, 'Password too long'),
  confirmPassword: z.string()
    .min(1, 'Please confirm your password'),
  setupKey: z.string()
    .min(1, 'Setup key is required')
    .max(256, 'Setup key too long'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// ============ HELPERS ============

/** Check if the setup is still available (no superadmin exists + no bootstrap lock) */
async function isSetupAvailable(): Promise<boolean> {
  try {
    // Check bootstrap lock first (fast path)
    const lock = await SystemState.findOne({ key: 'first_superadmin_created' }).lean();
    if (lock && lock.completed) return false;

    // Check if any superadmin exists
    const superadminCount = await Admin.countDocuments({ role: 'superadmin' });
    return superadminCount === 0;
  } catch {
    // FAIL CLOSED: if DB check fails, deny access
    return false;
  }
}

/** Validate password strength (beyond Zod length check) */
function validatePasswordStrength(password: string): string | null {
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain a number';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain a special character';
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return 'This password is too common. Choose a stronger one.';
  return null;
}

/** Timing-safe comparison of the setup key */
function safeCompareSetupKey(input: string, expected: string): boolean {
  try {
    const inputBuf = Buffer.from(input, 'utf8');
    const expectedBuf = Buffer.from(expected, 'utf8');
    if (inputBuf.length !== expectedBuf.length) {
      // Still do a full comparison to avoid timing leak on length
      crypto.timingSafeEqual(inputBuf, inputBuf);
      return false;
    }
    return crypto.timingSafeEqual(inputBuf, expectedBuf);
  } catch {
    return false;
  }
}

/** Log audit event (non-blocking, errors swallowed) */
async function logAudit(details: string, success: boolean): Promise<void> {
  try {
    await ActivityLog.create({
      action: success ? 'first_setup_success' : 'first_setup_attempt',
      details,
      entityType: 'system',
    });
    // Note: adminId is intentionally not set for failed attempts (no admin exists yet)
  } catch {
    // Audit log failure should never block the main flow
  }
}

// ============ GET HANDLER ============
// Returns whether setup is available — used by the frontend to show/hide the form

export async function handleFirstSetupGet(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'first-setup' && segments[2] === 'status') {
    await connectDB();
    const available = await isSetupAvailable();

    if (!available) {
      // Return 404 — do NOT reveal why (don't expose account info)
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ setupAvailable: true });
  }

  return undefined;
}

// ============ POST HANDLER ============

export async function handleFirstSetupPost(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // Match: /api/admin/first-setup
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'first-setup') {
    // ---- GATE: Check if FIRST_ADMIN_SETUP_KEY env var exists ----
    const expectedKey = process.env.FIRST_ADMIN_SETUP_KEY;
    if (!expectedKey) {
      // Don't reveal that the key is missing — return 404
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // ---- GATE: Rate limiting (5 attempts per hour per IP) ----
    const ip = getClientIp(req);
    if (!await checkIpRateLimit(`${SETUP_RATE_LIMIT_KEY}${ip}`, SETUP_MAX_ATTEMPTS_PER_HOUR, SETUP_WINDOW_MS, RateLimit)) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    }

    // ---- GATE: Check if setup is still available ----
    await connectDB();
    const available = await isSetupAvailable();
    if (!available) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // ---- GATE: Content-Type check (basic CSRF protection) ----
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // ---- GATE: Origin/Referer check (CSRF) ----
    const origin = req.headers.get('origin') || '';
    const referer = req.headers.get('referer') || '';
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_BASE_URL,
      'https://phonedock.pk',
      'https://phonedock-pi.vercel.app',
    ].filter(Boolean) as string[];

    const originOk = allowedOrigins.some(o => origin === o);
    const refererOk = allowedOrigins.some(o => referer.startsWith(o));

    // In development, allow localhost origins
    const isDev = process.env.NODE_ENV !== 'production';
    const devOriginOk = isDev && (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1'));

    if (!originOk && !refererOk && !devOriginOk) {
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    }

    // ---- PARSE & VALIDATE BODY ----
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // Zod validation
    const parseResult = setupSchema.safeParse(body);
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0];
      return NextResponse.json({
        error: firstError?.message || 'Validation failed',
      }, { status: 400 });
    }

    const { name, email, password, setupKey } = parseResult.data;

    // ---- GATE: Timing-safe setup key comparison ----
    if (!safeCompareSetupKey(setupKey, expectedKey)) {
      // Log failed attempt (without revealing key details)
      await logAudit(`Failed setup attempt — invalid setup key`, false);
      return NextResponse.json({ error: 'Invalid setup key or setup is not available' }, { status: 403 });
    }

    // ---- VALIDATE PASSWORD STRENGTH ----
    const pwError = validatePasswordStrength(password);
    if (pwError) {
      return NextResponse.json({ error: pwError }, { status: 400 });
    }

    // ---- CHECK DUPLICATE EMAIL ----
    const existingAdmin = await Admin.findOne({ email }).select('_id').lean();
    if (existingAdmin) {
      // Generic error — don't reveal that the email exists
      return NextResponse.json({ error: 'Unable to create account. Please try different details.' }, { status: 400 });
    }

    // ---- CREATE SUPERADMIN + BOOTSTRAP LOCK ----
    try {
      const hashedPassword = await hashPassword(password);

      // Use MongoDB session/transaction if supported
      const session = await Admin.startSession();
      let createdAdmin: any = null;

      try {
        await session.withTransaction(async () => {
          // Double-check inside transaction: no superadmin exists
          const count = await Admin.countDocuments({ role: 'superadmin' }).session(session);
          if (count > 0) {
            throw new Error('SETUP_ALREADY_DONE');
          }

          // Double-check bootstrap lock
          const lock = await SystemState.findOne({ key: 'first_superadmin_created' }).session(session).lean();
          if (lock && lock.completed) {
            throw new Error('SETUP_ALREADY_DONE');
          }

          // Create the superadmin
          createdAdmin = await Admin.create([{
            email,
            name,
            password: hashedPassword as string,
            role: 'superadmin',
            active: true,
            emailVerified: true, // Owner bootstrap — pre-verified
            failedAttempts: 0,
            sessionVersion: 0,
            passwordChangedAt: new Date(),
          }], { session });

          createdAdmin = createdAdmin[0];

          // Create bootstrap lock
          await SystemState.create([{
            key: 'first_superadmin_created',
            completed: true,
            completedAt: new Date(),
            completedByAdminId: createdAdmin._id,
            metadata: { email: createdAdmin.email },
          }], { session });
        });
      } finally {
        await session.endSession();
      }

      if (!createdAdmin) {
        return NextResponse.json({ error: 'Setup failed. Please try again.' }, { status: 500 });
      }

      // ---- AUDIT LOG (success) ----
      await logAudit(`First superadmin created`, true);

      // ---- CREATE AUTHENTICATED SESSION ----
      const signedSession = await createSignedSession({
        sub: createdAdmin._id.toString(),
        email: createdAdmin.email,
        role: 'superadmin',
        sessionVersion: 0,
      });

      const response = NextResponse.json({
        success: true,
        message: 'Superadmin created. Remove FIRST_ADMIN_SETUP_KEY from Vercel and redeploy.',
        admin: {
          id: createdAdmin._id.toString(),
          email: createdAdmin.email,
          name: createdAdmin.name,
          role: 'superadmin',
        },
      });

      // Set HttpOnly, Secure, SameSite=Strict cookie
      response.cookies.set('pd_session', signedSession.token, signedSession.cookieOptions);

      return response;
    } catch (err: any) {
      // Handle transaction abort (duplicate superadmin race condition)
      if (err.message === 'SETUP_ALREADY_DONE') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      // Handle MongoDB duplicate key error
      if (err.code === 11000) {
        return NextResponse.json({ error: 'Unable to create account. Please try different details.' }, { status: 400 });
      }

      // Log the error without sensitive details
      console.error('[FirstSetup] Error:', (err as Error).message?.slice(0, 100));
      await logAudit('Setup failed: internal error', false);

      return NextResponse.json({ error: 'An error occurred. Please try again.' }, { status: 500 });
    }
  }

  return undefined;
}