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
  Settings, Copy, HelpCircle, X, ChevronLeft, ChevronRight, RefreshCw, Sun, Moon, Undo2, Redo2
} from 'lucide-react';

interface BatchImage {
  id: string;
  name: string;
  width: number;
  height: number;
  originalSrc: string;
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
  text: string; // The replacement text string
  fontFamily: string;
  fontSize: number; // relative to original image size
  color: string;
  fontWeight: number; // 100 to 900 to match weight slider in video
  fontStyle: 'normal' | 'italic';
  letterSpacing: number; // in pixels
  baseline: number; // vertical shift in pixels
  lineHeight: number; // percentage (e.g. 105 = 105%)
  opacity: number; // 0 to 100
  align: 'left' | 'center' | 'right';
  shadowBlur: number;
  shadowColor: string;
  inpaintMode: 'bilinear' | 'color' | 'clone';
  inpaintColor: string;
  cloneOffsetX: number;
  cloneOffsetY: number;
}

const GOOGLE_FONTS = [
  'Inter', 'Arial', 'Helvetica', 'Times New Roman', 'Montserrat', 'Oswald', 
  'Playfair Display', 'Lora', 'Pacifico'
];

// Helper component to render a zoomed cropped preview of the selected word from the original image element
const CropPreview = ({ activeImage, layer }: { activeImage: BatchImage; layer: TextReplacementLayer }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeImage || !activeImage.imgElement) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions to match original high-res selection bounds
    canvas.width = Math.max(1, Math.floor(layer.w));
    canvas.height = Math.max(1, Math.floor(layer.h));

    // Draw the crop from the original image (before any erasing runs!)
    ctx.drawImage(
      activeImage.imgElement,
      Math.floor(layer.x), Math.floor(layer.y), Math.floor(layer.w), Math.floor(layer.h),
      0, 0, canvas.width, canvas.height
    );
  }, [activeImage, layer]);

  return (
    <div className="flex flex-col gap-1 bg-zinc-950/80 p-2 rounded border border-zinc-800/60 shadow-inner">
      <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wide">Selected Text Crop Preview</span>
      <div className="h-14 w-full flex items-center justify-center bg-zinc-900/40 rounded overflow-hidden p-1 border border-zinc-900/50">
        <canvas ref={canvasRef} className="max-h-full max-w-full object-contain" style={{ imageRendering: 'pixelated' }} />
      </div>
    </div>
  );
};

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
  
  // Store extracted text items for PDF pages (indexed by BatchImage.id)
  const [pdfTextContent, setPdfTextContent] = useState<Record<string, { items: any[]; viewport: any }>>({});
  
  // Interaction/Canvas settings
  const [zoom, setZoom] = useState(1); // 1 = fit-to-screen
  const [activeTool, setActiveTool] = useState<'draw' | 'select' | 'eyedropper' | 'clone-setup'>('draw');
  const [isDarkMode, setIsDarkMode] = useState(true);

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
    const padding = 60;
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
    const cx = Math.max(0, Math.floor(x));
    const cy = Math.max(0, Math.floor(y));
    const cw = Math.min(ctx.canvas.width - cx, Math.floor(w));
    const ch = Math.min(ctx.canvas.height - cy, Math.floor(h));
    if (cw <= 0 || ch <= 0) return;

    const imgData = ctx.getImageData(cx, cy, cw, ch);
    const data = imgData.data;

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
      
      const [rl, gl, bl, al] = getOuterPixel(0, oy);
      const [rr, gr, br, ar] = getOuterPixel(ow - 1, oy);

      for (let px = 0; px < cw; px++) {
        const ox = px + padding;

        const [rt, gt, bt, at] = getOuterPixel(ox, 0);
        const [rb, gb, bb, ab] = getOuterPixel(ox, oh - 1);

        const dx = cw > 1 ? px / (cw - 1) : 0.5;
        const dy = ch > 1 ? py / (ch - 1) : 0.5;

        const rH = (1 - dx) * rl + dx * rr;
        const gH = (1 - dx) * gl + dx * gr;
        const bH = (1 - dx) * bl + dx * br;
        const aH = (1 - dx) * al + dx * ar;

        const rV = (1 - dy) * rt + dy * rb;
        const gV = (1 - dy) * gt + dy * gb;
        const bV = (1 - dy) * bt + dy * bb;
        const aV = (1 - dy) * at + dy * ab;

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

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img.imgElement, 0, 0);

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

    ctx.drawImage(activeImage.offscreenCanvas, 0, 0, canvas.width, canvas.height);

    if (activeTool === 'select' || activeTool === 'draw') {
      layers.forEach(layer => {
        const lx = layer.x * scale;
        const ly = layer.y * scale;
        const lw = layer.w * scale;
        const lh = layer.h * scale;

        ctx.save();
        ctx.strokeStyle = layer.id === selectedLayerId ? '#10b981' : 'rgba(16, 185, 129, 0.4)';
        ctx.lineWidth = layer.id === selectedLayerId ? 2 : 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(lx, ly, lw, lh);
        ctx.restore();

        // Draw resize handles and rotate dot connected underneath exactly like photext
        if (layer.id === selectedLayerId) {
          ctx.save();
          ctx.fillStyle = '#10b981';
          const hs = 6;
          // Top Left
          ctx.fillRect(lx - hs/2, ly - hs/2, hs, hs);
          // Top Right
          ctx.fillRect(lx + lw - hs/2, ly - hs/2, hs, hs);
          // Bottom Left
          ctx.fillRect(lx - hs/2, ly + lh - hs/2, hs, hs);
          // Bottom Right
          ctx.fillRect(lx + lw - hs/2, ly + lh - hs/2, hs, hs);

          // Center drag handle line & circle dot connected underneath (similar to video)
          const dotRadius = 4;
          const handleHeight = 20;
          const cx = lx + lw/2;
          const cy = ly + lh;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx, cy + handleHeight);
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(cx, cy + handleHeight, dotRadius, 0, Math.PI*2);
          ctx.fillStyle = '#10b981';
          ctx.fill();
          ctx.restore();
        }

        if (layer.id === selectedLayerId && layer.inpaintMode === 'clone') {
          const cx = (layer.x + layer.cloneOffsetX) * scale;
          const cy = (layer.y + layer.cloneOffsetY) * scale;

          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx + lw/2, cy + lh/2, 6, 0, Math.PI*2);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(lx + lw/2, ly + lh/2);
          ctx.lineTo(cx + lw/2, cy + lh/2);
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
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

  // Load PDF pages dynamically using the pre-installed pdfjs-dist with scratch carver fallback
  const loadPdfFile = async (file: File): Promise<BatchImage[]> => {
    setLoadingMessage('Extracting pages from PDF...');
    const pdfPages: BatchImage[] = [];

    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.mjs`;

      const buffer = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
      const totalPages = doc.numPages;

      for (let pIndex = 1; pIndex <= totalPages; pIndex++) {
        setLoadingMessage(`Rasterizing PDF Page ${pIndex} of ${totalPages}...`);
        const page = await doc.getPage(pIndex);
        const viewport = page.getViewport({ scale: 2.0 });

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = viewport.width;
        tempCanvas.height = viewport.height;
        const ctx = tempCanvas.getContext('2d');

        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
          const srcDataUrl = tempCanvas.toDataURL('image/png');

          const loadedImg = new window.Image();
          await new Promise<void>((r) => {
            loadedImg.onload = () => r();
            loadedImg.src = srcDataUrl;
          });

          const offscreenCanvas = document.createElement('canvas');
          offscreenCanvas.width = viewport.width;
          offscreenCanvas.height = viewport.height;

          const pageId = `pdf-${Date.now()}-${pIndex}-${Math.random().toString(36).substr(2, 5)}`;
          
          try {
            const textContent = await page.getTextContent();
            setPdfTextContent(prev => ({
              ...prev,
              [pageId]: { items: textContent.items, viewport }
            }));
          } catch (textErr) {
            console.warn("Could not extract PDF text content", textErr);
          }

          pdfPages.push({
            id: pageId,
            name: `${file.name.replace('.pdf', '')}_page_${pIndex}`,
            width: viewport.width,
            height: viewport.height,
            originalSrc: srcDataUrl,
            imgElement: loadedImg,
            offscreenCanvas: offscreenCanvas,
            isPdfPage: true,
            pageIndex: pIndex,
          });
        }
      }
    } catch (err) {
      console.warn("pdfjs-dist loader failed, falling back to scratch parser", err);
      const buffer = await file.arrayBuffer();
      const imageUrls = await extractImagesFromPdfScratch(buffer);
      
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
    }

    return pdfPages;
  };

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

  const handleSelectActiveImage = (id: string) => {
    setActiveImageId(id);
    setSelectedLayerId(null);
  };

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

  const getCanvasMouseCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !activeImage) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const viewportX = e.clientX - rect.left;
    const viewportY = e.clientY - rect.top;

    const scale = getScaleFactor();
    return {
      x: Math.min(activeImage.width, Math.max(0, viewportX / scale)),
      y: Math.min(activeImage.height, Math.max(0, viewportY / scale)),
    };
  };

  const triggerEyedropper = async () => {
    if (!selectedLayer) return;

    if (typeof window !== 'undefined' && (window as any).EyeDropper) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        setLayers(prev => prev.map(l => l.id === selectedLayerId ? { ...l, inpaintColor: result.sRGBHex, color: result.sRGBHex } : l));
        toast({ title: 'Color Sampled', description: `Color set to ${result.sRGBHex}` });
      } catch (err) {
        console.warn('Eyedropper cancelled or failed', err);
      }
    } else {
      setActiveTool('eyedropper');
      toast({ title: 'Eyedropper Active', description: 'Click anywhere on the image to sample background color.' });
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!activeImage) return;
    const coords = getCanvasMouseCoords(e);

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

    if (activeTool === 'draw') {
      setIsDrawing(true);
      setDrawStart({ x: coords.x, y: coords.y });
      setSelectedLayerId(null);
      return;
    }

    if (activeTool === 'select') {
      if (selectedLayer) {
        const scale = getScaleFactor();
        
        // 1. Check if clicked on Clone Stamp Source Dot
        if (selectedLayer.inpaintMode === 'clone') {
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
      }

      // 2. Check if clicked inside any existing layers
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

    if (isDrawing) {
      const x = Math.min(drawStart.x, coords.x);
      const y = Math.min(drawStart.y, coords.y);
      const w = Math.abs(coords.x - drawStart.x);
      const h = Math.abs(coords.y - drawStart.y);

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        drawMainCanvas();
        const scale = getScaleFactor();
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.strokeRect(x * scale, y * scale, w * scale, h * scale);
      }
      return;
    }

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

      if (w > 8 && h > 8) {
        let detectedBgColor = '#ffffff';
        let detectedTextColor = '#000000';
        let initialTextContent = '';
        
        if (activeImage.offscreenCanvas) {
          const offCtx = activeImage.offscreenCanvas.getContext('2d');
          if (offCtx) {
            const bx = Math.max(0, Math.floor(x));
            const by = Math.max(0, Math.floor(y));
            const bw = Math.min(activeImage.width - bx, Math.floor(w));
            const bh = Math.min(activeImage.height - by, Math.floor(h));
            
            if (bw > 0 && bh > 0) {
              const pad = 2;
              const borderPixels = offCtx.getImageData(bx, by, bw, bh).data;
              let rSum = 0, gSum = 0, bSum = 0, count = 0;
              
              for (let py = 0; py < bh; py++) {
                for (let px = 0; px < bw; px++) {
                  if (py < pad || py >= bh - pad || px < pad || px >= bw - pad) {
                    const idx = (py * bw + px) * 4;
                    rSum += borderPixels[idx];
                    gSum += borderPixels[idx+1];
                    bSum += borderPixels[idx+2];
                    count++;
                  }
                }
              }
              
              const bgR = count > 0 ? Math.round(rSum / count) : 255;
              const bgG = count > 0 ? Math.round(gSum / count) : 255;
              const bgB = count > 0 ? Math.round(bSum / count) : 255;
              detectedBgColor = '#' + ('000000' + ((bgR << 16) | (bgG << 8) | bgB).toString(16)).slice(-6);
              
              let maxDistance = -1;
              let textR = 0, textG = 0, textB = 0;
              
              for (let idx = 0; idx < borderPixels.length; idx += 4) {
                const r = borderPixels[idx];
                const g = borderPixels[idx+1];
                const b = borderPixels[idx+2];
                
                const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);
                if (dist > maxDistance) {
                  maxDistance = dist;
                  textR = r;
                  textG = g;
                  textB = b;
                }
              }
              
              if (maxDistance > 30) {
                detectedTextColor = '#' + ('000000' + ((textR << 16) | (textG << 8) | textB).toString(16)).slice(-6);
              } else {
                const luminance = (0.299 * bgR + 0.587 * bgG + 0.114 * bgB) / 255;
                detectedTextColor = luminance > 0.5 ? '#000000' : '#ffffff';
              }
            }
          }
        }

        if (activeImage.isPdfPage && pdfTextContent[activeImage.id]) {
          const { items, viewport } = pdfTextContent[activeImage.id];
          const matchedStrings: string[] = [];
          
          items.forEach((item: any) => {
            if (!item.str || item.str.trim() === '') return;
            const tx = item.transform[4];
            const ty = item.transform[5];
            
            const [vx, vy] = viewport.convertToViewportPoint(tx, ty);
            const scaleFactorX = activeImage.width / viewport.width;
            const scaleFactorY = activeImage.height / viewport.height;
            const originalX = vx * scaleFactorX;
            const originalY = vy * scaleFactorY;

            if (
              originalX >= x - 20 &&
              originalX <= x + w + 20 &&
              originalY >= y - 10 &&
              originalY <= y + h + 20
            ) {
              matchedStrings.push(item.str);
            }
          });
          
          if (matchedStrings.length > 0) {
            initialTextContent = matchedStrings.join(' ');
          }
        }

        const newLayer: TextReplacementLayer = {
          id: `layer-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          x, y, w, h,
          text: initialTextContent,
          fontFamily: 'Arial',
          fontSize: Math.round(h * 0.75),
          color: detectedTextColor,
          fontWeight: 700,
          fontStyle: 'normal',
          letterSpacing: 0,
          baseline: 0,
          lineHeight: 105,
          opacity: 100,
          align: 'center',
          shadowBlur: 0,
          shadowColor: '#000000',
          inpaintMode: 'bilinear',
          inpaintColor: detectedBgColor,
          cloneOffsetX: -w - 10,
          cloneOffsetY: 0,
        };

        setLayers(prev => [...prev, newLayer]);
        setSelectedLayerId(newLayer.id);
        setActiveTool('select');
        
        setTimeout(() => {
          const inputEl = document.querySelector('input[type="text"]') as HTMLInputElement;
          if (inputEl) {
            inputEl.focus();
          }
        }, 80);
      } else {
        drawMainCanvas();
      }
      setIsDrawing(false);
    }
    setDragState(null);
  };

  const handleDeleteLayer = (id: string) => {
    setLayers(prev => prev.filter(l => l.id !== id));
    if (selectedLayerId === id) setSelectedLayerId(null);
    toast({ title: 'Layer Deleted', description: 'Text replacement block was removed.' });
  };

  const handleClearAllLayers = () => {
    setLayers([]);
    setSelectedLayerId(null);
    toast({ title: 'Cleared All', description: 'All text replacement elements were deleted.' });
  };

  const updateSelectedLayer = (updates: Partial<TextReplacementLayer>) => {
    if (!selectedLayerId) return;
    setLayers(prev => prev.map(l => l.id === selectedLayerId ? { ...l, ...updates } : l));
  };

  const processExportItem = (img: BatchImage, allLayers: TextReplacementLayer[]): string => {
    if (!img.imgElement || !img.offscreenCanvas) return '';
    
    const expCanvas = document.createElement('canvas');
    expCanvas.width = img.width;
    expCanvas.height = img.height;
    const ctx = expCanvas.getContext('2d');
    if (!ctx) return '';

    ctx.drawImage(img.offscreenCanvas, 0, 0);

    allLayers.forEach(layer => {
      ctx.save();
      
      const lx = layer.x;
      const ly = layer.y + layer.baseline; // Apply baseline shift
      const lw = layer.w;
      const lh = layer.h;

      if (layer.shadowBlur > 0) {
        ctx.shadowColor = layer.shadowColor;
        ctx.shadowBlur = layer.shadowBlur;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      }

      ctx.globalAlpha = layer.opacity / 100;
      ctx.fillStyle = layer.color;
      ctx.textBaseline = 'middle';
      ctx.font = `${layer.fontStyle} ${layer.fontWeight} ${layer.fontSize}px "${layer.fontFamily}", sans-serif`;

      const lines = layer.text.split('\n');
      const lHeightVal = layer.fontSize * (layer.lineHeight / 100);
      const totalTextHeight = lines.length * lHeightVal;
      const startY = ly + (lh - totalTextHeight) / 2 + lHeightVal / 2;

      lines.forEach((line, index) => {
        const lineY = startY + index * lHeightVal;
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
          
          layers.forEach(layer => {
            ctx.save();
            ctx.globalAlpha = layer.opacity / 100;
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
            const lHeightVal = layer.fontSize * (layer.lineHeight / 100);
            const totalTextHeight = lines.length * lHeightVal;
            const startY = layer.y + layer.baseline + (layer.h - totalTextHeight) / 2 + lHeightVal / 2;
            
            lines.forEach((line, index) => {
              const lineY = startY + index * lHeightVal;
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
    <div className={`flex flex-col h-[calc(100vh-60px)] w-full overflow-hidden ${isDarkMode ? 'bg-zinc-950 text-zinc-100' : 'bg-white text-zinc-800'} font-sans`}>
      
      {/* Dynamic Header */}
      <div className={`h-14 border-b ${isDarkMode ? 'border-zinc-900 bg-zinc-900/40' : 'border-zinc-200 bg-zinc-50'} flex items-center justify-between px-6 shrink-0 z-20`}>
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-base tracking-wide flex items-center gap-1.5">
            <span className="bg-purple-600 text-white px-2 py-0.5 rounded text-sm">P</span> PhoText
          </span>
          <span className="text-[10px] bg-purple-900/50 text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded uppercase font-semibold">
            Client-Side Studio
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="h-8 w-8 p-0 hover:bg-zinc-800/40 rounded-full"
          >
            {isDarkMode ? <Sun className="h-4 w-4 text-zinc-300" /> : <Moon className="h-4 w-4 text-zinc-700" />}
          </Button>
          <div className="h-4 w-[1px] bg-zinc-800 mx-1" />
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-zinc-800/40" title="Undo"><Undo2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-zinc-800/40" title="Redo"><Redo2 className="h-4 w-4" /></Button>
          
          {images.length > 0 && (
            <Button
              onClick={handleExportPDF}
              className="bg-purple-600 hover:bg-purple-500 text-white h-8 text-xs font-semibold px-4 transition-all duration-300 rounded ml-2"
            >
              Export PDF
            </Button>
          )}
        </div>
      </div>

      {/* Main Core Layout: Sidebar | Workspace Canvas | Styles Inspector */}
      <div className="flex-1 flex w-full overflow-hidden relative">
        
        {/* Left Batch Sidebar */}
        <div className={`w-64 border-r ${isDarkMode ? 'border-zinc-900 bg-zinc-900/50' : 'border-zinc-200 bg-zinc-50'} flex flex-col h-full shrink-0`}>
          <div className="p-4 border-b border-zinc-800 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wider text-zinc-400">Batch Uploads</span>
              <span className="text-[10px] bg-purple-900/30 text-purple-400 px-1.5 py-0.2 rounded border border-purple-500/20">{images.length} files</span>
            </div>
            <Input 
              ref={fileInputRef}
              type="file"
              multiple
              accept=".png,.jpg,.jpeg,.webp,.bmp,.pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white text-xs h-9"
              disabled={isLoading}
            >
              Upload Image / PDF
            </Button>
          </div>

          <ScrollArea className="flex-1 p-2">
            {images.length === 0 ? (
              <div className="text-center py-20 px-3 text-zinc-500 flex flex-col items-center gap-2">
                <FileText className="h-6 w-6 opacity-30" />
                <p className="text-[11px]">No documents or templates uploaded yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {images.map(img => (
                  <div
                    key={img.id}
                    onClick={() => handleSelectActiveImage(img.id)}
                    className={`group relative aspect-square rounded overflow-hidden border bg-zinc-950 cursor-pointer ${
                      activeImageId === img.id ? 'border-purple-500 ring-1 ring-purple-500/30' : 'border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <img src={img.originalSrc} alt={img.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100" />
                    <div className="absolute inset-x-0 bottom-0 bg-black/80 p-1">
                      <p className="text-[9px] truncate text-zinc-300">{img.name}</p>
                      {img.isPdfPage && <span className="text-[7px] text-red-400">PDF P.{img.pageIndex}</span>}
                    </div>
                    <button
                      onClick={(e) => handleDeleteImage(img.id, e)}
                      className="absolute top-1 right-1 h-5 w-5 bg-black/60 hover:bg-red-600 text-white flex items-center justify-center rounded border border-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Center Workspace Canvas (Checkerboard Pattern Background) */}
        <div className="flex-1 flex flex-col bg-zinc-900 relative overflow-hidden h-full">
          
          {/* Active Canvas toolbar */}
          {activeImage && (
            <div className={`h-11 border-b ${isDarkMode ? 'border-zinc-900 bg-zinc-950/20' : 'border-zinc-200 bg-zinc-50'} flex items-center justify-between px-6 shrink-0`}>
              <div className="flex bg-zinc-950 border border-zinc-800 rounded p-0.5 gap-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setActiveTool('draw'); setSelectedLayerId(null); }}
                  className={`h-7 text-[11px] gap-1 px-2.5 ${activeTool === 'draw' ? 'bg-purple-600 text-white' : 'text-zinc-300'}`}
                >
                  <Plus className="h-3 w-3" /> Draw Box
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTool('select')}
                  className={`h-7 text-[11px] gap-1 px-2.5 ${activeTool === 'select' ? 'bg-purple-600 text-white' : 'text-zinc-300'}`}
                >
                  <Maximize2 className="h-3 w-3" /> Select Mode
                </Button>
              </div>

              {/* Dynamic Zoom Slider integrated directly in toolbar */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-zinc-950/40 border border-zinc-800/80 rounded px-2.5 py-1">
                  <span className="text-[10px] text-zinc-400 font-medium">Zoom Slider</span>
                  <Slider
                    value={[zoom]}
                    min={0.3}
                    max={3.0}
                    step={0.1}
                    onValueChange={(val) => setZoom(val[0])}
                    className="w-32 py-1 cursor-pointer"
                  />
                  <span className="text-[10px] min-w-[28px] text-center font-bold text-purple-400">{Math.round(zoom * 100)}%</span>
                  <Button
                    onClick={() => setZoom(1.0)}
                    className="bg-purple-900/40 border border-purple-500/20 text-purple-400 text-[10px] h-5 px-1.5 py-0 rounded"
                  >
                    Reset Zoom
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleExportCurrent} className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 h-7 text-[11px] px-2.5">
                  Export PNG
                </Button>
                <Button onClick={handleExportBatch} className="bg-zinc-950 hover:bg-zinc-900 border border-purple-900/40 text-purple-400 h-7 text-[11px] px-2.5">
                  Export Batch Images
                </Button>
              </div>
            </div>
          )}

          {/* Checkerboard Workspace View */}
          <div 
            ref={containerRef}
            className="flex-1 overflow-auto p-8 flex justify-center items-center relative checkboard-bg"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
              backgroundSize: '16px 16px',
            }}
          >
            {isLoading && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-[2px] z-50 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                <p className="text-xs text-purple-400 animate-pulse">{loadingMessage || 'Processing images...'}</p>
              </div>
            )}

            {!activeImage ? (
              <div className="text-center max-w-sm py-20 px-6 border border-dashed border-zinc-800 bg-zinc-950/20 rounded-2xl">
                <Upload className="h-8 w-8 mx-auto text-purple-400 mb-3" />
                <h3 className="text-sm font-semibold text-zinc-300">No Document Active</h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-[280px] mx-auto">Upload and select templates to start batch replacing text elements.</p>
              </div>
            ) : (
              <div 
                className="relative shadow-2xl bg-zinc-950 border border-zinc-800 transition-all select-none"
                style={{
                  width: activeImage.width * getScaleFactor(),
                  height: activeImage.height * getScaleFactor(),
                }}
              >
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={() => { setIsDrawing(false); setDragState(null); }}
                  className={`block w-full h-full ${
                    activeTool === 'draw' ? 'cursor-crosshair' : activeTool === 'eyedropper' ? 'cursor-cell' : 'cursor-default'
                  }`}
                />

                {/* Vector Overlay Layer */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {layers.map(layer => {
                    const scale = getScaleFactor();
                    const lx = layer.x * scale;
                    const ly = (layer.y + layer.baseline) * scale; // Include baseline vertical shift
                    const lw = layer.w * scale;
                    const lh = layer.h * scale;
                    const isSelected = layer.id === selectedLayerId;

                    return (
                      <div
                        key={layer.id}
                        className={`absolute pointer-events-auto flex items-center justify-center overflow-hidden border border-transparent ${
                          isSelected && activeTool === 'select' ? 'ring-1 ring-emerald-500/30' : ''
                        }`}
                        style={{
                          left: lx,
                          top: ly,
                          width: lw,
                          height: lh,
                          opacity: layer.opacity / 100,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (activeTool === 'select') setSelectedLayerId(layer.id);
                        }}
                      >
                        <textarea
                          value={layer.text}
                          readOnly // Editable exclusively in right-side Replacement Input exactly like video!
                          placeholder=""
                          className="w-full h-full bg-transparent border-none resize-none focus:outline-none p-1 text-center font-bold overflow-hidden leading-normal focus:ring-0 whitespace-pre-wrap select-text cursor-text"
                          style={{
                            fontFamily: `"${layer.fontFamily}", sans-serif`,
                            fontSize: layer.fontSize * scale,
                            color: layer.color,
                            fontWeight: layer.fontWeight,
                            fontStyle: layer.fontStyle,
                            letterSpacing: layer.letterSpacing * scale,
                            lineHeight: layer.lineHeight / 100,
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

            {/* Checkerboard zoom/fit controls in bottom-right corner */}
            {activeImage && (
              <div className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-zinc-950/80 border border-zinc-800 rounded px-2 py-1 backdrop-blur z-10">
                <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.max(0.2, z - 0.15))} className="h-6 w-6 p-0 text-zinc-400"><ZoomOut className="h-3 w-3" /></Button>
                <span className="text-[10px] min-w-[30px] text-center text-zinc-400">{Math.round(zoom * 100)}%</span>
                <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.min(3, z + 0.15))} className="h-6 w-6 p-0 text-zinc-400"><ZoomIn className="h-3 w-3" /></Button>
                <div className="h-3 w-[1px] bg-zinc-800 mx-1" />
                <Button variant="ghost" size="sm" onClick={() => setZoom(1)} className="h-6 text-[10px] px-1 text-zinc-400">Fit</Button>
              </div>
            )}
          </div>
        </div>

        {/* 3. Right Sidebar Styles Inspector - Sliding sliders matching the video */}
        <div className={`w-80 border-l ${isDarkMode ? 'border-zinc-900 bg-zinc-900/60' : 'border-zinc-200 bg-zinc-50'} flex flex-col h-full shrink-0 z-10`}>
          <div className="h-12 border-b border-zinc-800/40 flex items-center px-4 shrink-0 bg-zinc-950/20">
            <span className="font-bold text-xs uppercase tracking-wider text-zinc-400">Text Properties</span>
          </div>

          <ScrollArea className="flex-1 p-5">
            {!selectedLayer ? (
              <div className="text-center py-24 text-zinc-500 flex flex-col items-center gap-2 px-4">
                <HelpCircle className="h-7 w-7 opacity-30 text-zinc-400" />
                <p className="text-xs">No active bounding box selected.</p>
                <p className="text-[10px] text-zinc-600">Select an existing text block, or draw a new box on the canvas to edit background text.</p>
              </div>
            ) : (
              <div className="space-y-5">
                
                {/* Visual Crop Preview of Selected Word so user always knows what they selected */}
                {activeImage && <CropPreview activeImage={activeImage} layer={selectedLayer} />}

                {/* Bounding Box Info & Delete */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-zinc-500">Editor Panel</span>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleDeleteLayer(selectedLayer.id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-950/30 h-7 text-xs px-2"
                  >
                    Delete Layer
                  </Button>
                </div>

                {/* Replacement Text Area - Synced directly like video */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400 font-semibold">Replacement text</Label>
                  <textarea
                    value={selectedLayer.text}
                    onChange={(e) => updateSelectedLayer({ text: e.target.value })}
                    placeholder="Enter replacement word..."
                    className="w-full h-20 bg-zinc-950 border border-zinc-800 text-zinc-200 rounded p-2 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none font-sans"
                  />
                  <Button
                    variant="outline"
                    className="w-full border-zinc-800 text-zinc-400 hover:text-white h-7 text-[10px] mt-1 gap-1"
                    onClick={() => {
                      updateSelectedLayer({ text: selectedLayer.text + '\nNew Line' });
                    }}
                  >
                    + Add text line
                  </Button>
                </div>

                {/* Font Size & Font Color Side-by-Side (Matching Video Layout) */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-zinc-400 font-semibold">Font size: {selectedLayer.fontSize}px</Label>
                    <Slider
                      value={[selectedLayer.fontSize]}
                      min={8}
                      max={180}
                      step={1}
                      onValueChange={(val) => updateSelectedLayer({ fontSize: val[0] })}
                      className="py-1 cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-zinc-400 font-semibold">Font color</Label>
                    <div className="flex gap-1.5">
                      <div 
                        className="h-8 w-8 rounded border border-zinc-800 cursor-pointer shrink-0"
                        style={{ backgroundColor: selectedLayer.color }}
                        onClick={triggerEyedropper}
                        title="Eyedrop background color"
                      />
                      <Input
                        type="text"
                        value={selectedLayer.color}
                        onChange={(e) => updateSelectedLayer({ color: e.target.value })}
                        className="bg-zinc-950 border-zinc-800 text-zinc-200 text-[10px] h-8 px-1 uppercase"
                      />
                    </div>
                  </div>
                </div>

                {/* Font Family Dropdown */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400 font-semibold">Font family</Label>
                  <Select
                    value={selectedLayer.fontFamily}
                    onValueChange={(val) => updateSelectedLayer({ fontFamily: val })}
                  >
                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-xs text-zinc-200 h-9">
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

                {/* Font Style Toggles (B & I) */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400 font-semibold">Font Style</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={selectedLayer.fontWeight >= 700 ? 'default' : 'outline'}
                      onClick={() => updateSelectedLayer({ fontWeight: selectedLayer.fontWeight >= 700 ? 400 : 700 })}
                      className={`flex-1 h-9 rounded ${selectedLayer.fontWeight >= 700 ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'border-zinc-800 text-zinc-300'}`}
                    >
                      B
                    </Button>
                    <Button
                      variant={selectedLayer.fontStyle === 'italic' ? 'default' : 'outline'}
                      onClick={() => updateSelectedLayer({ fontStyle: selectedLayer.fontStyle === 'italic' ? 'normal' : 'italic' })}
                      className={`flex-1 h-9 rounded ${selectedLayer.fontStyle === 'italic' ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'border-zinc-800 text-zinc-300'}`}
                    >
                      I
                    </Button>
                  </div>
                </div>

                {/* Weight Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px] text-zinc-400">
                    <span>Weight</span>
                    <span className="text-zinc-300">{selectedLayer.fontWeight}</span>
                  </div>
                  <Slider
                    value={[selectedLayer.fontWeight]}
                    min={100}
                    max={900}
                    step={100}
                    onValueChange={(val) => updateSelectedLayer({ fontWeight: val[0] })}
                    className="py-1 cursor-pointer"
                  />
                </div>

                {/* Opacity Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px] text-zinc-400">
                    <span>Opacity</span>
                    <span className="text-zinc-300">{selectedLayer.opacity}%</span>
                  </div>
                  <Slider
                    value={[selectedLayer.opacity]}
                    min={0}
                    max={100}
                    step={5}
                    onValueChange={(val) => updateSelectedLayer({ opacity: val[0] })}
                    className="py-1 cursor-pointer"
                  />
                </div>

                {/* Spacing Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px] text-zinc-400">
                    <span>Spacing</span>
                    <span className="text-zinc-300">{selectedLayer.letterSpacing}px</span>
                  </div>
                  <Slider
                    value={[selectedLayer.letterSpacing]}
                    min={-5}
                    max={40}
                    step={1}
                    onValueChange={(val) => updateSelectedLayer({ letterSpacing: val[0] })}
                    className="py-1 cursor-pointer"
                  />
                </div>

                {/* Baseline Slider (Vertical Shift) */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px] text-zinc-400">
                    <span>Baseline</span>
                    <span className="text-zinc-300">{selectedLayer.baseline}px</span>
                  </div>
                  <Slider
                    value={[selectedLayer.baseline]}
                    min={-50}
                    max={50}
                    step={1}
                    onValueChange={(val) => updateSelectedLayer({ baseline: val[0] })}
                    className="py-1 cursor-pointer"
                  />
                </div>

                {/* Line Height Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px] text-zinc-400">
                    <span>Line height</span>
                    <span className="text-zinc-300">{selectedLayer.lineHeight}%</span>
                  </div>
                  <Slider
                    value={[selectedLayer.lineHeight]}
                    min={80}
                    max={200}
                    step={5}
                    onValueChange={(val) => updateSelectedLayer({ lineHeight: val[0] })}
                    className="py-1 cursor-pointer"
                  />
                </div>

                {/* Background Eraser Type */}
                <Separator className="bg-zinc-800" />
                <div className="space-y-2">
                  <Label className="text-xs text-zinc-400 font-semibold">Background Eraser Mode</Label>
                  <Select
                    value={selectedLayer.inpaintMode}
                    onValueChange={(val: 'bilinear' | 'color' | 'clone') => updateSelectedLayer({ inpaintMode: val })}
                  >
                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-xs text-zinc-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-200">
                      <SelectItem value="bilinear" className="hover:bg-zinc-900">Bilinear Auto-Inpaint</SelectItem>
                      <SelectItem value="color" className="hover:bg-zinc-900">Solid Color Patch</SelectItem>
                      <SelectItem value="clone" className="hover:bg-zinc-900">Texture Clone Stamp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedLayer.inpaintMode === 'color' && (
                  <div className="space-y-2">
                    <Label className="text-xs text-zinc-400">Solid Color Fill</Label>
                    <div className="flex gap-2">
                      <div 
                        className="h-8 w-8 rounded border border-zinc-800 cursor-pointer shrink-0"
                        style={{ backgroundColor: selectedLayer.inpaintColor }}
                        onClick={triggerEyedropper}
                      />
                      <Input
                        type="text"
                        value={selectedLayer.inpaintColor}
                        onChange={(e) => updateSelectedLayer({ inpaintColor: e.target.value })}
                        className="bg-zinc-950 border-zinc-800 text-zinc-200 text-xs uppercase"
                      />
                    </div>
                  </div>
                )}
                
              </div>
            )}
          </ScrollArea>
        </div>

      </div>

    </div>
  );
}
