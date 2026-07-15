import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function handleDownloadSample(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  if (segments.length === 1 && segments[0] === 'download-sample') {
    try {
      const filePath = path.join(process.cwd(), 'public', 'phonedock-sample-data.json');
      const fileBuffer = await readFile(filePath);
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="phonedock-sample-data.json"',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } catch {
      return NextResponse.json({ error: 'Sample data file not found' }, { status: 404 });
    }
  }
  return undefined;
}