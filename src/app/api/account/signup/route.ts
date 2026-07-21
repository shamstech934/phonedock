import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { createUserToken, USER_COOKIE, userCookieOptions } from '@/lib/user-auth';

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160).transform(v => v.toLowerCase()),
  password: z.string().min(8).max(128).regex(/[A-Za-z]/).regex(/[0-9]/),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Please enter a valid name, email and a password with at least 8 characters including a number.' }, { status: 400 });
    await connectDB();
    const exists = await User.exists({ email: parsed.data.email });
    if (exists) return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await User.create({ name: parsed.data.name, email: parsed.data.email, passwordHash });
    const token = await createUserToken({ id: String(user._id), email: user.email, name: user.name });
    const res = NextResponse.json({ user: { id: String(user._id), name: user.name, email: user.email } }, { status: 201 });
    res.cookies.set(USER_COOKIE, token, userCookieOptions);
    return res;
  } catch (error) {
    console.error('Account signup failed:', error);
    return NextResponse.json({ error: 'Unable to create account right now.' }, { status: 500 });
  }
}
