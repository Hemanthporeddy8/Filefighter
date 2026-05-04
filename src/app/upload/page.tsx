
// src/app/upload/page.tsx
"use client";

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { FileUpload } from '@/components/app/file-upload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, FilePlus2, Loader2, AlertTriangle, Timer, Download, FileText, Image as ImageIcon, Video, FileQuestion, User } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
const CONCURRENT_UPLOADS = 4; // Number of chunks to upload in parallel

interface SentBackFile {
    name: string;
    type: string;
    size: number;
    dataUrl: string;
}

type DashboardStatus = 'live' | 'assembling' | 'completed' | 'offline' | 'checking';


const StatusIndicator = ({ status }: { status: DashboardStatus }) => {
    let text, color;
    switch(status) {
        case 'live':
            text = 'Dashboard is Online';
            color = 'bg-green-500';
            break;
        case 'assembling':
            text = 'Dashboard is Receiving...';
            color = 'bg-blue-500 animate-pulse';
            break;
        case 'completed':
            text = 'Dashboard is Processing...';
            color = 'bg-yellow-500 animate-pulse';
            break;
        case 'offline':
            text = 'Dashboard is Offline';
            color = 'bg-red-500';
            break;
        default:
            text = 'Checking Status...';
            color = 'bg-gray-400 animate-pulse';
    }

    return (
        <div className="flex items-center gap-1.5 text-xs">
            <span className={cn("h-2.5 w-2.5 rounded-full", color)}></span>
            <span className="capitalize text-muted-foreground">{text}</span>
        </div>
    );
};

