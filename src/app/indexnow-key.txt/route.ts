export const dynamic = 'force-dynamic';
export async function GET() {
  const key = process.env.INDEXNOW_KEY || '';
  return new Response(key, { status: key ? 200 : 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}
