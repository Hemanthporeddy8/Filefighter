
// src/app/(main)/video-editor/page.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FileUpload } from '@/components/app/file-upload';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { 
    Loader2, 
    Video as VideoIcon, 
    UploadCloud,
    Play, 
    Pause, 
    Scissors, 
    Download, 
    Film, 
    SlidersHorizontal,
    Music,
    Type,
    Sparkles,
    ZoomIn,
    ZoomOut,
    SkipBack,
    SkipForward,
    Undo,
    Trash2,
    Palette,
    Image as ImageIcon,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { FilterSettings, TrimSettings, TransformSettings, BlendMode, AudioTrack, TextLayer } from '@/types/video';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import NextImage from 'next/image';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';

const formatTime = (time: number) => {
    if (isNaN(time) || time < 0) return '00:00.00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const milliseconds = Math.floor((time % 1) * 100);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(2, '0')}`;
};

const defaultFilters: FilterSettings = {
    brightness: 100,
    contrast: 100,
    saturate: 100,
    grayscale: 0,
    temperature: 0,
    tint: 0,
};

const defaultTransform: TransformSettings = {
    position: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotation: 0,
};

const blendModes: BlendMode[] = [
    'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 
    'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'
];

interface MediaAsset {
  id: string;
  file: File;
  src: string;
  thumbnail: string;
  duration: number;
}

interface TimelineClip extends MediaAsset {
  type: 'video' | 'image';
  start: number;
  filters: FilterSettings;
  trim: TrimSettings;
  transform: TransformSettings;
  blendMode: BlendMode;
}

const placeholderEffects = ["Glitch", "VHS", "Noise", "Old Film", "Scanlines", "Pixelate"];
const webSafeFonts = [
  'Arial', 'Verdana', 'Georgia', 'Times New Roman', 'Courier New', 
  'Roboto', 'Montserrat', 'Lato', 'Oswald'
];


