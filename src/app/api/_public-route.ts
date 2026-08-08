import { NextRequest, NextResponse } from 'next/server';
import { handlePublicGet, handlePublicPost } from '@/app/api/[[...path]]/handlers/public';
import { getClientIp } from '@/app/api/[[...path]]/handlers/helpers';

export async function publicGet(req: NextRequest, segments: string[]) {
  const result = await handlePublicGet(req, segments, getClientIp(req));
  return result || NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function publicPost(req: NextRequest, segments: string[]) {
  const result = await handlePublicPost(req, segments, getClientIp(req));
  return result || NextResponse.json({ error: 'Not found' }, { status: 404 });
}
