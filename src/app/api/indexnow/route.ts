import { NextRequest, NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/urls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const supplied = request.headers.get('x-cron-secret') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return supplied === secret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const key = process.env.INDEXNOW_KEY;
  if (!key) return NextResponse.json({ error: 'INDEXNOW_KEY is not configured' }, { status: 503 });
  if (!/^[A-Za-z0-9-]{8,128}$/.test(key)) {
    return NextResponse.json({ error: 'INDEXNOW_KEY must be 8-128 characters using only letters, numbers, or hyphens' }, { status: 503 });
  }
  const body = await request.json().catch(() => ({})) as { urls?: unknown };
  const base = getBaseUrl();
  const input = Array.isArray(body.urls) ? body.urls : [];
  const urls = input.filter((value): value is string => typeof value === 'string' && value.startsWith(`${base}/`)).slice(0, 10000);
  if (!urls.length) return NextResponse.json({ error: 'No valid same-site URLs supplied' }, { status: 400 });
  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: new URL(base).host, key, keyLocation: `${base}/${key}.txt`, urlList: urls }),
  });
  return NextResponse.json({ ok: response.ok, submitted: urls.length, status: response.status }, { status: response.ok ? 200 : 502 });
}
