
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
    const inspectorText = activeLayer?.type === 'text' ? textLayers.find(c => c.id === activeLayer.id) : undefined;
    
    const totalVideoDuration = clips.reduce((acc, clip) => acc + (clip.trim.end - clip.trim.start), 0);
    const maxAudioTime = audioTracks.reduce((max, track) => Math.max(max, track.start + track.duration), 0);
    const maxTextTime = textLayers.reduce((max, layer) => Math.max(max, layer.start + layer.duration), 0);

    const totalDuration = Math.max(totalVideoDuration, maxAudioTime, maxTextTime, 10);

    const pushClipsToHistory = useCallback((newClips: TimelineClip[][]) => {
        setClips(newClips[0] || []);
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
                videoEl.onseeked = null;
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
            transform: { ...defaultTransform, position: { x: 50, y: 50 } }, 
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
        const frameTime = 1 / 30; 
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

            seekToGlobalTime(0);
            setIsPlaying(true);
            recorder.start();

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
            className="flex flex-col h-[calc(100vh-140px)] w-full text-foreground gap-4 p-4"
            onMouseMove={handlePreviewMouseMove}
            onMouseUp={handlePreviewMouseUp}
            onMouseLeave={handlePreviewMouseUp}
        >
            {/* Top Section: Media, Preview, Inspector */}
            <div className="flex flex-1 gap-4 min-h-0">
                {/* Media Bin Sidebar (Left) */}
                <Card className="w-[300px] shrink-0 border-none bg-background/40 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-white/5">
                    <Tabs defaultValue="media" className="flex-1 flex flex-col">
                        <CardHeader className="bg-primary/5 border-b py-4">
                            <TabsList className="grid w-full grid-cols-5 bg-muted/40 p-1 rounded-lg">
                                <TabsTrigger value="media" title="Media" className="p-2"><Film className="h-4 w-4"/></TabsTrigger>
                                <TabsTrigger value="image" title="Images" className="p-2"><ImageIcon className="h-4 w-4"/></TabsTrigger>
                                <TabsTrigger value="audio" title="Audio" className="p-2"><Music className="h-4 w-4"/></TabsTrigger>
                                <TabsTrigger value="text" title="Text" className="p-2"><Type className="h-4 w-4"/></TabsTrigger>
                                <TabsTrigger value="effects" title="Effects" className="p-2"><Sparkles className="h-4 w-4"/></TabsTrigger>
                            </TabsList>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col gap-3 p-4 min-h-0 overflow-y-auto custom-scrollbar">
                             <TabsContent value="media" className="flex-1 flex flex-col gap-4 mt-0">
                                <FileUpload onFileSelect={handleFileSelect} label="Upload Video" acceptedFileTypes="video/*" multiple id="video-upload-bin" />
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Video Clips</Label>
                                    <ScrollArea className="h-[300px] rounded-xl border-2 border-dashed border-muted-foreground/10 p-2">
                                        {clips.filter(c => c.type === 'video').length === 0 && !isProcessing && (
                                            <div className="flex flex-col items-center justify-center h-32 text-center text-muted-foreground/50">
                                                <VideoIcon className="h-8 w-8 mb-2 opacity-20" />
                                                <p className="text-[10px] font-bold">BIN IS EMPTY</p>
                                            </div>
                                        )}
                                        {isProcessing && (
                                            <div className="flex flex-col items-center justify-center h-32 text-center text-primary/60">
                                                <Loader2 className="h-6 w-6 animate-spin mb-2" />
                                                <p className="text-[10px] font-bold">PROCESSING...</p>
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            {clips.filter(c => c.type === 'video').map(clip => (
                                                <div key={clip.id} onClick={() => setActiveLayer({id: clip.id, type: 'video'})} className={cn("flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all border-2", activeLayer?.id === clip.id ? "bg-primary/10 border-primary shadow-lg" : "bg-muted/30 border-transparent hover:border-primary/20")}>
                                                    <div className="relative shrink-0">
                                                        <NextImage src={clip.thumbnail} alt={clip.file.name} width={70} height={40} className="rounded-lg object-cover aspect-video shadow-md" />
                                                        <div className="absolute bottom-0 right-0 bg-black/80 px-1 rounded-sm text-[8px] font-mono text-white">{formatTime(clip.duration)}</div>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="truncate text-[11px] font-black uppercase tracking-tighter" title={clip.file.name}>{clip.file.name}</p>
                                                        <p className="text-[9px] font-bold text-muted-foreground italic">Video Clip</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </div>
                            </TabsContent>
                             <TabsContent value="image" className="flex-1 flex flex-col gap-4 mt-0">
                                <FileUpload onFileSelect={handleFileSelect} label="Upload Image" acceptedFileTypes="image/*" multiple id="image-upload-bin" />
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Image Assets</Label>
                                    <ScrollArea className="h-[300px] rounded-xl border-2 border-dashed border-muted-foreground/10 p-2">
                                        {clips.filter(c => c.type === 'image').length === 0 && (
                                            <div className="flex flex-col items-center justify-center h-32 text-center text-muted-foreground/50">
                                                <ImageIcon className="h-8 w-8 mb-2 opacity-20" />
                                                <p className="text-[10px] font-bold">NO IMAGES</p>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-2">
                                            {clips.filter(c => c.type === 'image').map(clip => (
                                                <div key={clip.id} onClick={() => setActiveLayer({id: clip.id, type: 'video'})} className={cn("relative group rounded-xl cursor-pointer aspect-square transition-all border-2 overflow-hidden", activeLayer?.id === clip.id ? "border-primary shadow-lg ring-2 ring-primary/20" : "border-transparent hover:border-primary/20")}>
                                                    <NextImage src={clip.thumbnail} alt={clip.file.name} fill className="object-cover transition-transform group-hover:scale-110"/>
                                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                                        <p className="text-[8px] font-black text-white truncate uppercase">{clip.file.name}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </div>
                             </TabsContent>
                             <TabsContent value="audio" className="flex-1 flex flex-col gap-4 mt-0">
                                <FileUpload onFileSelect={handleAudioFileSelect} label="Upload Audio" acceptedFileTypes="audio/*" multiple id="audio-upload-bin" />
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Audio Tracks</Label>
                                    <ScrollArea className="h-[300px] rounded-xl border-2 border-dashed border-muted-foreground/10 p-2">
                                        {audioTracks.length === 0 && (
                                            <div className="flex flex-col items-center justify-center h-32 text-center text-muted-foreground/50">
                                                <Music className="h-8 w-8 mb-2 opacity-20" />
                                                <p className="text-[10px] font-bold">NO AUDIO</p>
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            {audioTracks.map(track => (
                                                <div key={track.id} onClick={() => setActiveLayer({id: track.id, type: 'audio'})} className={cn("flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all border-2", activeLayer?.id === track.id ? "bg-emerald-500/10 border-emerald-500 shadow-lg" : "bg-muted/30 border-transparent hover:border-emerald-500/20")}>
                                                    <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center shrink-0 shadow-inner"><Music className="h-5 w-5 text-emerald-500"/></div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="truncate text-[11px] font-black uppercase tracking-tighter" title={track.name}>{track.name}</p>
                                                        <p className="text-[9px] font-bold text-muted-foreground italic">{formatTime(track.duration)}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </div>
                             </TabsContent>
                             <TabsContent value="text" className="flex-1 flex flex-col gap-4 mt-0">
                                <Button onClick={handleAddText} className="w-full h-11 font-black rounded-xl border-2 hover:bg-primary/5 transition-all shadow-md">
                                    <Type className="mr-2 h-4 w-4"/> ADD TEXT LAYER
                                </Button>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Active Text Layers</Label>
                                    <ScrollArea className="h-[300px] rounded-xl border-2 border-dashed border-muted-foreground/10 p-2">
                                        {textLayers.length === 0 && (
                                            <div className="flex flex-col items-center justify-center h-32 text-center text-muted-foreground/50">
                                                <Type className="h-8 w-8 mb-2 opacity-20" />
                                                <p className="text-[10px] font-bold">NO TEXT LAYERS</p>
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            {textLayers.map(layer => (
                                                <div key={layer.id} onClick={() => setActiveLayer({id: layer.id, type: 'text'})} className={cn("flex items-center justify-between gap-3 p-3 rounded-xl cursor-pointer transition-all border-2", activeLayer?.id === layer.id ? "bg-purple-500/10 border-purple-500 shadow-lg" : "bg-muted/30 border-transparent hover:border-purple-500/20")}>
                                                    <p className="truncate text-[11px] font-black uppercase tracking-tighter">{layer.content}</p>
                                                    <div className="h-2 w-2 rounded-full bg-purple-500" />
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </div>
                             </TabsContent>
                             <TabsContent value="effects" className="mt-0 flex-1 flex flex-col gap-4">
                                 <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Pro Effects</Label>
                                 <ScrollArea className="h-full">
                                    <div className="grid grid-cols-2 gap-3 pb-4">
                                        {placeholderEffects.map(effect => (
                                            <Button key={effect} variant="outline" className="h-20 flex-col gap-2 rounded-xl border-2 hover:bg-primary/5 group" onClick={() => toast({title: "Coming Soon!", description: `${effect} effect will be available in a future update.`})}>
                                                <Sparkles className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors"/>
                                                <span className="text-[10px] font-black uppercase tracking-tight">{effect}</span>
                                            </Button>
                                        ))}
                                    </div>
                                </ScrollArea>
                             </TabsContent>
                        </CardContent>
                    </Tabs>
                </Card>

                {/* Main Preview Area (Center) */}
                <div className="flex-1 flex flex-col gap-4 min-w-0">
                    <Card className="flex-1 bg-black/90 rounded-2xl overflow-hidden shadow-inner border-none ring-1 ring-white/10 relative group">
                        <div 
                            ref={previewContainerRef}
                            className="w-full h-full flex items-center justify-center relative overflow-hidden"
                            onMouseDown={handlePreviewMouseDown}
                        >
                             {currentClip && currentClip.type === 'video' && (
                                <video
                                    key={currentClip.id}
                                    ref={videoRef}
                                    className="max-w-full max-h-full transition-all duration-300 shadow-2xl"
                                    style={applyClipStyles(currentClip)}
                                />
                            )}
                            {currentClip && currentClip.type === 'image' && (
                                 <NextImage
                                    src={currentClip.src}
                                    alt={currentClip.file.name}
                                    fill
                                    className="object-contain transition-all duration-300"
                                    style={applyClipStyles(currentClip)}
                                />
                            )}
                            {!currentClip && (
                                 <div className="text-center animate-in fade-in zoom-in duration-500">
                                    <div className="relative inline-block mb-6">
                                        <UploadCloud className="mx-auto h-16 w-16 text-primary/20" />
                                        <div className="absolute inset-0 blur-xl bg-primary/10 animate-pulse"></div>
                                    </div>
                                    <p className="text-sm font-bold text-muted-foreground tracking-widest uppercase">Video Workspace Ready</p>
                                    <p className="text-[10px] text-muted-foreground/40 mt-2 italic font-medium">Add media to the bin to start creating</p>
                                </div>
                            )}
                            
                            {textLayers
                                .filter(layer => globalTime >= layer.start && globalTime < layer.start + layer.duration)
                                .map(layer => {
                                const isSelected = activeLayer?.type === 'text' && activeLayer.id === layer.id;
                                return (
                                    <div 
                                        key={layer.id} 
                                        className={cn("absolute cursor-move pointer-events-none select-none", isSelected && "ring-2 ring-primary ring-dashed ring-offset-2 ring-offset-black rounded-sm")}
                                        style={{
                                            left: layer.transform.position.x,
                                            top: layer.transform.position.y,
                                            transform: `scale(${layer.transform.scale.x}, ${layer.transform.scale.y}) rotate(${layer.transform.rotation}deg)`,
                                            color: layer.color,
                                            fontSize: layer.size,
                                            fontFamily: layer.font,
                                            mixBlendMode: layer.blendMode as any,
                                            textShadow: '0 2px 10px rgba(0,0,0,0.8)',
                                            whiteSpace: 'pre-wrap',
                                            lineHeight: 1.2
                                        }}
                                    >
                                        {layer.content}
                                    </div>
                                )
                            })}
                        </div>
                        {/* Playback Overlay Hint */}
                        {!isPlaying && currentClip && (
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
                                <div className="p-4 rounded-full bg-white/10 backdrop-blur-md border border-white/20 animate-pulse">
                                    <Play className="h-8 w-8 text-white fill-white" />
                                </div>
                            </div>
                        )}
                    </Card>
                </div>

                {/* Inspector Sidebar (Right) */}
                <Card className="w-[350px] shrink-0 border-none bg-background/40 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-white/5">
                    <CardHeader className="bg-primary/5 border-b py-4">
                        <div className="flex flex-col gap-0.5">
                            <CardTitle className="text-lg font-black flex items-center gap-2 tracking-tight">
                                <SlidersHorizontal className="h-5 w-5 text-primary"/> INSPECTOR
                            </CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-50 pl-1">
                                {activeLayer ? `Tuning ${activeLayer.type} layer` : 'Select a clip to tweak'}
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <ScrollArea className="flex-1 custom-scrollbar">
                        <CardContent className="p-4 space-y-6">
                            {activeLayer?.type === 'video' && inspectorClip && (
                                <Tabs defaultValue="adjust" className="w-full">
                                    <TabsList className="flex h-auto bg-muted/40 p-1 mb-6 rounded-xl gap-1 shadow-inner border border-primary/5">
                                        <TabsTrigger value="adjust" className="flex-1 py-2 text-[10px] font-black uppercase tracking-tighter">Adjust</TabsTrigger>
                                        <TabsTrigger value="transform" className="flex-1 py-2 text-[10px] font-black uppercase tracking-tighter">Transform</TabsTrigger>
                                        <TabsTrigger value="effects" className="flex-1 py-2 text-[10px] font-black uppercase tracking-tighter">Blend</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="adjust" className="space-y-5 animate-in slide-in-from-right-4 duration-300">
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center"><Label className="text-[10px] font-black uppercase opacity-60">Brightness</Label><span className="text-[10px] font-mono">{inspectorClip.filters.brightness}%</span></div>
                                            <Slider value={[inspectorClip.filters.brightness]} onValueChange={([val]) => updateClip(activeLayer.id, { filters: {...inspectorClip.filters, brightness: val} })} min={0} max={200} step={1} />
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center"><Label className="text-[10px] font-black uppercase opacity-60">Contrast</Label><span className="text-[10px] font-mono">{inspectorClip.filters.contrast}%</span></div>
                                            <Slider value={[inspectorClip.filters.contrast]} onValueChange={([val]) => updateClip(activeLayer.id, { filters: {...inspectorClip.filters, contrast: val} })} min={0} max={200} step={1} />
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center"><Label className="text-[10px] font-black uppercase opacity-60">Saturation</Label><span className="text-[10px] font-mono">{inspectorClip.filters.saturate}%</span></div>
                                            <Slider value={[inspectorClip.filters.saturate]} onValueChange={([val]) => updateClip(activeLayer.id, { filters: {...inspectorClip.filters, saturate: val} })} min={0} max={200} step={1} />
                                        </div>
                                    </TabsContent>
                                    <TabsContent value="transform" className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Pos X</Label><Input type="number" className="h-10 rounded-xl" value={inspectorClip.transform.position.x} onChange={(e) => updateClip(activeLayer.id, clip => ({ transform: { ...clip.transform, position: { ...clip.transform.position, x: Number(e.target.value) || 0 } } }))} /></div>
                                            <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Pos Y</Label><Input type="number" className="h-10 rounded-xl" value={inspectorClip.transform.position.y} onChange={(e) => updateClip(activeLayer.id, clip => ({ transform: { ...clip.transform, position: { ...clip.transform.position, y: Number(e.target.value) || 0 } } }))}/></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Scale</Label><Input type="number" step="0.1" className="h-10 rounded-xl" value={inspectorClip.transform.scale.x} onChange={(e) => updateClip(activeLayer.id, clip => ({ transform: { ...clip.transform, scale: { x: Number(e.target.value) || 0, y: Number(e.target.value) || 0 } } }))} /></div>
                                            <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Rotation</Label><Input type="number" className="h-10 rounded-xl" value={inspectorClip.transform.rotation} onChange={(e) => updateClip(activeLayer.id, clip => ({ transform: { ...clip.transform, rotation: Number(e.target.value) || 0 } }))} /></div>
                                        </div>
                                    </TabsContent>
                                    <TabsContent value="effects" className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase opacity-60">Blend Mode</Label>
                                            <Select value={inspectorClip.blendMode} onValueChange={(value: BlendMode) => updateClip(activeLayer.id, { blendMode: value })}>
                                                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                                                <SelectContent>{blendModes.map(mode => <SelectItem key={mode} value={mode} className="capitalize text-xs font-bold">{mode}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            )}
                            {activeLayer?.type === 'text' && inspectorText && (
                                <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase opacity-60">Content</Label>
                                        <Textarea className="min-h-[100px] text-sm rounded-xl resize-none" value={inspectorText.content} onChange={(e) => updateTextLayer(activeLayer.id, { content: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase opacity-60">Font Style</Label>
                                        <Select value={inspectorText.font} onValueChange={(v) => updateTextLayer(activeLayer.id, { font: v })}>
                                            <SelectTrigger className="h-11 rounded-xl"><SelectValue/></SelectTrigger>
                                            <SelectContent className="max-h-60">{webSafeFonts.map(f => <SelectItem key={f} value={f} style={{fontFamily: f}} className="text-sm">{f}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Size</Label><Input type="number" className="h-10 rounded-xl" value={inspectorText.size} onChange={e => updateTextLayer(activeLayer.id, { size: Number(e.target.value) })}/></div>
                                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Color</Label><Input type="color" value={inspectorText.color} onChange={e => updateTextLayer(activeLayer.id, { color: e.target.value })} className="p-1 h-10 w-full rounded-xl cursor-pointer border-none shadow-inner"/></div>
                                    </div>
                                    
                                    <div className="pt-4 border-t border-dashed">
                                        <Label className="text-[10px] font-black uppercase opacity-80 mb-4 block">Text Animation</Label>
                                        <Select onValueChange={() => toast({ title: "Coming Soon!", description: "Text transitions will be available in a future update." })}>
                                            <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Static (Default)" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none" className="text-xs font-bold">Static</SelectItem>
                                                <SelectItem value="fade" className="text-xs font-bold">Fade In</SelectItem>
                                                <SelectItem value="slide" className="text-xs font-bold">Slide In</SelectItem>
                                                <SelectItem value="typewriter" className="text-xs font-bold">Typewriter</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}
                            {!activeLayer && (
                                <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground/40 border-2 border-dashed rounded-2xl">
                                    <SlidersHorizontal className="h-8 w-8 mb-2 opacity-20" />
                                    <p className="text-[10px] font-bold tracking-tighter uppercase px-6 leading-tight">Pick a clip in the timeline to view properties</p>
                                </div>
                            )}
                         </CardContent>
                    </ScrollArea>
                    <CardFooter className="bg-primary/5 border-t p-4">
                        <Button onClick={handleExport} disabled={clips.length === 0 || isProcessing} className="w-full h-11 text-sm font-black rounded-xl shadow-lg transition-all active:scale-95">
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            EXPORT PRODUCTION VIDEO
                        </Button>
                    </CardFooter>
                </Card>
            </div>

            {/* Bottom Section: Timeline Controls and Tracks */}
            <Card className="border-none bg-background/40 backdrop-blur-xl shadow-2xl flex flex-col p-3 ring-1 ring-white/5">
                 <div className="flex items-center justify-between gap-4 mb-4 px-2">
                    <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg">
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background shadow-sm" onClick={() => setTimelineZoom(z => Math.max(0.5, z - 0.25))}><ZoomOut className="h-4 w-4"/></Button>
                        <div className="px-3 py-1 bg-background rounded-md shadow-inner">
                            <span className="text-[10px] font-black font-mono">{Math.round(timelineZoom * 100)}%</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background shadow-sm" onClick={() => setTimelineZoom(z => Math.min(5, z + 0.25))}><ZoomIn className="h-4 w-4"/></Button>
                    </div>

                    <div className="flex items-center justify-center gap-3">
                        <div className="flex gap-1 pr-4 border-r border-white/10">
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={handleUndo} disabled={historyIndex <= 0} title="Undo"><Undo className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-destructive hover:text-white" onClick={handleDeleteLayer} disabled={!activeLayer} title="Delete"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-muted/40" disabled={clips.length === 0} onClick={() => handleSeekFrame('backward')}><SkipBack className="h-5 w-5" /></Button>
                            <Button variant="default" size="icon" className="h-12 w-12 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all" onClick={handlePlayPause} disabled={clips.length === 0}>{isPlaying ? <Pause className="h-6 w-6 fill-white" /> : <Play className="h-6 w-6 fill-white pl-0.5" />}</Button>
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-muted/40" disabled={clips.length === 0} onClick={() => handleSeekFrame('forward')}><SkipForward className="h-5 w-5" /></Button>
                        </div>
                        <div className="pl-4 border-l border-white/10">
                            <Button variant="secondary" size="sm" className="h-9 font-black uppercase text-[10px] rounded-lg tracking-widest px-4 shadow-md" disabled={clips.length === 0} onClick={handleSplitClip} title="Split Clip">
                                <Scissors className="mr-2 h-4 w-4" /> SPLIT
                            </Button>
                        </div>
                    </div>

                    <div className="px-4 py-2 bg-primary/10 rounded-xl border border-primary/20 shadow-inner">
                        <span className="text-sm font-black font-mono tracking-tighter text-primary">
                            {formatTime(globalTime)} <span className="opacity-30">/</span> {formatTime(totalDuration)}
                        </span>
                    </div>
                </div>

                 <div ref={timelineContainerRef} onClick={handleTimelineClick} className="w-full h-48 bg-muted/20 rounded-2xl relative cursor-pointer overflow-x-auto custom-scrollbar border-2 border-white/5 shadow-inner">
                    <div className="relative min-h-full" style={{ width: `${timelineZoom * 100}%`}}>
                        {/* Playhead */}
                        <div ref={playheadRef} className="absolute top-0 w-[3px] h-full bg-red-600 z-30 pointer-events-none shadow-[0_0_10px_rgba(220,38,38,0.5)]" style={{ left: `${playheadPosition}%`}}>
                            <div className="absolute -top-1 -left-[5px] w-3 h-3 bg-red-600 rounded-full border-2 border-white" />
                        </div>
                        
                        <div className="space-y-2 py-4">
                            {/* Video Track (V1) */}
                            <div className="flex items-center h-16 group/track">
                                <div className="w-12 text-center text-[10px] font-black text-muted-foreground/40 p-2 border-r border-white/10 group-hover/track:text-primary transition-colors">V1</div>
                                <div className="flex-1 h-full relative ml-2">
                                    {clips.length === 0 ? (
                                        <div className="absolute inset-0 flex items-center px-4 text-[10px] font-bold text-muted-foreground/20 italic tracking-widest uppercase">Video timeline is empty...</div>
                                    ) : (
                                        <div className="flex h-full gap-0.5">
                                            {clips.map(clip => {
                                                const clipTrimmedDuration = clip.trim.end - clip.trim.start;
                                                const clipWidthPercentage = totalDuration > 0 ? (clipTrimmedDuration / totalDuration) * 100 : 0;
                                                return (
                                                    <div key={clip.id} className="h-full" style={{ flexBasis: `${clipWidthPercentage}%` }}>
                                                         <div onClick={(e) => { e.stopPropagation(); setActiveLayer({id: clip.id, type: 'video'}); }} className={cn("h-full rounded-lg bg-primary/20 relative overflow-hidden transition-all border-2", activeLayer?.id === clip.id ? "border-primary shadow-lg ring-4 ring-primary/10" : "border-white/5 hover:border-primary/40")}>
                                                             <div className="absolute inset-0 flex overflow-hidden opacity-30 grayscale pointer-events-none">
                                                                {Array.from({length: 8}).map((_, i) => (
                                                                    <NextImage key={i} src={clip.thumbnail} alt="" width={60} height={60} className="h-full w-auto object-cover" />
                                                                ))}
                                                             </div>
                                                             <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent" />
                                                             <p className="absolute bottom-1 left-2 text-white text-[9px] font-black uppercase tracking-tighter bg-black/60 px-1.5 py-0.5 rounded shadow-sm truncate max-w-[calc(100%-8px)]">{clip.file.name}</p>
                                                         </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Audio Track (A1) */}
                            <div className="flex items-center h-10 border-t border-white/5 group/track">
                                <div className="w-12 text-center text-[10px] font-black text-muted-foreground/40 p-2 border-r border-white/10 group-hover/track:text-emerald-500 transition-colors">A1</div>
                                <div className="flex-1 h-full relative ml-2">
                                    {audioTracks.map(track => {
                                        const left = totalDuration > 0 ? (track.start / totalDuration) * 100 : 0;
                                        const width = totalDuration > 0 ? (track.duration / totalDuration) * 100 : 0;
                                        return (
                                            <div
                                                key={track.id}
                                                className={cn("absolute h-full p-1 transition-all", activeLayer?.id === track.id && "z-10")}
                                                style={{ left: `${left}%`, width: `${width}%` }}
                                            >
                                                <div onClick={(e) => { e.stopPropagation(); setActiveLayer({id: track.id, type: 'audio'}); }} className={cn("h-full rounded-lg bg-emerald-500/30 flex items-center px-3 border-2 transition-all", activeLayer?.id === track.id ? "border-emerald-500 shadow-lg ring-4 ring-emerald-500/10" : "border-emerald-500/20 hover:border-emerald-500/40")}>
                                                    <Music className="h-3 w-3 text-emerald-400 mr-2 opacity-50 shrink-0" />
                                                    <p className="text-white text-[9px] font-black uppercase tracking-tighter truncate">{track.name}</p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                            
                            {/* Text Track (T1) */}
                             <div className="flex items-center h-10 border-t border-white/5 group/track">
                                <div className="w-12 text-center text-[10px] font-black text-muted-foreground/40 p-2 border-r border-white/10 group-hover/track:text-purple-500 transition-colors">T1</div>
                                <div className="flex-1 h-full relative ml-2">
                                      {textLayers.map(layer => {
                                        const left = totalDuration > 0 ? (layer.start / totalDuration) * 100 : 0;
                                        const width = totalDuration > 0 ? (layer.duration / totalDuration) * 100 : 0;
                                        return (
                                            <div
                                                key={layer.id}
                                                className={cn("absolute h-full p-1 transition-all", activeLayer?.id === layer.id && "z-10")}
                                                style={{ left: `${left}%`, width: `${width}%` }}
                                            >
                                                <div onClick={(e) => { e.stopPropagation(); setActiveLayer({id: layer.id, type: 'text'}); }} className={cn("h-full rounded-lg bg-purple-500/30 flex items-center px-3 border-2 transition-all", activeLayer?.id === layer.id ? "border-purple-500 shadow-lg ring-4 ring-purple-500/10" : "border-purple-500/20 hover:border-purple-500/40")}>
                                                    <Type className="h-3 w-3 text-purple-400 mr-2 opacity-50 shrink-0" />
                                                    <p className="text-white text-[9px] font-black uppercase tracking-tighter truncate">{layer.content}</p>
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
