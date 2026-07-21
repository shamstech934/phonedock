import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { createUserToken, isUserEmailVerificationRequired, USER_COOKIE, userCookieOptions } from '@/lib/user-auth';
import { recordSecurityEvent } from '@/lib/security-events';
import { enforceUserAuthRateLimit, getRequestSecurityContext } from '@/lib/user-security';

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160).transform(v => v.toLowerCase()),
  password: z.string().min(8).max(128).regex(/[A-Za-z]/).regex(/[0-9]/),
});

export async function POST(req: NextRequest) {
  const { ip, userAgent } = getRequestSecurityContext(req);
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Please enter a valid name, email and a password with at least 8 characters including a number.' }, { status: 400 });
    await connectDB();
    const allowed = await enforceUserAuthRateLimit({ action: 'signup', email: parsed.data.email, ip, userAgent });
    if (!allowed) {
      return NextResponse.json({ error: 'Too many account creation attempts. Please try again later.' }, { status: 429, headers: { 'Retry-After': '3600' } });
    }
    const exists = await User.exists({ email: parsed.data.email });
    if (exists) return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await User.create({ name: parsed.data.name, email: parsed.data.email, passwordHash });
    const requiresEmailVerification = isUserEmailVerificationRequired();
    const res = NextResponse.json({
      user: { id: String(user._id), name: user.name, email: user.email },
      requiresEmailVerification,
    }, { status: 201 });
    if (!requiresEmailVerification) {
      const token = await createUserToken({ id: String(user._id), email: user.email, name: user.name, sessionVersion: user.sessionVersion ?? 0 });
      res.cookies.set(USER_COOKIE, token, userCookieOptions);
    }
    await recordSecurityEvent({ action: 'user_signup_success', ip, userAgent });
    return res;
  } catch (error) {
    console.error('Account signup failed:', error);
    return NextResponse.json({ error: 'Unable to create account right now.' }, { status: 500 });
  }
}
