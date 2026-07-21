import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim();
  if (!client) {
    return new NextResponse('# PhoneDock ads.txt\n# Add NEXT_PUBLIC_ADSENSE_CLIENT to enable Google AdSense.\n', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    });
  }

  const publisherId = client.replace(/^ca-/, '');
  return new NextResponse(`google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
  });
}
