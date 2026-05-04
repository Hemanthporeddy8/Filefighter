// src/app/(main)/image-editor/page.tsx
"use client";

import 'react-image-crop/dist/ReactCrop.css';
import dynamic from 'next/dynamic';
import { useState, useCallback, useRef, useEffect, type MouseEvent, type TouchEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { FileUpload } from '@/components/app/file-upload';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  centerCrop,
  makeAspectCrop,
  type Crop as ReactCropType,
  type PixelCrop,
} from 'react-image-crop';
import {
  Crop as CropIcon,
  Replace,
  ImageIcon as ImageIconLucide,
  Download as DownloadIcon,
  Loader2,
  ImageIcon,
  LayoutPanelLeft,
  Layers,
  GalleryThumbnails,
  PictureInPicture,
  Copyright,
  Frame as FrameIcon,
  GanttChartSquare,
  FileText,
  IterationCw,
  Expand,
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Minimize2,
  Save,
  X,
  Spline,
  Check,
  Minus,
  Plus,
  ExternalLink,
  Printer,
  ArrowDown,
  ArrowUp,
  Trash2,
  Files as FilesIcon,
  Sparkles,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  History,
  Settings,
  Library,
  CheckCircle,
  Send,
  Wand2 as RetouchIcon,
  GraduationCap,
  Eraser,
  Palette as AdjustIcon,
  Move,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useDocumentQueue } from '@/contexts/document-context';
import type { DocumentQueueItem } from '@/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Image from 'next/image';

// Dynamically import heavy components
const GradingTool = dynamic(
    () => import('@/components/app/grading-tool').then(m => m.GradingTool),
    { 
        loading: () => <div className="absolute inset-0 bg-background/80 flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin" /></div>,
        ssr: false 
    }
);
const BackgroundRemover = dynamic(
    () => import('@/components/app/background-remover').then(m => m.BackgroundRemover),
    {
        loading: () => <div className="text-center"><Loader2 className="mx-auto h-8 w-8 text-primary animate-spin" /><p className="mt-2 font-medium">Loading AI Model...</p></div>,
        ssr: false
    }
);
const ReactCrop = dynamic(() => import('react-image-crop'), { 
    ssr: false, 
    loading: () => (
        <div className="min-h-[400px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="ml-2">Loading Cropper...</p>
        </div>
    )
});


interface ToolDefinition {
  name: string;
  icon: React.ElementType;
  actionId: string;
  description: string;
  className?: string;
  disabled?: boolean;
}

const toolCategories: Record<string, ToolDefinition[]> = {
    "Essentials": [
        { name: "Crop", icon: CropIcon, actionId: "crop", description: "Visually select an area of the image to keep." },
        { name: "Resize", icon: Expand, actionId: "resize", description: "Change the dimensions of the image." },
        { name: "Rotate Left", icon: RotateCcw, actionId: "rotateLeft", description: "Rotate the image 90 degrees counter-clockwise." },
        { name: "Rotate Right", icon: RotateCw, actionId: "rotateRight", description: "Rotate the image 90 degrees clockwise." },
        { name: "Flip Horizontal", icon: FlipHorizontal, actionId: "flipHorizontal", description: "Flip the image horizontally." },
        { name: "Flip Vertical", icon: FlipVertical, actionId: "flipVertical", description: "Flip the image vertically." },
    ],
    "AI": [
        { name: "Generate Image", icon: Sparkles, actionId: "generateImage", description: "Create an image from a text prompt.", className: "text-purple-500 hover:bg-purple-500/10 border-purple-500/20" },
    ],
    "Adjust & Retouch": [
        { name: "Adjustments", icon: AdjustIcon, actionId: "adjustments", description: "Adjust brightness, contrast, and saturation.", className: "text-blue-400 hover:bg-blue-400/10 border-blue-400/20" },
        { name: "Remove BG", icon: Eraser, actionId: "removeBackground", description: "Remove the image background.", className: "text-purple-500 hover:bg-purple-500/10 border-purple-500/20" },
        { name: "Retouch/Eraser", icon: RetouchIcon, actionId: "retouch", description: "Remove blemishes or objects from the image." },
        { name: "Grading Tool", icon: GraduationCap, actionId: "nameGrading", description: "Advanced color grading and curve adjustments." },
        { name: "Background", icon: ImageIconLucide, actionId: "backgroundColor", description: "Add a solid color background, useful for PNGs." },
    ],
    "Composition": [
        { name: "Merge Images", icon: LayoutPanelLeft, actionId: "mergeImages", description: "Merge images side-by-side or top-to-bottom." },
        { name: "Stitch Images", icon: GanttChartSquare, actionId: "stitchImages", description: "Stitch images vertically or horizontally (e.g., for screenshots)." },
        { name: "Overlay Image", icon: Layers, actionId: "overlayImage", description: "Overlay one image on another with custom position & opacity." },
        { name: "Collage Maker", icon: GalleryThumbnails, actionId: "collageMaker", description: "Create collages with multiple layouts (grid/freestyle)." },
        { name: "Image in Image (PiP)", icon: PictureInPicture, actionId: "pipImage", description: "Place one image inside another (Picture-in-Picture)." },
    ],
    "Frames & Text": [
        { name: "Watermark", icon: Copyright, actionId: "watermark", description: "Insert text or image watermarks." },
        { name: "Add Frame/Border", icon: FrameIcon, actionId: "addFrame", description: "Add frames or borders to your image." },
    ],
    "Utilities": [
        { name: "Compress Image", icon: Minimize2, actionId: "compressImage", description: "Reduce the file size of the image (JPEG)." },
        { name: "Convert Format", icon: Replace, actionId: "convertFormat", description: "Convert image format (e.g., to PNG, JPEG, WebP)." },
    ]
};

const baseImageNeededActions = [
    "crop", "resize", "rotateLeft", "rotateRight", "mergeImages", "stitchImages", 
    "flipHorizontal", "flipVertical", "compressImage", "overlayImage", "collageMaker", 
    "imageToPdfSingle", "convertFormat", "pipImage", "watermark", "addFrame", 
    "imageEnhancer", "adjustments", "retouch", "nameGrading", "backgroundColor", "removeBackground"
];


function canvasToDataURL(canvas: HTMLCanvasElement, fileType = 'image/png', quality = 0.9): string {
  if (fileType === 'image/jpeg' || fileType === 'image/webp') {
    return canvas.toDataURL(fileType, quality);
  }
  return canvas.toDataURL(fileType);
}

function debounce<T extends (...args: any) => void>(fn: T, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

async function canvasPreview(
  image: HTMLImageElement,
  canvas: HTMLCanvasElement,
  crop: PixelCrop,
  scale = 1,
  rotate = 0,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No 2d context')

  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height
  const pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1;

  canvas.width = Math.floor(crop.width * scaleX * pixelRatio)
  canvas.height = Math.floor(crop.height * scaleY * pixelRatio)

  ctx.scale(pixelRatio, pixelRatio)
  ctx.imageSmoothingQuality = 'high'

  const cropX = crop.x * scaleX
  const cropY = crop.y * scaleY

  const rotateRads = (rotate * Math.PI) / 180
  const centerX = image.naturalWidth / 2
  const centerY = image.naturalHeight / 2

  ctx.save()
  ctx.translate(-cropX, -cropY)
  ctx.translate(centerX, centerY)
  ctx.rotate(rotateRads)
  ctx.scale(scale, scale)
  ctx.translate(-centerX, -centerY)
  ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, 0, 0, image.naturalWidth, image.naturalHeight)
  ctx.restore()
}

function getImageFormatFromDataUrl(dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' {
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,/);
  if (match && match[1]) {
    if (match[1] === 'jpg') return 'JPEG';
    return match[1].toUpperCase() as 'PNG' | 'JPEG' | 'WEBP';
  }
  return 'PNG'; // Default
}

interface PdfImageItem {
  id: string;
  name: string;
  dataUrl: string;
}

interface BatchFileItem {
  id: string;
  name: string;
  file: File;
}

interface BatchResultItem {
  id: string;
  name: string;
  originalSize: number;
  newSize: number;
  dataUrl: string;
}

// Helper to convert data URI to a File object
const dataURLtoFile = (dataurl: string, filename: string): File => {
  if (!dataurl || !dataurl.includes(',')) {
    throw new Error("Invalid Data URL");
  }
  const arr = dataurl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  if (!mimeMatch) throw new Error("Could not determine file type from Data URL.");
  const mime = mimeMatch[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

// Helper to convert Blob URL to Data URL
const blobUrlToDataUrl = (blobUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        fetch(blobUrl)
            .then(res => res.blob())
            .then(blob => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    resolve(reader.result as string);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            })
            .catch(reject);
    });
};


function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}