function UploadPageContent() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('sessionId');
    const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
    const [senderName, setSenderName] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [currentFile, setCurrentFile] = useState('');
    const [lastUploadCount, setLastUploadCount] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState('');
    const [sentBackFile, setSentBackFile] = useState<SentBackFile | null>(null);
    const [dashboardStatus, setDashboardStatus] = useState<DashboardStatus>('checking');


    const handleFilesSelectedForUpload = (files: File[]) => {
        setFilesToUpload(files);
        setIsSuccess(false);
        setError(null);
        setUploadProgress(0);
        setCurrentFile('');
    };

    const uploadFileInChunks = async (file: File, uploadId: string) => {
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        let uploadedChunks = 0;
        setCurrentFile(`Uploading ${file.name}...`);
    
        const chunkQueue = Array.from({ length: totalChunks }, (_, i) => i);
    
        const uploadChunk = async (chunkIndex: number): Promise<void> => {
            const start = chunkIndex * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);
    
            const formData = new FormData();
            formData.append('chunk', chunk, file.name);
            formData.append('uploadId', uploadId);
            formData.append('chunkIndex', String(chunkIndex));
            formData.append('sessionId', sessionId!);
    
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });
    
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `Failed to upload chunk ${chunkIndex + 1}.` }));
                throw new Error(errorData.error);
            }
    
            uploadedChunks++;
            setUploadProgress((uploadedChunks / totalChunks) * 100);
        };
    
        const workerPromises = Array.from({ length: CONCURRENT_UPLOADS }, async () => {
            while (chunkQueue.length > 0) {
                const chunkIndex = chunkQueue.shift();
                if (chunkIndex !== undefined) {
                    await uploadChunk(chunkIndex);
                }
            }
        });
    
        await Promise.all(workerPromises);
    };

    const waitForDashboardReceipt = async (): Promise<boolean> => {
        setStatusMessage('Waiting for dashboard to receive file...');
        for (let i = 0; i < 10; i++) { // Poll for up to 30 seconds
            await new Promise(resolve => setTimeout(resolve, 3000));
            try {
                const formData = new FormData();
                formData.append('sessionId', sessionId!);
                formData.append('checkStatus', 'true');
                const res = await fetch('/api/ping', { method: 'POST', body: formData });
                const data = await res.json();
                
                // If the dashboard has received the file, it will reset its status to 'live'.
                if (data.status === 'live') {
                    return true;
                }
            } catch (e) {
                // Ignore fetch errors and continue polling
            }
        }
        return false; // Timeout
    }

    const handleUpload = async () => {
        if (filesToUpload.length === 0) {
            alert("Please select files to upload.");
            return;
        }
        if (!sessionId) {
            setError("This upload link is invalid. Please re-scan the QR code.");
            return;
        }
        if (dashboardStatus === 'offline') {
            setError("The dashboard is offline. Please ensure the dashboard is open and active.");
            return;
        }

        setIsUploading(true);
        setError(null);
        setUploadProgress(0);
        setStatusMessage('Initializing...');

        try {
            for (const file of filesToUpload) {
                const uploadId = `${Date.now()}-${file.name}`;
                await uploadFileInChunks(file, uploadId);

                setStatusMessage('Finalizing upload...');
                const completeResponse = await fetch('/api/upload-complete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId,
                        uploadId,
                        fileName: file.name,
                        totalChunks: Math.ceil(file.size / CHUNK_SIZE),
                        senderName: senderName || 'Anonymous',
                    }),
                });

                if (!completeResponse.ok) {
                    const errorData = await completeResponse.json().catch(() => ({ error: 'Failed to finalize upload.' }));
                    throw new Error(errorData.error);
                }
            }
            
            const received = await waitForDashboardReceipt();
            if (!received) {
                throw new Error("Confirmation from dashboard timed out. Please check the dashboard manually.");
            }

            setLastUploadCount(filesToUpload.length);
            setIsSuccess(true);
            setFilesToUpload([]);

        } catch (err: any) {
            setError(err.message || 'An unknown error occurred during upload.');
            setUploadProgress(0);
        } finally {
            setIsUploading(false);
            setCurrentFile('');
            setStatusMessage('');
        }
    };
    
    // Poll for sent-back files and dashboard status
    useEffect(() => {
        if (!sessionId) return;
    
        const controller = new AbortController();
        const signal = controller.signal;

        const pollForStatus = async () => {
            if (document.visibilityState !== 'visible') return;
            
            // Check dashboard status by pinging
             try {
                const formData = new FormData();
                formData.append('sessionId', sessionId);
                formData.append('checkStatus', 'true');

                const response = await fetch('/api/ping', {
                    method: 'POST',
                    body: formData,
                    signal,
                });
                 if (response.ok) {
                    const data = await response.json();
                    // Don't show "offline" if it's currently uploading
                    if (data.status === 'offline' && isUploading) {
                        return;
                    }
                    setDashboardStatus(data.status || 'offline');
                } else {
                    setDashboardStatus('offline');
                }
            } catch (error: any) {
                 if (error.name !== 'AbortError') {
                    console.error("Failed to ping for status:", error);
                    setDashboardStatus('offline');
                 }
            }
        };

        const pollForSentBackFile = async () => {
             if (document.visibilityState !== 'visible') return;
             // Check for sent back files
            try {
                const response = await fetch(`/api/check-send-back?sessionId=${sessionId}`, { signal });
                if (response.ok) {
                    const data = await response.json();
                    if (data.file) {
                        setSentBackFile(data.file);
                    }
                }
            } catch (error: any) {
                if (error.name !== 'AbortError') console.error("Failed to check for sent-back files:", error);
            }
        }
    
        const statusIntervalId = setInterval(pollForStatus, 5000);
        const fileIntervalId = setInterval(pollForSentBackFile, 8000);
        pollForStatus(); // Initial check
        pollForSentBackFile();
    
        return () => {
            clearInterval(statusIntervalId);
            clearInterval(fileIntervalId);
            controller.abort();
        };
    }, [sessionId, isUploading]);

    const renderFilePreview = () => {
        if (!sentBackFile) return null;
        if (sentBackFile.type.startsWith('image/')) {
            return <Image src={sentBackFile.dataUrl} alt={sentBackFile.name} width={200} height={150} className="rounded-md object-contain max-h-48" />;
        }
        if (sentBackFile.type.startsWith('video/')) {
            return <Video className="w-24 h-24 text-muted-foreground" />;
        }
        if (sentBackFile.type.startsWith('application/pdf')) {
            return <FileText className="w-24 h-24 text-muted-foreground" />;
        }
        return <FileQuestion className="w-24 h-24 text-muted-foreground" />;
    };
    
    if (!sessionId) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <Card className="w-full max-w-md shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-destructive">Invalid Link</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>This upload link is missing a session ID. Please re-scan the QR code from the FileFlow dashboard.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    if (isSuccess) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
                 <Card className="w-full max-w-md shadow-lg text-center">
                    <CardContent className="p-8">
                        <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4"/>
                        <h2 className="text-2xl font-semibold">Upload Complete!</h2>
                        <p className="text-muted-foreground mt-2">
                           {lastUploadCount} file(s) have been successfully received by the dashboard.
                        </p>
                         <Button onClick={() => setIsSuccess(false)} className="mt-6">
                            Send More Files
                        </Button>
                    </CardContent>
                 </Card>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center justify-start min-h-screen bg-gray-100 p-4 pt-8 sm:pt-12">
            <main className="w-full max-w-md">
                 {sentBackFile && (
                    <Card className="w-full shadow-lg mx-auto mb-6 bg-blue-50 border-blue-200">
                        <CardHeader>
                            <CardTitle className="text-blue-800">A File Was Sent Back to You</CardTitle>
                            <CardDescription className="text-blue-700">The dashboard user has sent you a modified file. You can download it now.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center gap-4">
                            <div className="p-2 border rounded-md bg-white h-48 flex items-center justify-center">
                                {renderFilePreview()}
                            </div>
                            <p className="font-semibold truncate w-full text-center" title={sentBackFile.name}>{sentBackFile.name}</p>
                            <Button asChild className="w-full">
                                <a href={sentBackFile.dataUrl} download={sentBackFile.name}>
                                    <Download className="mr-2 h-4 w-4"/>
                                    Download File
                                </a>
                            </Button>
                        </CardContent>
                    </Card>
                )}
                <Card className="w-full shadow-lg mx-auto">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <CardTitle className="flex items-center"><FilePlus2 className="mr-2 text-primary"/>Send Files to Dashboard</CardTitle>
                                <CardDescription>
                                    Your files will be sent to your active FileFlow session.
                                </CardDescription>
                            </div>
                           <StatusIndicator status={dashboardStatus} />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="space-y-2">
                            <Label htmlFor="sender-name">Your Name (Optional)</Label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    id="sender-name" 
                                    placeholder="e.g., John Doe, Marketing Team, etc."
                                    value={senderName}
                                    onChange={(e) => setSenderName(e.target.value)}
                                    className="pl-9"
                                    disabled={isUploading}
                                />
                            </div>
                        </div>
                        <FileUpload
                            onFileSelect={handleFilesSelectedForUpload}
                            id="qr-upload-page-input"
                            multiple
                            sessionId={sessionId}
                        />
                        {isUploading && (
                             <div className="space-y-2">
                                <Label>{currentFile || statusMessage}</Label>
                                <Progress value={uploadProgress} />
                                <p className="text-xs text-center text-muted-foreground">{Math.round(uploadProgress)}%</p>
                            </div>
                        )}
                        {error && (
                            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                <p>{error}</p>
                            </div>
                        )}
                        <Button onClick={handleUpload} disabled={!filesToUpload.length || isUploading} className="w-full">
                            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {isUploading ? (statusMessage || 'Sending...') : `Send ${filesToUpload.length} File(s)`}
                        </Button>
                    </CardContent>
                </Card>
            </main>
            <footer className="w-full max-w-md mt-6">
                 <div className="border rounded-lg p-2 flex items-center justify-center bg-gray-200/50">
                    <Image src="https://placehold.co/320x50.png" alt="Advertisement" width={320} height={50} className="object-contain" data-ai-hint="advertisement banner"/>
                </div>
            </footer>
        </div>
    );
}

export default function UploadPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>}>
            <UploadPageContent />
        </Suspense>
    );
}

    
