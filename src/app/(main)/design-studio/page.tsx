
// src/app/(main)/design-studio/page.tsx
"use client";

import { useState, useRef, useEffect, useCallback, ChangeEvent, MouseEvent as ReactMouseEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Text, Image as ImageIcon, Download, Trash2, Layers, Move, Bold, Italic, Type, Palette, Baseline, ArrowUp, ArrowDown, RotateCcw, Percent, Wand2, LayoutTemplate, X, Check, Square, Circle as CircleIcon, Copy as CopyIcon, PlusCircle, Presentation, ChevronLeft, ChevronRight, Video as VideoIcon, Undo, Redo, Eye, EyeOff, Lock, Unlock, ZoomIn, ZoomOut, Minus, Group, Ungroup } from 'lucide-react';
import type { DesignLayer, ImageLayer, TextLayer, ShapeLayer, VideoLayer, GroupLayer } from '@/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Image from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { jsPDF } from 'jspdf';

const CANVAS_WIDTH = 1280; // 16:9 aspect ratio
const CANVAS_HEIGHT = 720;

const webSafeFonts = [
  'Roboto', 'Montserrat', 'Lato', 'Oswald',
  'Arial', 'Verdana', 'Georgia', 'Times New Roman', 'Courier New'
];

type InteractionMode = 
  | { type: 'move' }
  | { type: 'resize', handle: 'nw' | 'ne' | 'sw' | 'se' }
  | { type: 'rotate' }
  | null;

// Template Definitions
type TemplateLayerDef = any;
interface Template {
    id: string;
    name: string;
    previewUrl: string;
    layers: TemplateLayerDef[];
}

const templates: Template[] = [
    {
        id: 'social-post-1',
        name: 'Product Feature',
        previewUrl: 'https://picsum.photos/seed/template1/150/100',
        layers: [
            { type: 'image', src: `https://picsum.photos/seed/product1/${CANVAS_WIDTH}/${CANVAS_HEIGHT}`, x: 0, y: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT, rotation: 0, opacity: 1 },
            { type: 'text', text: 'NEW ARRIVAL', x: 50, y: 550, fontFamily: 'Oswald', fontSize: 80, fontWeight: 'bold', fontStyle: 'normal', color: '#ffffff', rotation: 0, opacity: 1 },
            { type: 'text', text: 'The ultimate gadget for your modern life.', x: 50, y: 630, fontFamily: 'Roboto', fontSize: 24, fontWeight: 'normal', fontStyle: 'normal', color: '#ffffff', rotation: 0, opacity: 0.9 },
        ]
    },
    {
        id: 'quote-1',
        name: 'Inspirational Quote',
        previewUrl: 'https://picsum.photos/seed/template2/150/100',
        layers: [
             { type: 'image', src: `https://picsum.photos/seed/background2/${CANVAS_WIDTH}/${CANVAS_HEIGHT}`, x: 0, y: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT, rotation: 0, opacity: 0.6 },
             { type: 'text', text: '"The best way to predict the future is to create it."', x: 100, y: 300, fontFamily: 'Georgia', fontSize: 60, fontWeight: 'normal', fontStyle: 'italic', color: '#000000', rotation: 0, opacity: 1, width: CANVAS_WIDTH - 200 },
        ]
    },
     {
        id: 'event-promo-1',
        name: 'Event Promo',
        previewUrl: 'https://picsum.photos/seed/template3/150/100',
        layers: [
            { type: 'image', src: `https://picsum.photos/seed/event3/${CANVAS_WIDTH}/${CANVAS_HEIGHT}`, x: 0, y: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT, rotation: 0, opacity: 1 },
            { type: 'text', text: 'ANNUAL TECH SUMMIT', x: 50, y: 50, fontFamily: 'Montserrat', fontSize: 80, fontWeight: 'bold', fontStyle: 'normal', color: '#ffffff', rotation: 0, opacity: 1, shadowColor: '#000000', shadowBlur: 10, shadowOffsetX: 2, shadowOffsetY: 2 },
            { type: 'text', text: 'December 15th | Virtual Event', x: 50, y: 140, fontFamily: 'Roboto', fontSize: 32, fontWeight: 'normal', fontStyle: 'normal', color: '#ffffff', rotation: 0, opacity: 1 },
        ]
    }
];

interface Slide {
  id: string;
  layers: DesignLayer[];
}

