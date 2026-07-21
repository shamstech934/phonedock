import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { createUserToken, USER_COOKIE, userCookieOptions } from '@/lib/user-auth';

const schema = z.object({ email: z.string().trim().email().transform(v => v.toLowerCase()), password: z.string().min(1).max(128) });

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid email or password.' }, { status: 400 });
    await connectDB();
    const user = await User.findOne({ email: parsed.data.email }).select('+passwordHash');
    if (!user || user.status !== 'active' || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }
    user.lastLoginAt = new Date();
    await user.save();
    const token = await createUserToken({ id: String(user._id), email: user.email, name: user.name });
    const res = NextResponse.json({ user: { id: String(user._id), name: user.name, email: user.email } });
    res.cookies.set(USER_COOKIE, token, userCookieOptions);
    return res;
  } catch (error) {
    console.error('Account login failed:', error);
    return NextResponse.json({ error: 'Unable to sign in right now.' }, { status: 500 });
  }
}
