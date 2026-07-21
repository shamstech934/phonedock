import { NextRequest, NextResponse } from 'next/server';

const partnerUrls: Record<string, string | undefined> = {
  daraz: process.env.NEXT_PUBLIC_AFFILIATE_DARAZ_URL,
  priceoye: process.env.NEXT_PUBLIC_AFFILIATE_PRICEOYE_URL,
  mega: process.env.NEXT_PUBLIC_AFFILIATE_MEGA_URL,
};

export function GET(request: NextRequest) {
  const partner = request.nextUrl.searchParams.get('partner')?.toLowerCase() || '';
  const slug = request.nextUrl.searchParams.get('phone') || 'unknown';
  const destination = partnerUrls[partner]?.trim();

  if (!destination) {
    return NextResponse.redirect(new URL(`/phones?affiliate=${encodeURIComponent(partner)}&status=unavailable`, request.url));
  }

  let url: URL;
  try {
    url = new URL(destination);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported protocol');
  } catch {
    return NextResponse.json({ error: 'Affiliate destination is invalid' }, { status: 500 });
  }

  url.searchParams.set('utm_source', 'phonedock');
  url.searchParams.set('utm_medium', 'affiliate');
  url.searchParams.set('utm_campaign', slug);

  return NextResponse.redirect(url, { status: 302, headers: { 'Referrer-Policy': 'strict-origin-when-cross-origin' } });
}
