
// src/app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs-extra';
import { fileTypeFromBuffer } from 'file-type';

const UPLOAD_DIR = path.join(process.cwd(), '.tmp', 'uploads');

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const chunk = formData.get('chunk') as File | null;
    const uploadId = formData.get('uploadId') as string | null;
    const chunkIndexStr = formData.get('chunkIndex') as string | null;
    const sessionId = formData.get('sessionId') as string | null;

    if (!chunk || !uploadId || chunkIndexStr === null || !sessionId) {
      return NextResponse.json({ error: 'Missing required upload parameters.' }, { status: 400 });
    }

    const chunkIndex = parseInt(chunkIndexStr, 10);

    const chunkDir = path.join(UPLOAD_DIR, uploadId);
    await fs.ensureDir(chunkDir);
    
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());
    // Pad index to ensure correct sorting later
    const paddedIndex = String(chunkIndex).padStart(5, '0');
    await fs.writeFile(path.join(chunkDir, `${paddedIndex}.chunk`), chunkBuffer);

    // The assembly logic is now moved to /api/upload-complete
    // This endpoint is now only responsible for receiving chunks.

    return NextResponse.json({ success: true, message: `Chunk ${chunkIndex + 1} received.` });
  } catch (error) {
    console.error('Upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'File upload failed.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
