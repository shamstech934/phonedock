import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { Admin, ActivityLog } from '@/lib/models';
import {
  connectDB, getAdminFromRequest, isEmailConfigured,
  verifyPassword, hashPassword, createSignedSession, getSessionFromRequest, validateSessionVersion,
  checkLoginRateLimitFromDB, recordFailedLoginDB, resetFailedAttempts, isStrongPassword, sanitizeInput,
  hashResetToken, verifyResetToken,
} from './helpers';

// ============ ADMIN AUTH GET ============

export async function handleAdminAuthGet(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/admin/session ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'session') {
    await connectDB();
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    const versionCheck = await validateSessionVersion(session.sub, session.sessionVersion ?? 0, Admin);
    if (!versionCheck.valid) {
      const response = NextResponse.json({ authenticated: false }, { status: 401 });
      response.cookies.set('pd_session', '', { maxAge: 0, path: '/' });
      return response;
    }
    const admin = await Admin.findById(session.sub).select('-password -resetTokenHash -resetTokenExpires');
    if (!admin || !admin.active) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // Session rotation: if less than 50% TTL remains, issue new token
    const response = NextResponse.json({
      authenticated: true,
      admin: { id: admin._id.toString(), email: admin.email, name: admin.name, role: admin.role },
    });

    if (session.exp) {
      const remaining = session.exp - Math.floor(Date.now() / 1000);
      const halfTtl = 12 * 3600; // 12 hours (50% of 24h)
      if (remaining < halfTtl && remaining > 0) {
        const newSession = await createSignedSession({
          sub: admin._id.toString(),
          email: admin.email,
          role: admin.role,
          sessionVersion: (admin as any).sessionVersion ?? 0,
        });
        response.cookies.set('pd_session', newSession.token, newSession.cookieOptions);
      }
    }

    return response;
  }

  return undefined;
}

// ============ ADMIN AUTH POST ============

