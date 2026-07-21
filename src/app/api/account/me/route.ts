import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { getUserId } from '@/lib/user-auth';
export async function GET(req: NextRequest) {
  const id = await getUserId(req);
  if (!id) return NextResponse.json({ user: null }, { status: 401 });
  await connectDB();
  const user = await User.findById(id).select('name email emailVerified status createdAt').lean();
  if (!user || user.status !== 'active') return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user: { id: String(user._id), name: user.name, email: user.email, emailVerified: user.emailVerified, createdAt: user.createdAt } });
}
