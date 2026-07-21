import { SignJWT, jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';

export const USER_COOKIE = 'pd_user_session';
// Seven days limits exposure while still keeping a practical consumer session.
const MAX_AGE = 60 * 60 * 24 * 7;
const ISSUER = 'phonedock';
const AUDIENCE = 'phonedock-user';
const MAX_TOKEN_LENGTH = 4096;

function secret() {
  const value = process.env.USER_JWT_SECRET || process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new Error('USER_JWT_SECRET or JWT_SECRET must be at least 32 characters');
  return new TextEncoder().encode(value);
}

export function isUserEmailVerificationRequired(): boolean {
  return process.env.REQUIRE_USER_EMAIL_VERIFICATION === 'true';
}

export async function createUserToken(user: { id: string; email: string; name: string; sessionVersion?: number }) {
  return new SignJWT({ email: user.email, name: user.name, type: 'user', sessionVersion: user.sessionVersion ?? 0 })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

export async function readUserToken(token: string) {
  if (!token || token.length > MAX_TOKEN_LENGTH) throw new Error('Invalid user session');
  const { payload, protectedHeader } = await jwtVerify(token, secret(), {
    algorithms: ['HS256'],
    issuer: ISSUER,
    audience: AUDIENCE,
    clockTolerance: 5,
  });
  if (protectedHeader.alg !== 'HS256' || payload.type !== 'user' || !payload.sub) throw new Error('Invalid user session');
  if (!Number.isInteger(payload.sessionVersion) || Number(payload.sessionVersion) < 0) throw new Error('Invalid user session');
  return payload;
}

export async function getUserSession(req: NextRequest) {
  const token = req.cookies.get(USER_COOKIE)?.value;
  if (!token) return null;
  try {
    const payload = await readUserToken(token);
    await connectDB();
    const user = await User.findById(payload.sub).select('status sessionVersion').lean();
    if (!user || user.status !== 'active' || (user.sessionVersion ?? 0) !== Number(payload.sessionVersion)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getUserId(req: NextRequest) {
  return (await getUserSession(req))?.sub || null;
}

export const userCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: MAX_AGE,
};
