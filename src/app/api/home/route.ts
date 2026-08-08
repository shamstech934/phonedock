import { NextRequest } from 'next/server';
import { publicGet } from '@/app/api/_public-route';
export const runtime = 'nodejs';
export const maxDuration = 15;
export async function GET(req: NextRequest) { return publicGet(req, ['home']); }
