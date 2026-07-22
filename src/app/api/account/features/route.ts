import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { z } from 'zod';
import { connectDB } from '@/lib/mongodb';
import { CompareHistory, Favorite, Notification, Phone, RecentlyViewed, Wishlist } from '@/lib/models';
import { getUserId } from '@/lib/user-auth';

export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'private, no-store' };
const resources = { wishlist: Wishlist, favorites: Favorite, recent: RecentlyViewed } as const;

async function user(req: NextRequest) {
  const id = await getUserId(req);
  if (!id) return null;
  await connectDB();
  return new Types.ObjectId(id);
}

export async function GET(req: NextRequest) {
  const userId = await user(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore });
  const resource = req.nextUrl.searchParams.get('resource') || 'wishlist';
  if (resource in resources) {
    const model = resources[resource as keyof typeof resources];
    const sort: Record<string, 1 | -1> = resource === 'recent' ? { viewedAt: -1 } : { createdAt: -1 };
    const items = await model.find({ userId }).sort(sort).limit(100).populate('phoneId', 'slug modelName thumbnail pricePKR originalPricePKR overallRating brandId').lean();
    return NextResponse.json({ items }, { headers: noStore });
  }
  if (resource === 'comparisons') return NextResponse.json({ items: await CompareHistory.find({ userId }).sort({ createdAt: -1 }).limit(50).populate('phoneIds', 'slug modelName thumbnail').lean() }, { headers: noStore });
  if (resource === 'notifications') {
    const items = await Notification.find({ userId, archivedAt: null }).sort({ createdAt: -1 }).limit(100).lean();
    const unread = await Notification.countDocuments({ userId, readAt: null, archivedAt: null });
    return NextResponse.json({ items, unread }, { headers: noStore });
  }
  return NextResponse.json({ error: 'Invalid resource' }, { status: 400, headers: noStore });
}

const mutation = z.discriminatedUnion('resource', [
  z.object({ resource: z.enum(['wishlist', 'favorites', 'recent']), phoneId: z.string().refine(Types.ObjectId.isValid), folder: z.string().trim().max(40).optional() }),
  z.object({ resource: z.literal('comparisons'), phoneIds: z.array(z.string().refine(Types.ObjectId.isValid)).min(2).max(6) }),
  z.object({ resource: z.literal('notifications'), action: z.enum(['read-all', 'archive']), notificationId: z.string().refine(Types.ObjectId.isValid).optional() }),
]);

export async function POST(req: NextRequest) {
  const userId = await user(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore });
  const parsed = mutation.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: noStore });
  const data = parsed.data;
  if (data.resource === 'wishlist' || data.resource === 'favorites' || data.resource === 'recent') {
    if (!await Phone.exists({ _id: data.phoneId, active: true, status: 'published' })) return NextResponse.json({ error: 'Phone not found' }, { status: 404, headers: noStore });
    const model = resources[data.resource as keyof typeof resources];
    const update = data.resource === 'recent' ? { viewedAt: new Date() } : { folder: data.folder || 'default' };
    await model.updateOne({ userId, phoneId: data.phoneId }, { $set: update, $setOnInsert: { userId, phoneId: data.phoneId } }, { upsert: true });
    if (data.resource === 'recent') {
      const overflow = await RecentlyViewed.find({ userId }).sort({ viewedAt: -1 }).skip(100).select('_id').lean();
      if (overflow.length) await RecentlyViewed.deleteMany({ _id: { $in: overflow.map(item => item._id) }, userId });
    }
    return NextResponse.json({ ok: true }, { status: 201, headers: noStore });
  }
  if (data.resource === 'comparisons') {
    const phoneIds = [...new Set(data.phoneIds)];
    if (await Phone.countDocuments({ _id: { $in: phoneIds }, active: true, status: 'published' }) !== phoneIds.length) return NextResponse.json({ error: 'Invalid phones' }, { status: 400, headers: noStore });
    const item = await CompareHistory.create({ userId, phoneIds, shareId: crypto.randomBytes(12).toString('base64url') });
    return NextResponse.json({ item }, { status: 201, headers: noStore });
  }
  if (data.resource !== 'notifications') return NextResponse.json({ error: 'Invalid resource' }, { status: 400, headers: noStore });
  if (data.action === 'read-all') await Notification.updateMany({ userId, readAt: null }, { $set: { readAt: new Date() } });
  else if (data.notificationId) await Notification.updateOne({ _id: data.notificationId, userId }, { $set: { archivedAt: new Date() } });
  else return NextResponse.json({ error: 'Notification required' }, { status: 400, headers: noStore });
  return NextResponse.json({ ok: true }, { headers: noStore });
}

export async function DELETE(req: NextRequest) {
  const userId = await user(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore });
  const resource = req.nextUrl.searchParams.get('resource');
  const id = req.nextUrl.searchParams.get('id');
  if (resource && resource in resources && id && Types.ObjectId.isValid(id)) await resources[resource as keyof typeof resources].deleteOne({ userId, phoneId: id });
  else if (resource === 'comparisons' && id && Types.ObjectId.isValid(id)) await CompareHistory.deleteOne({ userId, _id: id });
  else return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: noStore });
  return new NextResponse(null, { status: 204, headers: noStore });
}
