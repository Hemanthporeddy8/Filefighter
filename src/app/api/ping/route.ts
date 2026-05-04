
// src/app/api/ping/route.ts
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs-extra';

const UPLOAD_DIR = path.join(process.cwd(), '.tmp', 'uploads');
const PING_TIMEOUT_SECONDS = 30; // Consider a user offline after this many seconds of no ping

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const sessionId = formData.get('sessionId') as string | null;
    const checkStatus = formData.get('checkStatus') as string | null;


    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required.' }, { status: 400 });
    }
    
    const sessionDir = path.join(UPLOAD_DIR, sessionId);
    await fs.ensureDir(sessionDir);
    const pingFilePath = path.join(sessionDir, '_ping.json');


    if (checkStatus) {
        // This is a status check from the upload page.
        let status = 'offline';
        if (await fs.pathExists(pingFilePath)) {
            try {
                const pingData = await fs.readJson(pingFilePath);
                status = pingData.status || 'offline';
            } catch (e) {
                // If file is being written, it might be empty. Default to a safe status.
                status = 'assembling';
            }
        }
        return NextResponse.json({ success: true, status });

    } else {
        // This is a ping from the dashboard to keep the session alive.
        await fs.writeJson(path.join(sessionDir, '_ping.json'), { timestamp: Date.now(), status: 'live' });
        // sendBeacon does not process responses, so return a simple success
        return new NextResponse(null, { status: 204 });
    }

  } catch (error) {
    console.error('Ping error:', error);
    return NextResponse.json({ error: 'Ping failed.' }, { status: 500 });
  }
}
