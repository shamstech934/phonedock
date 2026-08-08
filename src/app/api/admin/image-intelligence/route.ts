import { NextRequest } from 'next/server';
import { handleImageIntelligenceGet, handleImageIntelligencePost } from '../../[[...path]]/handlers/image-intelligence';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
export async function GET(req: NextRequest){ return handleImageIntelligenceGet(req); }
export async function POST(req: NextRequest){ return handleImageIntelligencePost(req); }
