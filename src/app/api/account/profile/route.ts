import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { CompareHistory, Favorite, Notification, RecentlyViewed, Wishlist } from '@/lib/models';
import { getUserId, USER_COOKIE } from '@/lib/user-auth';
import { recordSecurityEvent } from '@/lib/security-events';
import { getRequestSecurityContext } from '@/lib/user-security';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  avatarUrl: z.union([z.literal(''), z.string().url().max(500)]),
  country: z.string().regex(/^[A-Z]{2}$/),
  timezone: z.string().trim().min(1).max(80),
  preferredCurrency: z.string().regex(/^[A-Z]{3}$/),
  preferredLanguage: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/),
  notificationSettings: z.object({ email: z.boolean(), priceDrops: z.boolean(), ptaChanges: z.boolean(), restock: z.boolean() }),
  privacySettings: z.object({ saveHistory: z.boolean(), personalization: z.boolean() }),
});

export async function GET(req: NextRequest) {
  const id = await getUserId(req);
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  await connectDB();
  const profile = await User.findById(id).select('name email emailVerified avatarUrl country timezone preferredCurrency preferredLanguage notificationSettings privacySettings createdAt').lean();
  return profile ? NextResponse.json({ profile }, { headers }) : NextResponse.json({ error: 'Not found' }, { status: 404, headers });
}

export async function PATCH(req: NextRequest) {
  const id = await getUserId(req);
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  const parsed = profileSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid profile' }, { status: 400, headers });
  await connectDB();
  const profile = await User.findOneAndUpdate({ _id: id, status: 'active' }, { $set: parsed.data }, { new: true, runValidators: true }).select('name email emailVerified avatarUrl country timezone preferredCurrency preferredLanguage notificationSettings privacySettings').lean();
  return NextResponse.json({ profile }, { headers });
}

export async function DELETE(req: NextRequest) {
  const id = await getUserId(req);
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  await connectDB();
  const session = await User.startSession();
  try {
    await session.withTransaction(async () => {
      await Promise.all([
        Wishlist.deleteMany({ userId: id }).session(session), Favorite.deleteMany({ userId: id }).session(session),
        RecentlyViewed.deleteMany({ userId: id }).session(session), CompareHistory.deleteMany({ userId: id }).session(session),
        Notification.deleteMany({ userId: id }).session(session),
      ]);
      await User.updateOne({ _id: id }, { $set: { status: 'blocked', email: `deleted-${id}@deleted.invalid`, name: 'Deleted User', deletedAt: new Date() }, $inc: { sessionVersion: 1 } }, { session });
    });
    const { ip, userAgent } = getRequestSecurityContext(req);
    await recordSecurityEvent({ action: 'user_account_deleted', ip, userAgent });
    const response = new NextResponse(null, { status: 204, headers });
    response.cookies.set(USER_COOKIE, '', { path: '/', maxAge: 0 });
    return response;
  } finally { await session.endSession(); }
}
