// src/app/share/page.tsx
"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { FileUpload } from '@/components/app/file-upload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, FilePlus2, Loader2, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useWebRTC } from '@/hooks/use-webrtc';
import { cn } from '@/lib/utils';

const StatusIndicator = ({ status, isConnected }: { status: string, isConnected: boolean }) => {
    let text, color;

    if (isConnected) {
        text = 'Connected';
        color = 'bg-green-500';
    } else if (status.includes('fail') || status.includes('error')) {
        text = 'Connection Failed';
        color = 'bg-red-500';
    } else {
        text = 'Connecting...';
        color = 'bg-yellow-500 animate-pulse';
    }


    return (
        <div className="flex items-center gap-1.5 text-xs">
            {isConnected ? <Wifi className="h-4 w-4 text-green-600" /> : <WifiOff className="h-4 w-4 text-red-600" />}
            <span className="capitalize text-muted-foreground">{text}</span>
        </div>
    );
};

function SharePageContent() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('sessionId');
    const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
    const [senderName, setSenderName] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    const [lastUploadCount, setLastUploadCount] = useState(0);

    // WebRTC hook as the client
    const { isConnected, error: webrtcError, sendFile, uploadProgress, statusMessage } = useWebRTC(false, sessionId);

    const handleFilesSelectedForUpload = (files: File[]) => {
        setFilesToUpload(files);
        setIsSuccess(false);
    };

    const handleUpload = async () => {
        if (filesToUpload.length === 0) {
            alert("Please select files to upload.");
            return;
        }
        if (!isConnected) {
             alert("Not connected to the host. Please ensure the host's 'Same Share' dialog is open.");
            return;
        }

        try {
            for (const file of filesToUpload) {
                await sendFile(file);
            }
            setLastUploadCount(filesToUpload.length);
            setIsSuccess(true);
            setFilesToUpload([]);

        } catch (err: any) {
            console.error("Upload error:", err);
        }
    };
    
    if (!sessionId) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <Card className="w-full max-w-md shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-destructive">Invalid Link</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>This share link is missing a session ID. Please re-scan the QR code.</p>
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
                        <h2 className="text-2xl font-semibold">Transfer Complete!</h2>
                        <p className="text-muted-foreground mt-2">
                           {lastUploadCount} file(s) have been successfully sent to the dashboard.
                        </p>
                         <Button onClick={() => setIsSuccess(false)} className="mt-6">
                            Send More Files
                        </Button>
                    </CardContent>
                 </Card>
            </div>
        )
    }
    
    const isUploading = uploadProgress > 0 && uploadProgress < 100;

    return (
        <div className="flex flex-col items-center justify-start min-h-screen bg-gray-100 p-4 pt-8 sm:pt-12">
            <main className="w-full max-w-md">
                <Card className="w-full shadow-lg mx-auto">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <CardTitle className="flex items-center"><FilePlus2 className="mr-2 text-primary"/>Send Files via Same Share</CardTitle>
                                <CardDescription>
                                    Your files will be sent directly to the dashboard peer-to-peer.
                                </CardDescription>
                            </div>
                           <StatusIndicator status={statusMessage} isConnected={isConnected} />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="space-y-2">
                            <Label htmlFor="sender-name">Your Name (Optional)</Label>
                            <Input 
                                id="sender-name" 
                                placeholder="So they know who sent it"
                                value={senderName}
                                onChange={(e) => setSenderName(e.target.value)}
                                disabled={isUploading}
                            />
                        </div>
                        <FileUpload
                            onFileSelect={handleFilesSelectedForUpload}
                            id="qr-upload-page-input"
                            multiple
                            sessionId={sessionId}
                        />
                        {(isUploading || statusMessage.includes('Sending')) && (
                             <div className="space-y-2">
                                <Label>{statusMessage}</Label>
                                <Progress value={uploadProgress} />
                                <p className="text-xs text-center text-muted-foreground">{Math.round(uploadProgress)}%</p>
                            </div>
                        )}
                        {webrtcError && (
                             <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                <p>{webrtcError}</p>
                            </div>
                        )}
                        <Button onClick={handleUpload} disabled={!filesToUpload.length || isUploading || !isConnected} className="w-full">
                            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {isUploading ? (statusMessage || 'Sending...') : `Send ${filesToUpload.length} File(s)`}
                        </Button>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}

export default function SharePage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>}>
            <SharePageContent />
        </Suspense>
    );
}
