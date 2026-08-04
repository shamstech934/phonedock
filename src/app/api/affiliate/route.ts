import { NextRequest, NextResponse } from 'next/server';
import { connectDBSafe } from '@/lib/mongodb';
import { AffiliateClick, AffiliateLink, Phone } from '@/lib/models';

export const dynamic = 'force-dynamic';

const partnerUrls: Record<string, string | undefined> = {
  daraz: process.env.AFFILIATE_DARAZ_URL || process.env.NEXT_PUBLIC_AFFILIATE_DARAZ_URL,
  priceoye: process.env.AFFILIATE_PRICEOYE_URL || process.env.NEXT_PUBLIC_AFFILIATE_PRICEOYE_URL,
  mega: process.env.AFFILIATE_MEGA_URL || process.env.NEXT_PUBLIC_AFFILIATE_MEGA_URL,
};

const allowedHosts = (process.env.AFFILIATE_ALLOWED_HOSTS || 'daraz.pk,priceoye.pk,mega.pk')
  .split(',').map((host) => host.trim().toLowerCase()).filter(Boolean);

export async function GET(request: NextRequest) {
  const partner = request.nextUrl.searchParams.get('partner')?.toLowerCase() || '';
  const slug = request.nextUrl.searchParams.get('phone') || 'unknown';
  let destination = partnerUrls[partner]?.trim();
  let linkId: string | null = null;
  const connection = await connectDBSafe();
  if (connection && partner) {
    const phone = slug !== 'unknown' ? await Phone.findOne({ slug, active: true, status: 'published' }).select('_id').lean() : null;
    const now = new Date();
    const record = await AffiliateLink.findOne({ storeKey: partner, active: true, availability: { $ne: 'out_of_stock' }, $and: [{ $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }, { $or: [{ phoneId: phone?._id }, { phoneId: null }] }] }).select('+destinationUrl +trackingId').sort({ phoneId: -1, priority: -1 }).lean();
    if (record) { destination = record.destinationUrl; linkId = String(record._id); }
  }

  if (!destination) {
    return NextResponse.redirect(new URL(`/phones?affiliate=${encodeURIComponent(partner)}&status=unavailable`, request.url));
  }

  let url: URL;
  try {
    url = new URL(destination);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported protocol');
    const hostname = url.hostname.toLowerCase();
    if (!allowedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))) throw new Error('Host is not allowlisted');
  } catch {
    return NextResponse.json({ error: 'Affiliate destination is invalid' }, { status: 500 });
  }

  url.searchParams.set('utm_source', 'phonedock');
  url.searchParams.set('utm_medium', 'affiliate');
  url.searchParams.set('utm_campaign', slug);
  if (linkId && connection) {
    const day = new Date().toISOString().slice(0, 10);
    await Promise.all([
      AffiliateLink.updateOne({ _id: linkId }, { $inc: { clicks: 1 } }),
      AffiliateClick.updateOne({ affiliateLinkId: linkId, storeKey: partner, phoneSlug: slug.slice(0, 160), day }, { $inc: { count: 1 }, $setOnInsert: { affiliateLinkId: linkId, storeKey: partner, phoneSlug: slug.slice(0, 160), day } }, { upsert: true }),
    ]);
  }

  return NextResponse.redirect(url, { status: 302, headers: { 'Referrer-Policy': 'strict-origin-when-cross-origin' } });
}