export default function DesignStudioPage() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const presentationCanvasRef = useRef<HTMLCanvasElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const textEditRef = useRef<HTMLTextAreaElement>(null);
    const { toast } = useToast();
    
    const initialSlideId = `slide-${Date.now()}`;
    const initialSlidesState: Slide[] = [{ id: initialSlideId, layers: [] }];
    
    // State Management for Multi-Slide Presentations
    const [slides, setSlides] = useState<Slide[]>(initialSlidesState);
    const [activeSlideId, setActiveSlideId] = useState<string>(initialSlideId);
    
    const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
    const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
    const [interactionMode, setInteractionMode] = useState<InteractionMode>(null);
    const [dragStart, setDragStart] = useState<{x: number, y: number, layer: DesignLayer, initialMouseX: number, initialMouseY: number, initialPositions?: Map<string, {x: number, y: number}>} | null>(null);
    
    const [templateToLoad, setTemplateToLoad] = useState<Template | null>(null);
    const [snapLines, setSnapLines] = useState<{type: 'h' | 'v', position: number}[]>([]);
    const [toolbarPosition, setToolbarPosition] = useState<{ top: number; left: number } | null>(null);

    // New state for presentation mode
    const [isPresenting, setIsPresenting] = useState(false);
    const [presenterSlideIndex, setPresenterSlideIndex] = useState(0);

    // State for video elements
    const [videoElements, setVideoElements] = useState<Record<string, HTMLVideoElement>>({});
    const animationFrameRef = useRef<number>();

    // State for Undo/Redo
    const [history, setHistory] = useState<Slide[][]>([initialSlidesState]);
    const [historyIndex, setHistoryIndex] = useState(0);
    
    // UI State
    const [isPanelOpen, setIsPanelOpen] = useState(true);
    const [zoom, setZoom] = useState(1);
    const [cursor, setCursor] = useState('default');
    
    // Local state for font size input to prevent rapid state updates
    const [localFontSize, setLocalFontSize] = useState<string>('');

    const activeSlide = slides.find(s => s.id === activeSlideId);
    const selectedLayers = activeSlide?.layers.filter(l => selectedLayerIds.includes(l.id)) || [];
    const lastSelectedLayer = activeSlide?.layers.find(l => l.id === selectedLayerIds[selectedLayerIds.length - 1]) || null;
    const editingLayer = activeSlide?.layers.find(l => l.id === editingLayerId) as TextLayer | undefined;
    
    const pushToHistory = useCallback((newSlidesState: Slide[]) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newSlidesState);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }, [history, historyIndex]);

    const updateSlidesAndRecord = useCallback((updater: (prevSlides: Slide[]) => Slide[]) => {
        setSlides(prevSlides => {
            const newSlides = updater(prevSlides);
            pushToHistory(newSlides);
            return newSlides;
        });
    }, [pushToHistory]);

    const handleUndo = useCallback(() => {
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setSlides(history[newIndex]);
        setHistoryIndex(newIndex);
        setSelectedLayerIds([]); // Clear selection on undo/redo
      }
    }, [history, historyIndex]);

    const handleRedo = useCallback(() => {
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setSlides(history[newIndex]);
        setHistoryIndex(newIndex);
        setSelectedLayerIds([]); // Clear selection on undo/redo
      }
    }, [history, historyIndex]);

    const measureTextLayer = (ctx: CanvasRenderingContext2D, layer: TextLayer) => {
        ctx.font = `${layer.fontStyle} ${layer.fontWeight} ${layer.fontSize}px ${layer.fontFamily}`;
        const metrics = ctx.measureText(layer.text);
        return {
            width: metrics.width,
            height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent || layer.fontSize,
        };
    };

    const isPointInLayer = (px: number, py: number, layer: DesignLayer) => {
        const { x, y, width, height, rotation } = layer;
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        
        // Translate point to be relative to layer center
        const translatedX = px - centerX;
        const translatedY = py - centerY;
        
        // Rotate point backwards
        const rad = -rotation * Math.PI / 180;
        const rotatedX = translatedX * Math.cos(rad) - translatedY * Math.sin(rad);
        const rotatedY = translatedX * Math.sin(rad) + translatedY * Math.cos(rad);

        // Check if rotated point is within the un-rotated layer bounds
        const layerHalfWidth = width / 2;
        const layerHalfHeight = height / 2;
        
        return rotatedX > -layerHalfWidth && rotatedX < layerHalfWidth &&
               rotatedY > -layerHalfHeight && rotatedY < layerHalfHeight;
    };
    
    const getLayerHandles = (layer: DesignLayer) => {
      const handleSize = 10;
      const { x, y, width, height } = layer;
      
      const corners = {
        nw: { x, y },
        ne: { x: x + width, y },
        sw: { x, y: y + height },
        se: { x: x + width, y: y + height },
        rotation: { x: x + width / 2, y: y - 25 },
      };

      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const rad = layer.rotation * Math.PI / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const getRotatedPoint = (px: number, py: number) => {
        const dx = px - centerX;
        const dy = py - centerY;
        return {
          x: centerX + dx * cos - dy * sin,
          y: centerY + dx * sin + dy * cos,
        };
      };
      
      return {
        nw: { ...getRotatedPoint(corners.nw.x, corners.nw.y), cursor: 'nwse-resize' },
        ne: { ...getRotatedPoint(corners.ne.x, corners.ne.y), cursor: 'nesw-resize' },
        sw: { ...getRotatedPoint(corners.sw.x, corners.sw.y), cursor: 'nesw-resize' },
        se: { ...getRotatedPoint(corners.se.x, corners.se.y), cursor: 'nwse-resize' },
        rotation: { ...getRotatedPoint(corners.rotation.x, corners.rotation.y), cursor: 'crosshair' },
      };
    };

    const drawLayers = useCallback((ctx: CanvasRenderingContext2D, layers: DesignLayer[]) => {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  
      layers.forEach(layer => {
          if (layer.isHidden || layer.id === editingLayerId) return;
          ctx.save();
          ctx.globalAlpha = layer.opacity;
  
          if (layer.shadowColor && layer.shadowBlur && layer.shadowBlur > 0) {
              ctx.shadowColor = layer.shadowColor;
              ctx.shadowBlur = layer.shadowBlur;
              ctx.shadowOffsetX = layer.shadowOffsetX || 0;
              ctx.shadowOffsetY = layer.shadowOffsetY || 0;
          }
  
          const centerX = layer.x + layer.width / 2;
          const centerY = layer.y + layer.height / 2;
          ctx.translate(centerX, centerY);
          ctx.rotate(layer.rotation * Math.PI / 180);
          ctx.translate(-centerX, -centerY);
          
          if (layer.type === 'group') {
              ctx.strokeStyle = 'rgba(0, 123, 255, 0.5)';
              ctx.lineWidth = 2;
              ctx.setLineDash([6, 3]);
              ctx.strokeRect(layer.x, layer.y, layer.width, layer.height);
              ctx.setLineDash([]);
          } else if (layer.type === 'image' && layer.image) {
              ctx.drawImage(layer.image, layer.x, layer.y, layer.width, layer.height);
          } else if (layer.type === 'video') {
              const videoElement = videoElements[layer.id];
              if (videoElement && videoElement.readyState >= 2) {
                  ctx.drawImage(videoElement, layer.x, layer.y, layer.width, layer.height);
              }
          } else if (layer.type === 'text') {
              ctx.font = `${layer.fontStyle} ${layer.fontWeight} ${layer.fontSize}px ${layer.fontFamily}`;
              ctx.fillStyle = layer.color;
              ctx.textBaseline = 'top';
              ctx.fillText(layer.text, layer.x, layer.y);
          } else if (layer.type === 'shape') {
              ctx.fillStyle = layer.fillColor || '#cccccc';
              if (layer.shapeType === 'rectangle') {
                  ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
              } else if (layer.shapeType === 'circle') {
                  ctx.beginPath();
                  ctx.arc(layer.x + layer.width / 2, layer.y + layer.height / 2, layer.width / 2, 0, Math.PI * 2);
                  ctx.fill();
              }
          }
          ctx.restore();
      });
    }, [videoElements, editingLayerId]);

    const renderCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const currentLayers = activeSlide?.layers || [];
        drawLayers(ctx, currentLayers);

        if (snapLines.length > 0) {
            ctx.save();
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            snapLines.forEach(line => {
                ctx.beginPath();
                if (line.type === 'v') { ctx.moveTo(line.position, 0); ctx.lineTo(line.position, CANVAS_HEIGHT); } 
                else { ctx.moveTo(0, line.position); ctx.lineTo(CANVAS_WIDTH, line.position); }
                ctx.stroke();
            });
            ctx.restore();
        }

        selectedLayers.forEach(layer => {
            if (layer && layer.id !== editingLayerId) {
                ctx.save();
                const centerX = layer.x + layer.width / 2;
                const centerY = layer.y + layer.height / 2;
                ctx.translate(centerX, centerY);
                ctx.rotate(layer.rotation * Math.PI / 180);
                ctx.translate(-centerX, -centerY);

                ctx.strokeStyle = '#007bff';
                ctx.lineWidth = 2;
                ctx.strokeRect(layer.x - 1, layer.y - 1, layer.width + 2, layer.height + 2);
                
                ctx.restore();
            }
        });

        // Only draw handles if a single layer is selected and not being edited
        if (selectedLayers.length === 1 && selectedLayers[0].type !== 'group' && selectedLayers[0].id !== editingLayerId) {
            const selectedLayer = selectedLayers[0];
            const handles = getLayerHandles(selectedLayer);
            ctx.fillStyle = '#007bff';
            const handleSize = 10;
            Object.values(handles).forEach(handle => {
                ctx.fillRect(handle.x - handleSize/2, handle.y - handleSize/2, handleSize, handleSize);
            });
        }

    }, [activeSlide, selectedLayers, snapLines, drawLayers, editingLayerId]);
    
    // Renders the current presentation slide to its dedicated canvas
    const renderPresentationSlide = useCallback(() => {
      if (!isPresenting) return;
      const canvas = presentationCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
  
      const slideToRender = slides[presenterSlideIndex];
      if (slideToRender) {
        drawLayers(ctx, slideToRender.layers);
      }
    }, [isPresenting, presenterSlideIndex, slides, drawLayers]);

    // Main render loop for video playback
    useEffect(() => {
        const hasVideo = activeSlide?.layers.some(l => l.type === 'video');
        
        const loop = () => {
            renderCanvas();
            animationFrameRef.current = requestAnimationFrame(loop);
        };

        if (hasVideo) {
            animationFrameRef.current = requestAnimationFrame(loop);
        } else {
            renderCanvas(); // Render once if no video
        }

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [activeSlide, renderCanvas]);

    // Effect for the presentation canvas
    useEffect(() => {
        if (isPresenting) {
          renderPresentationSlide();
        }
    }, [isPresenting, renderPresentationSlide]);

    // Keyboard controls for presentation mode and undo/redo
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        const isEditingText = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA';
        
        // Allow escape key to pass through to blur the textarea
        if (isEditingText && e.key !== 'Escape') return;
  
        if (isPresenting) {
          if (e.key === 'Escape') setIsPresenting(false);
          else if (e.key === 'ArrowRight') setPresenterSlideIndex(prev => Math.min(prev + 1, slides.length - 1));
          else if (e.key === 'ArrowLeft') setPresenterSlideIndex(prev => Math.max(prev - 1, 0));
        } else {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                handleUndo();
            } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
                e.preventDefault();
                handleRedo();
            } else if (e.key === 'Escape' && editingLayerId) {
              setEditingLayerId(null);
            } else if (lastSelectedLayer && lastSelectedLayer.type === 'text' && !isEditingText && !e.ctrlKey && !e.metaKey && e.key.length === 1) {
              setEditingLayerId(lastSelectedLayer.id);
              setTimeout(() => {
                if (textEditRef.current) {
                  textEditRef.current.value = e.key;
                  textEditRef.current.select();
                }
              }, 0);
            }
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPresenting, slides.length, handleUndo, handleRedo, lastSelectedLayer, editingLayerId]);


    useEffect(() => {
        if (lastSelectedLayer && canvasRef.current && canvasContainerRef.current) {
            const canvasRect = canvasRef.current.getBoundingClientRect();
            const containerRect = canvasContainerRef.current.getBoundingClientRect();

            const scaleY = canvasRect.height / CANVAS_HEIGHT;
            const scaleX = canvasRect.width / CANVAS_WIDTH;

            const canvasTopInContainer = canvasRect.top - containerRect.top;
            const canvasLeftInContainer = canvasRect.left - containerRect.left;

            const layerTop = canvasTopInContainer + lastSelectedLayer.y * scaleY;
            const layerLeft = canvasLeftInContainer + lastSelectedLayer.x * scaleX;
            const layerScreenWidth = lastSelectedLayer.width * scaleX;

            const TOOLBAR_HEIGHT = 44;
            const TOOLBAR_WIDTH = lastSelectedLayer.type === 'text' ? 450 : 200;
            const Y_OFFSET = 10;

            const top = layerTop - TOOLBAR_HEIGHT - Y_OFFSET;
            const left = layerLeft + (layerScreenWidth / 2) - (TOOLBAR_WIDTH / 2);

            setToolbarPosition({
                top: Math.max(5, top),
                left: Math.max(5, Math.min(left, containerRect.width - TOOLBAR_WIDTH - 5))
            });
        } else {
            setToolbarPosition(null);
        }
    }, [selectedLayerIds, slides, activeSlideId, lastSelectedLayer]);

    useEffect(() => {
        const loadFonts = async () => {
          if ('fonts' in document) {
            await Promise.all(webSafeFonts.map(font => (document as any).fonts.load(`12px ${font}`)));
            renderCanvas();
          }
        };
        loadFonts();
    }, [renderCanvas]);
    
    // Focus textarea when editing starts
    useEffect(() => {
        if (editingLayerId && textEditRef.current) {
            textEditRef.current.focus();
            textEditRef.current.select();
        }
    }, [editingLayerId]);

    // Sync local font size state when selection changes
    useEffect(() => {
        if (lastSelectedLayer?.type === 'text') {
            setLocalFontSize(lastSelectedLayer.fontSize.toString());
        }
    }, [lastSelectedLayer]);

    // Cleanup object URLs for videos
    useEffect(() => {
        return () => {
            Object.values(videoElements).forEach(video => URL.revokeObjectURL(video.src));
        };
    }, [videoElements]);

    const addLayerToActiveSlide = (newLayer: DesignLayer) => {
      if (!activeSlide) return;
      const newSlides = slides.map(s => 
          s.id === activeSlide.id 
              ? { ...s, layers: [...s.layers, newLayer] } 
              : s
      );
      updateSlidesAndRecord(() => newSlides);
      setSelectedLayerIds([newLayer.id]);
    };

    const handleAddImage = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new window.Image();
            img.onload = () => {
                const MAX_DIM = 400;
                const scale = Math.min(MAX_DIM / img.width, MAX_DIM / img.height, 1);
                const newWidth = img.width * scale;
                const newHeight = img.height * scale;

                addLayerToActiveSlide({
                    id: `layer-${Date.now()}`, type: 'image', src: img.src, image: img,
                    x: (CANVAS_WIDTH - newWidth) / 2, y: (CANVAS_HEIGHT - newHeight) / 2,
                    width: newWidth, height: newHeight, rotation: 0, opacity: 1,
                    isLocked: false, isHidden: false,
                });
            };
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    };

    const handleAddVideo = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !file.type.startsWith('video/')) {
            toast({ title: "Invalid File", description: "Please select a valid video file.", variant: "destructive"});
            return;
        };

        const fileURL = URL.createObjectURL(file);
        const videoElement = document.createElement('video');
        videoElement.src = fileURL;
        videoElement.muted = true;
        videoElement.loop = true;
        videoElement.playsInline = true;
        
        videoElement.onloadedmetadata = () => {
            videoElement.play().catch(error => {
                console.warn("Video autoplay was prevented by the browser.", error);
            });

            const MAX_DIM = 400;
            const scale = Math.min(MAX_DIM / videoElement.videoWidth, MAX_DIM / videoElement.videoHeight, 1);
            const newWidth = videoElement.videoWidth * scale;
            const newHeight = videoElement.videoHeight * scale;

            const newLayer: VideoLayer = {
                id: `layer-${Date.now()}`, type: 'video', src: fileURL,
                x: (CANVAS_WIDTH - newWidth) / 2, y: (CANVAS_HEIGHT - newHeight) / 2,
                width: newWidth, height: newHeight, rotation: 0, opacity: 1,
                isLocked: false, isHidden: false,
            };
            
            setVideoElements(prev => ({...prev, [newLayer.id]: videoElement }));
            addLayerToActiveSlide(newLayer);
        };
        
        event.target.value = '';
    };
    
    const handleAddText = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const newLayer: TextLayer = {
            id: `layer-${Date.now()}`, type: 'text', text: 'Hello, Presentation!',
            x: 100, y: 100, width: 0, height: 0, fontFamily: 'Roboto', fontSize: 48,
            fontWeight: 'normal', fontStyle: 'normal', color: '#000000', rotation: 0, opacity: 1,
            isLocked: false, isHidden: false,
        };

        const { width, height } = measureTextLayer(ctx, newLayer);
        newLayer.width = width; newLayer.height = height;
        addLayerToActiveSlide(newLayer);
    };

    const handleAddShape = (shapeType: 'rectangle' | 'circle') => {
        const size = 150;
        addLayerToActiveSlide({
            id: `layer-${Date.now()}`, type: 'shape', shapeType,
            x: (CANVAS_WIDTH - size) / 2, y: (CANVAS_HEIGHT - size) / 2,
            width: size, height: size, rotation: 0, opacity: 1, fillColor: '#cccccc',
            isLocked: false, isHidden: false,
        });
    };

    const confirmLoadTemplate = () => {
        if (!templateToLoad || !activeSlide) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const newLayersPromises = templateToLoad.layers.map((layerDef, index) => {
            return new Promise<DesignLayer>((resolve) => {
                const baseLayer = {
                    id: `tpl-layer-${Date.now()}-${index}`, x: layerDef.x || 0, y: layerDef.y || 0,
                    rotation: layerDef.rotation || 0, opacity: layerDef.opacity || 1,
                    shadowColor: layerDef.shadowColor, shadowBlur: layerDef.shadowBlur,
                    shadowOffsetX: layerDef.shadowOffsetX, shadowOffsetY: layerDef.shadowOffsetY,
                    isLocked: false, isHidden: false,
                };
                if (layerDef.type === 'text') {
                    const textLayer: TextLayer = {
                        ...baseLayer, type: 'text', text: layerDef.text || '', fontFamily: layerDef.fontFamily || 'Roboto',
                        fontSize: layerDef.fontSize || 24, fontWeight: layerDef.fontWeight || 'normal',
                        fontStyle: layerDef.fontStyle || 'normal', color: layerDef.color || '#000000', width: 0, height: 0,
                    };
                    const { width, height } = measureTextLayer(ctx, textLayer);
                    textLayer.width = width; textLayer.height = height;
                    resolve(textLayer);
                } else if (layerDef.type === 'image' && layerDef.src) {
                    const img = new window.Image();
                    img.crossOrigin = "anonymous";
                    img.onload = () => resolve({
                        ...baseLayer, type: 'image', src: img.src, image: img,
                        width: layerDef.width || img.width, height: layerDef.height || img.height,
                    });
                    img.src = layerDef.src;
                } else if (layerDef.type === 'shape') {
                    resolve({
                        ...baseLayer, type: 'shape', shapeType: layerDef.shapeType || 'rectangle',
                        width: layerDef.width || 150, height: layerDef.height || 150, fillColor: layerDef.fillColor || '#cccccc',
                    });
                }
            });
        });
        
        Promise.all(newLayersPromises).then(newLayers => {
            const finalLayers = newLayers.filter(Boolean) as DesignLayer[];
            updateSlidesAndRecord(prev => prev.map(s => s.id === activeSlide.id ? { ...s, layers: finalLayers } : s));
            setSelectedLayerIds([]);
            setTemplateToLoad(null);
            toast({ title: 'Template Applied to Current Slide' });
        });
    };
    
    // Live update function without saving to history
    const updateLayer = useCallback((id: string, updates: Partial<DesignLayer>) => {
        if (!activeSlideId) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        setSlides(prevSlides => prevSlides.map(s => {
            if (s.id !== activeSlideId) return s;
            const newLayers = s.layers.map(l => {
                if (l.id !== id) return l;
                const updatedLayer = { ...l, ...updates };
                if (updatedLayer.type === 'text') {
                    const { width, height } = measureTextLayer(ctx, updatedLayer as TextLayer);
                    updatedLayer.width = width;
                    updatedLayer.height = height;
                }
                return updatedLayer as DesignLayer;
            });
            return { ...s, layers: newLayers };
        }));

    }, [activeSlideId]);

    // Function to commit the current state to history
    const commitHistory = useCallback(() => {
        setSlides(prev => {
            pushToHistory(prev);
            return prev;
        });
    }, [pushToHistory]);

    // Combined function for controls that should update and record history in one go
    const updateAndCommit = useCallback((id: string, updates: Partial<DesignLayer>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        setSlides(prevSlides => {
            const newSlides = prevSlides.map(s => {
                if (s.id !== activeSlideId) return s;
                return {
                    ...s,
                    layers: s.layers.map(l => {
                        if (l.id !== id) return l;
                        const updatedLayer = { ...l, ...updates };
                        if (updatedLayer.type === 'text') {
                             const { width, height } = measureTextLayer(ctx, updatedLayer as TextLayer);
                             updatedLayer.width = width;
                             updatedLayer.height = height;
                        }
                        return updatedLayer as DesignLayer;
                    })
                };
            });
            pushToHistory(newSlides);
            return newSlides;
        });
    }, [activeSlideId, pushToHistory]);


    const handleToggleLayerProperty = useCallback((layerId: string, property: 'isHidden' | 'isLocked') => {
        updateSlidesAndRecord(prev => prev.map(s => {
            if (s.id !== activeSlideId) return s;
            const newLayers = s.layers.map(l => 
                l.id === layerId ? { ...l, [property]: !l[property] } as DesignLayer : l
            );
            return { ...s, layers: newLayers };
        }));
    }, [activeSlideId, updateSlidesAndRecord]);
    
    const handleRemoveLayer = () => {
        if (selectedLayerIds.length === 0 || !activeSlide) return;
        
        updateSlidesAndRecord(prev => prev.map(s => {
            if (s.id !== activeSlide.id) return s;

            // Cleanup video elements if any of the selected layers are videos
            selectedLayerIds.forEach(id => {
                const layerToRemove = s.layers.find(l => l.id === id);
                if (layerToRemove && layerToRemove.type === 'video') {
                    const videoElement = videoElements[layerToRemove.id];
                    if (videoElement) {
                        URL.revokeObjectURL(videoElement.src);
                        setVideoElements(prevElements => {
                            const newElements = { ...prevElements };
                            delete newElements[layerToRemove.id];
                            return newElements;
                        });
                    }
                }
            });
            
            return { ...s, layers: s.layers.filter(l => !selectedLayerIds.includes(l.id)) };
        }));
        
        setSelectedLayerIds([]);
    };
    
    const handleMoveLayer = (direction: 'up' | 'down') => {
        if (selectedLayerIds.length !== 1 || !activeSlide) return;
        const selectedLayerId = selectedLayerIds[0];
        
        updateSlidesAndRecord(prev => prev.map(s => {
            if (s.id !== activeSlide.id) return s;

            const index = s.layers.findIndex(l => l.id === selectedLayerId);
            if (index === -1) return s;
        
            const newLayers = [...s.layers];
            if (direction === 'up' && index < newLayers.length - 1) {
                [newLayers[index], newLayers[index + 1]] = [newLayers[index + 1], newLayers[index]];
            } 
            else if (direction === 'down' && index > 0) {
                [newLayers[index], newLayers[index - 1]] = [newLayers[index - 1], newLayers[index]];
            }
            return { ...s, layers: newLayers };
        }));
    };

    const handleDuplicateLayer = () => {
        if (selectedLayerIds.length === 0 || !activeSlide) return;
        
        updateSlidesAndRecord(prev => prev.map(s => {
            if (s.id !== activeSlide.id) return s;

            const layersToDuplicate = s.layers.filter(l => selectedLayerIds.includes(l.id));
            const newLayers: DesignLayer[] = [];

            layersToDuplicate.forEach(layer => {
                const newId = `layer-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                let newLayer: DesignLayer;
                
                const baseDuplicatedLayer = {
                    ...layer,
                    id: newId,
                    x: layer.x + 20,
                    y: layer.y + 20,
                    isLocked: false,
                    isHidden: false,
                };

                if (layer.type === 'video') {
                    const videoElement = videoElements[layer.id];
                    if(!videoElement) return;

                    const newVideoElement = videoElement.cloneNode(true) as HTMLVideoElement;
                    newVideoElement.currentTime = 0;
                    newVideoElement.play();
                    
                    setVideoElements(prevVids => ({...prevVids, [newId]: newVideoElement}));
                    newLayer = baseDuplicatedLayer as VideoLayer;

                } else if (layer.type === 'image' && layer.image) {
                    newLayer = { ...baseDuplicatedLayer, image: layer.image } as ImageLayer;
                } else {
                    newLayer = baseDuplicatedLayer;
                }
                newLayers.push(newLayer);
            });
            
            if (newLayers.length > 0) {
                setSelectedLayerIds(newLayers.map(l => l.id));
                return { ...s, layers: [...s.layers, ...newLayers] };
            }
            return s;
        }));
    };
    
    const handleGroupLayers = () => {
        if (!activeSlide || selectedLayers.length < 2) return;
        
        updateSlidesAndRecord(prev => prev.map(s => {
            if (s.id !== activeSlide.id) return s;

            let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
            selectedLayers.forEach(l => {
                minX = Math.min(minX, l.x);
                minY = Math.min(minY, l.y);
                maxX = Math.max(maxX, l.x + l.width);
                maxY = Math.max(maxY, l.y + l.height);
            });
            
            const newGroup: GroupLayer = {
                id: `group-${Date.now()}`, type: 'group',
                x: minX, y: minY, width: maxX - minX, height: maxY - minY,
                rotation: 0, opacity: 1, childLayerIds: selectedLayerIds,
                isLocked: false, isHidden: false,
            };
            
            const newLayers = s.layers.map(l => 
                selectedLayerIds.includes(l.id) ? { ...l, isHidden: true } as DesignLayer : l
            );
            newLayers.push(newGroup);
            setSelectedLayerIds([newGroup.id]);
            return { ...s, layers: newLayers };
        }));
    };
    
    const handleUngroupLayers = () => {
        const group = selectedLayers[0];
        if (!activeSlide || !group || group.type !== 'group') return;
        
        updateSlidesAndRecord(prev => prev.map(s => {
            if (s.id !== activeSlide.id) return s;
            
            let newLayers = s.layers.filter(l => l.id !== group.id);
            newLayers = newLayers.map(l => 
                group.childLayerIds.includes(l.id) ? { ...l, isHidden: false } as DesignLayer : l
            );
            
            setSelectedLayerIds(group.childLayerIds);
            return { ...s, layers: newLayers };
        }));
    };

    const getScaledCoords = (e: ReactMouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        };
    };

    const handleCanvasMouseMove = (e: ReactMouseEvent<HTMLCanvasElement>) => {
        if (interactionMode) return; 

        const { x: mouseX, y: mouseY } = getScaledCoords(e);

        if (selectedLayers.length === 1 && selectedLayers[0].type !== 'group' && !selectedLayers[0].isLocked) {
            const handles = getLayerHandles(selectedLayers[0]);
            const handleSize = 10;
            for (const handle of Object.values(handles)) {
                if (mouseX >= handle.x - handleSize/2 && mouseX <= handle.x + handleSize/2 && mouseY >= handle.y - handleSize/2 && mouseY <= handle.y + handleSize/2) {
                    setCursor(handle.cursor);
                    return;
                }
            }
        }

        const currentLayers = activeSlide?.layers || [];
        for (let i = currentLayers.length - 1; i >= 0; i--) {
            const layer = currentLayers[i];
            if (layer.isHidden || layer.isLocked) continue;
            if (isPointInLayer(mouseX, mouseY, layer)) {
                if (layer.type === 'text') {
                    setCursor('text');
                } else {
                    setCursor('move');
                }
                return;
            }
        }
        setCursor('default');
    };

    const handleMouseDown = (e: ReactMouseEvent<HTMLCanvasElement>) => {
        if (editingLayerId) {
            const textEditor = textEditRef.current;
            if (textEditor && !textEditor.contains(e.target as Node)) {
                updateAndCommit(editingLayerId, {text: textEditor.value});
                setEditingLayerId(null);
            }
            return;
        }

        const { x: mouseX, y: mouseY } = getScaledCoords(e);
        const shiftKey = e.shiftKey;

        if (selectedLayerIds.length === 1 && lastSelectedLayer && !lastSelectedLayer.isLocked && lastSelectedLayer.type !== 'group') {
            const handles = getLayerHandles(lastSelectedLayer);
            const handleSize = 10;
            for (const [key, handle] of Object.entries(handles)) {
                const handleRect = { x: handle.x - handleSize/2, y: handle.y - handleSize/2, width: handleSize, height: handleSize };
                if (mouseX >= handleRect.x && mouseX <= handleRect.x + handleRect.width && mouseY >= handleRect.y && mouseY <= handleRect.y + handleRect.height) {
                    if (key === 'rotation') {
                        setInteractionMode({ type: 'rotate' });
                    } else {
                        setInteractionMode({ type: 'resize', handle: key as 'nw'|'ne'|'sw'|'se' });
                    }
                    setDragStart({ x: lastSelectedLayer.x, y: lastSelectedLayer.y, layer: lastSelectedLayer, initialMouseX: mouseX, initialMouseY: mouseY });
                    return;
                }
            }
        }
        
        const currentLayers = activeSlide?.layers || [];
        let clickedLayer: DesignLayer | null = null;
        for (let i = currentLayers.length - 1; i >= 0; i--) {
            const currentLayer = currentLayers[i];
            if (currentLayer.isHidden || currentLayer.isLocked) continue;
            if (isPointInLayer(mouseX, mouseY, currentLayer)) {
                clickedLayer = currentLayer;
                break;
            }
        }
        
        if (clickedLayer) {
            if (shiftKey) {
                setSelectedLayerIds(prev => 
                    prev.includes(clickedLayer!.id) 
                        ? prev.filter(id => id !== clickedLayer!.id)
                        : [...prev, clickedLayer!.id]
                );
            } else if (!selectedLayerIds.includes(clickedLayer.id)) {
                setSelectedLayerIds([clickedLayer.id]);
            }
            
            setInteractionMode({ type: 'move' });

            const currentSelection = shiftKey 
                ? (selectedLayerIds.includes(clickedLayer.id) 
                    ? selectedLayerIds.filter(id => id !== clickedLayer!.id) 
                    : [...selectedLayerIds, clickedLayer.id])
                : [clickedLayer.id];
            
            const initialLayers = activeSlide!.layers.filter(l => currentSelection.includes(l.id));

            setDragStart({ 
                x: clickedLayer.x, y: clickedLayer.y, layer: clickedLayer,
                initialMouseX: mouseX, initialMouseY: mouseY,
                initialPositions: new Map(initialLayers.map(l => [l.id, { x: l.x, y: l.y }]))
            });
        } else {
            setSelectedLayerIds([]);
        }
    };
    
    const handleDoubleClick = (e: ReactMouseEvent<HTMLCanvasElement>) => {
        const { x: mouseX, y: mouseY } = getScaledCoords(e);
        const currentLayers = activeSlide?.layers || [];
        for (let i = currentLayers.length - 1; i >= 0; i--) {
            const layer = currentLayers[i];
            if (layer.type === 'text' && !layer.isHidden && !layer.isLocked && isPointInLayer(mouseX, mouseY, layer)) {
                setEditingLayerId(layer.id);
                setSelectedLayerIds([layer.id]); // Also select it
                return;
            }
        }
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!interactionMode || !dragStart || !activeSlide) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;

        let dx = mouseX - dragStart.initialMouseX;
        let dy = mouseY - dragStart.initialMouseY;
        
        setSlides(prevSlides => {
            const newSlides = prevSlides.map(s => {
                if (s.id !== activeSlide.id) return s;

                const newLayers = s.layers.map(layer => {
                    if (interactionMode.type === 'move' && selectedLayerIds.includes(layer.id)) {
                        const initialPos = dragStart.initialPositions?.get(layer.id);
                        if (initialPos) {
                            let newX = initialPos.x + dx;
                            let newY = initialPos.y + dy;

                            // Clamp the new position to be within the canvas bounds.
                            // A layer's position is its top-left corner.
                            newX = Math.max(0, Math.min(newX, CANVAS_WIDTH - layer.width));
                            newY = Math.max(0, Math.min(newY, CANVAS_HEIGHT - layer.height));

                            return { ...layer, x: newX, y: newY } as DesignLayer;
                        }
                    } else if (layer.id === dragStart.layer.id) {
                         if (interactionMode.type === 'resize') {
                            const originalLayer = dragStart.layer;
                            const aspectRatio = originalLayer.width / originalLayer.height;

                            const centerX = originalLayer.x + originalLayer.width / 2;
                            const centerY = originalLayer.y + originalLayer.height / 2;

                            const startVectorX = dragStart.initialMouseX - centerX;
                            const startVectorY = dragStart.initialMouseY - centerY;
                            const startDist = Math.sqrt(startVectorX**2 + startVectorY**2);
                            
                            const currentVectorX = mouseX - centerX;
                            const currentVectorY = mouseY - centerY;
                            const currentDist = Math.sqrt(currentVectorX**2 + currentVectorY**2);
                            
                            if (startDist === 0) return layer; // Avoid division by zero

                            const scaleFactor = currentDist / startDist;

                            const newWidth = Math.max(10, originalLayer.width * scaleFactor);
                            const newHeight = newWidth / aspectRatio;

                            const newX = centerX - newWidth / 2;
                            const newY = centerY - newHeight / 2;
                            
                            return { ...layer, x: newX, y: newY, width: newWidth, height: newHeight } as DesignLayer;
                        } else if (interactionMode.type === 'rotate') {
                             const centerX = layer.x + layer.width / 2;
                             const centerY = layer.y + layer.height / 2;
                             const angle = Math.atan2(mouseY - centerY, mouseX - centerX) * 180 / Math.PI;
                             return { ...layer, rotation: angle + 90 } as DesignLayer;
                        }
                    }
                    return layer;
                });
                return { ...s, layers: newLayers };
            });
            return newSlides;
        });

    }, [interactionMode, dragStart, activeSlide, selectedLayerIds]);

    const handleMouseUp = useCallback(() => {
        if (interactionMode && dragStart) {
            commitHistory();
        }
        setInteractionMode(null); setDragStart(null); setSnapLines([]); 
    }, [interactionMode, dragStart, commitHistory]);
    
    useEffect(() => {
        if(interactionMode) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [interactionMode, handleMouseMove, handleMouseUp]);

    const handleDownloadCurrentSlide = () => {
        setSelectedLayerIds([]);
        setTimeout(() => {
            const canvas = canvasRef.current;
            if (!canvas) { toast({ title: 'Error', description: 'Canvas not found.', variant: 'destructive'}); return; };
            const link = document.createElement('a');
            link.download = `slide-${slides.findIndex(s => s.id === activeSlideId) + 1}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            toast({ title: 'Download Started' });
        }, 100);
    };

    const handleDownloadPresentation = async () => {
        toast({ title: 'Exporting Presentation...', description: 'This may take a moment. Videos will be represented by their current frame.' });
        const { default: jsPDF } = await import('jspdf');
    
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'px',
          format: [CANVAS_WIDTH, CANVAS_HEIGHT],
        });
    
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = CANVAS_WIDTH;
        tempCanvas.height = CANVAS_HEIGHT;
        const ctx = tempCanvas.getContext('2d');
        if (!ctx) {
          toast({ title: 'Error', description: 'Could not create canvas for PDF export.', variant: 'destructive' });
          return;
        }
    
        for (let i = 0; i < slides.length; i++) {
          const slide = slides[i];
          drawLayers(ctx, slide.layers);
          
          const imgData = tempCanvas.toDataURL('image/png');
          if (i > 0) pdf.addPage([CANVAS_WIDTH, CANVAS_HEIGHT], 'landscape');
          pdf.addImage(imgData, 'PNG', 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }
    
        pdf.save('presentation.pdf');
        toast({ title: 'Presentation downloaded as PDF.' });
    };

    const handleAddSlide = () => {
      const newSlide = { id: `slide-${Date.now()}`, layers: [] };
      const currentIndex = slides.findIndex(s => s.id === activeSlideId);
      const newSlides = [...slides];
      newSlides.splice(currentIndex + 1, 0, newSlide);
      updateSlidesAndRecord(() => newSlides);
      setActiveSlideId(newSlide.id);
    };

    const handleDeleteSlide = (idToDelete: string) => {
      if (slides.length <= 1) {
        toast({ title: "Cannot Delete", description: "You must have at least one slide.", variant: 'destructive'});
        return;
      }
      
      const slideToDelete = slides.find(s => s.id === idToDelete);
      if (slideToDelete) {
        slideToDelete.layers.forEach(layer => {
            if (layer.type === 'video') {
                const videoElement = videoElements[layer.id];
                if (videoElement) {
                    URL.revokeObjectURL(videoElement.src);
                    setVideoElements(prev => { const newElements = { ...prev }; delete newElements[layer.id]; return newElements; });
                }
            }
        });
      }

      const oldIndex = slides.findIndex(s => s.id === idToDelete);
      const newSlides = slides.filter(s => s.id !== idToDelete);
      if (activeSlideId === idToDelete) {
          const newActiveIndex = Math.max(0, oldIndex - 1);
          setActiveSlideId(newSlides[newActiveIndex].id);
      }
      updateSlidesAndRecord(() => newSlides);
    };

    const handleDuplicateSlide = (idToDuplicate: string) => {
      const slideToDuplicate = slides.find(s => s.id === idToDuplicate);
      if (!slideToDuplicate) return;

      const newSlide: Slide = {
          id: `slide-${Date.now()}`,
          layers: slideToDuplicate.layers.map(layer => {
              const newId = `layer-${Date.now()}-${Math.random()}`;
              if (layer.type === 'video') {
                  const videoElement = videoElements[layer.id];
                  if (!videoElement) return { ...layer, id: newId } as DesignLayer;
                  
                  const newVideoElement = videoElement.cloneNode(true) as HTMLVideoElement;
                  newVideoElement.currentTime = 0;
                  newVideoElement.play();
                  setVideoElements(prev => ({...prev, [newId]: newVideoElement}));
                  return { ...layer, id: newId } as DesignLayer;
              }
              if (layer.type === 'image' && layer.image) {
                  return { ...layer, id: newId, image: layer.image } as DesignLayer;
              }
              return { ...layer, id: newId } as DesignLayer;
          })
      };

      const currentIndex = slides.findIndex(s => s.id === idToDuplicate);
      const newSlides = [...slides];
      newSlides.splice(currentIndex + 1, 0, newSlide);
      updateSlidesAndRecord(() => newSlides);
      setActiveSlideId(newSlide.id);
    };

    const handleFontSizeCommit = () => {
        if (!lastSelectedLayer || lastSelectedLayer.type !== 'text') return;
        const textLayer = lastSelectedLayer as TextLayer;
        const newSize = parseInt(localFontSize, 10);
        if (!isNaN(newSize) && newSize > 0) {
            if (newSize !== textLayer.fontSize) {
                updateAndCommit(textLayer.id, { fontSize: newSize });
            }
        } else {
            // Reset to original value if input is invalid
            setLocalFontSize(textLayer.fontSize.toString());
        }
    };
    
    const isUngroupable = selectedLayers.length === 1 && selectedLayers[0].type === 'group';

    return (
        <>
            <Card className="h-full w-full flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
                    <div className="space-y-1.5">
                        <CardTitle className="text-xl">Design Studio</CardTitle>
                        <CardDescription>Create and manage slides for your presentation.</CardDescription>
                    </div>
                     <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={handleUndo} disabled={historyIndex <= 0} title="Undo (Ctrl+Z)"><Undo className="h-4 w-4" /></Button>
                        <Button variant="outline" size="icon" onClick={handleRedo} disabled={historyIndex >= history.length - 1} title="Redo (Ctrl+Y)"><Redo className="h-4 w-4" /></Button>
                        <Separator orientation="vertical" className="h-8 mx-1" />
                        <Button variant="outline" onClick={() => setIsPresenting(true)}><Presentation className="mr-2"/> Present</Button>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 p-4">
                    <div className="relative flex h-full w-full gap-4 rounded-lg border bg-muted/40 p-4">
                        <div 
                            ref={canvasContainerRef}
                            className="relative flex-1 flex items-center justify-center rounded-lg bg-background shadow-lg overflow-auto"
                        >
                            {toolbarPosition && lastSelectedLayer && (
                                <div
                                    className="absolute z-10 bg-background border rounded-lg shadow-lg p-1 flex items-center gap-1"
                                    style={{ top: `${toolbarPosition.top}px`, left: `${toolbarPosition.left}px` }}
                                    onMouseDown={(e) => e.stopPropagation()} // Prevent canvas mousedown from firing
                                >
                                    {lastSelectedLayer.type === 'text' && (
                                        <>
                                            <Select value={lastSelectedLayer.fontFamily} onValueChange={value => updateAndCommit(lastSelectedLayer!.id, { fontFamily: value })}>
                                                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent>{webSafeFonts.map(font => <SelectItem key={font} value={font} style={{ fontFamily: font }}>{font}</SelectItem>)}</SelectContent>
                                            </Select>
                                            <Input
                                                type="number"
                                                value={localFontSize}
                                                onChange={e => {
                                                    setLocalFontSize(e.target.value);
                                                    const newSize = parseInt(e.target.value, 10);
                                                    if (!isNaN(newSize) && newSize > 0) {
                                                        updateLayer(lastSelectedLayer.id, { fontSize: newSize });
                                                    }
                                                }}
                                                onBlur={handleFontSizeCommit}
                                                onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
                                                className="w-16 h-8 text-xs"
                                            />
                                            <Toggle size="sm" pressed={lastSelectedLayer.fontWeight === 'bold'} onPressedChange={pressed => updateAndCommit(lastSelectedLayer!.id, { fontWeight: pressed ? 'bold' : 'normal' })}><Bold className="h-4 w-4"/></Toggle>
                                            <Toggle size="sm" pressed={lastSelectedLayer.fontStyle === 'italic'} onPressedChange={pressed => updateAndCommit(lastSelectedLayer!.id, { fontStyle: pressed ? 'italic' : 'normal' })}><Italic className="h-4 w-4"/></Toggle>
                                            <div className="h-8 w-8 flex items-center justify-center relative">
                                                <Palette className="h-4 w-4"/>
                                                <Input type="color" value={lastSelectedLayer.color} onChange={e => updateLayer(lastSelectedLayer!.id, { color: e.target.value })} onBlur={() => commitHistory()} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"/>
                                            </div>
                                            <Separator orientation="vertical" className="h-6 mx-1" />
                                        </>
                                    )}
                                    <Button variant="ghost" size="icon" title="Duplicate Layer" onClick={handleDuplicateLayer}><CopyIcon className="h-4 w-4" /></Button>
                                    <Separator orientation="vertical" className="h-6 mx-1" />
                                    <Button variant="ghost" size="icon" title="Bring Forward" onClick={() => handleMoveLayer('up')} disabled={selectedLayerIds.length !== 1}><ArrowUp className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" title="Send Backward" onClick={() => handleMoveLayer('down')} disabled={selectedLayerIds.length !== 1}><ArrowDown className="h-4 w-4" /></Button>
                                    <Separator orientation="vertical" className="h-6 mx-1" />
                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title="Delete Layer" onClick={handleRemoveLayer}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            )}
                            <div style={{ transform: `scale(${zoom})`, transition: 'transform 0.1s' }}>
                                <canvas
                                    ref={canvasRef}
                                    width={CANVAS_WIDTH}
                                    height={CANVAS_HEIGHT}
                                    className="shadow-inner rounded-md bg-white"
                                    style={{ cursor: cursor }}
                                    onMouseDown={handleMouseDown}
                                    onMouseMove={handleCanvasMouseMove}
                                    onDoubleClick={handleDoubleClick}
                                />
                                {editingLayer && (
                                    <textarea
                                        ref={textEditRef}
                                        defaultValue={editingLayer.text}
                                        onBlur={(e) => {
                                            updateAndCommit(editingLayer.id, { text: e.target.value });
                                            setEditingLayerId(null);
                                        }}
                                        onKeyDown={(e) => {
                                            if(e.key === 'Escape') {
                                                updateAndCommit(editingLayer.id, { text: e.currentTarget.value });
                                                setEditingLayerId(null);
                                                e.currentTarget.blur();
                                            }
                                        }}
                                        style={{
                                            position: 'absolute',
                                            left: `${editingLayer.x}px`,
                                            top: `${editingLayer.y}px`,
                                            width: `${editingLayer.width + 50}px`,
                                            height: `${editingLayer.height + 20}px`,
                                            fontFamily: editingLayer.fontFamily,
                                            fontSize: `${editingLayer.fontSize}px`,
                                            fontWeight: editingLayer.fontWeight,
                                            fontStyle: editingLayer.fontStyle,
                                            color: editingLayer.color,
                                            transform: `rotate(${editingLayer.rotation}deg)`,
                                            transformOrigin: 'top left',
                                            background: 'transparent',
                                            border: '1px dashed #007bff',
                                            padding: 0,
                                            margin: 0,
                                            resize: 'none',
                                            overflow: 'hidden',
                                            lineHeight: 1.2
                                        }}
                                    />
                                )}
                            </div>
                            <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1">
                                <Button variant="outline" size="icon" onClick={() => setZoom(z => Math.max(z - 0.1, 0.2))}><ZoomOut /></Button>
                                <Button variant="outline" onClick={() => setZoom(1)} className="w-16">{Math.round(zoom * 100)}%</Button>
                                <Button variant="outline" size="icon" onClick={() => setZoom(z => Math.min(z + 0.1, 2))}><ZoomIn /></Button>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <Button variant="outline" size="icon" onClick={() => setIsPanelOpen(!isPanelOpen)} className="my-auto">
                                {isPanelOpen ? <ChevronRight /> : <ChevronLeft />}
                            </Button>
                            <div className={cn("w-80 flex flex-col gap-2 bg-background rounded-lg border h-full transition-all duration-300", isPanelOpen ? "block" : "hidden")}>
                                <Tabs defaultValue="elements" className="flex flex-col h-full">
                                    <TabsList className="grid w-full grid-cols-2">
                                        <TabsTrigger value="elements">Elements</TabsTrigger>
                                        <TabsTrigger value="layers">Layers</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="elements" className="flex-1 overflow-y-auto p-2">
                                        <div className="p-2">
                                            <h3 className="text-lg font-semibold flex items-center mb-4"><LayoutTemplate className="mr-2 h-5 w-5"/>Templates</h3>
                                            <ScrollArea className="h-48 -mx-2 px-2">
                                                <div className="grid grid-cols-2 gap-2">
                                                    {templates.map(template => (
                                                        <div key={template.id} className="relative group cursor-pointer" onClick={() => setTemplateToLoad(template)}>
                                                            <Image src={template.previewUrl} alt={template.name} width={150} height={100} className="rounded-md object-cover border" data-ai-hint="design template"/>
                                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                <Check className="h-8 w-8 text-white"/>
                                                            </div>
                                                            <p className="text-xs text-center mt-1 truncate">{template.name}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </ScrollArea>
                                        </div>
                                        <Separator />
                                        <div className="p-2">
                                            <h3 className="text-lg font-semibold mb-4">Add Elements</h3>
                                            <div className="grid grid-cols-2 gap-2">
                                                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleAddImage} />
                                                <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleAddVideo} />
                                                <Button variant="outline" onClick={() => imageInputRef.current?.click()}><ImageIcon className="mr-2"/> Image</Button>
                                                <Button variant="outline" onClick={() => videoInputRef.current?.click()}><VideoIcon className="mr-2"/> Video</Button>
                                                <Button variant="outline" onClick={handleAddText}><Text className="mr-2"/> Text</Button>
                                                <Button variant="outline" onClick={() => handleAddShape('rectangle')}><Square className="mr-2"/> Rectangle</Button>
                                                <Button variant="outline" onClick={() => handleAddShape('circle')}><CircleIcon className="mr-2"/> Circle</Button>
                                            </div>
                                        </div>
                                    </TabsContent>
                                    <TabsContent value="layers" className="flex-1 flex flex-col p-0">
                                        <div className="p-4 border-b">
                                            <h3 className="text-lg font-semibold flex items-center mb-2"><Layers className="mr-2 h-5 w-5"/>Layers</h3>
                                            <p className="text-sm text-muted-foreground">Layers on current slide</p>
                                        </div>
                                        <ScrollArea className="px-2 flex-1">
                                            <div className="space-y-1 py-2">
                                                {[...(activeSlide?.layers || [])].reverse().map((layer) => {
                                                    if (layer.isHidden && !selectedLayerIds.includes(layer.id) && !(layer.type === 'group' && layer.childLayerIds.some(id => selectedLayerIds.includes(id)))) {
                                                        return null; // Don't show hidden layers unless they are selected or their group is
                                                    }

                                                    const isSelected = selectedLayerIds.includes(layer.id);
                                                    
                                                    return (
                                                        <div
                                                            key={layer.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation(); 
                                                                if (layer.isLocked) return;
                                                                if (e.shiftKey) {
                                                                    setSelectedLayerIds(prev => prev.includes(layer.id) ? prev.filter(id => id !== layer.id) : [...prev, layer.id]);
                                                                } else {
                                                                    setSelectedLayerIds([layer.id]);
                                                                }
                                                            }}
                                                            className={cn( 
                                                                "flex items-center justify-between p-2 rounded-md transition-colors", 
                                                                isSelected ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                                                                layer.isLocked ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                                                                layer.isHidden && !isSelected ? "opacity-50" : ""
                                                            )}
                                                        >
                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                {layer.type === 'group' && <Group className="h-4 w-4 shrink-0" />}
                                                                {layer.type === 'image' && <ImageIcon className="h-4 w-4 shrink-0" />}
                                                                {layer.type === 'video' && <VideoIcon className="h-4 w-4 shrink-0" />}
                                                                {layer.type === 'text' && <Type className="h-4 w-4 shrink-0" />}
                                                                {layer.type === 'shape' && (layer.shapeType === 'rectangle' ? <Square className="h-4 w-4 shrink-0" /> : <CircleIcon className="h-4 w-4 shrink-0" />)}
                                                                <span className="truncate text-sm">
                                                                    {layer.type === 'text' ? layer.text : layer.type === 'group' ? `Group (${layer.childLayerIds.length} items)` : layer.type === 'shape' ? `${layer.shapeType}` : layer.type === 'video' ? 'Video Layer' : `Image Layer`}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center shrink-0">
                                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleToggleLayerProperty(layer.id, 'isLocked'); }}>
                                                                    {layer.isLocked ? <Lock className="h-4 w-4"/> : <Unlock className="h-4 w-4"/>}
                                                                </Button>
                                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleToggleLayerProperty(layer.id, 'isHidden'); }}>
                                                                    {layer.isHidden ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {(activeSlide?.layers.length || 0) === 0 && (
                                                    <p className="text-xs text-muted-foreground text-center p-4">Your layers will appear here.</p>
                                                )}
                                            </div>
                                        </ScrollArea>
                                        <Separator />
                                        <ScrollArea className="max-h-[45vh] p-4">
                                            {selectedLayerIds.length > 1 ? (
                                                <div>
                                                    <h3 className="text-lg font-semibold mb-4">{selectedLayerIds.length} Layers Selected</h3>
                                                    <Button variant="outline" className="w-full" onClick={handleGroupLayers}><Group className="mr-2"/> Group</Button>
                                                </div>
                                            ) : isUngroupable ? (
                                                <div>
                                                    <h3 className="text-lg font-semibold mb-4">Group Selected</h3>
                                                    <Button variant="outline" className="w-full" onClick={handleUngroupLayers}><Ungroup className="mr-2"/> Ungroup</Button>
                                                </div>
                                            ) : lastSelectedLayer ? (
                                                <div className="space-y-6">
                                                    <div>
                                                        <div className="flex justify-between items-center mb-4">
                                                            <h3 className="text-lg font-semibold capitalize">{lastSelectedLayer.type} Properties</h3>
                                                            <Button variant="ghost" size="icon" onClick={handleRemoveLayer}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                                        </div>
                                                        <div className="space-y-4">
                                                            {lastSelectedLayer.type === 'shape' && (<div className="space-y-1"><Label htmlFor="prop-fill-color" className="flex items-center"><Palette className="mr-2 h-4 w-4" />Fill Color</Label><Input id="prop-fill-color" type="color" value={lastSelectedLayer.fillColor} onChange={e => updateLayer(lastSelectedLayer!.id, { fillColor: e.target.value })} onBlur={() => commitHistory()} className="h-10 p-1"/></div>)}
                                                            <div className="space-y-1"><Label htmlFor="prop-opacity" className="flex items-center"><Percent className="mr-2 h-4 w-4" />Opacity</Label><Slider id="prop-opacity" value={[lastSelectedLayer.opacity]} min={0} max={1} step={0.01} onValueChange={v => updateLayer(lastSelectedLayer!.id, { opacity: v[0] })} onValueCommit={commitHistory}/></div>
                                                            <div className="space-y-1"><Label htmlFor="prop-rotation" className="flex items-center"><RotateCcw className="mr-2 h-4 w-4" />Rotation</Label><Slider id="prop-rotation" value={[lastSelectedLayer.rotation]} min={-180} max={180} step={1} onValueChange={v => updateLayer(lastSelectedLayer!.id, { rotation: v[0] })} onValueCommit={commitHistory} /></div>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <h3 className="text-lg font-semibold flex items-center mb-4"><Wand2 className="mr-2 h-5 w-5"/>Effects</h3>
                                                        <div className="space-y-4">
                                                            <div className="flex items-center space-x-2"><Checkbox id="shadow-enable" checked={!!lastSelectedLayer.shadowBlur && lastSelectedLayer.shadowBlur > 0} onCheckedChange={(checked) => { updateAndCommit(lastSelectedLayer!.id, { shadowBlur: checked ? 10 : 0, shadowColor: checked ? '#000000' : undefined, shadowOffsetX: checked ? 5 : 0, shadowOffsetY: checked ? 5 : 0, }); }} /><Label htmlFor="shadow-enable">Enable Drop Shadow</Label></div>
                                                            {!!lastSelectedLayer.shadowBlur && lastSelectedLayer.shadowBlur > 0 && (
                                                                <div className="space-y-4 pl-2 border-l-2 ml-3">
                                                                    <div className="space-y-1 pl-4"><Label>Color</Label><Input type="color" value={lastSelectedLayer.shadowColor || '#000000'} onChange={e => updateLayer(lastSelectedLayer!.id, { shadowColor: e.target.value })} onBlur={commitHistory} className="h-10 p-1"/></div>
                                                                    <div className="space-y-1 pl-4"><Label>Blur</Label><Slider value={[lastSelectedLayer.shadowBlur || 0]} min={0} max={50} step={1} onValueChange={v => updateLayer(lastSelectedLayer!.id, { shadowBlur: v[0] })} onValueCommit={commitHistory}/></div>
                                                                    <div className="space-y-1 pl-4"><Label>Offset X</Label><Slider value={[lastSelectedLayer.shadowOffsetX || 0]} min={-50} max={50} step={1} onValueChange={v => updateLayer(lastSelectedLayer!.id, { shadowOffsetX: v[0] })} onValueCommit={commitHistory}/></div>
                                                                    <div className="space-y-1 pl-4"><Label>Offset Y</Label><Slider value={[lastSelectedLayer.shadowOffsetY || 0]} min={-50} max={50} step={1} onValueChange={v => updateLayer(lastSelectedLayer!.id, { shadowOffsetY: v[0] })} onValueCommit={commitHistory}/></div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : ( <div className="flex items-center justify-center bg-muted/10 border-dashed rounded-md min-h-[150px]"><div className="text-center p-4 text-muted-foreground"><Move className="mx-auto h-8 w-8 mb-2" /><p className="text-sm font-medium">Select a layer to edit</p><p className="text-xs">Click an object on the canvas or a layer in the panel.</p></div></div>)}
                                        </ScrollArea>
                                        <div className="p-2 mt-auto border-t">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button className="w-full"><Download className="mr-2"/> Download</Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuItem onClick={handleDownloadCurrentSlide}>Current Slide (PNG)</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={handleDownloadPresentation}>Presentation (PDF)</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </div>
                    </div>
                </CardContent>

                <CardFooter className="p-2 border-t bg-background/95">
                  <div className="flex items-center gap-2 w-full">
                    <ScrollArea className="w-full whitespace-nowrap">
                      <div className="flex items-end gap-3 p-2">
                        {slides.map((slide, index) => (
                          <div key={slide.id} className="group relative">
                            <p className="text-xs text-center text-muted-foreground mb-1">{index + 1}</p>
                            <div
                              className={cn("w-40 h-24 bg-white rounded-md border-2 cursor-pointer shadow-sm flex items-center justify-center text-muted-foreground", activeSlideId === slide.id ? 'border-primary' : 'border-border')}
                              onClick={() => setActiveSlideId(slide.id)}
                            >
                               {slide.layers.length > 0 ? `${slide.layers.length} layers` : "Blank"}
                            </div>
                            <div className="absolute top-0 right-0 m-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="outline" size="icon" className="h-6 w-6 bg-white/80" onClick={() => handleDuplicateSlide(slide.id)}><CopyIcon className="h-3 w-3"/></Button>
                              <Button variant="destructive" size="icon" className="h-6 w-6" onClick={() => handleDeleteSlide(slide.id)}><Trash2 className="h-3 w-3"/></Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    <Button variant="outline" size="lg" className="h-24" onClick={handleAddSlide}><PlusCircle className="h-6 w-6"/></Button>
                  </div>
                </CardFooter>
            </Card>

            <AlertDialog open={!!templateToLoad} onOpenChange={() => setTemplateToLoad(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Load Template?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will replace all content on the current slide with the selected template. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmLoadTemplate}>Load Template</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {isPresenting && (
                <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center group/presenter">
                    <canvas
                        ref={presentationCanvasRef}
                        width={CANVAS_WIDTH}
                        height={CANVAS_HEIGHT}
                        className="max-w-[95vw] max-h-[95vh] object-contain"
                    />
                    <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-white/50 hover:text-white" onClick={() => setIsPresenting(false)}>
                        <X />
                    </Button>
                    <Button variant="ghost" size="icon" className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white opacity-0 group-hover/presenter:opacity-100 transition-opacity" onClick={() => setPresenterSlideIndex(prev => Math.max(prev - 1, 0))}>
                        <ChevronLeft className="h-8 w-8" />
                    </Button>
                     <Button variant="ghost" size="icon" className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white opacity-0 group-hover/presenter:opacity-100 transition-opacity" onClick={() => setPresenterSlideIndex(prev => Math.min(prev + 1, slides.length - 1))}>
                        <ChevronRight className="h-8 w-8" />
                    </Button>
                    <div className="absolute bottom-4 text-white/50 text-sm">
                        {presenterSlideIndex + 1} / {slides.length}
                    </div>
                </div>
            )}
        </>
    );
}
