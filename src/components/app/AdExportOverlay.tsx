// src/components/app/AdExportOverlay.tsx
"use client";

import { useEffect, useState } from 'react';
import { Loader2, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdBanner } from './AdBanner';

interface AdExportOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  fileName?: string;
}

export function AdExportOverlay({ isOpen, onClose, onComplete, fileName = 'file' }: AdExportOverlayProps) {
  const [countdown, setCountdown] = useState(5);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Reset state when overlay opens
    setCountdown(5);
    setIsDone(false);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsDone(true);
          onComplete(); // Fire the actual download trigger
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, onComplete]);



  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-md transition-all duration-300">
      <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden p-6 animate-in fade-in-50 zoom-in-95 duration-200 text-center">
        
        {/* Close button (only active after countdown completes) */}
        {isDone && (
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Processing Spinner / Done Check */}
        <div className="flex flex-col items-center justify-center mb-6">
          {!isDone ? (
            <div className="relative flex items-center justify-center">
              <Loader2 className="h-16 w-16 animate-spin text-primary opacity-20" />
              <span className="absolute text-xl font-bold font-mono text-primary">{countdown}</span>
            </div>
          ) : (
            <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center text-primary border border-primary/20">
              <Download className="h-8 w-8 animate-bounce" />
            </div>
          )}
        </div>

        {/* Message Copy */}
        <h2 className="text-xl font-bold font-headline mb-2 text-foreground">
          {!isDone ? 'Generating Your File...' : 'Download Ready!'}
        </h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
          {!isDone 
            ? `We are preparing "${fileName}" for you. This free creator workspace is supported by ads.` 
            : `Your download has started automatically. You can close this window now.`}
        </p>

        {/* Ad block */}
        <div className="border border-border rounded-xl p-3 bg-muted/10 min-h-[120px] flex items-center justify-center">
          <AdBanner slotId="export-overlay-banner" />
        </div>

        {/* Footer actions */}
        <div className="mt-6 flex justify-center gap-3">
          {isDone ? (
            <Button onClick={onClose} className="w-full">Done</Button>
          ) : (
            <Button variant="ghost" disabled className="w-full text-xs text-muted-foreground">
              Please wait {countdown}s to download...
            </Button>
          )}
        </div>

      </div>
    </div>
  );
}
