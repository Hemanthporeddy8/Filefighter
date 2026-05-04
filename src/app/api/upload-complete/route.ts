
// src/app/api/upload-complete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs-extra';
import { fileTypeFromBuffer } from 'file-type';

const UPLOAD_DIR = path.join(process.cwd(), '.tmp', 'uploads');

async function reassembleFile(uploadId: string, originalFilename: string, sessionId: string, totalChunks: number, senderName?: string) {
    const chunkDir = path.join(UPLOAD_DIR, uploadId);
    const finalDir = path.join(UPLOAD_DIR, sessionId);
    const finalPath = path.join(finalDir, originalFilename);
    await fs.ensureDir(finalDir);

    // This check is important. If chunks were never created (e.g., direct save from WA), we shouldn't proceed.
    if (!await fs.pathExists(chunkDir)) {
        // The file might have been saved directly. Let's check.
        if (await fs.pathExists(finalPath)) {
            return; // File is already there, nothing to do.
        }
        throw new Error(`Upload ID ${uploadId} not found. Cannot reassemble file.`);
    }

    const chunkFiles = (await fs.readdir(chunkDir)).sort((a, b) => {
        const aIndex = parseInt(a.split('.').at(0) || '0', 10);
        const bIndex = parseInt(b.split('.').at(0) || '0', 10);
        return aIndex - bIndex;
    });

    if (chunkFiles.length !== totalChunks) {
        throw new Error(`File assembly failed: Expected ${totalChunks} chunks but found ${chunkFiles.length}.`);
    }

    const writeStream = fs.createWriteStream(finalPath);

    for (const chunkFile of chunkFiles) {
        const chunkPath = path.join(chunkDir, chunkFile);
        const chunkBuffer = await fs.readFile(chunkPath);
        writeStream.write(chunkBuffer);
        await fs.remove(chunkPath); // Clean up chunk
    }

    writeStream.end();
    
    await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
    });

    await fs.rmdir(chunkDir); // Clean up chunk directory

    const finalBuffer = await fs.readFile(finalPath);
    const fileType = await fileTypeFromBuffer(finalBuffer);
    const stats = await fs.stat(finalPath);
    
    const meta = {
        name: originalFilename,
        type: fileType?.mime || 'application/octet-stream',
        size: stats.size,
        senderName: senderName || 'Anonymous',
    };
    await fs.writeFile(path.join(finalDir, `${originalFilename}.meta.json`), JSON.stringify(meta));
}

export async function POST(req: NextRequest) {
    const { sessionId, uploadId, fileName, totalChunks, senderName } = await req.json();

    if (!sessionId || !uploadId || !fileName) {
        return NextResponse.json({ error: 'Missing required parameters for completion.' }, { status: 400 });
    }

    const sessionDir = path.join(UPLOAD_DIR, sessionId);
    const pingFilePath = path.join(sessionDir, '_ping.json');

    try {
        await fs.ensureDir(sessionDir);
        await fs.writeJson(pingFilePath, { timestamp: Date.now(), status: 'assembling' });

        // The reassembly logic is now only called for chunked uploads.
        if (totalChunks && totalChunks > 0) {
            await reassembleFile(uploadId, fileName, sessionId, totalChunks, senderName);
        }
        
        const currentPingData = await fs.readJson(pingFilePath).catch(() => ({}));
        await fs.writeJson(pingFilePath, { ...currentPingData, timestamp: Date.now(), status: 'completed' });

        return NextResponse.json({ success: true, message: 'File processing complete and ready for polling.' });

    } catch (error: any) {
        console.error('File completion error:', error);
        if (await fs.pathExists(sessionDir)) {
          await fs.remove(sessionDir).catch(e => console.error(`Failed to clean session dir on error: ${e.message}`));
        }
        return NextResponse.json({ error: error.message || 'Failed to complete file processing.' }, { status: 500 });
    }
}
