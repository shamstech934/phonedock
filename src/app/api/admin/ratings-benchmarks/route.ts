import { NextRequest } from 'next/server';
import { handleRatingsBenchmarksGet, handleRatingsBenchmarksPost } from '../../[[...path]]/handlers/ratings-benchmarks';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
export async function GET(req: NextRequest){ return handleRatingsBenchmarksGet(req); }
export async function POST(req: NextRequest){ return handleRatingsBenchmarksPost(req); }
