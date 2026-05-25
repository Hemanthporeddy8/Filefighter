"use client";

/**
 * src/components/app/same-share-panel.tsx
 *
 * Extracted WebRTC panel that ONLY mounts when the Same Share dialog is opened.
 * Because it's lazy-loaded via next/dynamic + mounted conditionally,
 * the useWebRTC hook never initializes until the user actually opens the dialog.
 *
 * This saves ~8KB of JS + prevents unnecessary WebRTC peer connection setup
 * on every dashboard page load.
 */

import { useState, useEffect } from 'react';
import { useWebRTC } from '@/hooks/use-webrtc';
import { QrCodeDisplay } from '@/components/app/qr-code-display';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReceivedFile {
  name: string;
  data: ArrayBuffer;
  type: string;
  size: number;
}

interface SameSharePanelProps {
  onFilesReceived: (files: ReceivedFile[]) => void;
}

export function SameSharePanel({ onFilesReceived }: SameSharePanelProps) {
  // Generate session ID once on mount (not on every parent render)
  const [sessionId] = useState(() => `webrtc-session-${Date.now()}`);

  const { isConnected, receivedFiles, clearReceivedFiles } = useWebRTC(true, sessionId);

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/share?sessionId=${sessionId}`
    : '';

  // Forward received files to parent
  useEffect(() => {
    if (receivedFiles.length > 0) {
      onFilesReceived(receivedFiles);
      clearReceivedFiles();
    }
  }, [receivedFiles, onFilesReceived, clearReceivedFiles]);

  return (
    <div className="py-4 space-y-4 flex flex-col items-center">
      {shareUrl ? (
        <>
          <QrCodeDisplay value={shareUrl} size={256} id="same-share-webrtc-qr" />
          <div className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                'h-2.5 w-2.5 rounded-full transition-colors',
                isConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
              )}
            />
            <span>
              {isConnected ? 'A peer is connected.' : 'Waiting for a peer to connect...'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            This QR code is unique for this session. Close this dialog to invalidate it.
          </p>
        </>
      ) : (
        <div className="h-[256px] flex items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span>Initializing secure session...</span>
        </div>
      )}
    </div>
  );
}
