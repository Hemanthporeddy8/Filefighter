// src/components/app/background-remover.tsx
"use client";

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const BackgroundRemover = ({ imageSrc, onComplete, onCancel }: { imageSrc: string, onComplete: (dataUrl: string) => void, onCancel: () => void }) => {
    const [status, setStatus] = useState('Initializing AI model...');
    const { toast } = useToast();

    useEffect(() => {
        let isCancelled = false;

        const processImage = async () => {
            if (!imageSrc) return;

            setStatus('Loading AI Model...');
            
            try {
                // Dynamically import the heavy library
                const { default: removeBackground } = (await import('@imgly/background-removal')) as any;
                
                if (isCancelled) return;

                setStatus('Processing image...');
                
                const blob = await removeBackground(imageSrc, {
                    onProgress: (progress) => {
                         if (isCancelled) return;
                         // The progress gives valuable info, e.g., about model downloading
                         if(progress.type === 'download' && progress.total > 0){
                             const percentage = Math.round((progress.loaded / progress.total) * 100);
                             setStatus(`Downloading AI model: ${percentage}%`);
                         }
                    },
                });
                
                if (isCancelled) return;

                const reader = new FileReader();
                reader.onloadend = () => {
                    if (!isCancelled) {
                        onComplete(reader.result as string);
                    }
                };
                reader.readAsDataURL(blob);

            } catch (error: any) {
                if (isCancelled) return;
                console.error('Error removing background:', error);
                toast({ title: "Background Removal Failed", description: "The AI model encountered an error. Please try again.", variant: "destructive" });
                onCancel();
            }
        };

        processImage();

        return () => {
            isCancelled = true;
        };
    }, [imageSrc, onComplete, onCancel, toast]);

    return (
        <div className="w-full flex flex-col items-center justify-center p-4 min-h-[200px] bg-muted/50 rounded-lg border border-dashed">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-sm font-medium text-foreground">{status}</p>
            <p className="text-xs text-muted-foreground mt-1">This may take a moment, especially on the first run.</p>
        </div>
    );
};
