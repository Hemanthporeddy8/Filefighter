// src/app/(main)/design-studio/page.tsx
"use client";

import { useState, useRef, useEffect, useCallback, ChangeEvent } from 'react';
import { extractImagesFromPdfScratch } from '@/lib/pdf-scratch/extractor';
import { buildPdfFromCanvasesScratch } from '@/lib/pdf-scratch/builder';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Upload, Download, Trash2, Type, Palette, Bold, Italic, 
  AlignLeft, AlignCenter, AlignRight, ZoomIn, ZoomOut, 
  Maximize2, Eye, Plus, Check, Loader2, FileText, 
  Settings, Copy, HelpCircle, X, ChevronLeft, ChevronRight, RefreshCw
} from 'lucide-react';

// Custom interfaces for PhoText Studio
interface BatchImage {
  id: string;
  name: string;
  width: number;
  height: number;
  originalSrc: string; // Object URL or Base64 Data URL
  imgElement: HTMLImageElement | null;
  offscreenCanvas: HTMLCanvasElement | null;
  isPdfPage: boolean;
  pageIndex: number;
}

interface TextReplacementLayer {
  id: string;
  x: number; // Stored in original high-resolution image pixel coordinates
  y: number;
  w: number;
  h: number;
  text: string;
  fontFamily: string;
  fontSize: number; // Stored in pixels relative to original image size
  color: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  letterSpacing: number; // in pixels relative to original image size
  lineHeight: number; // multiplier
  align: 'left' | 'center' | 'right';
  shadowBlur: number;
  shadowColor: string;
  inpaintMode: 'bilinear' | 'color' | 'clone';
  inpaintColor: string;
  cloneOffsetX: number; // in pixels relative to original image size
  cloneOffsetY: number;
}

const GOOGLE_FONTS = [
  'Inter', 'Roboto', 'Montserrat', 'Oswald', 
  'Playfair Display', 'Lora', 'Pacifico', 'Courier New'
];

