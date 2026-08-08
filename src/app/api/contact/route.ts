import { NextRequest } from 'next/server';
import { publicPost } from '@/app/api/_public-route';
export const runtime = 'nodejs';
export const maxDuration = 15;
export async function POST(req: NextRequest) { return publicPost(req, ['contact']); }
