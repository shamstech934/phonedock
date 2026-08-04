import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { Admin, ActivityLog } from '@/lib/models';
import { recordSecurityEvent } from '@/lib/security-events';
import {
  connectDB, getAdminFromRequest, isEmailConfigured, getClientIp,
  verifyPassword, hashPassword, createSignedSession, getSessionFromRequest, validateSessionVersion,
  validateSessionRecord, revokeSession, revokeAllSessions, revokeOtherSessions, getActiveSessions,
  persistSessionRecord,
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
    // Fail-closed AdminSession record check
    const recordCheck = await validateSessionRecord(session.jti);
    if (!recordCheck.valid) {
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
          sessionVersion: (admin as unknown as { sessionVersion?: number }).sessionVersion ?? 0,
        });
        response.cookies.set('pd_session', newSession.token, newSession.cookieOptions);
        // Persist the rotated session record
        await persistSessionRecord(admin._id.toString(), newSession.jti, getClientIp(req), req.headers.get('user-agent')?.slice(0, 200) || '');
      }
    }

    return response;
  }

  // ---- /api/admin/sessions (GET — list active sessions) ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'sessions') {
    await connectDB();
    const authResult = await getAdminFromRequest(req);
    if (authResult.error) return authResult.error;
    const admin = authResult.admin!;

    const currentJti = (await getSessionFromRequest(req))?.jti || '';
    const sessions = await getActiveSessions(admin._id.toString());

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: s._id?.toString(),
        jti: s.tokenJti,
        ip: s.ip || '',
        userAgent: (s.userAgent || '').slice(0, 120),
        lastUsedAt: s.lastUsedAt,
        createdAt: s.createdAt,
        isCurrent: s.tokenJti === currentJti,
      })),
    });
  }

  return undefined;
}

// ============ ADMIN AUTH POST ============

export async function handleAdminAuthPost(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
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
    // Fail-closed AdminSession record check
    const recordCheck = await validateSessionRecord(session.jti);
    if (!recordCheck.valid) {
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
    const requestIp = getClientIp(req);
    const requestUa = req.headers.get('user-agent')?.slice(0, 200) || '';

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }
    // Bound input sizes before bcrypt/database work to reduce abuse and accidental oversized payloads.
    if (email.length > 254 || password.length > 128 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      await recordSecurityEvent({ action: 'login_rejected', ip: requestIp, userAgent: requestUa, reason: 'invalid_input' });
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const admin = await Admin.findOne({ email }).select('+password +failedAttempts +lockedUntil +sessionVersion');

    // Check rate limit for existing accounts; always return 401 for non-existent
    // to prevent account enumeration (same response regardless of email existence)
    if (!admin) {
      await recordSecurityEvent({ action: 'login_failed', ip: requestIp, userAgent: requestUa, reason: 'invalid_credentials' });
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // DB-backed rate limiting (only reached when admin exists — no info leak)
    const rateCheck = checkLoginRateLimitFromDB(admin);
    if (!rateCheck.allowed) {
      await recordSecurityEvent({ action: 'login_blocked', adminId: admin._id, ip: requestIp, userAgent: requestUa, reason: 'account_lockout' });
      // Return 401 (not 429) to avoid revealing account existence via status code
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (!admin.active) {
      await recordSecurityEvent({ action: 'login_blocked', adminId: admin._id, ip: requestIp, userAgent: requestUa, reason: 'account_disabled' });
      // Return same 401 message to avoid revealing account exists but is disabled
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await verifyPassword(password, admin.password);
    if (!valid) {
      recordFailedLoginDB(admin);
      await admin.save();
      await recordSecurityEvent({ action: 'login_failed', adminId: admin._id, ip: requestIp, userAgent: requestUa, reason: 'invalid_credentials' });
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Successful login
    resetFailedAttempts(admin);
    admin.lastLogin = new Date();
    admin.lastLoginIp = requestIp;
    admin.lastLoginUA = requestUa;
    await admin.save();

    const session = await createSignedSession({
      sub: admin._id.toString(),
      email: admin.email,
      role: admin.role,
      sessionVersion: (admin as unknown as { sessionVersion?: number }).sessionVersion ?? 0,
    });

    // Persist before returning the cookie so the first session check cannot race
    // against AdminSession creation and incorrectly reject a valid login.
    await persistSessionRecord(admin._id.toString(), session.jti, requestIp, requestUa);

    // Single cookie — no token in response body
    const response = NextResponse.json({
      success: true,
      admin: { id: admin._id.toString(), email: admin.email, name: admin.name, role: admin.role },
    });
    response.cookies.set('pd_session', session.token, session.cookieOptions);


    try { await ActivityLog.create({ adminId: admin._id, action: 'login', details: 'Admin logged in', entityType: 'admin' }); } catch (e) { console.error('[ActivityLog]', e); }
    await recordSecurityEvent({ action: 'login_success', adminId: admin._id, ip: requestIp, userAgent: requestUa });
    return response;
  }

  // ---- /api/admin/logout ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'logout') {
    const session = await getSessionFromRequest(req);
    if (session?.jti) {
      // Revoke the specific session record
      await revokeSession(session.jti);
    }
    const response = NextResponse.json({ success: true });
    response.cookies.set('pd_session', '', { maxAge: 0, path: '/' });
    return response;
  }

  // ---- /api/admin/change-password ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'change-password') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const body = await req.json();
    const { currentPassword, newPassword } = body;
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current and new password required' }, { status: 400 });
    }
    if (String(currentPassword).length > 128 || String(newPassword).length > 128) {
      return NextResponse.json({ error: 'Password input is too long' }, { status: 400 });
    }
    const pwCheck = isStrongPassword(String(newPassword));
    if (!pwCheck.valid) {
      return NextResponse.json({ error: `Weak password: ${pwCheck.errors.join(', ')}` }, { status: 400 });
    }
    const adminFull = await Admin.findById(admin._id).select('+password');
    if (!adminFull) return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    const valid = await verifyPassword(currentPassword, adminFull.password);
    if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    adminFull.password = await hashPassword(newPassword);
    adminFull.passwordChangedAt = new Date();
    // Increment sessionVersion to invalidate ALL existing sessions (safety net)
    await Admin.findByIdAndUpdate(admin._id, {
      $set: { password: adminFull.password, passwordChangedAt: new Date() },
      $inc: { sessionVersion: 1 },
    });
    // Also revoke all AdminSession records for this admin
    await revokeAllSessions(admin._id.toString());
    // Clear the cookie so user must re-login
    const response = NextResponse.json({ success: true, message: 'Password changed. Please log in again.' });
    response.cookies.set('pd_session', '', { maxAge: 0, path: '/' });
    try { await ActivityLog.create({ adminId: admin._id, action: 'change_password', details: 'Password changed', entityType: 'admin' }); } catch (e) { console.error('[ActivityLog]', e); }
    return response;
  }

  // ---- /api/admin/forgot-password ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'forgot-password') {
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
      // Send reset email with the raw token
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.APP_URL || '';
      const resetLink = `${baseUrl}/admin/reset-password?token=${rawToken}`;
      try {
        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.createTransport({
          host: process.env.EMAIL_HOST,
          port: parseInt(process.env.EMAIL_PORT || '587'),
          secure: parseInt(process.env.EMAIL_PORT || '587') === 465,
          auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        });
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: admin.email,
          subject: 'PhoneDock — Password Reset',
          html: `<p>You requested a password reset.</p><p>Click <a href="${resetLink}">here</a> to reset your password. This link expires in 30 minutes.</p><p>If you didn't request this, ignore this email.</p>`,
        });
      } catch (emailErr: unknown) {
        console.error('[ForgotPassword] Email send failed:', emailErr instanceof Error ? emailErr.message : String(emailErr));
        // Don't expose email failure to user — prevents revealing which emails exist
      }
    }
    return NextResponse.json({ success: true, message: 'If an account exists, a reset link will be sent.' });
  }

  // ---- /api/admin/reset-password (token-based) ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'reset-password') {
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
    // Also revoke all AdminSession records for this admin
    await revokeAllSessions(admin._id.toString());

    try { await ActivityLog.create({ adminId: admin._id, action: 'reset_password', details: 'Password reset via token', entityType: 'admin' }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, message: 'Password reset. Please log in.' });
  }

  return undefined;
}

