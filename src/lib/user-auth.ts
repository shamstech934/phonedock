import { SignJWT, jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';

export const USER_COOKIE = 'pd_user_session';
const MAX_AGE = 60 * 60 * 24 * 30;

function secret() {
  const value = process.env.USER_JWT_SECRET || process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new Error('USER_JWT_SECRET or JWT_SECRET must be at least 32 characters');
  return new TextEncoder().encode(value);
}

export async function createUserToken(user: { id: string; email: string; name: string }) {
  return new SignJWT({ email: user.email, name: user.name, type: 'user' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

export async function readUserToken(token: string) {
  const { payload } = await jwtVerify(token, secret());
  if (payload.type !== 'user' || !payload.sub) throw new Error('Invalid user session');
  return payload;
}

export async function getUserId(req: NextRequest) {
  const token = req.cookies.get(USER_COOKIE)?.value;
  if (!token) return null;
  try { return (await readUserToken(token)).sub || null; } catch { return null; }
}

export const userCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: MAX_AGE,
};
