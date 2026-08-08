import { NextRequest } from 'next/server';
import { handleSpecsIntelligenceGet, handleSpecsIntelligencePost } from '../../[[...path]]/handlers/specs-intelligence';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
export async function GET(req: NextRequest){ return handleSpecsIntelligenceGet(req); }
export async function POST(req: NextRequest){ return handleSpecsIntelligencePost(req); }
