// This API endpoint has been removed as the URL Downloader feature was deleted.
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  return NextResponse.json({ error: 'This feature has been removed.' }, { status: 410 });
}