export default function ImageEditorPage() {
  function centerAspectCrop(
    mediaWidth: number,
    mediaHeight: number,
    aspect: number,
  ) {
    return centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90,
        },
        aspect,
        mediaWidth,
        mediaHeight,
      ),
      mediaWidth,
      mediaHeight,
    )
  }

  const [imgSrc, setImgSrc] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageState, setImageState] = useState<{
    image: HTMLImageElement;
    width: number;
    height: number;
  } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const collageSlotInputRef = useRef<HTMLInputElement>(null);
  const retouchImageCanvasRef = useRef<HTMLCanvasElement>(null);
  const retouchEditCanvasRef = useRef<HTMLCanvasElement>(null);
  const brushCursorRef = useRef<HTMLDivElement>(null);
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
  
  const [crop, setCrop] = useState<ReactCropType>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [scale, setScale] = useState(1);
  const [rotateState, setRotateState] = useState(0);
  const [aspect, setAspect] = useState<number | undefined>();
  const [croppedImageUrl, setCroppedImageUrl] = useState<string | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [activeToolName, setActiveToolName] = useState<string | null>(null);

  const [showCropper, setShowCropper] = useState(false);
  const [showResizeControls, setShowResizeControls] = useState(false);
  const [resizeWidth, setResizeWidth] = useState('');
  const [resizeHeight, setResizeHeight] = useState('');
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);

  const [showMergeControls, setShowMergeControls] = useState(false);
  const [mergeImageFile, setMergeImageFile] = useState<File | null>(null);
  const [mergeImageSrc, setMergeImageSrc] = useState<string | null>(null);
  const [mergeDirection, setMergeDirection] = useState<'horizontal' | 'vertical'>('horizontal');
  const [mergedPreviewDataUrl, setMergedPreviewDataUrl] = useState<string | null>(null);
  const [isAdjustingMerge, setIsAdjustingMerge] = useState(false);
  const [image2XOffset, setImage2XOffset] = useState(0);
  const [image2YOffset, setImage2YOffset] = useState(0);

  const [showStitchControls, setShowStitchControls] = useState(false);
  const [stitchImageFile, setStitchImageFile] = useState<File | null>(null);
  const [stitchImageSrc, setStitchImageSrc] = useState<string | null>(null);
  const [stitchDirection, setStitchDirection] = useState<'horizontal' | 'vertical'>('horizontal');
  const [stitchedPreviewDataUrl, setStitchedPreviewDataUrl] = useState<string | null>(null);

  const [showCompressControls, setShowCompressControls] = useState(false);
  const [compressionQuality, setCompressionQuality] = useState(0.8);

  const [showOverlayControls, setShowOverlayControls] = useState(false);
  const [overlayImageFile, setOverlayImageFile] = useState<File | null>(null);
  const [overlayImageSrc, setOverlayImageSrc] = useState<string | null>(null);
  const [overlayOpacity, setOverlayOpacity] = useState(1);
  const [overlayRotation, setOverlayRotation] = useState(0);
  const [overlayRect, setOverlayRect] = useState({ x: 10, y: 10, width: 30, height: 30 }); // in %
  const [dragInfo, setDragInfo] = useState<{
    type: 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
    startX: number; // percentage
    startY: number; // percentage
    initialRect: typeof overlayRect;
  } | null>(null);

  const [showCollageControls, setShowCollageControls] = useState(false);
  const [collageSlotFiles, setCollageSlotFiles] = useState<(File | null)[]>([null, null, null, null]);
  const [collageSlotSrcs, setCollageSlotSrcs] = useState<(string | null)[]>([null, null, null, null]);
  const [selectedCollageLayout, setSelectedCollageLayout] = useState<string>('2_horizontal');
  const [collageResultDataUrl, setCollageResultDataUrl] = useState<string | null>(null);
  const [isProcessingCollage, setIsProcessingCollage] = useState(false);

  const [showConvertControls, setShowConvertControls] = useState(false);
  const [convertTargetFormat, setConvertTargetFormat] = useState('image/png');

  const [showPipControls, setShowPipControls] = useState(false);
  const [pipImageFile, setPipImageFile] = useState<File | null>(null);
  const [pipImageSrc, setPipImageSrc] = useState<string | null>(null);
  const [pipOpacity, setPipOpacity] = useState(1);
  const [pipScale, setPipScale] = useState(0.3);
  const [pipPreviewDataUrl, setPipPreviewDataUrl] = useState<string | null>(null);
  const [isAdjustingPip, setIsAdjustingPip] = useState(false);
  const [pipRect, setPipRect] = useState({ x: 10, y: 10, width: 30, height: 30}); // x, y, width, height in % of container
  const [dragPipInfo, setDragPipInfo] = useState<{ offsetX: number, offsetY: number } | null>(null);

  const [showWatermarkControls, setShowWatermarkControls] = useState(false);
  const [watermarkType, setWatermarkType] = useState<'text' | 'image'>('text');
  const [watermarkText, setWatermarkText] = useState('FileFlow');
  const [watermarkTextColor, setWatermarkTextColor] = useState('#ffffff');
  const [watermarkTextSize, setWatermarkTextSize] = useState(48);
  const [watermarkPosition, setWatermarkPosition] = useState('center');
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.5);
  const [watermarkImageFile, setWatermarkImageFile] = useState<File | null>(null);
  const [watermarkImageSrc, setWatermarkImageSrc] = useState<string | null>(null);
  const [watermarkedPreviewUrl, setWatermarkedPreviewUrl] = useState<string | null>(null);
  const [isProcessingWatermark, setIsProcessingWatermark] = useState(false);

  const [showFrameControls, setShowFrameControls] = useState(false);
  const [frameWidth, setFrameWidth] = useState(10);
  const [frameColor, setFrameColor] = useState('#000000');
  const [framedPreviewUrl, setFramedPreviewUrl] = useState<string | null>(null);
  const [isProcessingFrame, setIsProcessingFrame] = useState(false);

  const [showBackgroundColorControls, setShowBackgroundColorControls] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  
  // State for client-side adjustments
  const [showAdjustmentsControls, setShowAdjustmentsControls] = useState(false);
  const [adjustments, setAdjustments] = useState({
    brightness: 100,
    contrast: 100,
    saturate: 100,
    grayscale: 0,
    sepia: 0,
    invert: 0,
    hueRotate: 0,
  });
  
  const [showBatchControls, setShowBatchControls] = useState(false);
  const [batchFiles, setBatchFiles] = useState<BatchFileItem[]>([]);
  const [batchAction, setBatchAction] = useState('compress');
  const [batchResizeWidth, setBatchResizeWidth] = useState('800');
  const [batchResizeHeight, setBatchResizeHeight] = useState('');
  const [batchMaintainAspectRatio, setBatchMaintainAspectRatio] = useState(true);
  const [batchCompressQuality, setBatchCompressQuality] = useState(0.8);
  const [batchConvertFormat, setBatchConvertFormat] = useState('image/jpeg');
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchResultItem[]>([]);

  // State for Retouch tool
  const [showRetouchControls, setShowRetouchControls] = useState(false);
  const [retouchTool, setRetouchTool] = useState<'eraser' | 'restore'>('eraser');
  const [brushSize, setBrushSize] = useState(20);
  const isDrawingRef = useRef(false);
  const originalImageDataRef = useRef<ImageData | null>(null);

  // State for AI Generator
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  const searchParams = useSearchParams();
  const returnPath = searchParams.get('returnPath');
  const router = useRouter();

  // State and logic for the "Select from Queue" dialog
  const [isQueueDialogOpen, setIsQueueDialogOpen] = useState(false);
  const { documents, updateDocument } = useDocumentQueue();
  const imageDocuments = documents.filter(doc => doc.type === 'Image' && doc.dataUri);
  const [sourceDocument, setSourceDocument] = useState<DocumentQueueItem | null>(null);

  // State for Undo/Redo
  const [history, setHistory] = useState<string[]>([] as string[]);
  const [historyIndex, setHistoryIndex] = useState(-1);


  const collageLayouts = [
    { value: '2_horizontal', label: '2 Images (Side-by-Side)', requiredImages: 2 },
    { value: '2_vertical', label: '2 Images (Stacked)', requiredImages: 2 },
    { value: '2x2_grid', label: '4 Images (2x2 Grid)', requiredImages: 4 },
  ];


  const { toast } = useToast();

  const updateImageAndHistory = (newSrc: string) => {
    setImgSrc(newSrc);
    setHistory(prev => {
        // Cut off any future states if we are undoing and then making a new change
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(newSrc);
        return newHistory;
    });
    setHistoryIndex(prev => prev + 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setImgSrc(history[newIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setImgSrc(history[newIndex]);
    }
  };
  
  const onSelectFile = useCallback((files: File[]) => {
    const file = files[0] || null;
    setImageFile(file);
    if (file) {
      setCrop(undefined);
      setCompletedCrop(undefined);
      
      // Cleanup previous object URLs when a new file is explicitly selected
      objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();

      resetAllToolStates();
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        const resultSrc = reader.result?.toString() || '';
        setImgSrc(resultSrc);
        setHistory([resultSrc]);
        setHistoryIndex(0);
      });
      reader.readAsDataURL(file);
    } else {
      setImgSrc('');
      resetAllToolStates();
      setImageState(null);
      setHistory([]);
      setHistoryIndex(-1);
    }
  }, []);
  
  useEffect(() => {
    const docId = searchParams.get('docId');
    if (docId) {
        const doc = documents.find(d => d.id === docId);
        if (doc) {
            setSourceDocument(doc);
            if (doc.dataUri) {
                try {
                    const file = dataURLtoFile(doc.dataUri, doc.name);
                    onSelectFile([file]);
                    toast({ title: "Image Loaded", description: "Ready for editing." });
                } catch (error) {
                    toast({ title: "Load Failed", description: "Could not load the transferred image.", variant: "destructive" });
                }
            } else {
                 toast({ title: "Data Missing", description: "The selected document does not have loaded data. Please re-upload.", variant: "destructive" });
                 router.push('/dashboard');
            }
        }
    }
  }, [searchParams, documents, toast, onSelectFile, router]);

  useEffect(() => {
    if (!imgSrc) {
        setImageState(null);
        return;
    }
    const image = new window.Image();
    image.src = imgSrc;
    image.crossOrigin = "anonymous";
    image.onload = () => {
        setImageState({ image, width: image.naturalWidth, height: image.naturalHeight });
        if (showResizeControls) {
            setResizeWidth(image.naturalWidth.toString());
            setResizeHeight(image.naturalHeight.toString());
        }
        if (showCropper) {
            const currentAspect = aspect || (image.naturalWidth / image.naturalHeight);
            const newCrop = centerAspectCrop(image.naturalWidth, image.naturalHeight, currentAspect);
            setCrop(newCrop);
            setCompletedCrop(newCrop as unknown as PixelCrop);
        }
         if (showRetouchControls) {
            const canvas = retouchImageCanvasRef.current;
            const ctx = canvas?.getContext('2d', { willReadFrequently: true });
            if (canvas && ctx) {
                canvas.width = image.naturalWidth;
                canvas.height = image.naturalHeight;
                ctx.drawImage(image, 0, 0);
                originalImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
            }
        }
    };
    image.onerror = () => {
        console.error("Failed to load image programmatically.");
        setImageState(null);
        toast({ title: "Image Load Error", description: "Could not load the image.", variant: "destructive" });
    }
  }, [imgSrc, showResizeControls, showCropper, showRetouchControls, aspect, toast]);

  const handleSelectFromQueue = (doc: DocumentQueueItem) => {
    if (doc.dataUri) {
        try {
            setSourceDocument(doc);
            const file = dataURLtoFile(doc.dataUri, doc.name);
            onSelectFile([file]);
            setIsQueueDialogOpen(false);
            toast({ title: "Image Loaded", description: `Loaded ${doc.name} from the queue.` });
        } catch (error) {
            toast({ title: "Load Failed", description: "Could not load the selected image.", variant: "destructive" });
        }
    }
  };

  const debouncedCanvasPreview = useCallback(
    debounce(async (currentCrop: PixelCrop) => {
      const previewCanvas = document.createElement('canvas'); // Create temporary canvas
      if (currentCrop.width && currentCrop.height && imgRef.current && previewCanvas) {
       try {
          await canvasPreview(imgRef.current, previewCanvas, currentCrop, scale, rotateState);
        } catch (error) { console.error("Error in canvasPreview debounce:", error) }
      }
    }, 100),
    [scale, rotateState]
  );

  useEffect(() => {
    if (completedCrop?.width && completedCrop?.height && imgRef.current && showCropper) {
      debouncedCanvasPreview(completedCrop);
    }
  }, [completedCrop, debouncedCanvasPreview, showCropper]);

    const fileTypeFromDataURL = (dataURL: string | null): string => {
    if (!dataURL) return 'image/png'; // Default if null
    const match = dataURL.match(/^data:(image\/[a-z]+);/);
    return match ? match[1] : 'image/png'; // Default if type not found
  }

  const resetAllToolStates = () => {
    setActiveToolName(null);
    setShowCropper(false);
    setShowResizeControls(false);
    setShowMergeControls(false);
    setShowStitchControls(false);
    setShowCompressControls(false);
    setShowOverlayControls(false);
    setShowCollageControls(false);
    setShowConvertControls(false);
    setShowPipControls(false);
    setShowBatchControls(false);
    setShowWatermarkControls(false);
    setShowFrameControls(false);
    setShowAdjustmentsControls(false);
    setShowBackgroundColorControls(false);
    setShowRetouchControls(false);
    setShowAiGenerator(false);
    setAiPrompt('');
    setIsAdjustingMerge(false);
    setCroppedImageUrl(null);
    setMergedPreviewDataUrl(null);
    setStitchedPreviewDataUrl(null);
    setCollageResultDataUrl(null);
    setPipPreviewDataUrl(null);
    setWatermarkedPreviewUrl(null);
    setFramedPreviewUrl(null);
    setCrop(undefined);
    setCompletedCrop(undefined);
    setImage2XOffset(0);
    setImage2YOffset(0);
    setPipRect({ x: 10, y: 10, width: 30, height: 30 });
    setPipOpacity(1);
    setPipScale(0.3);
    setCollageSlotFiles([null, null, null, null]);
    setCollageSlotSrcs([imgSrc, null, null, null]);
    setScale(1);
    setRotateState(0);
    setAdjustments({ 
      brightness: 100, 
      contrast: 100, 
      saturate: 100,
      grayscale: 0,
      sepia: 0,
      invert: 0,
      hueRotate: 0,
     });
  };

  const handleRotateImage = async (degrees: number) => {
    if (!imgSrc || !imageState) {
      toast({ title: "Error", description: "No image loaded for rotation.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    resetAllToolStates();

    try {
      const image = new window.Image();
      image.crossOrigin = "anonymous";

      await new Promise<void>((resolve, reject) => {
        image.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error("Failed to get canvas context."));
            return;
          }

          const rads = degrees * Math.PI / 180;
          const absRads = Math.abs(rads);

          if (absRads === Math.PI / 2 || absRads === 3 * Math.PI / 2) {
            canvas.width = image.naturalHeight;
            canvas.height = image.naturalWidth;
          } else {
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
          }

          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate(rads);
          ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);

          const rotatedDataUrl = canvas.toDataURL(fileTypeFromDataURL(imgSrc) || 'image/png');
          updateImageAndHistory(rotatedDataUrl);
          setRotateState(0);

          resolve();
        };
        image.onerror = () => {
          reject(new Error("Failed to load image for rotation."));
        };
        image.src = imgSrc;
      });

    } catch (error: any) {
      console.error("Error rotating image:", error);
      toast({ title: "Rotation Failed", description: error.message || "Could not rotate image.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFlipImage = async (direction: 'horizontal' | 'vertical') => {
    if (!imgSrc || !imageState) {
      toast({ title: "Error", description: "No image loaded for flipping.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    resetAllToolStates();

    try {
      const image = new window.Image();
      image.crossOrigin = "anonymous";

      await new Promise<void>((resolve, reject) => {
        image.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error("Failed to get canvas context for flipping."));
            return;
          }

          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;

          if (direction === 'horizontal') {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
          } else { // Vertical flip
            ctx.translate(0, canvas.height);
            ctx.scale(1, -1);
          }

          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

          const flippedDataUrl = canvas.toDataURL(fileTypeFromDataURL(imgSrc) || 'image/png');
          updateImageAndHistory(flippedDataUrl);
          setRotateState(0);

          resolve();
        };
        image.onerror = () => {
          reject(new Error("Failed to load image for flipping."));
        };
        image.src = imgSrc;
      });

    } catch (error: any) {
      console.error("Error flipping image:", error);
      toast({ title: "Flip Failed", description: error.message || "Could not flip image.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendToQueue = async () => {
    if (!imageFile || !imgSrc || !sourceDocument) {
      toast({ title: "No Image", description: "There is no edited image to send.", variant: "destructive" });
      return;
    }
  
    try {
      let finalDataUrl = imgSrc;
      if (imgSrc.startsWith('blob:')) {
        finalDataUrl = await blobUrlToDataUrl(imgSrc);
      }
      
      const editedFile = dataURLtoFile(finalDataUrl, `edited-${imageFile.name}`);
      const editedDoc: Omit<DocumentQueueItem, 'id' | 'files' | 'status'> = {
        name: editedFile.name,
        type: 'Image',
        uploadedAt: new Date(),
        size: formatFileSize(editedFile.size),
        dataUri: finalDataUrl,
      };

      // Find the original document and add the edited version to it
      const originalDoc = sourceDocument;
      const originalFileItem = {
        name: originalDoc.name,
        type: originalDoc.type,
        uploadedAt: originalDoc.uploadedAt,
        size: originalDoc.size,
        dataUri: originalDoc.dataUri,
      };

      const newFiles = [...(originalDoc.files || [originalFileItem]), editedDoc];
  
      updateDocument(sourceDocument.id, {
          name: `Batch: ${originalDoc.name}`,
          type: 'Batch',
          status: 'Edited',
          files: newFiles
      });
  
      toast({
        title: 'Edits Saved',
        description: 'The edited image has been grouped with the original in the queue.',
      });
      router.push('/dashboard');
  
    } catch (error) {
      console.error("Failed to send to queue:", error);
      toast({ title: "Error", description: "Could not create file to send to queue.", variant: "destructive" });
    }
  };
  
  const handleSendBackToPassportPhoto = async () => {
      if (!imageFile || !imgSrc || !returnPath) return;
  
      try {
          let finalDataUrl = imgSrc;
          if (imgSrc.startsWith('blob:')) {
              finalDataUrl = await blobUrlToDataUrl(imgSrc);
          }
  
          const editedFile = dataURLtoFile(finalDataUrl, `edited-${imageFile.name}`);
          const newDoc: DocumentQueueItem = {
              id: `doc-edited-${Date.now()}`,
              name: editedFile.name,
              type: 'Image',
              status: 'Edited',
              uploadedAt: new Date(),
              size: formatFileSize(editedFile.size),
              dataUri: finalDataUrl,
          };
          
          updateDocument(sourceDocument!.id, newDoc);
          router.push(`${returnPath}?docId=${sourceDocument!.id}`);
      } catch (error) {
           toast({ title: "Error", description: "Could not send image back.", variant: "destructive" });
      }
  };

  const handleDownload = () => {
    let finalSrc = imgSrc;
    if (activeToolName === 'Retouch/Eraser' && retouchImageCanvasRef.current) {
        finalSrc = retouchImageCanvasRef.current.toDataURL('image/png');
    }

    if (!finalSrc) {
        toast({ title: "Nothing to download", variant: "destructive" });
        return;
    }
    const link = document.createElement('a');
    link.href = finalSrc;
    const format = getImageFormatFromDataUrl(finalSrc).toLowerCase();
    link.download = `edited-image-${Date.now()}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
  
  const handleDownloadCroppedImage = useCallback(async () => {
    const image = imgRef.current;
    const previewCanvas = document.createElement('canvas');
    if (!image || !completedCrop || !previewCanvas) {
      throw new Error('Crop canvas does not exist');
    }
  
    await canvasPreview(image, previewCanvas, completedCrop);
    
    const blob = await new Promise<Blob | null>(resolve => previewCanvas.toBlob(resolve, 'image/png'));
    
    if(!blob) {
        toast({ title: "Error", description: "Could not create cropped image blob.", variant: "destructive"});
        return;
    }
  
    const dataUrl = URL.createObjectURL(blob);
    registerObjectUrl(dataUrl);
    updateImageAndHistory(dataUrl);
    setShowCropper(false);
    setCroppedImageUrl(null);
  
  }, [completedCrop, toast]);

  const handleResizeImage = () => {
      const width = parseInt(resizeWidth, 10);
      const height = parseInt(resizeHeight, 10);

      if (!imgSrc || !imageState || isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
          toast({ title: 'Invalid Dimensions', description: 'Please provide valid width and height.', variant: 'destructive'});
          return;
      }
      setIsProcessing(true);
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
          ctx.drawImage(imageState.image, 0, 0, width, height);
          const resizedDataUrl = canvasToDataURL(canvas, fileTypeFromDataURL(imgSrc));
          updateImageAndHistory(resizedDataUrl);
          toast({ title: 'Image Resized', description: `New dimensions: ${width}x${height}` });
      } else {
          toast({ title: "Error", description: "Could not get canvas context for resizing.", variant: "destructive" });
      }
      setShowResizeControls(false);
      setIsProcessing(false);
  };
  
  const handleResizeInputChange = (e: React.ChangeEvent<HTMLInputElement>, dimension: 'width' | 'height') => {
      const value = e.target.value;
      if (!imageState || !maintainAspectRatio) {
          if (dimension === 'width') setResizeWidth(value);
          else setResizeHeight(value);
          return;
      }
      
      const numericValue = parseInt(value, 10);
      if (isNaN(numericValue) || numericValue <= 0) {
        if (dimension === 'width') setResizeWidth(value);
        else setResizeHeight(value);
        return;
      }

      const aspectRatio = imageState.width / imageState.height;
      if (dimension === 'width') {
          setResizeWidth(value);
          setResizeHeight(Math.round(numericValue / aspectRatio).toString());
      } else {
          setResizeHeight(value);
          setResizeWidth(Math.round(numericValue * aspectRatio).toString());
      }
  };

  const handleMergeImages = useCallback((dataUrl1: string, dataUrl2: string, direction: 'horizontal' | 'vertical') => {
    return new Promise<string>((resolve, reject) => {
        const img1 = new window.Image();
        const img2 = new window.Image();
        img1.crossOrigin = "anonymous";
        img2.crossOrigin = "anonymous";
        let loadedCount = 0;

        const onBothLoaded = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject("Could not get context"); return; }
            
            if (direction === 'horizontal') {
                canvas.width = img1.naturalWidth + img2.naturalWidth;
                canvas.height = Math.max(img1.naturalHeight, img2.naturalHeight);
                ctx.fillStyle = backgroundColor;
                ctx.fillRect(0,0, canvas.width, canvas.height);
                ctx.drawImage(img1, 0, (canvas.height - img1.naturalHeight) / 2);
                ctx.drawImage(img2, img1.naturalWidth, (canvas.height - img2.naturalHeight) / 2);
            } else { // vertical
                canvas.width = Math.max(img1.naturalWidth, img2.naturalWidth);
                canvas.height = img1.naturalHeight + img2.naturalHeight;
                ctx.fillStyle = backgroundColor;
                ctx.fillRect(0,0, canvas.width, canvas.height);
                ctx.drawImage(img1, (canvas.width - img1.naturalWidth) / 2, 0);
                ctx.drawImage(img2, (canvas.width - img2.naturalWidth) / 2, img1.naturalHeight);
            }
            resolve(canvas.toDataURL('image/png'));
        };

        img1.onload = () => { if (++loadedCount === 2) onBothLoaded(); };
        img2.onload = () => { if (++loadedCount === 2) onBothLoaded(); };
        img1.onerror = () => reject("Failed to load base image");
        img2.onerror = () => reject("Failed to load merge image");

        img1.src = dataUrl1;
        img2.src = dataUrl2;
    });
  }, [backgroundColor]);

  const handleGenerateCollage = useCallback(async () => {
    const layout = collageLayouts.find(l => l.value === selectedCollageLayout);
    if (!layout) return;

    const sources = collageSlotSrcs.slice(0, layout.requiredImages);
    if (sources.some(s => !s)) {
        setCollageResultDataUrl(null);
        return; // Not all slots are filled
    }

    setIsProcessingCollage(true);

    try {
        const images = await Promise.all(sources.map(src => {
            return new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new window.Image();
                img.crossOrigin = "anonymous";
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = src!;
            });
        }));

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Canvas not supported");

        const width = 1200; // Common width for collage
        let height = 800; // Default height

        ctx.fillStyle = '#fff';

        if (layout.value === '2_horizontal') {
            height = width / (images[0].naturalWidth / images[0].naturalHeight + images[1].naturalWidth / images[1].naturalHeight);
            canvas.width = width;
            canvas.height = height;
            ctx.fillRect(0,0,width,height);
            const w1 = width * (images[0].naturalWidth / (images[0].naturalWidth + images[1].naturalWidth));
            ctx.drawImage(images[0], 0, 0, w1, height);
            ctx.drawImage(images[1], w1, 0, width - w1, height);
        } else if (layout.value === '2_vertical') {
            canvas.width = width;
            canvas.height = width;
            ctx.fillRect(0,0,width,width);
            ctx.drawImage(images[0], 0, 0, width, width/2);
            ctx.drawImage(images[1], 0, width/2, width, width/2);
        } else if (layout.value === '2x2_grid') {
            canvas.width = width;
            canvas.height = width;
             ctx.fillRect(0,0,width,width);
            ctx.drawImage(images[0], 0, 0, width / 2, width / 2);
            ctx.drawImage(images[1], width / 2, 0, width / 2, width / 2);
            ctx.drawImage(images[2], 0, width / 2, width / 2, width / 2);
            ctx.drawImage(images[3], width / 2, width / 2, width / 2, width / 2);
        }

        setCollageResultDataUrl(canvas.toDataURL('image/jpeg', 0.9));
    } catch (error) {
        toast({ title: 'Collage Error', description: 'Could not load one or more images for the collage.', variant: 'destructive' });
    } finally {
        setIsProcessingCollage(false);
    }
  }, [selectedCollageLayout, collageSlotSrcs, toast]);

  useEffect(() => {
    if (showMergeControls && imgSrc && mergeImageSrc) {
        const generateMergePreview = async () => {
            setIsProcessing(true);
            try {
                const resultUrl = await handleMergeImages(imgSrc, mergeImageSrc, mergeDirection);
                setMergedPreviewDataUrl(resultUrl);
            } catch (error) {
                toast({ title: "Merge Failed", description: (error as Error).message, variant: "destructive" });
            }
            setIsProcessing(false);
        };
        generateMergePreview();
    }
  }, [imgSrc, mergeImageSrc, mergeDirection, showMergeControls, toast, handleMergeImages]);
  
  useEffect(() => {
    if (showStitchControls && imgSrc && stitchImageSrc) {
        const generateStitchPreview = async () => {
            setIsProcessing(true);
            try {
                const resultUrl = await handleMergeImages(imgSrc, stitchImageSrc, stitchDirection);
                setStitchedPreviewDataUrl(resultUrl);
            } catch (error) {
                toast({ title: "Stitch Failed", description: (error as Error).message, variant: "destructive" });
            }
            setIsProcessing(false);
        };
        generateStitchPreview();
    }
  }, [imgSrc, stitchImageSrc, stitchDirection, showStitchControls, toast, handleMergeImages]);

  useEffect(() => {
    if (showCollageControls) {
      handleGenerateCollage();
    }
  }, [collageSlotSrcs, showCollageControls, handleGenerateCollage]);

  const handleCollageFileSelect = (files: File[], index: number) => {
    const file = files[0];
    if (file) {
        setCollageSlotFiles(prev => {
            const newFiles = [...prev];
            newFiles[index] = file;
            return newFiles;
        });
        const reader = new FileReader();
        reader.onload = (e) => {
            setCollageSlotSrcs(prev => {
                const newSrcs = [...prev];
                newSrcs[index] = e.target?.result as string;
                return newSrcs;
            });
        };
        reader.readAsDataURL(file);
    }
  };

  const handleApplyCollage = () => {
    if (!collageResultDataUrl) return;
    updateImageAndHistory(collageResultDataUrl);
    resetAllToolStates();
    toast({ title: 'Collage Applied' });
  };

  const handleCompressImage = () => {
    if (!imgSrc || !imageState) {
        toast({ title: 'No Image', description: 'Please load an image to compress.', variant: 'destructive' });
        return;
    }
    setIsProcessing(true);

    const canvas = document.createElement('canvas');
    canvas.width = imageState.width;
    canvas.height = imageState.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        toast({ title: 'Error', description: 'Could not create canvas for compression.', variant: 'destructive' });
        setIsProcessing(false);
        return;
    }

    ctx.drawImage(imageState.image, 0, 0);
    const compressedDataUrl = canvas.toDataURL('image/jpeg', compressionQuality);
    
    const originalSize = imageFile?.size ?? 0;
    const newFile = dataURLtoFile(compressedDataUrl, 'compressed.jpg');
    
    updateImageAndHistory(compressedDataUrl);
    
    toast({
      title: 'Image Compressed',
      description: `Original: ${formatFileSize(originalSize)} | New: ${formatFileSize(newFile.size)}`,
    });

    setShowCompressControls(false);
    setIsProcessing(false);
  };

  const handleConvertFormat = () => {
    if (!imgSrc || !imageState) {
        toast({ title: 'No Image', description: 'Please load an image to convert.', variant: 'destructive' });
        return;
    }
    setIsProcessing(true);

    const canvas = document.createElement('canvas');
    canvas.width = imageState.width;
    canvas.height = imageState.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        toast({ title: 'Error', description: 'Could not create canvas for conversion.', variant: 'destructive' });
        setIsProcessing(false);
        return;
    }

    ctx.drawImage(imageState.image, 0, 0);
    const convertedDataUrl = canvas.toDataURL(convertTargetFormat, 0.9); // Use quality for lossy formats

    updateImageAndHistory(convertedDataUrl);
    
    toast({
      title: 'Format Converted',
      description: `Image successfully converted to ${convertTargetFormat.split('/')[1].toUpperCase()}.`,
    });

    setShowConvertControls(false);
    setIsProcessing(false);
  };
  
  const handleApplyBackgroundColor = () => {
    if (!imageState || !imgSrc) {
        toast({ title: "No Image", description: "Please load an image first.", variant: "destructive" });
        return;
    }
    setIsProcessing(true);
    const canvas = document.createElement('canvas');
    canvas.width = imageState.width;
    canvas.height = imageState.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        setIsProcessing(false);
        toast({ title: "Error", description: "Canvas not supported.", variant: "destructive" });
        return;
    }
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageState.image, 0, 0);
    const resultDataUrl = canvasToDataURL(canvas);
    updateImageAndHistory(resultDataUrl);
    setShowBackgroundColorControls(false);
    setIsProcessing(false);
  };
  
  const handleApplyOverlay = () => {
    if (!imageState || !overlayImageFile || !overlayImageSrc) return;
    setIsProcessing(true);
    const baseImage = imageState.image;
    const overlayImage = new window.Image();
    overlayImage.crossOrigin = "anonymous";
    overlayImage.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = baseImage.naturalWidth;
        canvas.height = baseImage.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Draw base image
        ctx.drawImage(baseImage, 0, 0);
        
        // Prepare transformations for the overlay
        ctx.save();
        ctx.globalAlpha = overlayOpacity;

        const overlayWidth = canvas.width * (overlayRect.width / 100);
        const overlayHeight = canvas.height * (overlayRect.height / 100);
        const x = (overlayRect.x / 100) * canvas.width;
        const y = (overlayRect.y / 100) * canvas.height;
        
        const centerX = x + overlayWidth / 2;
        const centerY = y + overlayHeight / 2;

        // Translate to the center of the overlay, rotate, then translate back
        ctx.translate(centerX, centerY);
        ctx.rotate(overlayRotation * Math.PI / 180);
        ctx.translate(-centerX, -centerY);
        
        // Draw the rotated overlay
        ctx.drawImage(overlayImage, x, y, overlayWidth, overlayHeight);

        ctx.restore(); // Restore the canvas state (removes transformations)
        
        const finalDataUrl = canvasToDataURL(canvas, fileTypeFromDataURL(imgSrc));
        updateImageAndHistory(finalDataUrl);
        resetAllToolStates();
        setIsProcessing(false);
        toast({ title: "Overlay Applied" });
    };
    overlayImage.src = overlayImageSrc;
  };
  
  const handleApplyWatermark = () => {
      if (!imageState) return;
      setIsProcessingWatermark(true);
      
      const canvas = document.createElement('canvas');
      canvas.width = imageState.width;
      canvas.height = imageState.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
          setIsProcessingWatermark(false);
          return;
      }
      ctx.drawImage(imageState.image, 0, 0);

      // Common style
      ctx.globalAlpha = watermarkOpacity;
      ctx.fillStyle = watermarkTextColor;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      
      if (watermarkType === 'text') {
          ctx.font = `${watermarkTextSize}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const text = watermarkText;

          if (watermarkPosition === 'center') {
              ctx.fillText(text, canvas.width / 2, canvas.height / 2);
          } else if (watermarkPosition === 'bottom-right') {
              ctx.textAlign = 'right';
              ctx.textBaseline = 'bottom';
              ctx.fillText(text, canvas.width - 10, canvas.height - 10);
          } else { // tile
              for (let y = 0; y < canvas.height + watermarkTextSize; y += watermarkTextSize * 2) {
                  for (let x = 0; x < canvas.width + 200; x += ctx.measureText(text).width + 50) {
                      ctx.save();
                      ctx.translate(x, y);
                      ctx.rotate(-0.25 * Math.PI);
                      ctx.fillText(text, 0, 0);
                      ctx.restore();
                  }
              }
          }
      } else if (watermarkType === 'image' && watermarkImageSrc) {
          const watermarkImg = new window.Image();
          watermarkImg.onload = () => {
              const scale = 0.2; // Example scale
              const w = watermarkImg.width * scale;
              const h = watermarkImg.height * scale;
              if (watermarkPosition === 'center') {
                  ctx.drawImage(watermarkImg, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
              } else if (watermarkPosition === 'bottom-right') {
                  ctx.drawImage(watermarkImg, canvas.width - w - 10, canvas.height - h - 10, w, h);
              }
          };
          watermarkImg.src = watermarkImageSrc;
      }
      
      // Update the main image source after drawing
      setTimeout(() => {
          const finalUrl = canvasToDataURL(canvas, fileTypeFromDataURL(imgSrc));
          updateImageAndHistory(finalUrl);
          setShowWatermarkControls(false);
          setIsProcessingWatermark(false);
          toast({ title: 'Watermark Applied' });
      }, 500); // Delay to allow image to draw
  };

  const handleApplyFrame = () => {
    if (!imageState) return;

    setIsProcessingFrame(true);
    const image = imageState.image;
    const frameSize = frameWidth * 2; // Frame on both sides

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth + frameSize;
    canvas.height = image.naturalHeight + frameSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        setIsProcessingFrame(false);
        return;
    }

    // Draw the frame color
    ctx.fillStyle = frameColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the image in the center
    ctx.drawImage(image, frameWidth, frameWidth);

    const finalUrl = canvasToDataURL(canvas, fileTypeFromDataURL(imgSrc));
    updateImageAndHistory(finalUrl);
    setShowFrameControls(false);
    setIsProcessingFrame(false);
    toast({ title: 'Frame Applied' });
  };
  
  const handleApplyPip = useCallback(async () => {
    if (!imageState || !pipImageSrc || !previewContainerRef.current) {
        toast({ title: "Cannot Apply", description: "Base image or PiP image is missing.", variant: "destructive" });
        return;
    }
    
    setIsProcessing(true);
    
    try {
        const baseImage = imageState.image;
        const pipImage = new window.Image();
        pipImage.crossOrigin = "anonymous";
        pipImage.src = pipImageSrc;
        
        await new Promise((resolve, reject) => {
            pipImage.onload = resolve;
            pipImage.onerror = reject;
        });

        const canvas = document.createElement('canvas');
        canvas.width = baseImage.naturalWidth;
        canvas.height = baseImage.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Canvas context is not available.");

        ctx.drawImage(baseImage, 0, 0);
        ctx.globalAlpha = pipOpacity;

        const pipWidth = canvas.width * (pipRect.width / 100);
        const pipHeight = canvas.height * (pipRect.height / 100);
        const x = (pipRect.x / 100) * canvas.width;
        const y = (pipRect.y / 100) * canvas.height;

        ctx.drawImage(pipImage, x, y, pipWidth, pipHeight);
        
        const finalDataUrl = canvas.toDataURL('image/png');
        updateImageAndHistory(finalDataUrl);
        resetAllToolStates();
        toast({ title: "PiP Effect Applied" });

    } catch (e) {
        console.error("Error applying PiP:", e);
        toast({ title: "PiP Failed", description: "Could not apply the Picture-in-Picture effect.", variant: "destructive" });
    } finally {
        setIsProcessing(false);
    }
  }, [imageState, pipImageSrc, pipOpacity, pipRect, toast]);
  
  const handlePipMouseDown = useCallback((e: MouseEvent | TouchEvent) => {
    if (!previewContainerRef.current) return;
    const containerRect = previewContainerRef.current.getBoundingClientRect();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const pipElement = previewContainerRef.current.querySelector('[data-pip-draggable="true"]') as HTMLElement;
    if (!pipElement) return;
    
    const pipRect = pipElement.getBoundingClientRect();
    
    const offsetX = clientX - pipRect.left;
    const offsetY = clientY - pipRect.top;
    
    setDragPipInfo({ offsetX, offsetY });
  }, []);

  const handlePipMouseMove = useCallback((e: globalThis.MouseEvent | globalThis.TouchEvent) => {
    if (!dragPipInfo || !previewContainerRef.current) return;
    
    const containerRect = previewContainerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    let newX = clientX - containerRect.left - dragPipInfo.offsetX;
    let newY = clientY - containerRect.top - dragPipInfo.offsetY;
    
    const newXPercent = (newX / containerRect.width) * 100;
    const newYPercent = (newY / containerRect.height) * 100;
    
    setPipRect(prev => ({
        ...prev,
        x: Math.max(0, Math.min(newXPercent, 100 - prev.width)),
        y: Math.max(0, Math.min(newYPercent, 100 - prev.height)),
    }));
  }, [dragPipInfo]);
  
  const handlePipMouseUp = useCallback(() => {
    setDragPipInfo(null);
  }, []);
  
  useEffect(() => {
    if (dragPipInfo) {
      window.addEventListener('mousemove', handlePipMouseMove);
      window.addEventListener('touchmove', handlePipMouseMove, { passive: false });
      window.addEventListener('mouseup', handlePipMouseUp);
      window.addEventListener('touchend', handlePipMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handlePipMouseMove);
      window.removeEventListener('touchmove', handlePipMouseMove);
      window.removeEventListener('mouseup', handlePipMouseUp);
      window.removeEventListener('touchend', handlePipMouseUp);
    };
  }, [dragPipInfo, handlePipMouseMove, handlePipMouseUp]);

  const startDrawingRetouch = (e: MouseEvent<HTMLCanvasElement>) => {
        isDrawingRef.current = true;
        drawRetouch(e);
  };

    const stopDrawingRetouch = () => {
        if (isDrawingRef.current && imageState) {
            isDrawingRef.current = false;
        }
    };

    const drawRetouch = (e: MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawingRef.current || !retouchImageCanvasRef.current) return;

        const canvas = retouchImageCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        if (retouchTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (retouchTool === 'restore' && originalImageDataRef.current) {
            ctx.globalCompositeOperation = 'source-over';
            const radius = brushSize / 2;
            const destData = ctx.getImageData(x - radius, y - radius, brushSize, brushSize);
            const sourceData = originalImageDataRef.current;
            
            for (let i = 0; i < destData.data.length; i += 4) {
                const pixelX = Math.floor(x - radius + (i/4) % brushSize);
                const pixelY = Math.floor(y - radius + Math.floor((i/4) / brushSize));
                const sourceIndex = (pixelY * canvas.width + pixelX) * 4;
                
                destData.data[i] = sourceData.data[sourceIndex];
                destData.data[i + 1] = sourceData.data[sourceIndex + 1];
                destData.data[i + 2] = sourceData.data[sourceIndex + 2];
                destData.data[i + 3] = sourceData.data[sourceIndex + 3];
            }
            ctx.putImageData(destData, x - radius, y - radius);
        }
    };
    
    const applyRetouch = () => {
        const canvas = retouchImageCanvasRef.current;
        if (!canvas) return;
        updateImageAndHistory(canvas.toDataURL('image/png'));
        resetAllToolStates();
        toast({ title: "Retouch Applied" });
    };

    const updateCursorPosition = (e: MouseEvent<HTMLDivElement>) => {
      const cursor = brushCursorRef.current;
      const container = previewContainerRef.current;
      if (!cursor || !container) return;

      const containerRect = container.getBoundingClientRect();
      cursor.style.left = `${e.clientX - containerRect.left}px`;
      cursor.style.top = `${e.clientY - containerRect.top}px`;
    }

    useEffect(() => {
      const cursor = brushCursorRef.current;
      if (!cursor || !showRetouchControls || !imgRef.current) return;
      
      const imgRect = imgRef.current.getBoundingClientRect();
      const scale = imageState ? (imgRect.width / imageState.width) : 1;
      const size = brushSize * scale;

      cursor.style.width = `${size}px`;
      cursor.style.height = `${size}px`;
      cursor.classList.toggle('border-red-500', retouchTool === 'eraser');
      cursor.classList.toggle('border-green-500', retouchTool === 'restore');

    }, [brushSize, retouchTool, showRetouchControls, imageState]);

    const activateRetouchTool = (initialImage?: HTMLImageElement) => {
        const imageToUse = initialImage || imageState?.image;
        if (!imageToUse) return;

        const canvas = retouchImageCanvasRef.current;
        const ctx = canvas?.getContext('2d', { willReadFrequently: true });
        if (canvas && ctx) {
            canvas.width = imageToUse.naturalWidth;
            canvas.height = imageToUse.naturalHeight;
            ctx.drawImage(imageToUse, 0, 0);
            if (!originalImageDataRef.current) {
                originalImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
            }
        }
        setShowRetouchControls(true);
        setActiveToolName('Retouch/Eraser');
    };

  const handleToolAction = async (tool: ToolDefinition) => {
    const aiActions = ["generateImage"];
    if (baseImageNeededActions.includes(tool.actionId) && !aiActions.includes(tool.actionId) && !imgSrc) {
        toast({ title: 'No Image', description: 'Please upload an image to use this tool.', variant: 'destructive' });
        return;
    }
    
    resetAllToolStates();
    setActiveToolName(tool.name);

    switch (tool.actionId) {
        case 'generateImage':
            setShowAiGenerator(true);
            break;
        case 'removeBackground':
            // This now just sets the state to show the BackgroundRemover component
            break;
        case 'retouch':
            activateRetouchTool();
            break;
        case 'crop':
            setShowCropper(true);
            break;
        case 'resize':
            setShowResizeControls(true);
            if(imageState) {
                setResizeWidth(imageState.width.toString());
                setResizeHeight(imageState.height.toString());
            }
            break;
        case 'rotateLeft':
            handleRotateImage(-90);
            break;
        case 'rotateRight':
            handleRotateImage(90);
            break;
        case 'flipHorizontal':
            handleFlipImage('horizontal');
            break;
        case 'flipVertical':
            handleFlipImage('vertical');
            break;
        case 'mergeImages':
            setShowMergeControls(true);
            break;
        case 'stitchImages':
            setShowStitchControls(true);
            break;
        case 'compressImage':
            setShowCompressControls(true);
            break;
        case 'overlayImage':
            setShowOverlayControls(true);
            break;
        case 'collageMaker':
            setShowCollageControls(true);
            setCollageSlotFiles([imageFile, null, null, null]);
            setCollageSlotSrcs([imgSrc, null, null, null]);
            break;
        case 'convertFormat':
            setShowConvertControls(true);
            break;
        case 'pipImage':
            setShowPipControls(true);
            break;
        case 'batchProcess':
            setShowBatchControls(true);
            if (imageFile) {
                setBatchFiles([{ id: imageFile.name + Date.now(), name: imageFile.name, file: imageFile }]);
            }
            break;
        case 'watermark':
            setShowWatermarkControls(true);
            break;
        case 'addFrame':
            setShowFrameControls(true);
            break;
        case 'adjustments':
            setShowAdjustmentsControls(true);
            break;
        case 'backgroundColor':
            setShowBackgroundColorControls(true);
            break;
        case 'nameGrading':
            // The main tool component will be rendered conditionally
            break;
    }
  };
  
    const handleOverlayMouseDown = useCallback((e: MouseEvent | TouchEvent) => {
        if (!previewContainerRef.current) return;
        const target = e.target as HTMLElement;
        const handleType = target.dataset.handle as typeof dragInfo.type;
        if (!handleType) return;
        
        e.preventDefault();
        e.stopPropagation();

        const containerRect = previewContainerRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        const startX = (clientX - containerRect.left) / containerRect.width * 100;
        const startY = (clientY - containerRect.top) / containerRect.height * 100;

        setDragInfo({
            type: handleType,
            startX: startX,
            startY: startY,
            initialRect: { ...overlayRect }
        });
    }, [overlayRect]);

    const handleWindowMouseMove = useCallback((e: globalThis.MouseEvent | globalThis.TouchEvent) => {
        if (!dragInfo || !previewContainerRef.current) return;

        const containerRect = previewContainerRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        const currentX = (clientX - containerRect.left) / containerRect.width * 100;
        const currentY = (clientY - containerRect.top) / containerRect.height * 100;

        const dx = currentX - dragInfo.startX;
        const dy = currentY - dragInfo.startY;

        let newRect = { ...dragInfo.initialRect };
        
        if (dragInfo.type === 'move') {
            newRect.x += dx;
            newRect.y += dy;
        } else {
            if (dragInfo.type.includes('w')) { newRect.x += dx; newRect.width -= dx; }
            if (dragInfo.type.includes('e')) { newRect.width += dx; }
            if (dragInfo.type.includes('n')) { newRect.y += dy; newRect.height -= dy; }
            if (dragInfo.type.includes('s')) { newRect.height += dy; }
        }

        // Boundary checks
        if (newRect.width < 5) {
            newRect.width = 5;
            if(dragInfo.type.includes('w')) newRect.x = dragInfo.initialRect.x + dragInfo.initialRect.width - 5;
        }
        if (newRect.height < 5) {
            newRect.height = 5;
            if(dragInfo.type.includes('n')) newRect.y = dragInfo.initialRect.y + dragInfo.initialRect.height - 5;
        }
        if (newRect.x < 0) { newRect.width += newRect.x; newRect.x = 0; }
        if (newRect.y < 0) { newRect.height += newRect.y; newRect.y = 0; }
        if (newRect.x + newRect.width > 100) { newRect.width = 100 - newRect.x; }
        if (newRect.y + newRect.height > 100) { newRect.height = 100 - newRect.y; }

        setOverlayRect(newRect);

    }, [dragInfo]);

    const handleWindowMouseUp = useCallback(() => {
        setDragInfo(null);
    }, []);

    useEffect(() => {
        if (dragInfo) {
            window.addEventListener('mousemove', handleWindowMouseMove);
            window.addEventListener('touchmove', handleWindowMouseMove);
            window.addEventListener('mouseup', handleWindowMouseUp);
            window.addEventListener('touchend', handleWindowMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleWindowMouseMove);
            window.removeEventListener('touchmove', handleWindowMouseMove);
            window.removeEventListener('mouseup', handleWindowMouseUp);
            window.removeEventListener('touchend', handleWindowMouseUp);
        };
    }, [dragInfo, handleWindowMouseMove, handleWindowMouseUp]);
    
    const handleGenerateAiImage = async () => {
        if (!aiPrompt) {
          toast({ title: 'Prompt is empty', description: 'Please enter a prompt to generate an image.', variant: 'destructive' });
          return;
        }
        setIsProcessing(true);
        resetAllToolStates();
    
        // Simulate AI generation by drawing on a canvas
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');
    
        if (!ctx) {
          toast({ title: 'Error', description: 'Canvas not supported.', variant: 'destructive' });
          setIsProcessing(false);
          return;
        }
    
        // Create a simple generative-art-like placeholder
        const seed = aiPrompt.length;
        ctx.fillStyle = `hsl(${seed * 10}, 20%, 95%)`;
        ctx.fillRect(0, 0, 800, 600);
        for (let i = 0; i < 20; i++) {
            ctx.fillStyle = `hsla(${(seed * 10 + i * 20) % 360}, 50%, 60%, 0.5)`;
            ctx.beginPath();
            ctx.arc(
                Math.random() * 800,
                Math.random() * 600,
                Math.random() * 100 + 20,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
        ctx.fillStyle = '#000';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`AI-Generated for: "${aiPrompt}"`, 400, 300);
    
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `ai-generated-${Date.now()}.png`, { type: 'image/png' });
            onSelectFile([file]);
            toast({ title: 'Image Generated', description: 'Placeholder image loaded into the editor.' });
          } else {
            toast({ title: 'Generation Failed', description: 'Could not create image blob.', variant: 'destructive' });
          }
          setIsProcessing(false);
        }, 'image/png');
    };

  if (activeToolName === 'Grading Tool') {
    return (
        <GradingTool 
            initialImageSrc={imgSrc}
            onExport={(dataUrl) => {
                updateImageAndHistory(dataUrl);
                setActiveToolName(null); // Exit grading tool on export
            }}
            onCancel={() => setActiveToolName(null)}
        />
    );
  }

  return (
    <>
      <input
        type="file"
        ref={collageSlotInputRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          const index = Number(e.currentTarget.dataset.index);
          if (e.target.files) {
            handleCollageFileSelect(Array.from(e.target.files), index);
          }
          // Reset the input value to allow selecting the same file again
          e.currentTarget.value = '';
        }}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
              <CardHeader className="flex flex-row justify-between items-start">
                  <div>
                    <CardTitle>Editor</CardTitle>
                  </div>
                   {imgSrc && (
                    <Button variant="outline" onClick={() => { setImgSrc(''); setImageFile(null); resetAllToolStates(); }}>
                        <Replace className="mr-2 h-4 w-4" /> Replace Image
                    </Button>
                   )}
              </CardHeader>
               <CardContent>
                   <Card className="shadow-inner">
                      <CardHeader>
                          <CardTitle className="text-lg">Image Area</CardTitle>
                          <CardDescription>
                              {activeToolName ? `Currently using: ${activeToolName}` : imgSrc ? 'Your image preview.' : 'Upload an image to get started.'}
                          </CardDescription>
                      </CardHeader>
                      <CardContent 
                          ref={previewContainerRef} 
                          className="min-h-[400px] bg-muted/50 rounded-md p-4 flex items-center justify-center relative overflow-hidden"
                          onMouseMove={showRetouchControls ? (e) => updateCursorPosition(e as any) : undefined}
                          onMouseEnter={showRetouchControls ? () => brushCursorRef.current && (brushCursorRef.current.style.display = 'block') : undefined}
                          onMouseLeave={showRetouchControls ? () => brushCursorRef.current && (brushCursorRef.current.style.display = 'none') : undefined}
                      >
                          {isProcessing ? (
                              <div className="text-center">
                                  <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin" />
                                  <p className="mt-2 font-medium">Processing...</p>
                              </div>
                          ) : !imgSrc ? (
                            <div className="text-center text-muted-foreground">
                                <ImageIconLucide className="mx-auto h-16 w-16 opacity-50" />
                                <p className="mt-4 font-medium">No Image Uploaded</p>
                                <p className="text-sm">Please upload an image to use the editor tools.</p>
                            </div>
                          ) : activeToolName === 'Remove BG' ? (
                              <BackgroundRemover 
                                  imageSrc={imgSrc}
                                  onComplete={(dataUrl) => {
                                      updateImageAndHistory(dataUrl);
                                      resetAllToolStates();
                                      toast({title: "Background Removed Successfully"});
                                  }}
                                  onCancel={resetAllToolStates}
                              />
                          ) : (
                              <div className="max-w-full max-h-full relative">
                                  { showCropper ? (
                                      <ReactCrop
                                          crop={crop}
                                          onChange={(_, percentCrop) => setCrop(percentCrop)}
                                          onComplete={(c) => setCompletedCrop(c)}
                                          aspect={aspect}
                                      >
                                        <Image
                                            ref={imgRef}
                                            alt="Image for editing"
                                            src={imgSrc}
                                            style={{ transform: `scale(${scale}) rotate(${rotateState}deg)`, filter: `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturate}%) grayscale(${adjustments.grayscale}%) sepia(${adjustments.sepia}%) invert(${adjustments.invert}%) hue-rotate(${adjustments.hueRotate}deg)`}}
                                            onLoad={(e) => {
                                                if (aspect) {
                                                    const { width, height } = e.currentTarget;
                                                    setCrop(centerCrop(width, height, aspect));
                                                }
                                            }}
                                            width={800} height={600}
                                            className="max-w-full max-h-[60vh] object-contain"
                                            data-ai-hint="edited image"
                                        />
                                      </ReactCrop>
                                    ) : showRetouchControls ? (
                                      <div className="relative cursor-none">
                                        <canvas
                                          ref={retouchImageCanvasRef}
                                          className="max-w-full max-h-[60vh] object-contain"
                                          style={{ filter: `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturate}%) grayscale(${adjustments.grayscale}%) sepia(${adjustments.sepia}%) invert(${adjustments.invert}%) hue-rotate(${adjustments.hueRotate}deg)`}}
                                          onMouseDown={(e) => startDrawingRetouch(e)}
                                          onMouseMove={(e) => isDrawingRef.current && drawRetouch(e)}
                                          onMouseUp={stopDrawingRetouch}
                                          onMouseLeave={stopDrawingRetouch}
                                        />
                                        <canvas ref={retouchEditCanvasRef} className="absolute top-0 left-0 pointer-events-none" />
                                      </div>
                                    ) : (
                                      <div className="relative">
                                        <Image
                                          ref={imgRef}
                                          alt="Image Preview"
                                          src={imgSrc}
                                          style={{ transform: `scale(${scale}) rotate(${rotateState}deg)`, filter: `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturate}%) grayscale(${adjustments.grayscale}%) sepia(${adjustments.sepia}%) invert(${adjustments.invert}%) hue-rotate(${adjustments.hueRotate}deg)`}}
                                          className="max-w-full max-h-[60vh] object-contain"
                                          width={800} height={600}
                                          data-ai-hint="edited image"
                                        />
                                        {showPipControls && pipImageSrc && (
                                          <div
                                              data-pip-draggable="true"
                                              className="absolute border-2 border-dashed border-blue-500 cursor-move"
                                              style={{
                                                  left: `${pipRect.x}%`,
                                                  top: `${pipRect.y}%`,
                                                  width: `${pipRect.width}%`,
                                                  height: `${pipRect.height}%`,
                                                  opacity: pipOpacity,
                                              }}
                                              onMouseDown={(e) => handlePipMouseDown(e)}
                                              onTouchStart={(e) => handlePipMouseDown(e)}
                                          >
                                              <Image src={pipImageSrc} alt="PiP Image" layout="fill" className="pointer-events-none" data-ai-hint="picture in picture" />
                                          </div>
                                        )}
                                      </div>
                                    )
                                  }
                                  {overlayImageSrc && showOverlayControls && (
                                      <div
                                          className="absolute border-2 border-dashed border-blue-500 cursor-move"
                                          style={{
                                              left: `${overlayRect.x}%`,
                                              top: `${overlayRect.y}%`,
                                              width: `${overlayRect.width}%`,
                                              height: `${overlayRect.height}%`,
                                              opacity: overlayOpacity,
                                              transform: `rotate(${overlayRotation}deg)`
                                          }}
                                          data-handle="move"
                                          onMouseDown={handleOverlayMouseDown}
                                          onTouchStart={handleOverlayMouseDown}
                                      >
                                          <Image src={overlayImageSrc} alt="Overlay" layout="fill" className="pointer-events-none" data-ai-hint="overlay image" />
                                          {/* Resize Handles */}
                                          <div data-handle="nw" className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white rounded-full cursor-nwse-resize pointer-events-auto border-2 border-blue-500"/>
                                          <div data-handle="ne" className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white rounded-full cursor-nesw-resize pointer-events-auto border-2 border-blue-500"/>
                                          <div data-handle="sw" className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white rounded-full cursor-nesw-resize pointer-events-auto border-2 border-blue-500"/>
                                          <div data-handle="se" className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white rounded-full cursor-nwse-resize pointer-events-auto border-2 border-blue-500"/>
                                      </div>
                                  )}
                              </div>
                          )}
                           <div ref={brushCursorRef} className="absolute rounded-full pointer-events-none transform -translate-x-1/2 -translate-y-1/2 border-2 hidden"></div>
                      </CardContent>
                  </Card>
               </CardContent>
                <CardFooter className="flex flex-wrap items-center gap-2">
                  <Button onClick={handleSendBackToPassportPhoto} variant="secondary" className={cn(returnPath ? 'flex' : 'hidden')}><Send className="mr-2"/> Send Back to Passport Photo</Button>
                  <Button onClick={handleSendToQueue} variant="secondary" className={cn(!returnPath ? 'flex' : 'hidden')}><Send className="mr-2"/> Send to Queue</Button>
                  <Button onClick={handleUndo} disabled={historyIndex <= 0} variant="outline"><Undo className="mr-2" /> Undo</Button>
                  <Button onClick={handleRedo} disabled={historyIndex >= history.length - 1} variant="outline"><Redo className="mr-2" /> Redo</Button>
                  <Button onClick={handleDownload} variant="default" className="bg-accent hover:bg-accent/90 text-accent-foreground"><DownloadIcon className="mr-2"/> Download Edited Image</Button>
                  {croppedImageUrl && <Image src={croppedImageUrl} alt="Cropped preview" width={100} height={100} data-ai-hint="cropped image"/>}
                  <p className="text-xs text-muted-foreground ml-auto">Tools are client-side. Larger images may impact performance.</p>
                </CardFooter>
          </Card>

          {activeToolName && activeToolName !== 'Grading Tool' && activeToolName !== 'Remove BG' && (
              <Card className="p-4 shadow-inner">
                  <div className="flex justify-between items-center mb-2">
                      <CardTitle className="text-lg">Controls: {activeToolName}</CardTitle>
                      <Button variant="ghost" size="icon" onClick={resetAllToolStates}><X/></Button>
                  </div>
                   {showAiGenerator && (
                    <div className="space-y-4">
                        <Label htmlFor="ai-prompt">AI Prompt</Label>
                        <Textarea id="ai-prompt" placeholder="e.g., a photo of a majestic lion in the savannah" value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} />
                        <Button className="w-full" onClick={handleGenerateAiImage} disabled={isProcessing}>
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4"/>}
                            Generate Image
                        </Button>
                    </div>
                   )}
                   {showCropper && imgSrc && (
                     <div className="space-y-4">
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                         <Button variant="outline" size="sm" onClick={() => setAspect(16 / 9)}>16:9</Button>
                         <Button variant="outline" size="sm" onClick={() => setAspect(4 / 3)}>4:3</Button>
                         <Button variant="outline" size="sm" onClick={() => setAspect(1 / 1)}>1:1</Button>
                         <Button variant="outline" size="sm" onClick={() => setAspect(undefined)}>Free</Button>
                       </div>
                       <Button className="w-full" onClick={handleDownloadCroppedImage} disabled={!completedCrop?.width}>Apply Crop</Button>
                     </div>
                   )}
                   {showResizeControls && imgSrc && (
                      <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <Label htmlFor="resize-width">Width (px)</Label>
                                  <Input id="resize-width" type="number" value={resizeWidth} onChange={(e) => handleResizeInputChange(e, 'width')} />
                              </div>
                              <div>
                                  <Label htmlFor="resize-height">Height (px)</Label>
                                  <Input id="resize-height" type="number" value={resizeHeight} onChange={(e) => handleResizeInputChange(e, 'height')} />
                              </div>
                          </div>
                          <div className="flex items-center space-x-2">
                              <Checkbox id="aspect-ratio" checked={maintainAspectRatio} onCheckedChange={(checked) => setMaintainAspectRatio(Boolean(checked))} />
                              <Label htmlFor="aspect-ratio">Maintain aspect ratio</Label>
                          </div>
                          <Button className="w-full" onClick={handleResizeImage}>Apply Resize</Button>
                      </div>
                   )}
                   {showMergeControls && imgSrc && (
                      <div className="space-y-4">
                          <FileUpload
                              label="Upload Second Image"
                              onFileSelect={(files) => {
                                  if (files[0]) {
                                      setMergeImageFile(files[0]);
                                      setMergeImageSrc(URL.createObjectURL(files[0]));
                                  } else {
                                      setMergeImageFile(null);
                                      setMergeImageSrc(null);
                                  }
                              }}
                              acceptedFileTypes="image/jpeg,image/png,image/webp"
                              id="merge-upload"
                          />
                          {mergeImageSrc && (
                              <>
                                  <RadioGroup value={mergeDirection} onValueChange={(value: 'horizontal' | 'vertical') => setMergeDirection(value)} className="flex gap-4">
                                      <div className="flex items-center space-x-2"><RadioGroupItem value="horizontal" id="h-merge"/><Label htmlFor="h-merge">Horizontal</Label></div>
                                      <div className="flex items-center space-x-2"><RadioGroupItem value="vertical" id="v-merge"/><Label htmlFor="v-merge">Vertical</Label></div>
                                  </RadioGroup>
                                  {mergedPreviewDataUrl && <Image src={mergedPreviewDataUrl} alt="Merge preview" width={300} height={200} className="rounded-md border object-contain mx-auto" data-ai-hint="merged image" />}
                                  <Button className="w-full" onClick={() => { updateImageAndHistory(mergedPreviewDataUrl!); resetAllToolStates(); }}>Apply Merge</Button>
                              </>
                          )}
                      </div>
                   )}
                    {showStitchControls && imgSrc && (
                      <div className="space-y-4">
                          <FileUpload
                              label="Upload Image to Stitch"
                              onFileSelect={(files) => {
                                  if (files[0]) {
                                      setStitchImageFile(files[0]);
                                      setStitchImageSrc(URL.createObjectURL(files[0]));
                                  } else {
                                      setStitchImageFile(null);
                                      setStitchImageSrc(null);
                                  }
                              }}
                              acceptedFileTypes="image/jpeg,image/png,image/webp"
                              id="stitch-upload"
                          />
                          {stitchImageSrc && (
                              <>
                                  <RadioGroup value={stitchDirection} onValueChange={(value: 'horizontal' | 'vertical') => setStitchDirection(value)} className="flex gap-4">
                                      <div className="flex items-center space-x-2"><RadioGroupItem value="horizontal" id="h-stitch"/><Label htmlFor="h-stitch">Horizontal</Label></div>
                                      <div className="flex items-center space-x-2"><RadioGroupItem value="vertical" id="v-stitch"/><Label htmlFor="v-stitch">Vertical</Label></div>
                                  </RadioGroup>
                                  {stitchedPreviewDataUrl && <Image src={stitchedPreviewDataUrl} alt="Stitch preview" width={300} height={200} className="rounded-md border object-contain mx-auto" data-ai-hint="stitched image" />}
                                  <Button className="w-full" onClick={() => { updateImageAndHistory(stitchedPreviewDataUrl!); resetAllToolStates(); }}>Apply Stitch</Button>
                              </>
                          )}
                      </div>
                    )}
                    {showCompressControls && imgSrc && (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="quality-slider">Quality (for JPEG): {Math.round(compressionQuality * 100)}%</Label>
                          <Slider
                            id="quality-slider"
                            min={0.1}
                            max={1}
                            step={0.05}
                            value={[compressionQuality]}
                            onValueChange={(value) => setCompressionQuality(value[0])}
                            className="mt-2"
                          />
                        </div>
                        <Button className="w-full" onClick={handleCompressImage}>Apply Compression</Button>
                      </div>
                    )}
                    {showConvertControls && imgSrc && (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="convert-format">Target Format</Label>
                          <Select value={convertTargetFormat} onValueChange={setConvertTargetFormat}>
                            <SelectTrigger id="convert-format">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="image/png">PNG</SelectItem>
                              <SelectItem value="image/jpeg">JPEG</SelectItem>
                              <SelectItem value="image/webp">WebP</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button className="w-full" onClick={handleConvertFormat}>Apply Conversion</Button>
                      </div>
                    )}
                   {showAdjustmentsControls && imgSrc && (
                      <div className="space-y-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="space-y-1">
                                <Label htmlFor="brightness-slider">Brightness: {adjustments.brightness}%</Label>
                                <Slider id="brightness-slider" min={0} max={200} value={[adjustments.brightness]} onValueChange={v => setAdjustments(adj => ({...adj, brightness: v[0]}))} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="contrast-slider">Contrast: {adjustments.contrast}%</Label>
                                <Slider id="contrast-slider" min={0} max={200} value={[adjustments.contrast]} onValueChange={v => setAdjustments(adj => ({...adj, contrast: v[0]}))} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="saturate-slider">Saturation: {adjustments.saturate}%</Label>
                                <Slider id="saturate-slider" min={0} max={200} value={[adjustments.saturate]} onValueChange={v => setAdjustments(adj => ({...adj, saturate: v[0]}))} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="grayscale-slider">Grayscale: {adjustments.grayscale}%</Label>
                                <Slider id="grayscale-slider" min={0} max={100} value={[adjustments.grayscale]} onValueChange={v => setAdjustments(adj => ({...adj, grayscale: v[0]}))} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="sepia-slider">Sepia: {adjustments.sepia}%</Label>
                                <Slider id="sepia-slider" min={0} max={100} value={[adjustments.sepia]} onValueChange={v => setAdjustments(adj => ({...adj, sepia: v[0]}))} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="invert-slider">Invert: {adjustments.invert}%</Label>
                                <Slider id="invert-slider" min={0} max={100} value={[adjustments.invert]} onValueChange={v => setAdjustments(adj => ({...adj, invert: v[0]}))} />
                            </div>
                          </div>
                          <div className="space-y-1">
                              <Label htmlFor="hue-slider">Hue Rotate: {adjustments.hueRotate}°</Label>
                              <Slider id="hue-slider" min={0} max={360} value={[adjustments.hueRotate]} onValueChange={v => setAdjustments(adj => ({...adj, hueRotate: v[0]}))} />
                          </div>
                      </div>
                  )}
                  {showBackgroundColorControls && imgSrc && (
                      <div className="space-y-4">
                          <Label>Choose a background color to apply behind your image.</Label>
                          <div className="flex items-center gap-2">
                              <Input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className="w-16 h-10 p-1" />
                              <Input type="text" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} placeholder="#ffffff" />
                          </div>
                           <Button className="w-full" onClick={handleApplyBackgroundColor}>Apply Background</Button>
                      </div>
                  )}
                  {showOverlayControls && imgSrc && (
                      <div className="space-y-4">
                          <FileUpload
                              label="Upload Overlay Image"
                              onFileSelect={(files) => {
                                  if (files[0]) {
                                      setOverlayImageFile(files[0]);
                                      setOverlayImageSrc(URL.createObjectURL(files[0]));
                                  }
                              }}
                              acceptedFileTypes="image/png"
                              id="overlay-upload"
                          />
                          {overlayImageSrc && (
                              <>
                                  <p className="text-xs text-muted-foreground">Drag the overlay image on the preview to position and resize it.</p>
                                  <div>
                                      <Label>Opacity: {Math.round(overlayOpacity * 100)}%</Label>
                                      <Slider min={0} max={1} step={0.01} value={[overlayOpacity]} onValueChange={v => setOverlayOpacity(v[0])} />
                                  </div>
                                   <div>
                                      <Label>Rotation: {overlayRotation}°</Label>
                                      <Slider min={-180} max={180} step={1} value={[overlayRotation]} onValueChange={v => setOverlayRotation(v[0])} />
                                  </div>
                                  <Button className="w-full" onClick={handleApplyOverlay}>Apply Overlay</Button>
                              </>
                          )}
                      </div>
                  )}
                  {showWatermarkControls && imgSrc && (
                    <div className="space-y-4">
                      <RadioGroup defaultValue="text" onValueChange={(value: 'text' | 'image') => setWatermarkType(value)} className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="text" id="r1" />
                          <Label htmlFor="r1">Text</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="image" id="r2" />
                          <Label htmlFor="r2">Image</Label>
                        </div>
                      </RadioGroup>
                      
                      {watermarkType === 'text' && (
                        <div className="space-y-2">
                          <Label htmlFor="watermark-text">Watermark Text</Label>
                          <Input id="watermark-text" value={watermarkText} onChange={e => setWatermarkText(e.target.value)} />
                           <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label htmlFor="watermark-color">Color</Label>
                              <Input id="watermark-color" type="color" value={watermarkTextColor} onChange={e => setWatermarkTextColor(e.target.value)} />
                            </div>
                             <div>
                              <Label htmlFor="watermark-size">Font Size</Label>
                              <Input id="watermark-size" type="number" value={watermarkTextSize} onChange={e => setWatermarkTextSize(Number(e.target.value))} />
                            </div>
                          </div>
                        </div>
                      )}

                      {watermarkType === 'image' && (
                         <FileUpload
                            label="Upload Watermark Image"
                            onFileSelect={(files) => {
                                if (files[0]) {
                                    setWatermarkImageFile(files[0]);
                                    setWatermarkImageSrc(URL.createObjectURL(files[0]));
                                }
                            }}
                            acceptedFileTypes="image/png"
                            id="watermark-upload"
                        />
                      )}

                      <div>
                        <Label>Position</Label>
                        <Select value={watermarkPosition} onValueChange={setWatermarkPosition}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="center">Center</SelectItem>
                            <SelectItem value="bottom-right">Bottom Right</SelectItem>
                            <SelectItem value="tile">Tile</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                       <div>
                        <Label>Opacity: {Math.round(watermarkOpacity * 100)}%</Label>
                        <Slider min={0} max={1} step={0.01} value={[watermarkOpacity]} onValueChange={v => setWatermarkOpacity(v[0])} />
                      </div>
                       <Button className="w-full" onClick={handleApplyWatermark} disabled={isProcessingWatermark}>
                         {isProcessingWatermark ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                        Apply Watermark
                       </Button>
                    </div>
                  )}
                  {showFrameControls && imgSrc && (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="frame-width-slider">Frame Width: {frameWidth}px</Label>
                        <Slider
                          id="frame-width-slider"
                          min={1}
                          max={100}
                          step={1}
                          value={[frameWidth]}
                          onValueChange={(value) => setFrameWidth(value[0])}
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label htmlFor="frame-color-input">Frame Color</Label>
                        <Input
                          id="frame-color-input"
                          type="color"
                          value={frameColor}
                          onChange={(e) => setFrameColor(e.target.value)}
                          className="w-full p-1 h-10"
                        />
                      </div>
                      <Button className="w-full" onClick={handleApplyFrame} disabled={isProcessingFrame}>
                         {isProcessingFrame ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Apply Frame
                      </Button>
                    </div>
                  )}
                  {showPipControls && imgSrc && (
                      <div className="space-y-4">
                          <FileUpload
                              label="Upload Inner Image"
                              onFileSelect={(files) => {
                                  if (files[0]) {
                                      setPipImageFile(files[0]);
                                      setPipImageSrc(URL.createObjectURL(files[0]));
                                  }
                              }}
                              acceptedFileTypes="image/png,image/jpeg,image/webp"
                              id="pip-upload"
                          />
                          {pipImageSrc && (
                              <>
                                  <p className="text-xs text-muted-foreground">Drag the inner image on the preview to position it.</p>
                                  <div><Label>Scale: {Math.round(pipRect.width)}%</Label><Slider min={5} max={100} step={1} value={[pipRect.width]} onValueChange={v => setPipRect(p => ({...p, width: v[0], height: v[0] * (imageState!.height/imageState!.width) }))} /></div>
                                  <div><Label>Opacity: {Math.round(pipOpacity * 100)}%</Label><Slider min={0} max={1} step={0.01} value={[pipOpacity]} onValueChange={v => setPipOpacity(v[0])} /></div>
                                  <Button className="w-full" onClick={handleApplyPip}>Apply PiP Effect</Button>
                              </>
                          )}
                      </div>
                  )}
                  {showRetouchControls && imgSrc && (
                      <div className="space-y-4">
                          <RadioGroup value={retouchTool} onValueChange={(v: 'eraser' | 'restore') => setRetouchTool(v)} className="flex gap-4">
                              <div className="flex items-center space-x-2"><RadioGroupItem value="eraser" id="tool-eraser"/><Label htmlFor="tool-eraser">Eraser</Label></div>
                              <div className="flex items-center space-x-2"><RadioGroupItem value="restore" id="tool-restore"/><Label htmlFor="tool-restore">Restore</Label></div>
                          </RadioGroup>
                           <div>
                              <Label htmlFor="brush-size-slider">Brush Size: {brushSize}px</Label>
                              <Slider id="brush-size-slider" min={5} max={100} value={[brushSize]} onValueChange={v => setBrushSize(v[0])} />
                          </div>
                          <Button className="w-full" onClick={applyRetouch}>Apply Retouch</Button>
                      </div>
                  )}
                  {showCollageControls && (
                      <div className="space-y-4">
                          <div>
                              <Label htmlFor="collage-layout">Layout</Label>
                              <Select value={selectedCollageLayout} onValueChange={setSelectedCollageLayout}>
                                  <SelectTrigger id="collage-layout"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                      {collageLayouts.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                                  </SelectContent>
                              </Select>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {Array.from({ length: collageLayouts.find(l=>l.value === selectedCollageLayout)?.requiredImages || 0 }).map((_, index) => (
                                  <div key={index} className="flex flex-col items-center gap-1">
                                      <Label className="text-xs">Slot {index + 1}</Label>
                                      <div 
                                          className="w-24 h-24 border-2 border-dashed rounded-md flex items-center justify-center cursor-pointer hover:bg-muted"
                                          onClick={() => {
                                              if (collageSlotInputRef.current) {
                                                  collageSlotInputRef.current.dataset.index = String(index);
                                                  collageSlotInputRef.current.click();
                                              }
                                          }}
                                      >
                                          {collageSlotSrcs[index] ? (
                                              <Image src={collageSlotSrcs[index]!} alt={`Slot ${index + 1}`} width={96} height={96} className="object-cover rounded-sm" />
                                          ) : (
                                              <Plus className="h-6 w-6 text-muted-foreground" />
                                          )}
                                      </div>
                                  </div>
                              ))}
                          </div>
                           {collageResultDataUrl && (
                              <div>
                                  <Label>Preview</Label>
                                  <Image src={collageResultDataUrl} alt="Collage Preview" width={400} height={400} className="rounded-md border object-contain mx-auto mt-2"/>
                              </div>
                           )}
                          <Button className="w-full" disabled={isProcessingCollage || !collageResultDataUrl} onClick={handleApplyCollage}>
                              {isProcessingCollage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Apply Collage
                          </Button>
                      </div>
                  )}
              </Card>
          )}
        </div>

        <div className="lg:col-span-1 space-y-6">
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center text-xl font-headline">
                        <ImageIcon className="mr-2 h-6 w-6 text-primary" /> Image Source
                    </CardTitle>
                    <CardDescription>
                        Upload an image or select one to start editing.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <FileUpload
                        label="Upload Image"
                        onFileSelect={onSelectFile}
                        acceptedFileTypes="image/jpeg,image/png,image/webp"
                        id="image-editor-upload"
                    />
                    <div className="relative text-center">
                        <Separator />
                        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">OR</span>
                    </div>
                    <Button variant="outline" className="w-full" onClick={() => setIsQueueDialogOpen(true)}>
                        <Library className="mr-2 h-4 w-4" /> Select from Queue
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Tools</CardTitle>
                    <CardDescription>Select a tool to apply to your image.</CardDescription>
                </CardHeader>
                <CardContent>
                   <Tabs defaultValue="Essentials" className="w-full">
                      <ScrollArea>
                          <TabsList className="w-full justify-start">
                              {Object.keys(toolCategories).map(category => (
                                  <TabsTrigger key={category} value={category}>{category}</TabsTrigger>
                              ))}
                          </TabsList>
                          <ScrollBar orientation="horizontal" />
                      </ScrollArea>
                      {Object.entries(toolCategories).map(([category, tools]) => (
                          <TabsContent key={category} value={category} className="mt-4">
                              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                  {tools.map(tool => (
                                      <Button
                                          key={tool.actionId}
                                          variant={activeToolName === tool.name ? 'default' : 'outline'}
                                          onClick={() => handleToolAction(tool)}
                                          className={cn("flex-col p-2 space-y-1 h-16", tool.className)}
                                          disabled={isProcessing}
                                          title={tool.description}
                                      >
                                          <tool.icon className="h-5 w-5 mb-1"/>
                                          <span className="text-xs text-center">{tool.name}</span>
                                      </Button>
                                  ))}
                              </div>
                          </TabsContent>
                      ))}
                  </Tabs>
                </CardContent>
            </Card>
        </div>
      </div>
    

    <Dialog open={isQueueDialogOpen} onOpenChange={setIsQueueDialogOpen}>
        <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
                <DialogTitle>Select Image from Queue</DialogTitle>
                <DialogDescription>
                    Choose an image from your document queue to edit.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <ScrollArea className="h-96 pr-4">
                    {imageDocuments.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {imageDocuments.map(doc => {
                                const isSelected = sourceDocument?.id === doc.id;
                                return (
                                    <div
                                        key={doc.id}
                                        className="relative group cursor-pointer"
                                        onClick={() => handleSelectFromQueue(doc)}
                                    >
                                        <Card className={cn("overflow-hidden transition-all", isSelected && "ring-2 ring-primary")}>
                                            <CardContent className="p-0">
                                                <Image
                                                    src={doc.dataUri!}
                                                    alt={doc.name}
                                                    width={200}
                                                    height={150}
                                                    className="w-full h-32 object-cover"
                                                    data-ai-hint="document image"
                                                />
                                            </CardContent>
                                            <CardFooter className="p-2 text-xs">
                                                <p className="truncate" title={doc.name}>{doc.name}</p>
                                            </CardFooter>
                                        </Card>
                                        {isSelected && (
                                            <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-0.5 pointer-events-none">
                                                <CheckCircle className="h-5 w-5" />
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
                            <p>No images found in your document queue.</p>
                            <p className="text-xs mt-1">Upload some images on the dashboard first.</p>
                        </div>
                    )}
                </ScrollArea>
            </div>
        </DialogContent>
    </Dialog>
    </>
  );
}
