
// src/components/app/grading-tool.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { FileUpload } from '@/components/app/file-upload';
import { Loader2 } from 'lucide-react';


interface GradingToolProps {
    initialImageSrc?: string;
    onExport: (dataUrl: string) => void;
    onCancel: () => void;
}

interface Filters {
    brightness: number;
    contrast: number;
    saturation: number;
    highlights: number;
    shadows: number;
    vibrance: number;
    blur: number;
    sharpening: number;
    vignette: number;
}

type Curve = [number, number][];
interface Curves {
    RGB: Curve;
    Red: Curve;
    Green: Curve;
    Blue: Curve;
}

export function GradingTool({ initialImageSrc, onExport, onCancel }: GradingToolProps) {
    const { toast } = useToast();
    const [imgSrc, setImgSrc] = useState<string | null>(initialImageSrc || null);
    const [originalImageData, setOriginalImageData] = useState<ImageData | null>(null);
    const [currentImageData, setCurrentImageData] = useState<ImageData | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const curveCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [filters, setFilters] = useState<Filters>({
        brightness: 0, contrast: 0, saturation: 0, highlights: 0, shadows: 0,
        vibrance: 0, blur: 0, sharpening: 0, vignette: 0
    });

    const [curves, setCurves] = useState<Curves>({
        RGB: [[0, 0], [255, 255]], Red: [[0, 0], [255, 255]],
        Green: [[0, 0], [255, 255]], Blue: [[0, 0], [255, 255]]
    });

    const [currentCurveChannel, setCurrentCurveChannel] = useState<'RGB' | 'Red' | 'Green' | 'Blue'>('RGB');
    const [isDraggingCurve, setIsDraggingCurve] = useState(false);
    const [selectedPoint, setSelectedPoint] = useState<number | null>(null);

    const handleFileSelect = (files: File[]) => {
        const file = files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setImgSrc(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const interpolateCurve = useCallback((x: number, curve: Curve): number => {
        if (x <= curve[0][0]) return curve[0][1];
        if (x >= curve[curve.length - 1][0]) return curve[curve.length - 1][1];
        
        for (let i = 0; i < curve.length - 1; i++) {
            if (x >= curve[i][0] && x <= curve[i + 1][0]) {
                const t = (x - curve[i][0]) / (curve[i + 1][0] - curve[i][0]);
                return curve[i][1] + t * (curve[i + 1][1] - curve[i][1]);
            }
        }
        return x; // Should not happen with sorted curve points
    }, []);

    const applyCurves = useCallback((baseImageData: ImageData) => {
        if (!baseImageData || !canvasRef.current) return;
        
        const imageData = new ImageData(
            new Uint8ClampedArray(baseImageData.data),
            baseImageData.width,
            baseImageData.height
        );
        const data = imageData.data;

        const rgbLookup = Array.from({ length: 256 }, (_, i) => Math.round(interpolateCurve(i, curves.RGB)));
        const redLookup = Array.from({ length: 256 }, (_, i) => Math.round(interpolateCurve(i, curves.Red)));
        const greenLookup = Array.from({ length: 256 }, (_, i) => Math.round(interpolateCurve(i, curves.Green)));
        const blueLookup = Array.from({ length: 256 }, (_, i) => Math.round(interpolateCurve(i, curves.Blue)));

        for (let i = 0; i < data.length; i += 4) {
            let r = rgbLookup[data[i]];
            let g = rgbLookup[data[i+1]];
            let b = rgbLookup[data[i+2]];

            data[i] = redLookup[r];
            data[i+1] = greenLookup[g];
            data[i+2] = blueLookup[b];
        }
        
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
            ctx.putImageData(imageData, 0, 0);
        }

    }, [curves, interpolateCurve]);
    
    const applyAllFilters = useCallback(() => {
        if (!originalImageData) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        
        ctx.putImageData(originalImageData, 0, 0);
        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        const data = imageData.data;
        const brightness = filters.brightness * 2.55;
        const contrast = (filters.contrast + 100) / 100;
        const saturation = (filters.saturation + 100) / 100;

        for (let i = 0; i < data.length; i += 4) {
            // Brightness & Contrast
            data[i] = Math.min(255, Math.max(0, (data[i] - 128) * contrast + 128 + brightness));
            data[i+1] = Math.min(255, Math.max(0, (data[i+1] - 128) * contrast + 128 + brightness));
            data[i+2] = Math.min(255, Math.max(0, (data[i+2] - 128) * contrast + 128 + brightness));

            // Saturation
            const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
            data[i] = Math.min(255, Math.max(0, gray + saturation * (data[i] - gray)));
            data[i+1] = Math.min(255, Math.max(0, gray + saturation * (data[i+1] - gray)));
            data[i+2] = Math.min(255, Math.max(0, gray + saturation * (data[i+2] - gray)));
        }

        setCurrentImageData(imageData);
        applyCurves(imageData);

    }, [originalImageData, filters, applyCurves]);

    useEffect(() => {
        applyAllFilters();
    }, [filters, applyAllFilters]);

    useEffect(() => {
        if (currentImageData) {
            applyCurves(currentImageData);
        }
    }, [curves, currentImageData, applyCurves]);

    useEffect(() => {
        if (!imgSrc) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);

        const imageElement = new window.Image();
        imageElement.crossOrigin = "anonymous";
        imageElement.src = imgSrc;
        
        imageElement.onload = () => {
             const canvas = canvasRef.current;
            if (!canvas) return;
            
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) {
                toast({ title: "Error", description: "Could not create canvas context.", variant: "destructive" });
                setIsLoading(false);
                return;
            }

            const maxWidth = 800;
            const maxHeight = 600;
            let { naturalWidth: width, naturalHeight: height } = imageElement;
            const aspectRatio = width / height;

            if (width > maxWidth) {
                width = maxWidth;
                height = width / aspectRatio;
            }
            if (height > maxHeight) {
                height = maxHeight;
                width = height * aspectRatio;
            }
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(imageElement, 0, 0, width, height);

            try {
                const initialData = ctx.getImageData(0, 0, width, height);
                setOriginalImageData(initialData);
                setCurrentImageData(initialData);
            } catch (e) {
                console.error("Error getting image data:", e);
                toast({ title: "Error", description: "Could not process image data. The image might be from a different origin.", variant: "destructive"});
            } finally {
                setIsLoading(false);
            }
        }
        imageElement.onerror = () => {
             toast({ title: "Image Load Error", description: "Could not load the provided image.", variant: "destructive" });
             setIsLoading(false);
        }
    }, [imgSrc, toast]);

    const drawCurveGrid = useCallback(() => {
        const canvas = curveCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 4; i++) {
            const x = (i / 4) * width;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
            const y = (i / 4) * height;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
        }
    }, []);
    

    const drawCurve = useCallback(() => {
        const canvas = curveCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const width = canvas.width;
        const height = canvas.height;

        drawCurveGrid();
        
        const curve = curves[currentCurveChannel];

        ctx.strokeStyle = '#32a4b8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x <= 255; x++) {
            const y = interpolateCurve(x, curve);
            const canvasX = (x / 255) * width;
            const canvasY = height - (y / 255) * height;
            if (x === 0) ctx.moveTo(canvasX, canvasY);
            else ctx.lineTo(canvasX, canvasY);
        }
        ctx.stroke();

        ctx.fillStyle = '#32a4b8';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        curve.forEach((point, index) => {
            const x = (point[0] / 255) * width;
            const y = height - (point[1] / 255) * height;
            ctx.beginPath();
            ctx.arc(x, y, index === selectedPoint ? 8 : 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        });

    }, [curves, currentCurveChannel, selectedPoint, drawCurveGrid, interpolateCurve]);

    useEffect(() => {
        drawCurve();
    }, [drawCurve]);

    const handleCurveMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = curveCanvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
        
        const curveX = (x / canvas.width) * 255;
        const curveY = 255 - (y / canvas.height) * 255;

        const curve = curves[currentCurveChannel];
        const pointIndex = curve.findIndex(p => Math.sqrt((p[0] - curveX)**2 + (p[1] - curveY)**2) < 15);
        
        if (pointIndex !== -1) {
            setSelectedPoint(pointIndex);
            setIsDraggingCurve(true);
        } else if (curveX > 10 && curveX < 245) {
            const newPoint: [number, number] = [Math.round(curveX), Math.round(curveY)];
            const newCurve = [...curve, newPoint].sort((a, b) => a[0] - b[0]);
            const newPointIndex = newCurve.findIndex(p => p[0] === newPoint[0] && p[1] === newPoint[1]);
            setCurves(prev => ({...prev, [currentCurveChannel]: newCurve }));
            setSelectedPoint(newPointIndex);
            setIsDraggingCurve(true);
        }
    };
    
    const handleCurveMouseMove = useCallback((e: MouseEvent) => {
        if (!isDraggingCurve || selectedPoint === null) return;
        const canvas = curveCanvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
        
        const curveX = Math.round(Math.max(0, Math.min(255, (x / canvas.width) * 255)));
        const curveY = Math.round(Math.max(0, Math.min(255, 255 - (y / canvas.height) * 255)));
        
        setCurves(prev => {
            const curve = [...prev[currentCurveChannel]];
            if (selectedPoint > 0 && selectedPoint < curve.length - 1) {
                 curve[selectedPoint] = [curveX, curveY];
            } else {
                 curve[selectedPoint][1] = curveY;
            }
            curve.sort((a, b) => a[0] - b[0]);
            const newIndex = curve.findIndex(p => p[0] === curveX && p[1] === curveY);
            if(newIndex !== -1) setSelectedPoint(newIndex);
            
            return {...prev, [currentCurveChannel]: curve };
        });

    }, [isDraggingCurve, selectedPoint, currentCurveChannel]);

    const handleCurveMouseUp = useCallback(() => {
        setIsDraggingCurve(false);
        setSelectedPoint(null);
    }, []);

    useEffect(() => {
        if (isDraggingCurve) {
            window.addEventListener('mousemove', handleCurveMouseMove);
            window.addEventListener('mouseup', handleCurveMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleCurveMouseMove);
            window.removeEventListener('mouseup', handleCurveMouseUp);
        };
    }, [isDraggingCurve, handleCurveMouseMove, handleCurveMouseUp]);
    
    const resetAll = () => {
        setFilters({
            brightness: 0, contrast: 0, saturation: 0, highlights: 0, shadows: 0,
            vibrance: 0, blur: 0, sharpening: 0, vignette: 0
        });
        setCurves({
            RGB: [[0, 0], [255, 255]], Red: [[0, 0], [255, 255]],
            Green: [[0, 0], [255, 255]], Blue: [[0, 0], [255, 255]]
        });
        if(originalImageData) {
            setCurrentImageData(originalImageData);
            applyCurves(originalImageData);
        }
        toast({ title: 'Resetted', description: 'All adjustments have been reset.'});
    };
    
    const handleExport = () => {
        const canvas = canvasRef.current;
        if (!canvas) {
            toast({ title: "Export Failed", description: "Canvas not found.", variant: "destructive" });
            return;
        }
        const dataUrl = canvas.toDataURL('image/png');
        onExport(dataUrl);
    };
    
    return (
        <Card className="w-full h-full flex flex-col">
            <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle>Grading Tool</CardTitle>
                 <div className="flex gap-2">
                    <Button variant="outline" onClick={resetAll} disabled={!imgSrc}>Reset</Button>
                    <Button variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button onClick={handleExport} disabled={!imgSrc}>Apply & Save</Button>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex gap-4 overflow-hidden">
                <div className="flex-1 flex items-center justify-center bg-muted/50 rounded-md p-4">
                    {imgSrc ? (
                         <canvas ref={canvasRef} />
                    ) : (
                        <div className="w-full max-w-sm">
                           <FileUpload onFileSelect={handleFileSelect} label="Upload Image to Grade"/>
                        </div>
                    )}
                    {isLoading && imgSrc && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                            <Loader2 className="h-10 w-10 animate-spin" />
                        </div>
                    )}
                </div>
                <div className={cn("w-[320px] flex flex-col", !imgSrc && "pointer-events-none opacity-50")}>
                    <Tabs defaultValue="light" className="flex-1 flex flex-col">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="light">Light</TabsTrigger>
                            <TabsTrigger value="color">Color</TabsTrigger>
                            <TabsTrigger value="curve">Curve</TabsTrigger>
                            <TabsTrigger value="effects">Effects</TabsTrigger>
                        </TabsList>
                        <ScrollArea className="flex-1">
                            <div className="p-4">
                            <TabsContent value="light" className="space-y-4">
                                <ControlSlider label="Brightness" value={filters.brightness} onChange={v => setFilters(f => ({...f, brightness: v}))} min={-100} max={100} />
                                <ControlSlider label="Contrast" value={filters.contrast} onChange={v => setFilters(f => ({...f, contrast: v}))} min={-100} max={100} />
                                <ControlSlider label="Highlights" value={filters.highlights} onChange={v => setFilters(f => ({...f, highlights: v}))} min={-100} max={100} />
                                <ControlSlider label="Shadows" value={filters.shadows} onChange={v => setFilters(f => ({...f, shadows: v}))} min={-100} max={100} />
                            </TabsContent>
                            <TabsContent value="color" className="space-y-4">
                                <ControlSlider label="Saturation" value={filters.saturation} onChange={v => setFilters(f => ({...f, saturation: v}))} min={-100} max={100} />
                                <ControlSlider label="Vibrance" value={filters.vibrance} onChange={v => setFilters(f => ({...f, vibrance: v}))} min={-100} max={100} />
                            </TabsContent>
                            <TabsContent value="curve">
                                <div className="flex gap-1 mb-2">
                                    {(['RGB', 'Red', 'Green', 'Blue'] as const).map(channel => (
                                        <Button key={channel} variant={currentCurveChannel === channel ? 'default' : 'outline'} size="sm" onClick={() => setCurrentCurveChannel(channel)}>{channel}</Button>
                                    ))}
                                </div>
                                <canvas ref={curveCanvasRef} width={256} height={256} className="w-full h-auto bg-gray-800 rounded-md cursor-crosshair" onMouseDown={handleCurveMouseDown} />
                            </TabsContent>
                             <TabsContent value="effects" className="space-y-4">
                                <ControlSlider label="Vignette" value={filters.vignette} onChange={v => setFilters(f => ({...f, vignette: v}))} min={0} max={100} />
                                {/* Add more effects here */}
                            </TabsContent>
                            </div>
                        </ScrollArea>
                    </Tabs>
                </div>
            </CardContent>
        </Card>
    );
}

function ControlSlider({ label, value, onChange, min, max }: { label: string; value: number; onChange: (value: number) => void; min: number; max: number; }) {
    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <Label>{label}</Label>
                <span className="text-sm text-muted-foreground">{value}</span>
            </div>
            <Slider
                value={[value]}
                onValueChange={(v) => onChange(v[0])}
                min={min}
                max={max}
                step={1}
            />
        </div>
    );
}
