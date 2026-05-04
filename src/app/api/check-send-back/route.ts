
// src/app/api/check-send-back/route.ts
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs-extra';

const UPLOAD_DIR = path.join(process.cwd(), '.tmp', 'uploads');

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID is required.' }, { status: 400 });
  }

  const sendBackDir = path.join(UPLOAD_DIR, sessionId, 'sent-back');

  try {
    if (!await fs.pathExists(sendBackDir)) {
      return NextResponse.json({ file: null });
    }

    const filenames = await fs.readdir(sendBackDir);
    const contentFiles = filenames.filter(name => !name.endsWith('.meta.json'));

    if (contentFiles.length > 0) {
      const filename = contentFiles[0]; // Process one file at a time
      const filePath = path.join(sendBackDir, filename);
      const metaPath = path.join(sendBackDir, `${filename}.meta.json`);

      if (await fs.pathExists(metaPath)) {
        const fileBuffer = await fs.readFile(filePath);
        const meta = await fs.readJson(metaPath);
        const dataUri = `data:${meta.type};base64,${fileBuffer.toString('base64')}`;

        // Clean up the file and its metadata after retrieving it
        await fs.remove(filePath);
        await fs.remove(metaPath);

        return NextResponse.json({
          file: {
            name: meta.name,
            type: meta.type,
            size: meta.size,
            dataUrl: dataUri,
          }
        });
      }
    }

    return NextResponse.json({ file: null });
  } catch (error) {
    console.error('Check send-back error:', error);
    return NextResponse.json({ error: 'Failed to check for sent-back files.' }, { status: 500 });
  }
}
