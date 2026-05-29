// src/components/app/background-remover.tsx
"use client";

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
const MODEL_SIZE = 512;

// Dynamically load onnxruntime-web from CDN
const loadOrt = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if ((window as any).ort) {
      resolve((window as any).ort);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/ort.min.js';
    script.onload = () => {
      resolve((window as any).ort);
    };
    script.onerror = (err) => reject(new Error('Failed to load ONNX Runtime script'));
    document.head.appendChild(script);
  });
};

export const BackgroundRemover = ({ imageSrc, onComplete, onCancel }: { imageSrc: string, onComplete: (dataUrl: string) => void, onCancel: () => void }) => {
    const [status, setStatus] = useState('Initializing AI model...');
    const { toast } = useToast();

    useEffect(() => {
        let isCancelled = false;

        const processImage = async () => {
            if (!imageSrc) return;

            try {
                setStatus('Loading AI Engine...');
                const ort = await loadOrt();
                if (isCancelled) return;

                // Configure ONNX WebAssembly settings
                ort.env.wasm.numThreads = Math.min(navigator.hardwareConcurrency || 2, 4);
                ort.env.wasm.simd = true;
                ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/';

                const MODEL_URL_INT8 = '/background-remover/models/manthnet_nexus_v2_int8.onnx';
                const MODEL_URL_FP32 = '/background-remover/models/manthnet_nexus_v2.onnx';

                let session: any = null;

                // 1. Try loading hardware-accelerated model via WebGPU if supported
                const checkWebGPUSupport = async () => {
                    const nav = navigator as any;
                    if (!nav.gpu) return false;
                    try {
                        const adapter = await nav.gpu.requestAdapter();
                        return !!adapter;
                    } catch {
                        return false;
                    }
                };

                const hasWebGPU = await checkWebGPUSupport();
                if (hasWebGPU && !isCancelled) {
                    try {
                        setStatus('Loading hardware-accelerated model (WebGPU)...');
                        session = await ort.InferenceSession.create(MODEL_URL_FP32, {
                            executionProviders: ['webgpu'],
                            graphOptimizationLevel: 'all',
                            externalData: [
                                {
                                    path: 'manthnet_nexus_v2.onnx.data',
                                    data: '/background-remover/models/manthnet_nexus_v2.onnx.data'
                                }
                            ]
                        });
                        console.log('[React BackgroundRemover] WebGPU session successfully initialized!');
                    } catch (webgpuErr) {
                        console.warn('[React BackgroundRemover] WebGPU session failed, falling back to CPU:', webgpuErr);
                    }
                }

                // 2. CPU fallback: download and compile the INT8 quantized model locally
                if (!session && !isCancelled) {
                    try {
                        setStatus('Downloading model file (CPU fallback)...');
                        const res = await fetch(MODEL_URL_INT8);
                        if (!res.ok) throw new Error('INT8 model not found on server');

                        const total = parseInt(res.headers.get('Content-Length') || '0');
                        const reader = res.body?.getReader();
                        if (!reader) throw new Error('ReadableStream not supported');

                        const chunks: Uint8Array[] = [];
                        let received = 0;

                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            if (value) {
                                chunks.push(value);
                                received += value.length;
                                if (total) {
                                    const percentage = Math.round((received / total) * 100);
                                    setStatus(`Downloading AI model: ${percentage}%`);
                                }
                            }
                        }

                        if (isCancelled) return;
                        setStatus('Compiling AI engine on CPU...');

                        // Combine chunks into single ArrayBuffer
                        const buffer = new Uint8Array(received);
                        let offset = 0;
                        for (const chunk of chunks) {
                            buffer.set(chunk, offset);
                            offset += chunk.length;
                        }

                        session = await ort.InferenceSession.create(buffer.buffer, {
                            executionProviders: ['wasm'],
                            graphOptimizationLevel: 'all',
                        });
                        console.log('[React BackgroundRemover] CPU/WASM session successfully initialized!');
                    } catch (int8Err) {
                        console.warn('[React BackgroundRemover] INT8 model load failed, trying FP32 on CPU:', int8Err);
                        setStatus('Loading high-compatibility model (CPU)...');
                        session = await ort.InferenceSession.create(MODEL_URL_FP32, {
                            executionProviders: ['wasm'],
                            graphOptimizationLevel: 'all',
                            externalData: [
                                {
                                    path: 'manthnet_nexus_v2.onnx.data',
                                    data: '/background-remover/models/manthnet_nexus_v2.onnx.data'
                                }
                            ]
                        });
                    }
                }

                if (isCancelled || !session) return;
                setStatus('Preprocessing image...');

                // 3. Load image & draw onto a white canvas to extract clean ImageData (prevent alpha pre-multiply issues)
                const img = new Image();
                await new Promise<void>((res, rej) => {
                    img.onload = () => res();
                    img.onerror = () => rej(new Error('Failed to load source image'));
                    img.src = imageSrc;
                });

                const ow = img.naturalWidth;
                const oh = img.naturalHeight;

                const c = document.createElement('canvas');
                c.width = ow;
                c.height = oh;
                const ctx = c.getContext('2d', { willReadFrequently: true });
                if (!ctx) throw new Error('Canvas 2D context not supported');

                ctx.fillStyle = '#ffffff'; // White background compositor
                ctx.fillRect(0, 0, ow, oh);
                ctx.drawImage(img, 0, 0);
                const originalImageData = ctx.getImageData(0, 0, ow, oh);

                // 4. Preprocess: bilinear resize to 512x512 and normalize
                const resizeCanvas = document.createElement('canvas');
                resizeCanvas.width = MODEL_SIZE;
                resizeCanvas.height = MODEL_SIZE;
                const resizeCtx = resizeCanvas.getContext('2d', { willReadFrequently: true });
                if (!resizeCtx) throw new Error('Canvas 2D context not supported');

                resizeCtx.imageSmoothingEnabled = true;
                resizeCtx.imageSmoothingQuality = 'high';
                resizeCtx.drawImage(c, 0, 0, MODEL_SIZE, MODEL_SIZE);
                const resizedData = resizeCtx.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE);

                const { data: px } = resizedData;
                const np = MODEL_SIZE * MODEL_SIZE;
                const tensorData = new Float32Array(3 * np);
                for (let i = 0; i < np; i++) {
                    tensorData[0 * np + i] = (px[i * 4] / 255 - MEAN[0]) / STD[0];
                    tensorData[1 * np + i] = (px[i * 4 + 1] / 255 - MEAN[1]) / STD[1];
                    tensorData[2 * np + i] = (px[i * 4 + 2] / 255 - MEAN[2]) / STD[2];
                }

                if (isCancelled) return;
                setStatus('Running AI inference...');

                // 5. Run ONNX Inference
                const tensor = new ort.Tensor('float32', tensorData, [1, 3, MODEL_SIZE, MODEL_SIZE]);
                const output = await session.run({ input: tensor });
                const alpha = output['alpha'] || output[Object.keys(output)[0]];
                const alphaFlat = alpha.data as Float32Array;

                if (isCancelled) return;
                setStatus('Refining transparent mask...');

                // 6. Bilinear upsample alpha to original size and apply S-curve sharpening
                const alphaFull = new Float32Array(ow * oh);
                for (let py = 0; py < oh; py++) {
                    for (let px2 = 0; px2 < ow; px2++) {
                        const mx = (px2 / Math.max(ow - 1, 1)) * (MODEL_SIZE - 1);
                        const my = (py / Math.max(oh - 1, 1)) * (MODEL_SIZE - 1);
                        const x0 = Math.floor(mx);
                        const x1 = Math.min(x0 + 1, MODEL_SIZE - 1);
                        const y0 = Math.floor(my);
                        const y1 = Math.min(y0 + 1, MODEL_SIZE - 1);
                        const tx = mx - x0;
                        const ty = my - y0;
                        
                        alphaFull[py * ow + px2] =
                            (1 - tx) * (1 - ty) * alphaFlat[y0 * MODEL_SIZE + x0] +
                            tx * (1 - ty) * alphaFlat[y0 * MODEL_SIZE + x1] +
                            (1 - tx) * ty * alphaFlat[y1 * MODEL_SIZE + x0] +
                            tx * ty * alphaFlat[y1 * MODEL_SIZE + x1];
                    }
                }

                const sharpness = 10;
                const threshold = 0.45;
                for (let i = 0; i < alphaFull.length; i++) {
                    alphaFull[i] = 1 / (1 + Math.exp(-sharpness * (alphaFull[i] - threshold)));
                }

                // Write alpha channel back
                const finalImgData = ctx.getImageData(0, 0, ow, oh);
                const freshImg = new Image();
                await new Promise<void>((res, rej) => {
                    freshImg.onload = () => res();
                    freshImg.onerror = () => rej(new Error('Failed to reload fresh image'));
                    freshImg.src = imageSrc;
                });

                // Composite onto transparent canvas to extract pure pixels
                const transCanvas = document.createElement('canvas');
                transCanvas.width = ow;
                transCanvas.height = oh;
                const transCtx = transCanvas.getContext('2d');
                if (transCtx) {
                    transCtx.drawImage(freshImg, 0, 0);
                    const freshData = transCtx.getImageData(0, 0, ow, oh);
                    for (let i = 0; i < ow * oh; i++) {
                        finalImgData.data[i * 4] = freshData.data[i * 4];
                        finalImgData.data[i * 4 + 1] = freshData.data[i * 4 + 1];
                        finalImgData.data[i * 4 + 2] = freshData.data[i * 4 + 2];
                        finalImgData.data[i * 4 + 3] = Math.round(Math.min(Math.max(alphaFull[i], 0), 1) * 255);
                    }
                    transCtx.putImageData(finalImgData, 0, 0);
                    onComplete(transCanvas.toDataURL('image/png'));
                } else {
                    throw new Error('Could not create transparent composite');
                }

            } catch (error: any) {
                if (isCancelled) return;
                console.error('Error removing background:', error);
                toast({ title: "Background Removal Failed", description: error.message || "Please try again.", variant: "destructive" });
                onCancel();
            }
        };

        processImage();

        return () => {
            isCancelled = true;
        };
    }, [imageSrc, onComplete, onCancel, toast]);

    return (
        <div className="w-full flex flex-col items-center justify-center p-6 min-h-[220px] bg-background/50 rounded-2xl border-2 border-dashed border-primary/20 backdrop-blur-sm">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 text-sm font-black text-foreground uppercase tracking-widest">{status}</p>
            <p className="text-xs text-muted-foreground mt-2 font-bold leading-relaxed max-w-[280px] text-center">Processing runs 100% locally in your browser via hardware acceleration.</p>
        </div>
    );
};
