import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { createUserToken, isUserEmailVerificationRequired, USER_COOKIE, userCookieOptions } from '@/lib/user-auth';
import { recordSecurityEvent } from '@/lib/security-events';
import { enforceUserAuthRateLimit, getRequestSecurityContext } from '@/lib/user-security';

const schema = z.object({ email: z.string().trim().email().transform(v => v.toLowerCase()), password: z.string().min(1).max(128) });

export async function POST(req: NextRequest) {
  const { ip, userAgent } = getRequestSecurityContext(req);
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid email or password.' }, { status: 400 });
    await connectDB();
    const allowed = await enforceUserAuthRateLimit({ action: 'login', email: parsed.data.email, ip, userAgent });
    if (!allowed) {
      return NextResponse.json({ error: 'Too many sign-in attempts. Please try again later.' }, { status: 429, headers: { 'Retry-After': '900' } });
    }
    const user = await User.findOne({ email: parsed.data.email }).select('+passwordHash');
    if (!user || user.status !== 'active' || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      await recordSecurityEvent({ action: 'user_login_failed', ip, userAgent, reason: 'invalid_credentials' });
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }
    if (isUserEmailVerificationRequired() && !user.emailVerified) {
      await recordSecurityEvent({ action: 'user_login_unverified', ip, userAgent, reason: 'email_not_verified' });
      return NextResponse.json({ error: 'Please verify your email before signing in.', code: 'EMAIL_VERIFICATION_REQUIRED' }, { status: 403 });
    }
    user.lastLoginAt = new Date();
    await user.save();
    const token = await createUserToken({ id: String(user._id), email: user.email, name: user.name, sessionVersion: user.sessionVersion ?? 0 });
    const res = NextResponse.json({ user: { id: String(user._id), name: user.name, email: user.email } });
    res.cookies.set(USER_COOKIE, token, userCookieOptions);
    await recordSecurityEvent({ action: 'user_login_success', ip, userAgent });
    return res;
  } catch (error) {
    console.error('Account login failed:', error);
    return NextResponse.json({ error: 'Unable to sign in right now.' }, { status: 500 });
  }
}
