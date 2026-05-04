
// src/app/api/send-back/route.ts
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs-extra';

const UPLOAD_DIR = path.join(process.cwd(), '.tmp', 'uploads');

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const senderSessionId = formData.get('senderSessionId') as string | null;
    const fileName = formData.get('fileName') as string | null;

    if (!file || !senderSessionId || !fileName) {
      return NextResponse.json({ error: 'Missing required parameters.' }, { status: 400 });
    }

    // The directory for sent-back files will be a subdirectory of the original session
    const sendBackDir = path.join(UPLOAD_DIR, senderSessionId, 'sent-back');
    await fs.ensureDir(sendBackDir);

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(sendBackDir, fileName);

    await fs.writeFile(filePath, fileBuffer);

    const meta = {
        name: fileName,
        type: file.type,
        size: file.size,
    };
    await fs.writeFile(path.join(sendBackDir, `${fileName}.meta.json`), JSON.stringify(meta));

    return NextResponse.json({ success: true, message: 'File sent back successfully.' });
  } catch (error: any) {
    console.error('Send back error:', error);
    return NextResponse.json({ error: error.message || 'Failed to send file back.' }, { status: 500 });
  }
}