export default function DesignStudioPage() {
  const { toast } = useToast();
  
  // File upload and processing states
  const [images, setImages] = useState<BatchImage[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  // Replacement layers (synchronized across all batch images)
  const [layers, setLayers] = useState<TextReplacementLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  
  // Interaction/Canvas settings
  const [zoom, setZoom] = useState(1); // 1 = fit-to-screen
  const [activeTool, setActiveTool] = useState<'draw' | 'select' | 'eyedropper' | 'clone-setup'>('draw');
  
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Interaction states for Canvas Editor
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [dragState, setDragState] = useState<{
    type: 'move' | 'resize' | 'clone-drag';
    handle?: string;
    layerId: string;
    startX: number;
    startY: number;
    initialBox: { x: number; y: number; w: number; h: number };
    initialCloneOffset?: { x: number; y: number };
  } | null>(null);

  const activeImage = images.find(img => img.id === activeImageId) || null;
  const selectedLayer = layers.find(l => l.id === selectedLayerId) || null;

  // Dynamically load Google Fonts on component mount
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${GOOGLE_FONTS.map(f => f.replace(' ', '+')).join('&family=')}&display=swap`;
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Compute viewport scale factor (Viewport Dimensions / Original Image Dimensions)
  const getScaleFactor = useCallback(() => {
    if (!activeImage || !containerRef.current) return 1;
    const padding = 40;
    const maxWidth = containerRef.current.clientWidth - padding;
    const maxHeight = containerRef.current.clientHeight - padding;
    const scaleX = maxWidth / activeImage.width;
    const scaleY = maxHeight / activeImage.height;
    return Math.min(scaleX, scaleY) * zoom;
  }, [activeImage, zoom]);

  // Bilinear Inpainting Algorithm executed on offscreen canvas
  const performBilinearInpaint = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number
  ) => {
    // Avoid drawing errors if bounds are outside canvas
    const cx = Math.max(0, Math.floor(x));
    const cy = Math.max(0, Math.floor(y));
    const cw = Math.min(ctx.canvas.width - cx, Math.floor(w));
    const ch = Math.min(ctx.canvas.height - cy, Math.floor(h));
    if (cw <= 0 || ch <= 0) return;

    const imgData = ctx.getImageData(cx, cy, cw, ch);
    const data = imgData.data;

    // Sample border colors 3 pixels outside box boundary
    const padding = 3;
    const outerBox = ctx.getImageData(
      Math.max(0, cx - padding),
      Math.max(0, cy - padding),
      Math.min(ctx.canvas.width, cw + padding * 2),
      Math.min(ctx.canvas.height, ch + padding * 2)
    );

    const ow = outerBox.width;
    const oh = outerBox.height;
    const oData = outerBox.data;

    const getOuterPixel = (ox: number, oy: number) => {
      const idx = (Math.min(oh - 1, Math.max(0, oy)) * ow + Math.min(ow - 1, Math.max(0, ox))) * 4;
      return [oData[idx], oData[idx+1], oData[idx+2], oData[idx+3]];
    };

    for (let py = 0; py < ch; py++) {
      const oy = py + padding;
      
      // Interpolate horizontal endpoints
      const [rl, gl, bl, al] = getOuterPixel(0, oy);
      const [rr, gr, br, ar] = getOuterPixel(ow - 1, oy);

      for (let px = 0; px < cw; px++) {
        const ox = px + padding;

        // Interpolate vertical endpoints
        const [rt, gt, bt, at] = getOuterPixel(ox, 0);
        const [rb, gb, bb, ab] = getOuterPixel(ox, oh - 1);

        const dx = cw > 1 ? px / (cw - 1) : 0.5;
        const dy = ch > 1 ? py / (ch - 1) : 0.5;

        // Horizontal lerp
        const rH = (1 - dx) * rl + dx * rr;
        const gH = (1 - dx) * gl + dx * gr;
        const bH = (1 - dx) * bl + dx * br;
        const aH = (1 - dx) * al + dx * ar;

        // Vertical lerp
        const rV = (1 - dy) * rt + dy * rb;
        const gV = (1 - dy) * gt + dy * gb;
        const bV = (1 - dy) * bt + dy * bb;
        const aV = (1 - dy) * at + dy * ab;

        // Combine horizontal and vertical components symmetrically
        const idx = (py * cw + px) * 4;
        data[idx] = Math.round(0.5 * rH + 0.5 * rV);
        data[idx+1] = Math.round(0.5 * gH + 0.5 * gV);
        data[idx+2] = Math.round(0.5 * bH + 0.5 * bV);
        data[idx+3] = Math.round(0.5 * aH + 0.5 * aV);
      }
    }

    ctx.putImageData(imgData, cx, cy);
  }, []);

  // Clone Stamp logic executed on offscreen canvas
  const performCloneStamp = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    offsetX: number, offsetY: number
  ) => {
    const cx = Math.max(0, Math.floor(x));
    const cy = Math.max(0, Math.floor(y));
    const cw = Math.min(ctx.canvas.width - cx, Math.floor(w));
    const ch = Math.min(ctx.canvas.height - cy, Math.floor(h));
    if (cw <= 0 || ch <= 0) return;

    // Calculate source coords
    const srcX = Math.max(0, Math.min(ctx.canvas.width - cw, cx + Math.floor(offsetX)));
    const srcY = Math.max(0, Math.min(ctx.canvas.height - ch, cy + Math.floor(offsetY)));

    const srcData = ctx.getImageData(srcX, srcY, cw, ch);
    ctx.putImageData(srcData, cx, cy);
  }, []);

  // Offscreen canvas renderer to generate the in-painted background layer
  const processImageOffscreen = useCallback((img: BatchImage, allLayers: TextReplacementLayer[]) => {
    if (!img.imgElement || !img.offscreenCanvas) return;
    const canvas = img.offscreenCanvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset canvas to original image state
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img.imgElement, 0, 0);

    // Apply background erasing layers sequentially
    allLayers.forEach(layer => {
      if (layer.inpaintMode === 'bilinear') {
        performBilinearInpaint(ctx, layer.x, layer.y, layer.w, layer.h);
      } else if (layer.inpaintMode === 'color') {
        ctx.fillStyle = layer.inpaintColor;
        ctx.fillRect(Math.floor(layer.x), Math.floor(layer.y), Math.floor(layer.w), Math.floor(layer.h));
      } else if (layer.inpaintMode === 'clone') {
        performCloneStamp(ctx, layer.x, layer.y, layer.w, layer.h, layer.cloneOffsetX, layer.cloneOffsetY);
      }
    });
  }, [performBilinearInpaint, performCloneStamp]);

  // Main rendering loop to draw the composite active image onto viewport canvas
  const drawMainCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeImage || !activeImage.offscreenCanvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = getScaleFactor();
    canvas.width = activeImage.width * scale;
    canvas.height = activeImage.height * scale;

    // Draw the offscreen background (inpainted image base)
    ctx.drawImage(activeImage.offscreenCanvas, 0, 0, canvas.width, canvas.height);

    // Render text overlays directly on the canvas as fallback if needed, but we overlay React elements
    // We render dashed lines or boxes in editor mode here
    if (activeTool === 'select') {
      // Draw drag guidelines or selection handles
      layers.forEach(layer => {
        const lx = layer.x * scale;
        const ly = layer.y * scale;
        const lw = layer.w * scale;
        const lh = layer.h * scale;

        ctx.strokeStyle = layer.id === selectedLayerId ? '#8b5cf6' : 'rgba(139, 92, 246, 0.4)';
        ctx.lineWidth = layer.id === selectedLayerId ? 2 : 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(lx, ly, lw, lh);
        ctx.setLineDash([]);

        // If clone stamp tool setup is active for selected layer, draw cloning guidelines
        if (layer.id === selectedLayerId && layer.inpaintMode === 'clone') {
          const cx = (layer.x + layer.cloneOffsetX) * scale;
          const cy = (layer.y + layer.cloneOffsetY) * scale;

          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx + lw/2, cy + lh/2, 6, 0, Math.PI*2);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(lx + lw/2, ly + lh/2);
          ctx.lineTo(cx + lw/2, cy + lh/2);
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
          ctx.stroke();
        }
      });
    }
  }, [activeImage, getScaleFactor, activeTool, layers, selectedLayerId]);

  // Trigger offscreen render + main canvas sync on layer changes
  useEffect(() => {
    if (images.length > 0) {
      images.forEach(img => {
        processImageOffscreen(img, layers);
      });
      drawMainCanvas();
    }
  }, [layers, images, processImageOffscreen, drawMainCanvas]);

  // Trigger main canvas redraw on active image or scale zoom changes
  useEffect(() => {
    drawMainCanvas();
  }, [activeImageId, zoom, drawMainCanvas]);

  // Load standard images (.png, .jpg, etc.)
  const loadSingleImageFile = (file: File, index: number = 0): Promise<BatchImage> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const src = e.target?.result as string;
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;

          resolve({
            id: `img-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`,
            name: file.name,
            width: img.width,
            height: img.height,
            originalSrc: src,
            imgElement: img,
            offscreenCanvas: canvas,
            isPdfPage: false,
            pageIndex: index,
          });
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    });
  };

  // Load PDF pages dynamically using our custom scratch parser (zero-dependency)
  const loadPdfFile = async (file: File): Promise<BatchImage[]> => {
    setLoadingMessage('Extracting pages from PDF...');
    const buffer = await file.arrayBuffer();
    const imageUrls = await extractImagesFromPdfScratch(buffer);
    
    if (imageUrls.length === 0) {
      toast({ 
        title: 'Import Warning', 
        description: 'Could not extract images from PDF. Make sure it is a scanned/image PDF, or upload raw PNG/JPG files.', 
        variant: 'destructive' 
      });
      return [];
    }
    
    const pdfPages: BatchImage[] = [];
    for (let pIndex = 0; pIndex < imageUrls.length; pIndex++) {
      const srcDataUrl = imageUrls[pIndex];
      
      const loadedImg = new window.Image();
      await new Promise<void>((r) => {
        loadedImg.onload = () => r();
        loadedImg.src = srcDataUrl;
      });
      
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = loadedImg.width;
      offscreenCanvas.height = loadedImg.height;
      
      pdfPages.push({
        id: `pdf-${Date.now()}-${pIndex + 1}-${Math.random().toString(36).substr(2, 5)}`,
        name: `${file.name.replace('.pdf', '')}_page_${pIndex + 1}`,
        width: loadedImg.width,
        height: loadedImg.height,
        originalSrc: srcDataUrl,
        imgElement: loadedImg,
        offscreenCanvas: offscreenCanvas,
        isPdfPage: true,
        pageIndex: pIndex + 1,
      });
    }
    return pdfPages;
  };

  // Batch file uploader handler
  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);
    setLoadingMessage('Processing uploaded documents...');
    const list: BatchImage[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          const pages = await loadPdfFile(file);
          list.push(...pages);
        } else {
          setLoadingMessage(`Loading image ${file.name}...`);
          const imgItem = await loadSingleImageFile(file, i);
          list.push(imgItem);
        }
      }

      setImages(prev => {
        const merged = [...prev, ...list];
        if (merged.length > 0 && !activeImageId) {
          setActiveImageId(merged[0].id);
        }
        return merged;
      });

      toast({ title: 'Batch Upload Complete', description: `Successfully loaded ${list.length} pages/images.` });
    } catch (err) {
      console.error(err);
      toast({ title: 'Upload Failed', description: 'Could not process PDF or Image layers.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Switch Active Image
  const handleSelectActiveImage = (id: string) => {
    setActiveImageId(id);
    setSelectedLayerId(null);
  };

  // Delete Batch Image
  const handleDeleteImage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setImages(prev => {
      const remaining = prev.filter(img => img.id !== id);
      if (activeImageId === id) {
        setActiveImageId(remaining.length > 0 ? remaining[0].id : null);
        setSelectedLayerId(null);
      }
      return remaining;
    });
  };

  // Interactive mouse click-and-drag logic on workspace canvas
  const getCanvasMouseCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !activeImage) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const viewportX = e.clientX - rect.left;
    const viewportY = e.clientY - rect.top;

    const scale = getScaleFactor();
    // Return high-resolution coordinates relative to the original image dimensions
    return {
      x: Math.min(activeImage.width, Math.max(0, viewportX / scale)),
      y: Math.min(activeImage.height, Math.max(0, viewportY / scale)),
    };
  };

  // Eyedropper API triggers or Fallback click sampler
  const triggerEyedropper = async () => {
    if (!selectedLayer) return;

    // 1. Try modern native EyeDropper API
    if (typeof window !== 'undefined' && 'EyeDropper' in window) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        setLayers(prev => prev.map(l => l.id === selectedLayerId ? { ...l, inpaintColor: result.sRGBHex, color: result.sRGBHex } : l));
        toast({ title: 'Color Sampled', description: `Color set to ${result.sRGBHex}` });
      } catch (err) {
        console.warn('Eyedropper cancelled or failed', err);
      }
    } else {
      // 2. Set tool mode to local Canvas color sampling click
      setActiveTool('eyedropper');
      toast({ title: 'Eyedropper Active', description: 'Click anywhere on the image to sample background color.' });
    }
  };

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!activeImage) return;
    const coords = getCanvasMouseCoords(e);

    // 1. Eyedropper tool sampling active
    if (activeTool === 'eyedropper' && selectedLayerId) {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        const scale = getScaleFactor();
        const pixelData = ctx.getImageData(coords.x * scale, coords.y * scale, 1, 1).data;
        const hex = '#' + ('000000' + ((pixelData[0] << 16) | (pixelData[1] << 8) | pixelData[2]).toString(16)).slice(-6);
        
        setLayers(prev => prev.map(l => l.id === selectedLayerId ? { ...l, inpaintColor: hex, color: hex } : l));
        setActiveTool('select');
        toast({ title: 'Color Picked Successfully', description: `RGB: (${pixelData[0]}, ${pixelData[1]}, ${pixelData[2]})` });
      }
      return;
    }

    // 2. Drawing mode - start creating selection bounding box
    if (activeTool === 'draw') {
      setIsDrawing(true);
      setDrawStart({ x: coords.x, y: coords.y });
      setSelectedLayerId(null);
      return;
    }

    // 3. Selection mode setup
    if (activeTool === 'select') {
      // Check if we clicked on a Clone Stamp brush offset source
      if (selectedLayer && selectedLayer.inpaintMode === 'clone') {
        const scale = getScaleFactor();
        const cloneX = (selectedLayer.x + selectedLayer.cloneOffsetX) * scale;
        const cloneY = (selectedLayer.y + selectedLayer.cloneOffsetY) * scale;
        const clickX = coords.x * scale;
        const clickY = coords.y * scale;

        const distance = Math.hypot(clickX - (cloneX + selectedLayer.w * scale / 2), clickY - (cloneY + selectedLayer.h * scale / 2));
        if (distance < 12) {
          setDragState({
            type: 'clone-drag',
            layerId: selectedLayer.id,
            startX: coords.x,
            startY: coords.y,
            initialBox: { x: selectedLayer.x, y: selectedLayer.y, w: selectedLayer.w, h: selectedLayer.h },
            initialCloneOffset: { x: selectedLayer.cloneOffsetX, y: selectedLayer.cloneOffsetY },
          });
          return;
        }
      }

      // Check if clicked inside any existing layer bounds (starting from top layers)
      const clickedLayer = [...layers].reverse().find(layer => {
        return (
          coords.x >= layer.x &&
          coords.x <= layer.x + layer.w &&
          coords.y >= layer.y &&
          coords.y <= layer.y + layer.h
        );
      });

      if (clickedLayer) {
        setSelectedLayerId(clickedLayer.id);
        setDragState({
          type: 'move',
          layerId: clickedLayer.id,
          startX: coords.x,
          startY: coords.y,
          initialBox: { x: clickedLayer.x, y: clickedLayer.y, w: clickedLayer.w, h: clickedLayer.h },
        });
      } else {
        setSelectedLayerId(null);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!activeImage) return;
    const coords = getCanvasMouseCoords(e);

    // 1. Drawing box selection
    if (isDrawing) {
      const x = Math.min(drawStart.x, coords.x);
      const y = Math.min(drawStart.y, coords.y);
      const w = Math.abs(coords.x - drawStart.x);
      const h = Math.abs(coords.y - drawStart.y);

      // Temporary live draw feedback
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        drawMainCanvas();
        const scale = getScaleFactor();
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 2;
        ctx.strokeRect(x * scale, y * scale, w * scale, h * scale);
      }
      return;
    }

    // 2. Dragging translation / resizing
    if (dragState) {
      const dx = coords.x - dragState.startX;
      const dy = coords.y - dragState.startY;

      if (dragState.type === 'move') {
        setLayers(prev => prev.map(l => {
          if (l.id !== dragState.layerId) return l;
          return {
            ...l,
            x: Math.max(0, Math.min(activeImage.width - l.w, dragState.initialBox.x + dx)),
            y: Math.max(0, Math.min(activeImage.height - l.h, dragState.initialBox.y + dy)),
          };
        }));
      } else if (dragState.type === 'clone-drag' && dragState.initialCloneOffset) {
        setLayers(prev => prev.map(l => {
          if (l.id !== dragState.layerId) return l;
          return {
            ...l,
            cloneOffsetX: dragState.initialCloneOffset!.x + dx,
            cloneOffsetY: dragState.initialCloneOffset!.y + dy,
          };
        }));
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDrawing && activeImage) {
      const coords = getCanvasMouseCoords(e);
      const x = Math.min(drawStart.x, coords.x);
      const y = Math.min(drawStart.y, coords.y);
      const w = Math.abs(coords.x - drawStart.x);
      const h = Math.abs(coords.y - drawStart.y);

      // Only add layer if selection satisfies a minimal pixel size
      if (w > 8 && h > 8) {
        const newLayer: TextReplacementLayer = {
          id: `layer-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          x, y, w, h,
          text: 'New Styled Text',
          fontFamily: 'Inter',
          fontSize: Math.round(h * 0.7), // Auto-fit text height roughly
          color: '#ffffff',
          fontWeight: 'normal',
          fontStyle: 'normal',
          letterSpacing: 0,
          lineHeight: 1.1,
          align: 'center',
          shadowBlur: 0,
          shadowColor: '#000000',
          inpaintMode: 'bilinear',
          inpaintColor: '#ffffff',
          cloneOffsetX: -w - 10, // Default clone from the left
          cloneOffsetY: 0,
        };

        setLayers(prev => [...prev, newLayer]);
        setSelectedLayerId(newLayer.id);
        setActiveTool('select');
      } else {
        drawMainCanvas();
      }
      setIsDrawing(false);
    }
    setDragState(null);
  };

  // Delete Replacement Layer
  const handleDeleteLayer = (id: string) => {
    setLayers(prev => prev.filter(l => l.id !== id));
    if (selectedLayerId === id) setSelectedLayerId(null);
    toast({ title: 'Layer Deleted', description: 'Text replacement block was removed.' });
  };

  // Clear All Layers
  const handleClearAllLayers = () => {
    setLayers([]);
    setSelectedLayerId(null);
    toast({ title: 'Cleared All', description: 'All text replacement elements were deleted.' });
  };

  // Helper to handle text overlays updates in right sidebar
  const updateSelectedLayer = (updates: Partial<TextReplacementLayer>) => {
    if (!selectedLayerId) return;
    setLayers(prev => prev.map(l => l.id === selectedLayerId ? { ...l, ...updates } : l));
  };

  // Export current single image with text rendering onto a high-res downloaded canvas
  const processExportItem = (img: BatchImage, allLayers: TextReplacementLayer[]): string => {
    if (!img.imgElement || !img.offscreenCanvas) return '';
    
    // Create temporary high-res export canvas
    const expCanvas = document.createElement('canvas');
    expCanvas.width = img.width;
    expCanvas.height = img.height;
    const ctx = expCanvas.getContext('2d');
    if (!ctx) return '';

    // 1. Draw clean background image first
    ctx.drawImage(img.offscreenCanvas, 0, 0);

    // 2. Draw styled text overlays onto vector canvas space
    allLayers.forEach(layer => {
      ctx.save();
      
      const lx = layer.x;
      const ly = layer.y;
      const lw = layer.w;
      const lh = layer.h;

      // Enable shadow blurring if active
      if (layer.shadowBlur > 0) {
        ctx.shadowColor = layer.shadowColor;
        ctx.shadowBlur = layer.shadowBlur;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      }

      ctx.fillStyle = layer.color;
      ctx.textBaseline = 'middle';

      // Set Font style, weight, family, size
      ctx.font = `${layer.fontStyle} ${layer.fontWeight} ${layer.fontSize}px "${layer.fontFamily}", sans-serif`;

      // Multiline text handling
      const lines = layer.text.split('\n');
      const totalTextHeight = lines.length * layer.fontSize * layer.lineHeight;
      const startY = ly + (lh - totalTextHeight) / 2 + (layer.fontSize * layer.lineHeight) / 2;

      lines.forEach((line, index) => {
        const lineY = startY + index * layer.fontSize * layer.lineHeight;
        const textWidth = ctx.measureText(line).width;
        let lineX = lx;

        if (layer.align === 'center') {
          lineX = lx + (lw - textWidth) / 2;
        } else if (layer.align === 'right') {
          lineX = lx + lw - textWidth;
        }

        ctx.fillText(line, lineX, lineY);
      });

      ctx.restore();
    });

    return expCanvas.toDataURL('image/png');
  };

  // Trigger download of current active page
  const handleExportCurrent = () => {
    if (!activeImage) return;
    setIsLoading(true);
    toast({ title: 'Exporting Current Page...', description: 'Rendering high-resolution image text replacement.' });

    try {
      const dataUrl = processExportItem(activeImage, layers);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `PhoText_${activeImage.name.replace('.png', '').replace('.jpg', '')}.png`;
      a.click();
      toast({ title: 'Export Success', description: 'Image downloaded successfully.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Export Failed', description: 'Could not render composite canvas.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // Sequential Batch Download of all images
  const handleExportBatch = async () => {
    if (images.length === 0) return;
    setIsLoading(true);
    toast({ title: 'Exporting Batch Images...', description: 'Starting sequential downloads...' });

    try {
      for (let i = 0; i < images.length; i++) {
        setLoadingMessage(`Exporting image ${i + 1} of ${images.length}...`);
        const img = images[i];
        const dataUrl = processExportItem(img, layers);

        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `PhoText_batch_${i + 1}_${img.name}.png`;
        a.click();

        // 300ms minor delay to prevent browser blockages on multiple trigger clicks
        await new Promise(r => setTimeout(r, 300));
      }
      toast({ title: 'Batch Export Completed', description: `Successfully downloaded ${images.length} images.` });
    } catch (err) {
      console.error(err);
      toast({ title: 'Batch Export Failed', description: 'Error processing batch images.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  // Export batch as single multi-page PDF using our custom scratch builder (zero-dependency)
  const handleExportPDF = async () => {
    if (images.length === 0) return;
    setIsLoading(true);
    toast({ title: 'Generating PDF...', description: 'Compiling all pages...' });

    try {
      const compiledCanvases: HTMLCanvasElement[] = [];

      for (let i = 0; i < images.length; i++) {
        setLoadingMessage(`Rendering page ${i + 1} of ${images.length}...`);
        const img = images[i];
        
        const expCanvas = document.createElement('canvas');
        expCanvas.width = img.width;
        expCanvas.height = img.height;
        const ctx = expCanvas.getContext('2d');
        if (ctx && img.offscreenCanvas) {
          ctx.drawImage(img.offscreenCanvas, 0, 0);
          
          // Render vector text layers
          layers.forEach(layer => {
            ctx.save();
            ctx.fillStyle = layer.color;
            ctx.textBaseline = 'middle';
            ctx.font = `${layer.fontStyle} ${layer.fontWeight} ${layer.fontSize}px "${layer.fontFamily}", sans-serif`;
            
            if (layer.shadowBlur > 0) {
              ctx.shadowColor = layer.shadowColor;
              ctx.shadowBlur = layer.shadowBlur;
              ctx.shadowOffsetX = 2;
              ctx.shadowOffsetY = 2;
            }
            
            const lines = layer.text.split('\n');
            const totalTextHeight = lines.length * layer.fontSize * layer.lineHeight;
            const startY = layer.y + (layer.h - totalTextHeight) / 2 + (layer.fontSize * layer.lineHeight) / 2;
            
            lines.forEach((line, index) => {
              const lineY = startY + index * layer.fontSize * layer.lineHeight;
              const textWidth = ctx.measureText(line).width;
              let lineX = layer.x;
              
              if (layer.align === 'center') {
                lineX = layer.x + (layer.w - textWidth) / 2;
              } else if (layer.align === 'right') {
                lineX = layer.x + layer.w - textWidth;
              }
              ctx.fillText(line, lineX, lineY);
            });
            ctx.restore();
          });
          
          compiledCanvases.push(expCanvas);
        }
      }

      setLoadingMessage('Compiling standard PDF structure...');
      const pdfBlob = await buildPdfFromCanvasesScratch(compiledCanvases);
      
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PhoText_Studio_Document_${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({ title: 'PDF Export Complete', description: 'Successfully compiled and downloaded PDF document.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'PDF Export Failed', description: 'Error generating PDF file.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  return (
    <div className="flex h-[calc(100vh-60px)] w-full overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
      
      {/* 1. Left Sidebar: Batch Uploader & Thumbnails */}
      <div className="w-64 border-r border-zinc-800 bg-zinc-900/60 backdrop-blur-md flex flex-col h-full shrink-0">
        <div className="p-4 border-b border-zinc-800 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm text-zinc-300 uppercase tracking-wider">Batch Uploads</span>
            <span className="bg-purple-900/50 text-purple-400 text-xs px-2 py-0.5 rounded-full border border-purple-500/30">
              {images.length} files
            </span>
          </div>
          <p className="text-[11px] text-zinc-400">Upload multiple images or a multi-page PDF document to edit text in batch.</p>
          
          <Input 
            ref={fileInputRef}
            id="batch-uploader"
            type="file"
            multiple
            accept=".png,.jpg,.jpeg,.webp,.bmp,.pdf"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button 
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white gap-2 text-xs h-9 transition-all duration-300"
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Upload Image / PDF
          </Button>
        </div>

        <ScrollArea className="flex-1 p-2">
          {images.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center px-4">
              <div className="h-12 w-12 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-500 border border-zinc-700/50">
                <FileText className="h-5 w-5" />
              </div>
              <p className="text-xs text-zinc-500">No images or PDF files uploaded yet. Drag & Drop or click Upload to start.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 p-1">
              {images.map((img) => (
                <div
                  key={img.id}
                  onClick={() => handleSelectActiveImage(img.id)}
                  className={`group relative aspect-square rounded-md overflow-hidden bg-zinc-950 border-2 cursor-pointer transition-all duration-200 ${
                    activeImageId === img.id 
                      ? 'border-purple-500 ring-2 ring-purple-500/30 scale-[0.98]' 
                      : 'border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <img 
                    src={img.originalSrc} 
                    alt={img.name} 
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                    <p className="text-[10px] truncate font-medium text-zinc-300">{img.name}</p>
                    {img.isPdfPage && (
                      <span className="text-[8px] bg-red-950 text-red-400 px-1 py-0.2 rounded border border-red-900/30">
                        PDF P.{img.pageIndex}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={(e) => handleDeleteImage(img.id, e)}
                    className="absolute top-1 right-1 h-5 w-5 rounded bg-black/60 hover:bg-red-600/80 text-zinc-400 hover:text-white flex items-center justify-center border border-zinc-800 opacity-0 group-hover:opacity-100 transition-all duration-200"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* 2. Middle Editor: Workspace Canvas */}
      <div className="flex-1 flex flex-col bg-zinc-950 relative overflow-hidden h-full">
        {/* Workspace Canvas Toolbar */}
        <div className="h-14 border-b border-zinc-900 bg-zinc-900/30 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-lg text-purple-400 flex items-center gap-2 tracking-wide font-headline">
              PhoText Studio
            </h1>
            <span className="text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700 px-1.5 py-0.5 rounded uppercase font-semibold">
              Client-Side
            </span>
          </div>

          {activeImage && (
            <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1 gap-1">
              <Button
                variant={activeTool === 'draw' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => {
                  setActiveTool('draw');
                  setSelectedLayerId(null);
                }}
                className={`h-8 gap-1.5 text-xs ${activeTool === 'draw' ? 'bg-purple-600 hover:bg-purple-500' : 'hover:bg-zinc-800 text-zinc-300'}`}
              >
                <Plus className="h-3.5 w-3.5" /> Draw Box
              </Button>
              <Button
                variant={activeTool === 'select' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTool('select')}
                className={`h-8 gap-1.5 text-xs ${activeTool === 'select' ? 'bg-purple-600 hover:bg-purple-500' : 'hover:bg-zinc-800 text-zinc-300'}`}
              >
                <Maximize2 className="h-3.5 w-3.5" /> Select Mode
              </Button>
            </div>
          )}

          <div className="flex items-center gap-3">
            {activeImage && (
              <div className="flex items-center gap-1 bg-zinc-900/60 border border-zinc-800 rounded-md px-1 py-0.5">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setZoom(z => Math.max(0.2, z - 0.15))} 
                  className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs px-1 min-w-[36px] text-center font-medium text-zinc-400">
                  {Math.round(zoom * 100)}%
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setZoom(z => Math.min(3, z + 0.15))} 
                  className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {images.length > 0 && (
              <div className="flex gap-1.5">
                <Button
                  onClick={handleExportCurrent}
                  className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 h-9 text-xs gap-1.5 px-3"
                  disabled={isLoading || !activeImage}
                >
                  <Download className="h-3.5 w-3.5" /> Page PNG
                </Button>
                <Button
                  onClick={handleExportBatch}
                  className="bg-zinc-900 border border-purple-900/50 hover:bg-zinc-800 text-purple-400 h-9 text-xs gap-1.5 px-3"
                  disabled={isLoading}
                >
                  <Download className="h-3.5 w-3.5" /> Batch PNGs
                </Button>
                <Button
                  onClick={handleExportPDF}
                  className="bg-purple-600 hover:bg-purple-500 text-white h-9 text-xs gap-1.5 px-3 transition-colors duration-300"
                  disabled={isLoading}
                >
                  <FileText className="h-3.5 w-3.5" /> Compile PDF
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Image Workspace Canvas View */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-auto bg-zinc-950 p-6 flex justify-center items-center relative"
        >
          {isLoading && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-[2px] z-50 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
              <p className="text-sm font-semibold text-purple-400 tracking-wide animate-pulse">
                {loadingMessage || 'Processing batch images...'}
              </p>
            </div>
          )}

          {!activeImage ? (
            <div className="flex flex-col items-center gap-4 text-center max-w-md mx-auto py-24 px-6 border-2 border-dashed border-zinc-800 bg-zinc-900/20 rounded-2xl">
              <div className="h-16 w-16 bg-purple-950/40 rounded-full flex items-center justify-center text-purple-400 border border-purple-500/20">
                <Upload className="h-8 w-8" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-semibold text-zinc-200">No Image or PDF Active</h3>
                <p className="text-xs text-zinc-500 max-w-[320px] mx-auto leading-relaxed">
                  Start by uploading meme templates, document flyers, product labels, or multi-page PDFs to replace or batch-edit text.
                </p>
              </div>
              <Button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-purple-600 hover:bg-purple-500 text-white"
              >
                Upload Document Files
              </Button>
            </div>
          ) : (
            <div 
              className="relative shadow-2xl bg-zinc-900 border border-zinc-800 transition-all select-none"
              style={{
                width: activeImage.width * getScaleFactor(),
                height: activeImage.height * getScaleFactor(),
              }}
            >
              {/* Composite visible canvas */}
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => {
                  setIsDrawing(false);
                  setDragState(null);
                }}
                className={`block w-full h-full ${
                  activeTool === 'draw' 
                    ? 'cursor-crosshair' 
                    : activeTool === 'eyedropper' 
                    ? 'cursor-cell' 
                    : 'cursor-default'
                }`}
              />

              {/* Text Overlays Interactive layer */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {layers.map(layer => {
                  const scale = getScaleFactor();
                  const lx = layer.x * scale;
                  const ly = layer.y * scale;
                  const lw = layer.w * scale;
                  const lh = layer.h * scale;
                  const isSelected = layer.id === selectedLayerId;

                  return (
                    <div
                      key={layer.id}
                      className={`absolute pointer-events-auto flex items-center select-text justify-center overflow-hidden border border-transparent ${
                        isSelected && activeTool === 'select' ? 'ring-2 ring-purple-500/40 ring-offset-2 ring-offset-zinc-950' : ''
                      }`}
                      style={{
                        left: lx,
                        top: ly,
                        width: lw,
                        height: lh,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (activeTool === 'select') {
                          setSelectedLayerId(layer.id);
                        }
                      }}
                    >
                      {/* Real-time styled editable textbox in workspace */}
                      <textarea
                        value={layer.text}
                        onChange={(e) => {
                          if (activeTool === 'select') {
                            updateSelectedLayer({ text: e.target.value });
                          }
                        }}
                        readOnly={activeTool !== 'select'}
                        placeholder="Double-click to type..."
                        className="w-full h-full bg-transparent border-none resize-none focus:outline-none p-1 text-center font-semibold overflow-hidden leading-normal focus:ring-0 whitespace-pre-wrap select-text cursor-text"
                        style={{
                          fontFamily: `"${layer.fontFamily}", sans-serif`,
                          fontSize: layer.fontSize * scale,
                          color: layer.color,
                          fontWeight: layer.fontWeight,
                          fontStyle: layer.fontStyle,
                          letterSpacing: layer.letterSpacing * scale,
                          lineHeight: layer.lineHeight,
                          textAlign: layer.align,
                          textShadow: layer.shadowBlur > 0 ? `2px 2px ${layer.shadowBlur}px ${layer.shadowColor}` : 'none',
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Right Sidebar: Properties & Eraser Inspector */}
      <div className="w-80 border-l border-zinc-800 bg-zinc-900/60 backdrop-blur-md flex flex-col h-full shrink-0">
        <Tabs defaultValue="styles" className="flex flex-col h-full">
          <TabsList className="w-full grid grid-cols-2 h-12 bg-zinc-900 border-b border-zinc-800 rounded-none shrink-0 p-0">
            <TabsTrigger value="styles" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-purple-500 data-[state=active]:bg-zinc-950/40 text-xs">
              Text Styles
            </TabsTrigger>
            <TabsTrigger value="eraser" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-purple-500 data-[state=active]:bg-zinc-950/40 text-xs">
              Inpaint/Eraser
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            <TabsContent value="styles" className="p-5 flex flex-col gap-5 m-0">
              {!selectedLayer ? (
                <div className="text-center py-20 px-4 text-zinc-500 flex flex-col items-center gap-2">
                  <HelpCircle className="h-8 w-8 text-zinc-600" />
                  <p className="text-xs">No active bounding box selected.</p>
                  <p className="text-[11px] text-zinc-600">Select a drawn layer or click Draw Box to paint a new text replacement.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs uppercase text-zinc-400 tracking-wider">Style Attributes</span>
                    <Button 
                      variant="ghost" 
                      onClick={() => handleDeleteLayer(selectedLayer.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-950/30 h-7 text-xs px-2"
                    >
                      Delete Layer
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-zinc-400">Content Overlay Text</Label>
                    <Input 
                      value={selectedLayer.text}
                      onChange={(e) => updateSelectedLayer({ text: e.target.value })}
                      className="bg-zinc-950 border-zinc-800 text-zinc-200 text-xs focus-visible:ring-purple-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-zinc-400">Font Family</Label>
                    <Select
                      value={selectedLayer.fontFamily}
                      onValueChange={(val) => updateSelectedLayer({ fontFamily: val })}
                    >
                      <SelectTrigger className="bg-zinc-950 border-zinc-800 text-xs text-zinc-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-200">
                        {GOOGLE_FONTS.map(font => (
                          <SelectItem key={font} value={font} style={{ fontFamily: font }} className="hover:bg-zinc-900">
                            {font}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-400">Font Size (px)</Label>
                      <Input
                        type="number"
                        value={selectedLayer.fontSize}
                        onChange={(e) => updateSelectedLayer({ fontSize: Math.max(8, parseInt(e.target.value) || 12) })}
                        className="bg-zinc-950 border-zinc-800 text-zinc-200 text-xs focus-visible:ring-purple-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-400">Text Color</Label>
                      <div className="flex gap-1.5">
                        <div 
                          className="h-9 w-9 rounded border border-zinc-800 cursor-pointer shrink-0"
                          style={{ backgroundColor: selectedLayer.color }}
                          onClick={triggerEyedropper}
                          title="Click to eyedrop color"
                        />
                        <Input
                          type="text"
                          value={selectedLayer.color}
                          onChange={(e) => updateSelectedLayer({ color: e.target.value })}
                          className="bg-zinc-950 border-zinc-800 text-zinc-200 text-xs uppercase"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-zinc-400">Typography Modifiers</Label>
                    <div className="flex gap-2">
                      <Button
                        variant={selectedLayer.fontWeight === 'bold' ? 'default' : 'outline'}
                        onClick={() => updateSelectedLayer({ fontWeight: selectedLayer.fontWeight === 'bold' ? 'normal' : 'bold' })}
                        className={`flex-1 h-9 ${selectedLayer.fontWeight === 'bold' ? 'bg-purple-600 text-white' : 'border-zinc-800 text-zinc-300'}`}
                      >
                        <Bold className="h-3.5 w-3.5 mr-1" /> Bold
                      </Button>
                      <Button
                        variant={selectedLayer.fontStyle === 'italic' ? 'default' : 'outline'}
                        onClick={() => updateSelectedLayer({ fontStyle: selectedLayer.fontStyle === 'italic' ? 'normal' : 'italic' })}
                        className={`flex-1 h-9 ${selectedLayer.fontStyle === 'italic' ? 'bg-purple-600 text-white' : 'border-zinc-800 text-zinc-300'}`}
                      >
                        <Italic className="h-3.5 w-3.5 mr-1" /> Italic
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-zinc-400">Alignment</Label>
                    <div className="flex gap-1 bg-zinc-950 border border-zinc-800 rounded-lg p-0.5">
                      <Button
                        variant={selectedLayer.align === 'left' ? 'secondary' : 'ghost'}
                        onClick={() => updateSelectedLayer({ align: 'left' })}
                        className="flex-1 h-8 p-0"
                      >
                        <AlignLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant={selectedLayer.align === 'center' ? 'secondary' : 'ghost'}
                        onClick={() => updateSelectedLayer({ align: 'center' })}
                        className="flex-1 h-8 p-0"
                      >
                        <AlignCenter className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant={selectedLayer.align === 'right' ? 'secondary' : 'ghost'}
                        onClick={() => updateSelectedLayer({ align: 'right' })}
                        className="flex-1 h-8 p-0"
                      >
                        <AlignRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-400">Letter Spacing</span>
                      <span className="text-zinc-300 font-medium">{selectedLayer.letterSpacing}px</span>
                    </div>
                    <Slider
                      value={[selectedLayer.letterSpacing]}
                      min={-10}
                      max={40}
                      step={1}
                      onValueChange={(val) => updateSelectedLayer({ letterSpacing: val[0] })}
                      className="py-1 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-400">Line Height</span>
                      <span className="text-zinc-300 font-medium">{selectedLayer.lineHeight}</span>
                    </div>
                    <Slider
                      value={[selectedLayer.lineHeight]}
                      min={0.8}
                      max={2.5}
                      step={0.1}
                      onValueChange={(val) => updateSelectedLayer({ lineHeight: val[0] })}
                      className="py-1 cursor-pointer"
                    />
                  </div>

                  <Separator className="bg-zinc-800" />

                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-400">Shadow Blur</span>
                      <span className="text-zinc-300 font-medium">{selectedLayer.shadowBlur}px</span>
                    </div>
                    <Slider
                      value={[selectedLayer.shadowBlur]}
                      min={0}
                      max={20}
                      step={1}
                      onValueChange={(val) => updateSelectedLayer({ shadowBlur: val[0] })}
                      className="py-1 cursor-pointer"
                    />
                  </div>
                  
                  {selectedLayer.shadowBlur > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-400">Shadow Color</Label>
                      <Input
                        value={selectedLayer.shadowColor}
                        onChange={(e) => updateSelectedLayer({ shadowColor: e.target.value })}
                        className="bg-zinc-950 border-zinc-800 text-zinc-200 text-xs"
                      />
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="eraser" className="p-5 flex flex-col gap-5 m-0">
              {!selectedLayer ? (
                <div className="text-center py-20 px-4 text-zinc-500 flex flex-col items-center gap-2">
                  <HelpCircle className="h-8 w-8 text-zinc-600" />
                  <p className="text-xs">No active bounding box selected.</p>
                  <p className="text-[11px] text-zinc-600">Select a drawn layer or click Draw Box to paint a new text replacement.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs uppercase text-zinc-400 tracking-wider">Eraser Engine</span>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-zinc-400">Inpaint/Eraser Mode</Label>
                    <Select
                      value={selectedLayer.inpaintMode}
                      onValueChange={(val: 'bilinear' | 'color' | 'clone') => updateSelectedLayer({ inpaintMode: val })}
                    >
                      <SelectTrigger className="bg-zinc-950 border-zinc-800 text-xs text-zinc-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-200">
                        <SelectItem value="bilinear" className="hover:bg-zinc-900">
                          Bilinear Auto-Inpaint (Recommended)
                        </SelectItem>
                        <SelectItem value="color" className="hover:bg-zinc-900">
                          Solid Color Patch
                        </SelectItem>
                        <SelectItem value="clone" className="hover:bg-zinc-900">
                          Texture Clone Stamp
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedLayer.inpaintMode === 'bilinear' && (
                    <div className="p-3 bg-purple-950/20 border border-purple-500/10 rounded-lg space-y-1.5">
                      <p className="text-xs font-semibold text-purple-400">Bilinear Auto-Inpainter</p>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        Erases original text pixels automatically by interpolating gradients from surrounding boundary pixels. Zero-lag and works perfectly on memes and document scans.
                      </p>
                    </div>
                  )}

                  {selectedLayer.inpaintMode === 'color' && (
                    <div className="space-y-3">
                      <Label className="text-xs text-zinc-400">Solid Color Fill</Label>
                      <div className="flex gap-2">
                        <div 
                          className="h-9 w-9 rounded border border-zinc-800 cursor-pointer shrink-0"
                          style={{ backgroundColor: selectedLayer.inpaintColor }}
                          onClick={triggerEyedropper}
                          title="Click to eyedrop background color"
                        />
                        <Input
                          type="text"
                          value={selectedLayer.inpaintColor}
                          onChange={(e) => updateSelectedLayer({ inpaintColor: e.target.value })}
                          className="bg-zinc-950 border-zinc-800 text-zinc-200 text-xs uppercase"
                        />
                      </div>
                      <Button
                        onClick={triggerEyedropper}
                        className="w-full bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 h-8 text-xs gap-1.5"
                      >
                        <Palette className="h-3.5 w-3.5" /> Launch Eyedropper Color Picker
                      </Button>
                    </div>
                  )}

                  {selectedLayer.inpaintMode === 'clone' && (
                    <div className="space-y-4">
                      <div className="p-3 bg-emerald-950/20 border border-emerald-500/10 rounded-lg space-y-1.5">
                        <p className="text-xs font-semibold text-emerald-400">Texture Clone Stamp Brush</p>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">
                          For textured or noise-heavy backgrounds, clone background pixels from an offset coordinate.
                        </p>
                        <Button
                          onClick={() => {
                            setActiveTool('select');
                            toast({ title: 'Texture Stamp Setup', description: 'Drag the green target circle to select the clean texture source.' });
                          }}
                          className="w-full bg-emerald-700 hover:bg-emerald-600 text-white h-7 text-xs gap-1.5 mt-1"
                        >
                          Position Stamp Source
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[11px] text-zinc-500">Horizontal Offset</Label>
                          <Input
                            type="number"
                            value={selectedLayer.cloneOffsetX}
                            onChange={(e) => updateSelectedLayer({ cloneOffsetX: parseInt(e.target.value) || 0 })}
                            className="bg-zinc-950 border-zinc-800 text-zinc-200 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-zinc-500">Vertical Offset</Label>
                          <Input
                            type="number"
                            value={selectedLayer.cloneOffsetY}
                            onChange={(e) => updateSelectedLayer({ cloneOffsetY: parseInt(e.target.value) || 0 })}
                            className="bg-zinc-950 border-zinc-800 text-zinc-200 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <Separator className="bg-zinc-800" />

                  <div className="space-y-2">
                    <span className="font-bold text-xs uppercase text-zinc-400 tracking-wider">Box Metrics</span>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] text-zinc-500 block">Position X / Y</span>
                        <span className="text-xs font-medium text-zinc-300">
                          {Math.round(selectedLayer.x)}px / {Math.round(selectedLayer.y)}px
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 block">Size Width / Height</span>
                        <span className="text-xs font-medium text-zinc-300">
                          {Math.round(selectedLayer.w)}px / {Math.round(selectedLayer.h)}px
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </ScrollArea>

          {images.length > 0 && (
            <div className="p-4 border-t border-zinc-800 bg-zinc-900/40 shrink-0">
              <Button
                variant="outline"
                onClick={handleClearAllLayers}
                className="w-full border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs gap-1.5 h-9"
              >
                Clear All Text Replacements
              </Button>
            </div>
          )}
        </Tabs>
      </div>

    </div>
  );
}
