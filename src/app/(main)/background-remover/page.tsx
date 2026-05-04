// src/app/(main)/background-remover/page.tsx
"use client";

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { FileUpload } from '@/components/app/file-upload';
import { BackgroundRemover } from '@/components/app/background-remover';
import { Download, UploadCloud } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function BackgroundRemoverPage() {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [resultDataUrl, setResultDataUrl] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const { toast } = useToast();

    const handleFileSelect = (files: File[]) => {
        if (files.length > 0) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const target = e.target as FileReader;
                if(typeof target.result === 'string') {
                    setImageSrc(target.result);
                    setResultDataUrl(null);
                    setIsProcessing(true); // Automatically start processing
                }
            };
            reader.readAsDataURL(files[0]);
        }
    };
    
    const handleDownload = () => {
        if (!resultDataUrl) return;
        const link = document.createElement('a');
        link.href = resultDataUrl;
        link.download = 'background-removed.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
             <div className="bg-white rounded-2xl shadow-xl p-8">
                <div className="text-center mb-6">
                    <h1 className="text-4xl font-bold text-gray-800">Automatic Background Remover</h1>
                     <p className="text-indigo-600 mt-2 font-medium">
                        {isProcessing ? "AI is processing your image..." : (resultDataUrl ? "Your image is ready." : "Upload an image to start.")}
                     </p>
                </div>

                {!imageSrc && (
                    <div className="max-w-md mx-auto">
                        <FileUpload
                          label="Upload an image to remove the background"
                          onFileSelect={handleFileSelect}
                          acceptedFileTypes="image/jpeg,image/png,image/webp"
                          id="bg-remover-upload"
                        />
                    </div>
                )}
                
                {imageSrc && isProcessing && (
                     <BackgroundRemover
                        imageSrc={imageSrc}
                        onComplete={(dataUrl) => {
                            setResultDataUrl(dataUrl);
                            setIsProcessing(false);
                            toast({ title: "Background Removed Successfully!" });
                        }}
                        onCancel={() => {
                            setIsProcessing(false);
                            setImageSrc(null);
                        }}
                    />
                )}

                {resultDataUrl && !isProcessing && (
                    <div className="text-center space-y-4">
                        <div className="inline-block border p-2 rounded-lg shadow-sm bg-gray-50 checkerboard">
                            <Image src={resultDataUrl} alt="Background removed result" width={400} height={300} className="max-w-full h-auto object-contain rounded-md" />
                        </div>
                        <div className="flex justify-center gap-4">
                            <Button onClick={handleDownload} className="bg-gray-800 hover:bg-black text-white">
                                <Download className="mr-2 h-4 w-4" />
                                Download as PNG
                            </Button>
                             <Button variant="outline" onClick={() => { setImageSrc(null); setResultDataUrl(null); }}>
                                <UploadCloud className="mr-2 h-4 w-4" />
                                Upload Another
                            </Button>
                        </div>
                    </div>
                )}
            </div>
             <style jsx global>{`
                .checkerboard {
                    background-image:
                        linear-gradient(45deg, #e0e0e0 25%, transparent 25%),
                        linear-gradient(-45deg, #e0e0e0 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, #e0e0e0 75%),
                        linear-gradient(-45deg, transparent 75%, #e0e0e0 75%);
                    background-size: 20px 20px;
                    background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
                }
            `}</style>
        </div>
    );
}
