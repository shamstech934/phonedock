import { NextResponse } from 'next/server';
import { USER_COOKIE } from '@/lib/user-auth';
export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(USER_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}
