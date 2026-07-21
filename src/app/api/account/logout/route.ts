import { NextRequest, NextResponse } from 'next/server';
import { getUserId, USER_COOKIE } from '@/lib/user-auth';
import { User } from '@/lib/models/User';
export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (userId) {
    await User.updateOne({ _id: userId }, { $inc: { sessionVersion: 1 } });
  }
  const res = NextResponse.json({ success: true });
  res.cookies.set(USER_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}