// ============ ADMIN AUTH DELETE ============

export async function handleAdminAuthDelete(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- DELETE /api/admin/sessions/:jti — Revoke a specific other session ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'sessions') {
    await connectDB();
    const authResult = await getAdminFromRequest(req);
    if (authResult.error) return authResult.error;
    const admin = authResult.admin!;
    const targetJti = segments[2];
    const currentJti = (await getSessionFromRequest(req))?.jti;

    if (!targetJti) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Cannot revoke own current session via this endpoint — use /api/admin/logout
    if (targetJti === currentJti) {
      return NextResponse.json({ error: 'Cannot revoke your current session. Use /api/admin/logout instead.' }, { status: 400 });
    }

    const revoked = await revokeSession(targetJti);
    if (!revoked) {
      return NextResponse.json({ error: 'Session not found or already revoked' }, { status: 404 });
    }

    try { await ActivityLog.create({ adminId: admin._id, action: 'revoke_session', details: `Revoked session ${targetJti.slice(0, 8)}`, entityType: 'admin' }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, message: 'Session revoked' });
  }

  // ---- DELETE /api/admin/sessions — Revoke ALL other sessions ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'sessions') {
    await connectDB();
    const authResult = await getAdminFromRequest(req);
    if (authResult.error) return authResult.error;
    const admin = authResult.admin!;
    const currentJti = (await getSessionFromRequest(req))?.jti;

    if (!currentJti) {
      return NextResponse.json({ error: 'No active session' }, { status: 401 });
    }

    const count = await revokeOtherSessions(admin._id.toString(), currentJti);

    try { await ActivityLog.create({ adminId: admin._id, action: 'revoke_other_sessions', details: `Revoked ${count} other sessions`, entityType: 'admin' }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, message: `Revoked ${count} other session(s)`, revokedCount: count });
  }

  return undefined;
}