export default function VideoEditorPage() {
    const [clips, setClips] = useState<TimelineClip[]>([]);
    const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
    const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
    const [activeLayer, setActiveLayer] = useState<{ id: string; type: 'video' | 'audio' | 'text' } | null>(null);

    const [currentClipIndex, setCurrentClipIndex] = useState(0);
    const videoRef = useRef<HTMLVideoElement>(null);
    const previewContainerRef = useRef<HTMLDivElement>(null);
    const timelineContainerRef = useRef<HTMLDivElement>(null);
    const playheadRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef<number>();
    
    const [isProcessing, setIsProcessing] = useState(false);
    const { toast } = useToast();
    
    const [isPlaying, setIsPlaying] = useState(false);
    const isPlayingRef = useRef(isPlaying);
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

    const [globalTime, setGlobalTime] = useState(0);
    const [timelineZoom, setTimelineZoom] = useState(1);
    
    const [draggingTrimHandle, setDraggingTrimHandle] = useState<'start' | 'end' | null>(null);
    
    const [history, setHistory] = useState<(TimelineClip[])[][]>([[[]]]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const [draggedLayerInfo, setDraggedLayerInfo] = useState<{ id: string; type: 'text'; offsetX: number; offsetY: number; } | null>(null);

    const objectUrlsRef = useRef<Set<string>>(new Set());

    // Cleanup Object URLs on unmount
    useEffect(() => {
        const urls = objectUrlsRef.current;
        return () => {
            urls.forEach(url => {
                if (url.startsWith('blob:')) {
                    URL.revokeObjectURL(url);
                }
            });
            urls.clear();
        };
    }, []);

    const registerObjectUrl = (url: string) => {
        if (url.startsWith('blob:')) {
            objectUrlsRef.current.add(url);
        }
    };

    const inspectorClip = activeLayer?.type === 'video' ? clips.find(c => c.id === activeLayer.id) : undefined;
    const inspectorAudio = activeLayer?.type === 'audio' ? audioTracks.find(c => c.id === activeLayer.id) : undefined;
    const inspectorText = activeLayer?.type === 'text' ? textLayers.find(c => c.id === activeLayer.id) : undefined;
    
    const totalVideoDuration = clips.reduce((acc, clip) => acc + (clip.trim.end - clip.trim.start), 0);
    const maxAudioTime = audioTracks.reduce((max, track) => Math.max(max, track.start + track.duration), 0);
    const maxTextTime = textLayers.reduce((max, layer) => Math.max(max, layer.start + layer.duration), 0);

    const totalDuration = Math.max(totalVideoDuration, maxAudioTime, maxTextTime, 10);

    const pushClipsToHistory = useCallback((newClips: TimelineClip[][]) => {
        setClips(newClips[0] || []);
        // For now, only video clips are in history
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newClips);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    }, [history, historyIndex]);

    const generateVideoThumbnail = (videoEl: HTMLVideoElement): Promise<string> => {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const onSeeked = () => {
                canvas.width = videoEl.videoWidth;
                canvas.height = videoEl.videoHeight;
                canvas.getContext('2d')?.drawImage(videoEl, 0, 0, canvas.width, videoEl.videoHeight);
                resolve(canvas.toDataURL('image/jpeg'));
                videoEl.onseeked = null; // Clean up listener
            };
            videoEl.onseeked = onSeeked;
            videoEl.currentTime = 0.01;
        });
    }
    
    const handleFileSelect = async (files: File[]) => {
        if (files.length === 0) return;
        setIsProcessing(true);
        toast({ title: "Processing media...", description: "Generating thumbnails and reading metadata."});
        
        try {
            const newClipsPromises = files.map(file => new Promise<TimelineClip>((resolve, reject) => {
                if (file.type.startsWith('video/')) {
                    const video = document.createElement('video');
                    const src = URL.createObjectURL(file);
                    registerObjectUrl(src);
                    video.src = src;

                    video.onloadedmetadata = async () => {
                        const thumbnail = await generateVideoThumbnail(video);
                        const videoDuration = video.duration;
                        resolve({
                            id: `clip_${file.name}_${Date.now()}`, type: 'video',
                            file, src, thumbnail, duration: videoDuration, start: totalDuration,
                            filters: { ...defaultFilters }, trim: { start: 0, end: videoDuration },
                            transform: { ...defaultTransform }, blendMode: 'normal',
                        });
                    };
                    video.onerror = () => reject(new Error(`Failed to load video: ${file.name}`));
                } else if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const src = e.target?.result as string;
                        resolve({
                             id: `clip_${file.name}_${Date.now()}`, type: 'image',
                             file, src, thumbnail: src, duration: 5, start: totalDuration,
                             filters: { ...defaultFilters }, trim: { start: 0, end: 5 },
                             transform: { ...defaultTransform }, blendMode: 'normal',
                        });
                    };
                    reader.onerror = () => reject(new Error(`Failed to load image: ${file.name}`));
                    reader.readAsDataURL(file);
                } else {
                    reject(new Error(`${file.name} is not a valid video or image file.`));
                }
            }));

            const newClips = await Promise.all(newClipsPromises);

            pushClipsToHistory([[...clips, ...newClips]]);
            
            if (!activeLayer && newClips.length > 0) {
                setActiveLayer({ id: newClips[0].id, type: 'video' });
            }
            toast({ title: "Media added", description: `${newClips.length} file(s) added to the media bin.`});

        } catch (error: any) {
            toast({ title: 'Error processing files', description: error.message, variant: 'destructive'});
        } finally {
             setIsProcessing(false);
        }
    };
    
    const handleAudioFileSelect = async (files: File[]) => {
        if (files.length === 0) return;
        try {
            const newAudioPromises = files.map(file => new Promise<AudioTrack>((resolve, reject) => {
                if (!file.type.startsWith('audio/')) {
                    reject(new Error(`${file.name} is not a valid audio file.`));
                    return;
                }
                const audio = document.createElement('audio');
                const src = URL.createObjectURL(file);
                registerObjectUrl(src);
                audio.src = src;
                audio.onloadedmetadata = () => {
                    resolve({ id: `audio_${file.name}_${Date.now()}`, file, src, name: file.name, duration: audio.duration, start: globalTime });
                };
                audio.onerror = () => reject(new Error(`Failed to load audio: ${file.name}`));
            }));
            const newAudio = await Promise.all(newAudioPromises);
            setAudioTracks(prev => [...prev, ...newAudio]);
            toast({ title: "Audio added", description: `${newAudio.length} audio file(s) added.` });
        } catch (error: any) {
            toast({ title: 'Error processing audio', description: error.message, variant: 'destructive'});
        }
    };
    
    const handleAddText = () => {
        const newTextLayer: TextLayer = {
            id: `text_${Date.now()}`,
            content: 'New Text',
            font: 'Roboto',
            size: 48,
            color: '#ffffff',
            transform: { ...defaultTransform, position: { x: 50, y: 50 } }, // Default to center
            blendMode: 'normal',
            start: globalTime,
            duration: 5,
        };
        setTextLayers(prev => [...prev, newTextLayer]);
        setActiveLayer({ id: newTextLayer.id, type: 'text' });
    };

    const handlePlayPause = () => {
        setIsPlaying(!isPlaying);
    };

    const handleSeekFrame = (direction: 'forward' | 'backward') => {
        const frameTime = 1 / 30; // Assuming 30 FPS
        const newGlobalTime = globalTime + (direction === 'forward' ? frameTime : -frameTime);
        seekToGlobalTime(newGlobalTime);
    }

    const findClipIndexAtTime = (time: number, clipList: TimelineClip[]) => {
        let cumulativeDuration = 0;
        for (let i = 0; i < clipList.length; i++) {
            const clipDuration = clipList[i].trim.end - clipList[i].trim.start;
            if (time < cumulativeDuration + clipDuration) {
                return i;
            }
            cumulativeDuration += clipDuration;
        }
        return clipList.length > 0 ? clipList.length - 1 : -1;
    };
    
    useEffect(() => {
        let lastTime = performance.now();

        const playbackLoop = (currentTime: number) => {
            if (!isPlayingRef.current) {
                animationFrameRef.current = undefined;
                return;
            }

            const deltaTime = (currentTime - lastTime) / 1000;
            lastTime = currentTime;

            setGlobalTime(prevGlobalTime => {
                const newGlobalTime = Math.min(prevGlobalTime + deltaTime, totalDuration);
                
                if (newGlobalTime >= totalDuration) {
                    setIsPlaying(false);
                    return totalDuration;
                }
                
                const newClipIndex = findClipIndexAtTime(newGlobalTime, clips);
                if (newClipIndex !== currentClipIndex) {
                    setCurrentClipIndex(newClipIndex);
                }

                return newGlobalTime;
            });
            
            animationFrameRef.current = requestAnimationFrame(playbackLoop);
        };

        if (isPlaying) {
            lastTime = performance.now();
            animationFrameRef.current = requestAnimationFrame(playbackLoop);
        } else {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = undefined;
            }
        }

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isPlaying, clips, totalDuration, currentClipIndex]);
    
    useEffect(() => {
        const video = videoRef.current;
        const currentClip = clips[currentClipIndex];
        
        if (!video || !currentClip || currentClip.type !== 'video') {
            if (video?.played.length) video.pause();
            return;
        }
    
        if (video.src !== currentClip.src) {
            video.src = currentClip.src;
        }
        
        const timeInClip = globalTime - clips.slice(0, currentClipIndex).reduce((acc, c) => acc + (c.trim.end - c.trim.start), 0);
        const targetTime = currentClip.trim.start + timeInClip;
        
        if (Math.abs(video.currentTime - targetTime) > 0.1) {
            video.currentTime = targetTime;
        }

        if (isPlaying && video.paused) {
            video.play().catch(e => {
                if (e.name !== 'AbortError') console.error("Playback error:", e);
            });
        } else if (!isPlaying && !video.paused) {
            video.pause();
        }

    }, [globalTime, currentClipIndex, clips, isPlaying]);


    const seekToGlobalTime = useCallback((time: number) => {
        const newGlobalTime = Math.max(0, Math.min(totalDuration, time));
        setGlobalTime(newGlobalTime);

        const newClipIndex = findClipIndexAtTime(newGlobalTime, clips);
        setCurrentClipIndex(newClipIndex);

    }, [clips, totalDuration]);

    const handleTimelineClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (!timelineContainerRef.current || totalDuration === 0) return;
        const rect = timelineContainerRef.current.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const percentage = clickX / rect.width;
        seekToGlobalTime(percentage * totalDuration);
    };

    const applyClipStyles = (clip: TimelineClip | undefined): React.CSSProperties => {
        if (!clip) return {};
        const { filters, transform, blendMode } = clip;
        const style: React.CSSProperties = {
            filter: `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%) grayscale(${filters.grayscale}%)`,
            transform: `translate(${transform.position.x}px, ${transform.position.y}px) scale(${transform.scale.x}, ${transform.scale.y}) rotate(${transform.rotation}deg)`,
            mixBlendMode: blendMode === 'normal' ? 'normal' : blendMode as any,
        };
        return style;
    };

    const handleSplitClip = () => {
        const clipIndex = findClipIndexAtTime(globalTime, clips);
        if (clipIndex === -1) return;

        const clipToSplit = clips[clipIndex];
        const cumulativeTime = clips.slice(0, clipIndex).reduce((acc, c) => acc + (c.trim.end - c.trim.start), 0);
        const splitTimeInClip = globalTime - cumulativeTime + clipToSplit.trim.start;
    
        if (clipToSplit.type !== 'video' || splitTimeInClip <= clipToSplit.trim.start + 0.1 || splitTimeInClip >= clipToSplit.trim.end - 0.1) {
            toast({ title: "Cannot Split", description: "Cannot split an image or at the very start/end of a video clip." });
            return;
        }
    
        const firstPart = { ...clipToSplit, id: `clip_split_${clipToSplit.file.name}_${Date.now()}`, trim: { ...clipToSplit.trim, end: splitTimeInClip } };
        const secondPart = {
            ...clipToSplit,
            id: `clip_${clipToSplit.file.name}_${Date.now()}`,
            trim: { ...clipToSplit.trim, start: splitTimeInClip }
        };
    
        const newClips = [...clips];
        newClips.splice(clipIndex, 1, firstPart, secondPart);
    
        pushClipsToHistory([newClips]);
        toast({ title: "Clip Split", description: `Clip "${clipToSplit.file.name}" was split.` });
    };
    
    const handleDeleteLayer = () => {
        if (!activeLayer) {
            toast({ title: "No layer selected", description: "Please select a layer to delete." });
            return;
        }
        if (activeLayer.type === 'video') {
            const deletedIndex = clips.findIndex(c => c.id === activeLayer.id);
            const newClips = clips.filter(c => c.id !== activeLayer.id);
            pushClipsToHistory([newClips]);
            const nextClipToSelect = newClips[Math.max(0, deletedIndex - 1)] || newClips[0] || null;
            setActiveLayer(nextClipToSelect ? { id: nextClipToSelect.id, type: 'video' } : null);
        } else if (activeLayer.type === 'text') {
            setTextLayers(prev => prev.filter(l => l.id !== activeLayer.id));
            setActiveLayer(null);
        }
        toast({ title: "Layer Deleted" });
    };

    const handleUndo = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setClips(history[newIndex][0] || []);
            const currentActiveClipExists = (history[newIndex][0] || []).some(c => c.id === activeLayer?.id);
            if (!currentActiveClipExists) {
                setActiveLayer(null);
            }
        } else {
            toast({ title: "Nothing to undo", variant: "default" });
        }
    };

    const handleExport = async () => {
        if (clips.length === 0 || !videoRef.current) return;
        
        setIsProcessing(true);
        toast({ 
            title: 'Exporting Video', 
            description: 'Recording preview... Please wait until playback finishes.',
        });

        try {
            const video = videoRef.current;
            const stream = (video as any).captureStream ? (video as any).captureStream() : (video as any).mozCaptureStream ? (video as any).mozCaptureStream() : null;
            
            if (!stream) {
                throw new Error("Your browser does not support video stream capture.");
            }

            const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
            const chunks: Blob[] = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = async () => {
                try {
                    toast({ title: 'Converting to MP4...', description: 'Please leave this page open.', duration: 15000 });
                    const blob = new Blob(chunks, { type: 'video/webm' });
                    
                    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
                    const { fetchFile, toBlobURL } = await import('@ffmpeg/util');

                    const ffmpeg = new FFmpeg();
                    
                    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
                    await ffmpeg.load({
                        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                    });

                    await ffmpeg.writeFile('input.webm', await fetchFile(blob));
                    await ffmpeg.exec(['-i', 'input.webm', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', 'output.mp4']);
                    
                    const data = await ffmpeg.readFile('output.mp4');
                    const mp4Blob = new Blob([data as any], { type: 'video/mp4' });

                    const url = URL.createObjectURL(mp4Blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `fileflow-export-${Date.now()}.mp4`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    
                    setIsProcessing(false);
                    toast({ title: 'Export Complete', description: 'Your MP4 video has been downloaded.' });
                } catch (err: any) {
                    console.error('FFmpeg error:', err);
                    toast({ title: 'Conversion Failed', description: err.message, variant: 'destructive' });
                    
                    // Fallback to webm if ffmpeg fails
                    const blob = new Blob(chunks, { type: 'video/webm' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `fileflow-export-fallback.webm`;
                    document.body.appendChild(link);
                    link.click();
                    URL.revokeObjectURL(url);
                    
                    setIsProcessing(false);
                }
            };

            // Start from beginning
            seekToGlobalTime(0);
            setIsPlaying(true);
            recorder.start();

            // Stop recording when total duration is reached
            const checkEnd = setInterval(() => {
                if (globalTime >= totalDuration - 0.1) {
                    recorder.stop();
                    setIsPlaying(false);
                    clearInterval(checkEnd);
                }
            }, 100);

        } catch (error: any) {
            console.error("Export failed:", error);
            toast({ title: 'Export Failed', description: error.message, variant: 'destructive' });
            setIsProcessing(false);
        }
    };

    const updateClip = (clipId: string, updates: Partial<TimelineClip> | ((clip:TimelineClip) => Partial<TimelineClip>)) => {
        setClips(prev => prev.map(clip => {
            if (clip.id === clipId) {
                const newUpdates = typeof updates === 'function' ? updates(clip) : updates;
                return { ...clip, ...newUpdates };
            }
            return clip;
        }));
    };
    
     const updateTextLayer = (layerId: string, updates: Partial<TextLayer> | ((layer: TextLayer) => Partial<TextLayer>)) => {
        setTextLayers(prev => prev.map(layer => {
            if (layer.id === layerId) {
                const newUpdates = typeof updates === 'function' ? updates(layer) : updates;
                return { ...layer, ...newUpdates };
            }
            return layer;
        }));
    };

    const getTextLayerBoundingBox = (layer: TextLayer): { x: number; y: number; width: number; height: number } => {
        const lines = layer.content.split('\n');
        const lineHeight = layer.size * 1.2;
        const height = lines.length * lineHeight;
        const width = Math.max(...lines.map(line => line.length)) * (layer.size * 0.6);
        return { x: layer.transform.position.x, y: layer.transform.position.y, width, height };
    };

    const handlePreviewMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!previewContainerRef.current) return;
        const rect = previewContainerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        for (let i = textLayers.length - 1; i >= 0; i--) {
            const layer = textLayers[i];
            const isVisible = globalTime >= layer.start && globalTime < layer.start + layer.duration;
            if (!isVisible) continue;

            const box = getTextLayerBoundingBox(layer);
            if (x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) {
                setActiveLayer({ id: layer.id, type: 'text' });
                setDraggedLayerInfo({ id: layer.id, type: 'text', offsetX: x - box.x, offsetY: y - box.y });
                return;
            }
        }

        const videoLayer = clips.find((_, index) => index === currentClipIndex);
        if (videoLayer) {
            setActiveLayer({ id: videoLayer.id, type: 'video' });
        } else {
             setActiveLayer(null);
        }
        setDraggedLayerInfo(null);
    };

    const handlePreviewMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!draggedLayerInfo || !previewContainerRef.current) return;
        const rect = previewContainerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (draggedLayerInfo.type === 'text') {
            updateTextLayer(draggedLayerInfo.id, layer => ({
                transform: {
                    ...layer.transform,
                    position: {
                        x: x - draggedLayerInfo.offsetX,
                        y: y - draggedLayerInfo.offsetY
                    }
                }
            }));
        }
    };

    const handlePreviewMouseUp = () => {
        setDraggedLayerInfo(null);
    };
    
    const playheadPosition = totalDuration > 0 ? (globalTime / totalDuration) * 100 : 0;
    const currentClip = clips[currentClipIndex];

    return (
        <div 
            className="flex flex-col h-[calc(100vh-120px)] w-full text-foreground bg-muted/30 p-2 gap-2 rounded-lg"
            onMouseMove={handlePreviewMouseMove}
            onMouseUp={handlePreviewMouseUp}
            onMouseLeave={handlePreviewMouseUp}
        >
            <div className="flex flex-1 gap-2 min-h-0">
                <Card className="w-1/4 max-w-xs flex flex-col">
                    <Tabs defaultValue="media" className="flex-1 flex flex-col">
                        <CardHeader>
                            <TabsList className="grid w-full grid-cols-5">
                                <TabsTrigger value="media" title="Media"><Film /></TabsTrigger>
                                <TabsTrigger value="image" title="Images"><ImageIcon /></TabsTrigger>
                                <TabsTrigger value="audio" title="Audio"><Music /></TabsTrigger>
                                <TabsTrigger value="text" title="Text"><Type /></TabsTrigger>
                                <TabsTrigger value="effects" title="Effects"><Sparkles /></TabsTrigger>
                            </TabsList>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col gap-2 p-2 min-h-0">
                             <TabsContent value="media" className="flex-1 flex flex-col gap-2 mt-0">
                                <FileUpload onFileSelect={handleFileSelect} label="Upload Videos" acceptedFileTypes="video/*" multiple/>
                                <Label className="text-xs text-muted-foreground px-2">Video Bin</Label>
                                <ScrollArea className="flex-1 rounded-md border p-1">
                                    {clips.filter(c => c.type === 'video').length === 0 && !isProcessing && <div className="text-center text-muted-foreground text-sm p-4">Your videos will appear here.</div>}
                                    {isProcessing && <div className="text-center text-muted-foreground text-sm p-4"><Loader2 className="animate-spin inline-block mr-2" />Processing...</div>}
                                    <div className="space-y-2">
                                        {clips.filter(c => c.type === 'video').map(clip => (
                                            <div key={clip.id} onClick={() => setActiveLayer({id: clip.id, type: 'video'})} className={cn("flex items-center gap-2 p-1 rounded-md cursor-pointer hover:bg-muted", activeLayer?.id === clip.id && "bg-primary/10 ring-1 ring-primary")}>
                                                <NextImage src={clip.thumbnail} alt={clip.file.name} width={80} height={45} className="rounded-sm object-cover aspect-video" />
                                                <div className="text-xs overflow-hidden"><p className="truncate font-medium" title={clip.file.name}>{clip.file.name}</p><p className="text-muted-foreground">{formatTime(clip.duration)}</p></div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </TabsContent>
                             <TabsContent value="image" className="flex-1 flex flex-col gap-2 mt-0">
                                <FileUpload onFileSelect={handleFileSelect} label="Upload Images" acceptedFileTypes="image/*" multiple/>
                                <Label className="text-xs text-muted-foreground px-2">Image Bin</Label>
                                <ScrollArea className="flex-1 rounded-md border p-1">
                                    {clips.filter(c => c.type === 'image').length === 0 && <div className="text-center text-muted-foreground text-sm p-4">Your images will appear here.</div>}
                                    <div className="grid grid-cols-2 gap-2">
                                        {clips.filter(c => c.type === 'image').map(clip => (
                                            <div key={clip.id} onClick={() => setActiveLayer({id: clip.id, type: 'video'})} className={cn("relative rounded-md cursor-pointer aspect-square hover:ring-2 hover:ring-primary", activeLayer?.id === clip.id && "ring-2 ring-primary")}>
                                                <NextImage src={clip.thumbnail} alt={clip.file.name} fill className="object-cover rounded-md"/>
                                                <p className="absolute bottom-1 left-1 text-white text-[10px] bg-black/60 px-1 rounded truncate max-w-[calc(100%-8px)]">{clip.file.name}</p>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                             </TabsContent>
                             <TabsContent value="audio" className="flex-1 flex flex-col gap-2 mt-0">
                                <FileUpload onFileSelect={handleAudioFileSelect} label="Upload Audio" acceptedFileTypes="audio/*" multiple/>
                                <Label className="text-xs text-muted-foreground px-2">Audio Tracks</Label>
                                <ScrollArea className="flex-1 rounded-md border p-1">
                                    {audioTracks.length === 0 && <div className="text-center text-muted-foreground text-sm p-4">Your audio files will appear here.</div>}
                                    <div className="space-y-2">
                                        {audioTracks.map(track => (
                                            <div key={track.id} onClick={() => setActiveLayer({id: track.id, type: 'audio'})} className={cn("flex items-center gap-2 p-1 rounded-md cursor-pointer hover:bg-muted", activeLayer?.id === track.id && "bg-primary/10 ring-1 ring-primary")}>
                                                <div className="w-20 h-[45px] bg-muted rounded-sm flex items-center justify-center"><Music className="h-6 w-6 text-muted-foreground"/></div>
                                                <div className="text-xs overflow-hidden"><p className="truncate font-medium" title={track.name}>{track.name}</p><p className="text-muted-foreground">{formatTime(track.duration)}</p></div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                             </TabsContent>
                             <TabsContent value="text" className="flex-1 flex flex-col gap-2 mt-0">
                                <Button onClick={handleAddText}><Type className="mr-2"/>Add Text</Button>
                                <Label className="text-xs text-muted-foreground px-2">Text Layers</Label>
                                 <ScrollArea className="flex-1 rounded-md border p-1">
                                    {textLayers.length === 0 && <div className="text-center text-muted-foreground text-sm p-4">Your text layers will appear here.</div>}
                                    <div className="space-y-2">
                                        {textLayers.map(layer => (
                                            <div key={layer.id} onClick={() => setActiveLayer({id: layer.id, type: 'text'})} className={cn("flex items-center justify-between gap-2 p-2 rounded-md cursor-pointer hover:bg-muted", activeLayer?.id === layer.id && "bg-primary/10 ring-1 ring-primary")}>
                                                <p className="truncate text-sm">{layer.content}</p>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                             </TabsContent>
                             <TabsContent value="effects" className="mt-0">
                                 <ScrollArea className="h-full">
                                    <div className="grid grid-cols-2 gap-2">
                                        {placeholderEffects.map(effect => (
                                            <Button key={effect} variant="outline" className="h-16 flex-col" onClick={() => toast({title: "Coming Soon!", description: `${effect} effect will be available in a future update.`})}>
                                                <Sparkles className="h-5 w-5 mb-1"/>
                                                <span className="text-xs">{effect}</span>
                                            </Button>
                                        ))}
                                    </div>
                                </ScrollArea>
                             </TabsContent>
                        </CardContent>
                    </Tabs>
                </Card>

                <div className="flex-1 flex flex-col gap-2">
                    <div 
                        ref={previewContainerRef}
                        className="flex-1 bg-black rounded-md flex items-center justify-center relative overflow-hidden"
                        onMouseDown={handlePreviewMouseDown}
                    >
                         {currentClip && currentClip.type === 'video' && (
                            <video
                                key={currentClip.id}
                                ref={videoRef}
                                className="max-w-full max-h-full"
                                style={applyClipStyles(currentClip)}
                            />
                        )}
                        {currentClip && currentClip.type === 'image' && (
                             <NextImage
                                src={currentClip.src}
                                alt={currentClip.file.name}
                                fill
                                className="object-contain"
                                style={applyClipStyles(currentClip)}
                            />
                        )}
                        {!currentClip && (
                             <div className="text-center text-muted-foreground">
                                <UploadCloud className="mx-auto h-12 w-12" />
                                <p className="mt-2">Upload a video to start editing</p>
                            </div>
                        )}
                        
                        {textLayers
                            .filter(layer => globalTime >= layer.start && globalTime < layer.start + layer.duration)
                            .map(layer => {
                            const isSelected = activeLayer?.type === 'text' && activeLayer.id === layer.id;
                            return (
                                <div 
                                    key={layer.id} 
                                    className={cn("absolute cursor-move pointer-events-none", isSelected && "border border-dashed border-primary")}
                                    style={{
                                        left: layer.transform.position.x,
                                        top: layer.transform.position.y,
                                        transform: `scale(${layer.transform.scale.x}, ${layer.transform.scale.y}) rotate(${layer.transform.rotation}deg)`,
                                        color: layer.color,
                                        fontSize: layer.size,
                                        fontFamily: layer.font,
                                        mixBlendMode: layer.blendMode as any,
                                        textShadow: '1px 1px 3px rgba(0,0,0,0.5)',
                                        whiteSpace: 'pre-wrap',
                                        lineHeight: 1.2
                                    }}
                                >
                                    {layer.content}
                                </div>
                            )
                        })}
                    </div>
                </div>

                <Card className="w-1/4 max-w-xs flex flex-col">
                     <CardHeader><CardTitle className="text-xl flex items-center"><SlidersHorizontal className="mr-2 h-5 w-5"/>Inspector</CardTitle></CardHeader>
                     <ScrollArea className="flex-1">
                         <div className="p-4 space-y-4">
                            {activeLayer?.type === 'video' && inspectorClip && (
                                <Tabs defaultValue="adjust">
                                    <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="adjust">Adjust</TabsTrigger><TabsTrigger value="transform">Transform</TabsTrigger><TabsTrigger value="effects">Effects</TabsTrigger></TabsList>
                                    <TabsContent value="adjust" className="space-y-2 pt-2">
                                        <Label>Brightness: {inspectorClip.filters.brightness}%</Label><Slider value={[inspectorClip.filters.brightness]} onValueChange={([val]) => updateClip(activeLayer.id, { filters: {...inspectorClip.filters, brightness: val} })} min={0} max={200} step={1} />
                                        <Label>Contrast: {inspectorClip.filters.contrast}%</Label><Slider value={[inspectorClip.filters.contrast]} onValueChange={([val]) => updateClip(activeLayer.id, { filters: {...inspectorClip.filters, contrast: val} })} min={0} max={200} step={1} />
                                        <Label>Saturation: {inspectorClip.filters.saturate}%</Label><Slider value={[inspectorClip.filters.saturate]} onValueChange={([val]) => updateClip(activeLayer.id, { filters: {...inspectorClip.filters, saturate: val} })} min={0} max={200} step={1} />
                                    </TabsContent>
                                    <TabsContent value="transform" className="space-y-2 pt-2">
                                        <Label>Position X</Label><Input type="number" value={inspectorClip.transform.position.x} onChange={(e) => updateClip(activeLayer.id, clip => ({ transform: { ...clip.transform, position: { ...clip.transform.position, x: Number(e.target.value) || 0 } } }))} />
                                        <Label>Position Y</Label><Input type="number" value={inspectorClip.transform.position.y} onChange={(e) => updateClip(activeLayer.id, clip => ({ transform: { ...clip.transform, position: { ...clip.transform.position, y: Number(e.target.value) || 0 } } }))}/>
                                        <Label>Scale</Label><Input type="number" step="0.1" value={inspectorClip.transform.scale.x} onChange={(e) => updateClip(activeLayer.id, clip => ({ transform: { ...clip.transform, scale: { x: Number(e.target.value) || 0, y: Number(e.target.value) || 0 } } }))} />
                                        <Label>Rotation</Label><Input type="number" value={inspectorClip.transform.rotation} onChange={(e) => updateClip(activeLayer.id, clip => ({ transform: { ...clip.transform, rotation: Number(e.target.value) || 0 } }))} />
                                    </TabsContent>
                                    <TabsContent value="effects" className="space-y-2 pt-2">
                                        <Label>Blend Mode</Label><Select value={inspectorClip.blendMode} onValueChange={(value: BlendMode) => updateClip(activeLayer.id, { blendMode: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{blendModes.map(mode => <SelectItem key={mode} value={mode} className="capitalize">{mode}</SelectItem>)}</SelectContent></Select>
                                    </TabsContent>
                                </Tabs>
                            )}
                            {activeLayer?.type === 'text' && inspectorText && (
                                <div className="space-y-4">
                                    <Label>Content</Label><Textarea value={inspectorText.content} onChange={(e) => updateTextLayer(activeLayer.id, { content: e.target.value })} rows={3}/>
                                    <Label>Font</Label><Select value={inspectorText.font} onValueChange={(v) => updateTextLayer(activeLayer.id, { font: v })}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{webSafeFonts.map(f => <SelectItem key={f} value={f} style={{fontFamily: f}}>{f}</SelectItem>)}</SelectContent></Select>
                                    <div className="grid grid-cols-2 gap-2"><div className="space-y-1"><Label>Size</Label><Input type="number" value={inspectorText.size} onChange={e => updateTextLayer(activeLayer.id, { size: Number(e.target.value) })}/></div><div className="space-y-1"><Label>Color</Label><Input type="color" value={inspectorText.color} onChange={e => updateTextLayer(activeLayer.id, { color: e.target.value })} className="p-1 h-10"/></div></div>
                                    
                                    <Label>Transition</Label>
                                    <Select onValueChange={() => toast({ title: "Coming Soon!", description: "Text transitions will be available in a future update." })}>
                                        <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">None</SelectItem>
                                            <SelectItem value="fade">Fade In</SelectItem>
                                            <SelectItem value="slide">Slide In</SelectItem>
                                            <SelectItem value="typewriter">Typewriter</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    <Label className="font-semibold pt-2">Transform</Label>
                                    <Label>Position X</Label><Input type="number" value={inspectorText.transform.position.x} onChange={(e) => updateTextLayer(activeLayer.id, l => ({ transform: { ...l.transform, position: { ...l.transform.position, x: Number(e.target.value) || 0 } } }))} />
                                    <Label>Position Y</Label><Input type="number" value={inspectorText.transform.position.y} onChange={(e) => updateTextLayer(activeLayer.id, l => ({ transform: { ...l.transform, position: { ...l.transform.position, y: Number(e.target.value) || 0 } } }))} />
                                    <Label>Scale</Label><Input type="number" step="0.1" value={inspectorText.transform.scale.x} onChange={(e) => updateTextLayer(activeLayer.id, l => ({ transform: { ...l.transform, scale: { x: Number(e.target.value) || 0, y: Number(e.target.value) || 0 } } }))} />
                                    <Label>Rotation</Label><Input type="number" value={inspectorText.transform.rotation} onChange={(e) => updateTextLayer(activeLayer.id, l => ({ transform: { ...l.transform, rotation: Number(e.target.value) || 0 } }))} />
                                </div>
                            )}
                            {!activeLayer && <div className="text-center text-muted-foreground text-sm p-4">Select a layer to inspect its properties.</div>}
                         </div>
                     </ScrollArea>
                     <CardFooter>
                        <Button onClick={handleExport} disabled={clips.length === 0 || isProcessing} className="w-full">
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            Export Video
                        </Button>
                     </CardFooter>
                </Card>
            </div>

            <Card className="p-2">
                 <div className="grid grid-cols-3 items-center gap-4 mb-2">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => setTimelineZoom(z => Math.max(0.5, z - 0.25))}><ZoomOut /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setTimelineZoom(z => Math.min(5, z + 0.25))}><ZoomIn /></Button>
                        <span className="text-xs text-muted-foreground">{Math.round(timelineZoom * 100)}%</span>
                    </div>

                    <div className="flex items-center justify-center gap-2">
                        <Button variant="ghost" size="icon" onClick={handleUndo} disabled={historyIndex <= 0} title="Undo"><Undo className="h-5 w-5" /></Button>
                        <Button variant="ghost" size="icon" onClick={handleDeleteLayer} disabled={!activeLayer} title="Delete Selected Layer"><Trash2 className="h-5 w-5" /></Button>
                        <Button variant="ghost" size="icon" disabled={clips.length === 0} onClick={() => handleSeekFrame('backward')}><SkipBack className="h-6 w-6" /></Button>
                        <Button variant="ghost" size="icon" onClick={handlePlayPause} disabled={clips.length === 0}>{isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}</Button>
                        <Button variant="ghost" size="icon" disabled={clips.length === 0} onClick={handleSplitClip} title="Split Clip"><Scissors className="h-5 w-5" /></Button>
                        <Button variant="ghost" size="icon" disabled={clips.length === 0} onClick={() => handleSeekFrame('forward')}><SkipForward className="h-6 w-6" /></Button>
                    </div>

                    <div className="text-sm font-mono text-right">
                        {formatTime(globalTime)} / {formatTime(totalDuration)}
                    </div>
                </div>
                 <div ref={timelineContainerRef} onClick={handleTimelineClick} className="w-full bg-muted/50 rounded-md relative cursor-pointer overflow-x-auto">
                    <div className="relative h-full" style={{ width: `${timelineZoom * 100}%`}}>
                        <div ref={playheadRef} className="absolute top-0 w-0.5 h-full bg-red-500 z-20 pointer-events-none" style={{ left: `${playheadPosition}%`}}/>
                        
                        <div className="space-y-1 py-2">
                            <div className="flex items-center h-20">
                                <div className="w-16 text-center text-xs font-bold text-muted-foreground p-2 border-r border-muted-foreground/20">V1</div>
                                <div className="flex-1 h-full relative">
                                    <div className="flex h-full">
                                        {clips.map(clip => {
                                            const clipTrimmedDuration = clip.trim.end - clip.trim.start;
                                            const clipWidthPercentage = totalDuration > 0 ? (clipTrimmedDuration / totalDuration) * 100 : 0;
                                            return (
                                                <div key={clip.id} className="h-full p-1" style={{ flexBasis: `${clipWidthPercentage}%` }}>
                                                     <div onClick={(e) => { e.stopPropagation(); setActiveLayer({id: clip.id, type: 'video'}); }} className={cn("h-full rounded-md bg-primary/20 relative overflow-hidden", activeLayer?.id === clip.id && "ring-2 ring-primary")}>
                                                         <div className="absolute inset-0 flex overflow-hidden">
                                                            {Array.from({length: 5}).map((_, i) => (
                                                                <NextImage key={i} src={clip.thumbnail} alt="" width={50} height={50} className="h-full w-auto opacity-50" />
                                                            ))}
                                                         </div>
                                                         <p className="absolute bottom-1 left-1 text-white text-[10px] bg-black/50 px-1 rounded-sm truncate">{clip.file.name}</p>
                                                     </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center h-12 border-t border-muted-foreground/20">
                                <div className="w-16 text-center text-xs font-bold text-muted-foreground p-2 border-r border-muted-foreground/20">A1</div>
                                <div className="flex-1 h-full relative">
                                    {audioTracks.map(track => {
                                        const left = totalDuration > 0 ? (track.start / totalDuration) * 100 : 0;
                                        const width = totalDuration > 0 ? (track.duration / totalDuration) * 100 : 0;
                                        return (
                                            <div
                                                key={track.id}
                                                className={cn("absolute h-full p-1", activeLayer?.id === track.id && "z-10")}
                                                style={{ left: `${left}%`, width: `${width}%` }}
                                            >
                                                <div onClick={(e) => { e.stopPropagation(); setActiveLayer({id: track.id, type: 'audio'}); }} className={cn("h-full rounded-md bg-emerald-500/30 flex items-center px-2 overflow-hidden", activeLayer?.id === track.id && "ring-2 ring-emerald-400")}>
                                                    <div className="waveform-placeholder"/>
                                                    <p className="absolute text-white text-xs truncate z-10 left-2 right-2">{track.name}</p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                            
                             <div className="flex items-center h-12 border-t border-muted-foreground/20">
                                <div className="w-16 text-center text-xs font-bold text-muted-foreground p-2 border-r border-muted-foreground/20">T1</div>
                                <div className="flex-1 h-full relative">
                                      {textLayers.map(layer => {
                                        const left = totalDuration > 0 ? (layer.start / totalDuration) * 100 : 0;
                                        const width = totalDuration > 0 ? (layer.duration / totalDuration) * 100 : 0;
                                        return (
                                            <div
                                                key={layer.id}
                                                className={cn("absolute h-full p-1", activeLayer?.id === layer.id && "z-10")}
                                                style={{ left: `${left}%`, width: `${width}%` }}
                                            >
                                                <div onClick={(e) => { e.stopPropagation(); setActiveLayer({id: layer.id, type: 'text'}); }} className={cn("h-full rounded-md bg-purple-500/30 flex items-center px-2", activeLayer?.id === layer.id && "ring-2 ring-purple-400")}>
                                                    <p className="text-white text-xs truncate">{layer.content}</p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                        </div>
                    </div>
                 </div>
            </Card>
        </div>
    );
}
