
// src/app/api/poll/route.ts
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs-extra';

const UPLOAD_DIR = path.join(process.cwd(), '.tmp', 'uploads');
const PING_TIMEOUT_SECONDS = 30; // Consider a user offline after this many seconds of no ping

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID is required.' }, { status: 400 });
  }

  const sessionDir = path.join(UPLOAD_DIR, sessionId);
  const pingFilePath = path.join(sessionDir, '_ping.json');

  try {
    if (!await fs.pathExists(sessionDir)) {
      await fs.ensureDir(sessionDir);
      await fs.writeJson(pingFilePath, { timestamp: Date.now(), status: 'live' });
    }

    let currentStatus = 'offline';
    if (await fs.pathExists(pingFilePath)) {
      try {
        const pingData = await fs.readJson(pingFilePath);
        const ageInSeconds = (Date.now() - pingData.timestamp) / 1000;
        if (ageInSeconds > PING_TIMEOUT_SECONDS) {
            currentStatus = 'offline';
        } else {
            currentStatus = pingData.status || 'live';
        }
      } catch (e) {
        currentStatus = 'assembling'; // File might be being written
      }
    }
    
    // Always check for files, even if status is not 'completed' yet.
    // This allows for a more responsive UI.
    const filenames = await fs.readdir(sessionDir).catch(() => []);
    const contentFiles = filenames.filter(name => !name.endsWith('.meta.json') && name !== '_ping.json');

    if (contentFiles.length > 0) {
        const fileDataPromises = contentFiles.map(async (filename) => {
            const filePath = path.join(sessionDir, filename);
            const metaPath = path.join(sessionDir, `${filename}.meta.json`);

            if (await fs.pathExists(metaPath)) {
                try {
                    const fileBuffer = await fs.readFile(filePath);
                    const metaBuffer = await fs.readFile(metaPath);
                    const meta = JSON.parse(metaBuffer.toString());
                    const dataUri = `data:${meta.type};base64,${fileBuffer.toString('base64')}`;
                    
                    await fs.remove(filePath);
                    await fs.remove(metaPath);

                    return {
                        name: meta.name,
                        type: meta.type,
                        size: meta.size,
                        senderName: meta.senderName,
                        dataUri: dataUri,
                    };
                } catch(e) {
                    console.error(`Error processing file ${filename} in poll, cleaning up.`, e);
                    await fs.remove(filePath).catch(() => {});
                    await fs.remove(metaPath).catch(() => {});
                    return null;
                }
            }
            return null;
        });

        const files = (await Promise.all(fileDataPromises)).filter(Boolean);

        if (files.length > 0) {
            // After successfully processing files, update the status file back to 'live'
            const pingData = await fs.readJson(pingFilePath).catch(() => ({}));
            await fs.writeJson(pingFilePath, { ...pingData, timestamp: Date.now(), status: 'live' });
            return NextResponse.json({ files, status: 'completed' });
        }
    }
    
    return NextResponse.json({ files: [], status: currentStatus });

  } catch (error) {
    console.error('Polling error:', error);
    return NextResponse.json({ error: 'Failed to retrieve files.' }, { status: 500 });
  }
}
