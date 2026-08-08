import { NextRequest } from 'next/server';
import { handleLaunchIntelligenceGet, handleLaunchIntelligencePost } from '../../[[...path]]/handlers/launch-intelligence';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
export async function GET(req: NextRequest){ return handleLaunchIntelligenceGet(req); }
export async function POST(req: NextRequest){ return handleLaunchIntelligencePost(req); }
