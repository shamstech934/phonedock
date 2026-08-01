import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { AffiliateClick, AffiliateLink, Phone } from '@/lib/models';
import { connectDB, getAdminFromRequest, requirePermission } from '@/app/api/[[...path]]/handlers/helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STORE_KEYS = ['daraz', 'priceoye', 'mega'] as const;
const AVAILABILITY = ['in_stock', 'out_of_stock', 'preorder', 'unknown'] as const;

type StoreKey = (typeof STORE_KEYS)[number];
type Availability = (typeof AVAILABILITY)[number];

async function authorize(req: NextRequest, permission: 'prices:read' | 'prices:edit') {
  const auth = await getAdminFromRequest(req);
  if (auth.error) return { error: auth.error };
  const forbidden = requirePermission(auth.admin, permission);
  return forbidden ? { error: forbidden } : { admin: auth.admin };
}

function normalizeUrl(value: unknown): string {
  const raw = String(value || '').trim();
  const parsed = new URL(raw);
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Only HTTP/HTTPS URLs are allowed');
  return parsed.toString();
}

function allowedDestination(url: string, storeKey: StoreKey): boolean {
  const host = new URL(url).hostname.toLowerCase();
  const allowed: Record<StoreKey, string[]> = {
    daraz: ['daraz.pk'],
    priceoye: ['priceoye.pk'],
    mega: ['mega.pk'],
  };
  return allowed[storeKey].some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function parsePayload(body: Record<string, unknown>) {
  const storeKey = String(body.storeKey || '').toLowerCase() as StoreKey;
  if (!STORE_KEYS.includes(storeKey)) throw new Error('Unsupported affiliate store');
  const destinationUrl = normalizeUrl(body.destinationUrl);
  if (!allowedDestination(destinationUrl, storeKey)) throw new Error('Destination domain does not match selected store');
  const availability = String(body.availability || 'unknown') as Availability;
  if (!AVAILABILITY.includes(availability)) throw new Error('Invalid availability');
  const phoneIdRaw = String(body.phoneId || '').trim();
  if (phoneIdRaw && !Types.ObjectId.isValid(phoneIdRaw)) throw new Error('Invalid phone');
  return {
    storeKey,
    storeName: String(body.storeName || storeKey).trim().slice(0, 80),
    destinationUrl,
    trackingId: String(body.trackingId || '').trim().slice(0, 120),
    phoneId: phoneIdRaw ? new Types.ObjectId(phoneIdRaw) : null,
    logo: String(body.logo || '').trim().slice(0, 500),
    rating: Math.min(5, Math.max(0, Number(body.rating) || 0)),
    country: 'PK',
    priority: Math.max(0, Math.min(1000, Number(body.priority) || 0)),
    availability,
    active: body.active !== false,
    expiresAt: body.expiresAt ? new Date(String(body.expiresAt)) : null,
  };
}

export async function GET(req: NextRequest) {
  const auth = await authorize(req, 'prices:read');
  if (auth.error) return auth.error;
  await connectDB();

  const q = req.nextUrl.searchParams.get('q')?.trim() || '';
  const filter = q ? { $or: [{ storeName: { $regex: q, $options: 'i' } }, { storeKey: { $regex: q, $options: 'i' } }] } : {};
  const links = await AffiliateLink.find(filter)
    .select('+destinationUrl +trackingId')
    .populate('phoneId', 'modelName slug brandName')
    .sort({ active: -1, priority: -1, updatedAt: -1 })
    .limit(500)
    .lean();
  const phones = await Phone.find({ active: true, status: 'published' }).select('_id modelName slug brandName').sort({ brandName: 1, modelName: 1 }).limit(5000).lean();
  const clickRows = await AffiliateClick.aggregate([{ $group: { _id: '$affiliateLinkId', clicks30d: { $sum: '$count' } } }]);
  const clickMap = new Map(clickRows.map((row) => [String(row._id), Number(row.clicks30d || 0)]));

  return NextResponse.json({
    ok: true,
    links: links.map((link) => ({ ...link, _id: String(link._id), clicks30d: clickMap.get(String(link._id)) || 0 })),
    phones: phones.map((phone) => ({ ...phone, _id: String(phone._id) })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const auth = await authorize(req, 'prices:edit');
  if (auth.error) return auth.error;
  await connectDB();
  try {
    const payload = parsePayload(await req.json());
    const created = await AffiliateLink.create(payload);
    return NextResponse.json({ ok: true, id: String(created._id) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create affiliate link';
    return NextResponse.json({ error: message }, { status: message.includes('duplicate') ? 409 : 400 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await authorize(req, 'prices:edit');
  if (auth.error) return auth.error;
  await connectDB();
  try {
    const body = await req.json();
    const id = String(body.id || '');
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid link id' }, { status: 400 });
    const payload = parsePayload(body);
    const updated = await AffiliateLink.findByIdAndUpdate(id, { $set: payload }, { new: true, runValidators: true });
    if (!updated) return NextResponse.json({ error: 'Affiliate link not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update affiliate link' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await authorize(req, 'prices:edit');
  if (auth.error) return auth.error;
  await connectDB();
  const id = req.nextUrl.searchParams.get('id') || '';
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid link id' }, { status: 400 });
  await Promise.all([AffiliateLink.deleteOne({ _id: id }), AffiliateClick.deleteMany({ affiliateLinkId: id })]);
  return NextResponse.json({ ok: true });
}