export async function handleAdminAuthPost(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/bootstrap-admin (one-time cloud admin creation) ----
  // SECURITY: Only works if ADMIN_BOOTSTRAP_SECRET env var is set AND matches
  // the x-bootstrap-secret header. Only works when ZERO admins exist.
  // After creating the first admin, delete ADMIN_BOOTSTRAP_SECRET from Vercel env.
  if (segments.length === 1 && segments[0] === 'bootstrap-admin') {
    const bootstrapSecret = process.env.ADMIN_BOOTSTRAP_SECRET;
    const requestSecret = req.headers.get('x-bootstrap-secret');
    if (!bootstrapSecret || !requestSecret || requestSecret.length !== bootstrapSecret.length ||
      !crypto.timingSafeEqual(Buffer.from(requestSecret, 'utf-8'), Buffer.from(bootstrapSecret, 'utf-8'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await connectDB();
    const adminCount = await Admin.countDocuments();
    if (adminCount > 0) {
      return NextResponse.json({ error: 'Admin already exists. This endpoint is disabled.' }, { status: 409 });
    }
    const body = await req.json();
    const { name, email, password } = body;
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'name, email, and password are required' }, { status: 400 });
    }
    const pwCheck = isStrongPassword(password);
    if (!pwCheck.valid) {
      return NextResponse.json({ error: `Weak password: ${pwCheck.errors.join(', ')}` }, { status: 400 });
    }
    const hashed = await hashPassword(password);
    const created = await Admin.create({
      email: email.toLowerCase().trim(),
      name: name.trim(),
      password: hashed,
      role: 'superadmin',
      active: true,
      failedAttempts: 0,
      sessionVersion: 0,
      passwordChangedAt: new Date(),
    });
    return NextResponse.json({ success: true, id: created._id.toString(), email: created.email, role: created.role });
  }

  // ---- /api/admin/session (cookie-based session check) ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'session') {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    const versionCheck = await validateSessionVersion(session.sub, session.sessionVersion ?? 0, Admin);
    if (!versionCheck.valid) {
      const response = NextResponse.json({ authenticated: false }, { status: 401 });
      response.cookies.set('pd_session', '', { maxAge: 0, path: '/' });
      return response;
    }
    const admin = await Admin.findById(session.sub).select('-password -resetTokenHash -resetTokenExpires');
    if (!admin || !admin.active) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    return NextResponse.json({
      authenticated: true,
      admin: { id: admin._id.toString(), email: admin.email, name: admin.name, role: admin.role },
    });
  }

  // ---- /api/admin/login ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'login') {
    const body = await req.json();
    const email = sanitizeInput(String(body.email || '')).toLowerCase();
    const password = String(body.password || '');

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const admin = await Admin.findOne({ email }).select('+password +failedAttempts +lockedUntil +sessionVersion');
    if (!admin) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // DB-backed rate limiting
    const rateCheck = checkLoginRateLimitFromDB(admin);
    if (!rateCheck.allowed) {
      const minsLeft = rateCheck.lockedUntil
        ? Math.ceil((rateCheck.lockedUntil.getTime() - Date.now()) / 60000)
        : 15;
      return NextResponse.json({ error: `Too many login attempts. Try again in ${minsLeft} minutes.` }, { status: 429 });
    }

    if (!admin.active) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await verifyPassword(password, admin.password);
    if (!valid) {
      recordFailedLoginDB(admin);
      await admin.save();
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Successful login
    resetFailedAttempts(admin);
    admin.lastLogin = new Date();
    admin.lastLoginIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
    admin.lastLoginUA = req.headers.get('user-agent')?.slice(0, 200) || '';
    await admin.save();

    const session = await createSignedSession({
      sub: admin._id.toString(),
      email: admin.email,
      role: admin.role,
      sessionVersion: (admin as any).sessionVersion ?? 0,
    });

    // Single cookie — no token in response body
    const response = NextResponse.json({
      success: true,
      admin: { id: admin._id.toString(), email: admin.email, name: admin.name, role: admin.role },
    });
    response.cookies.set('pd_session', session.token, session.cookieOptions);

    try { await ActivityLog.create({ adminId: admin._id, action: 'login', details: 'Admin logged in', entityType: 'admin' }); } catch (e) { console.error('[ActivityLog]', e); }
    return response;
  }

  // ---- /api/admin/logout ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'logout') {
    const session = await getSessionFromRequest(req);
    if (session?.sub) {
      // Increment sessionVersion to invalidate this and all other sessions
      await Admin.findByIdAndUpdate(session.sub, { $inc: { sessionVersion: 1 } }).catch(() => {});
    }
    const response = NextResponse.json({ success: true });
    response.cookies.set('pd_session', '', { maxAge: 0, path: '/' });
    return response;
  }

  // ---- /api/admin/change-password ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'change-password') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const body = await req.json();
    const { currentPassword, newPassword } = body;
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current and new password required' }, { status: 400 });
    }
    const pwCheck = isStrongPassword(newPassword);
    if (!pwCheck.valid) {
      return NextResponse.json({ error: `Weak password: ${pwCheck.errors.join(', ')}` }, { status: 400 });
    }
    const adminFull = await Admin.findById(admin._id).select('+password');
    if (!adminFull) return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    const valid = await verifyPassword(currentPassword, adminFull.password);
    if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    adminFull.password = await hashPassword(newPassword);
    adminFull.passwordChangedAt = new Date();
    // Increment sessionVersion to invalidate ALL existing sessions
    await Admin.findByIdAndUpdate(admin._id, {
      $set: { password: adminFull.password, passwordChangedAt: new Date() },
      $inc: { sessionVersion: 1 },
    });
    // Clear the cookie so user must re-login
    const response = NextResponse.json({ success: true, message: 'Password changed. Please log in again.' });
    response.cookies.set('pd_session', '', { maxAge: 0, path: '/' });
    try { await ActivityLog.create({ adminId: admin._id, action: 'change_password', details: 'Password changed', entityType: 'admin' }); } catch (e) { console.error('[ActivityLog]', e); }
    return response;
  }

  // ---- /api/admin/forgot-password ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'forgot-password') {
    // If email is not configured, return a generic message
    if (!isEmailConfigured()) {
      return NextResponse.json({ success: true, message: 'If an account exists, a reset link will be sent.' });
    }

    const body = await req.json();
    const email = sanitizeInput(String(body.email || '')).toLowerCase();
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    // Always return success to prevent email enumeration
    const admin = await Admin.findOne({ email }).select('+resetTokenHash +resetTokenExpires');
    if (admin) {
      const rawToken = crypto.randomUUID();
      const tokenHash = hashResetToken(rawToken);
      admin.resetTokenHash = tokenHash;
      admin.resetTokenExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 min
      await admin.save();
      // TODO: Send email with reset link containing raw token
      // For now, forgot-password is effectively disabled because no email is sent
      // and the raw token is NEVER logged or returned
    }
    return NextResponse.json({ success: true, message: 'If an account exists, a reset link will be sent.' });
  }

  // ---- /api/admin/reset-password (token-based) ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'reset-password') {
    const body = await req.json();
    const { token, newPassword } = body;
    if (!token || !newPassword) {
      return NextResponse.json({ error: 'Token and new password required' }, { status: 400 });
    }
    const pwCheck = isStrongPassword(newPassword);
    if (!pwCheck.valid) {
      return NextResponse.json({ error: `Weak password: ${pwCheck.errors.join(', ')}` }, { status: 400 });
    }

    const tokenHash = hashResetToken(token);
    const admin = await Admin.findOne({
      resetTokenHash: tokenHash,
      resetTokenExpires: { $gt: new Date() },
    }).select('+password +resetTokenHash +resetTokenExpires +sessionVersion');

    if (!admin) {
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 });
    }

    // One-time usage: clear token, hash new password, increment sessionVersion
    const hashedPassword = await hashPassword(newPassword);
    await Admin.findByIdAndUpdate(admin._id, {
      $set: { password: hashedPassword, passwordChangedAt: new Date(), resetTokenHash: undefined, resetTokenExpires: undefined },
      $inc: { sessionVersion: 1 },
    });

    try { await ActivityLog.create({ adminId: admin._id, action: 'reset_password', details: 'Password reset via token', entityType: 'admin' }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, message: 'Password reset. Please log in.' });
  }

  return undefined;
}