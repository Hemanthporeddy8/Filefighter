// src/app/(main)/id-copier/page.tsx
"use client";

import { useState, useRef, useCallback, useEffect, type MouseEvent, type TouchEvent } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { FileUpload } from '@/components/app/file-upload';
import { Copy, RefreshCw, Printer, Move, Expand, Loader2, Download, Eye, Library, CheckCircle, UploadCloud, X, Rows, Columns, PlusCircle, Crop as CropIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useDocumentQueue } from '@/contexts/document-context';
import { useSearchParams } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { DocumentQueueItem } from '@/types';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { centerCrop, makeAspectCrop, type Crop as ReactCropType, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Input } from '@/components/ui/input';
import dynamic from 'next/dynamic';

import type { jsPDF } from 'jspdf';

const ReactCrop = dynamic(() => import('react-image-crop'), { 
    ssr: false, 
    loading: () => (
        <div className="h-[400px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="ml-2">Loading Crop Tool...</p>
        </div>
    )
});


// Define layout templates for the A4 preview
const templates = [
  {
    value: 'single_top',
    label: '1 Pair, Top Centered',
    positions: [
      { side: 'front', top: '5%', left: '15%', width: '33%', height: '20%' },
      { side: 'back', top: '5%', left: '52%', width: '33%', height: '20%' },
    ],
  },
  {
    value: 'two_vertical',
    label: '2 Pairs, Vertical',
    positions: [
      { side: 'front', top: '5%', left: '25%', width: '48%', height: '20%' },
      { side: 'back', top: '28%', left: '25%', width: '48%', height: '20%' },
    ],
  },
  {
    value: 'four_grid',
    label: '4 Pairs, 2x2 Grid',
    positions: [
      // Row 1
      { side: 'front', top: '5%', left: '5%', width: '43%', height: '20%' },
      { side: 'back', top: '5%', left: '52%', width: '43%', height: '20%' },
      // Row 2
      { side: 'front', top: '28%', left: '5%', width: '43%', height: '20%' },
      { side: 'back', top: '28%', left: '52%', width: '43%', height: '20%' },
    ],
  },
   {
    value: 'eight_grid',
    label: '8 Cards, 2x4 Grid',
    positions: [
      // Row 1
      { side: 'front', top: '4%', left: '5%', width: '43%', height: '20%' },
      { side: 'back', top: '4%', left: '52%', width: '43%', height: '20%' },
      // Row 2
      { side: 'front', top: '26%', left: '5%', width: '43%', height: '20%' },
      { side: 'back', top: '26%', left: '52%', width: '43%', height: '20%' },
       // Row 3
      { side: 'front', top: '48%', left: '5%', width: '43%', height: '20%' },
      { side: 'back', top: '48%', left: '52%', width: '43%', height: '20%' },
       // Row 4
      { side: 'front', top: '70%', left: '5%', width: '43%', height: '20%' },
      { side: 'back', top: '70%', left: '52%', width: '43%', height: '20%' },
    ],
  },
];

interface MultiCard {
  id: string;
  file: File;
  dataUrl: string;
}

// Helper to convert data URI to a File object
const dataURLtoFile = (dataurl: string, filename: string): File => {
  const arr = dataurl.split(',');
  if (arr.length < 2) throw new Error("Invalid Data URL");
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


export default function IdCopierPage() {
  const [frontImage, setFrontImage] = useState<File | null>(null);
  const [backImage, setBackImage] = useState<File | null>(null);
  const [frontImageUrl, setFrontImageUrl] = useState<string | null>(null);
  const [backImageUrl, setBackImageUrl] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0].value);
  
  const [mode, setMode] = useState<'template' | 'freestyle' | 'multiple'>('template');
  const [freestylePositions, setFreestylePositions] = useState({
    front: { x: 5, y: 5 }, // Default position in %
    back: { x: 52, y: 5 },  // Default position in %
  });
  const [freestyleSize, setFreestyleSize] = useState(33); // In percent
  const [draggedItem, setDraggedItem] = useState<{ item: 'front' | 'back'; offsetX: number; offsetY: number } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);

  const { documents } = useDocumentQueue();
  const searchParams = useSearchParams();
  const imageDocuments = documents.filter(doc => doc.type === 'Image' && doc.dataUri);
  const [isQueueDialogOpen, setIsQueueDialogOpen] = useState(false);
  const [selectionTarget, setSelectionTarget] = useState<'front' | 'back' | 'multiple' | null>(null);
  
  const [multipleCards, setMultipleCards] = useState<MultiCard[]>([]);
  const [multiGridCols, setMultiGridCols] = useState(3);
  const [selectedQueueDocs, setSelectedQueueDocs] = useState<Set<string>>(new Set());

  // State for Cropping
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false);
  const [croppingImageSide, setCroppingImageSide] = useState<'front' | 'back' | null>(null);
  const [crop, setCrop] = useState<ReactCropType>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const cropImgRef = useRef<HTMLImageElement>(null);
  const [aspect, setAspect] = useState<number | undefined>(85.6 / 53.98); // ID Card Aspect Ratio

  // State for download dialog
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false);
  const [downloadFilename, setDownloadFilename] = useState('id-card-sheet.pdf');

  const handleFileSelect = (files: File[], side: 'front' | 'back') => {
    const file = files[0] || null;
    if (side === 'front') {
      setFrontImage(file);
      setFrontImageUrl(file ? URL.createObjectURL(file) : null);
    } else {
      setBackImage(file);
      setBackImageUrl(file ? URL.createObjectURL(file) : null);
    }
  };
  
  const handleMultipleFileSelect = (files: File[]) => {
    const newCards: MultiCard[] = files.map(file => ({
      id: `${file.name}-${file.lastModified}`,
      file,
      dataUrl: URL.createObjectURL(file)
    }));
    setMultipleCards(prev => {
        const existingIds = new Set(prev.map(c => c.id));
        const uniqueNewCards = newCards.filter(c => !existingIds.has(c.id));
        return [...prev, ...uniqueNewCards];
    });
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = event.target.files?.[0] || null;
    if (file) {
      if (side === 'front') {
        setFrontImage(file);
        setFrontImageUrl(URL.createObjectURL(file));
      } else {
        setBackImage(file);
        setBackImageUrl(URL.createObjectURL(file));
      }
    }
     if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadButtonClick = (side: 'front' | 'back') => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('data-side', side);
      fileInputRef.current.click();
    }
  };

  const handleSelectFromQueue = () => {
    if (selectionTarget === 'multiple') {
      const docsToAdd = documents.filter(doc => selectedQueueDocs.has(doc.id));
      const newCards: MultiCard[] = docsToAdd.map(doc => {
          const file = dataURLtoFile(doc.dataUri!, doc.name);
          return { id: doc.id, file, dataUrl: doc.dataUri! };
      });
      setMultipleCards(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const uniqueNewCards = newCards.filter(c => !existingIds.has(c.id));
          return [...prev, ...uniqueNewCards];
      });
      setSelectedQueueDocs(new Set());
    } else if (selectionTarget && selectedQueueDocs.size > 0) {
      const docId = selectedQueueDocs.values().next().value;
      const doc = documents.find(d => d.id === docId);
      if (doc && doc.dataUri) {
          try {
              const file = dataURLtoFile(doc.dataUri, doc.name);
              handleFileSelect([file], selectionTarget);
          } catch (error) {
              toast({ title: "Load Failed", description: "Could not load image from queue.", variant: "destructive" });
          }
      }
    }
    setIsQueueDialogOpen(false);
  };
  
  useEffect(() => {
    const docId = searchParams.get('docId');
    if (docId) {
        const doc = documents.find(d => d.id === docId);
        if (doc && doc.dataUri) {
            try {
                const file = dataURLtoFile(doc.dataUri, doc.name);
                handleFileSelect([file], 'front');
                toast({ title: "Image Loaded", description: "The selected image has been loaded as the 'front' side." });
            } catch (error) {
                toast({ title: "Load Failed", description: "Could not load the image from the document queue.", variant: "destructive" });
            }
        }
    }
  }, [searchParams, documents, toast]);


  const handleReset = () => {
    setFrontImage(null);
    setBackImage(null);
    setFrontImageUrl(null);
    setBackImageUrl(null);
    setSelectedTemplate(templates[0].value);
    setMode('template');
    setFreestylePositions({ front: { x: 5, y: 5 }, back: { x: 52, y: 5 } });
    setFreestyleSize(33);
    setDraggedItem(null);
    setMultipleCards([]);
  }

  const handleDragStart = (e: MouseEvent<HTMLDivElement> | TouchEvent<HTMLDivElement>, item: 'front' | 'back') => {
    if (mode !== 'freestyle' || !previewRef.current) return;
    
    const targetRect = e.currentTarget.getBoundingClientRect();
    
    const isTouchEvent = 'touches' in e;
    if (isTouchEvent) {
        e.preventDefault();
    }

    const clientX = isTouchEvent ? e.touches[0].clientX : e.clientX;
    const clientY = isTouchEvent ? e.touches[0].clientY : e.clientY;

    const offsetX = clientX - targetRect.left;
    const offsetY = clientY - targetRect.top;

    setDraggedItem({ item, offsetX, offsetY });
  };

  const handleDragMove = useCallback((e: globalThis.MouseEvent | globalThis.TouchEvent) => {
    if (!draggedItem || !previewRef.current) return;

    const isTouchEvent = 'touches' in e;
    if (isTouchEvent) {
        e.preventDefault();
    }
    
    const clientX = isTouchEvent ? e.touches[0].clientX : e.clientX;
    const clientY = isTouchEvent ? e.touches[0].clientY : e.clientY;
    
    const containerRect = previewRef.current.getBoundingClientRect();
    
    const itemWidthPx = containerRect.width * (freestyleSize / 100);
    const ID_CARD_ASPECT_RATIO = 85.6 / 53.98;
    const itemHeightPx = itemWidthPx / ID_CARD_ASPECT_RATIO;

    let newX = clientX - containerRect.left - draggedItem.offsetX;
    let newY = clientY - containerRect.top - draggedItem.offsetY;

    // Constrain movement within the container
    newX = Math.max(0, Math.min(newX, containerRect.width - itemWidthPx));
    newY = Math.max(0, Math.min(newY, containerRect.height - itemHeightPx));

    const newXPercent = (newX / containerRect.width) * 100;
    const newYPercent = (newY / containerRect.height) * 100;

    setFreestylePositions(prev => ({
        ...prev,
        [draggedItem.item]: { x: newXPercent, y: newYPercent }
    }));
  }, [draggedItem, freestyleSize]);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
  }, []);

  useEffect(() => {
    if (draggedItem) {
        window.addEventListener('mousemove', handleDragMove);
        window.addEventListener('touchmove', handleDragMove, { passive: false });
        window.addEventListener('mouseup', handleDragEnd);
        window.addEventListener('touchend', handleDragEnd);
        
        return () => {
            window.removeEventListener('mousemove', handleDragMove);
            window.removeEventListener('touchmove', handleDragMove);
            window.removeEventListener('mouseup', handleDragEnd);
            window.removeEventListener('touchend', handleDragEnd);
        };
    }
  }, [draggedItem, handleDragMove, handleDragEnd]);

  function centerAspectCrop(
    mediaWidth: number,
    mediaHeight: number,
    aspect: number | undefined,
  ) {
    return centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90,
        },
        aspect || 1,
        mediaWidth,
        mediaHeight,
      ),
      mediaWidth,
      mediaHeight,
    )
  }

  const onImageLoadForCrop = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, aspect));
  };
  
  const handleApplyCrop = async () => {
    const image = cropImgRef.current;
    if (!image || !completedCrop) {
        toast({ title: "Crop Error", description: "Cannot apply crop.", variant: 'destructive' });
        return;
    }

    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = completedCrop.width * scaleX;
    canvas.height = completedCrop.height * scaleY;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const dataUrl = canvas.toDataURL('image/jpeg');
    const side = croppingImageSide;
    const originalFile = side === 'front' ? frontImage : backImage;
    const croppedFile = dataURLtoFile(dataUrl, `cropped-${originalFile?.name || 'image.jpg'}`);

    if (side === 'front') {
        setFrontImage(croppedFile);
        setFrontImageUrl(dataUrl);
    } else if (side === 'back') {
        setBackImage(croppedFile);
        setBackImageUrl(dataUrl);
    }

    setIsCropDialogOpen(false);
    toast({ title: 'Crop Applied' });
  };


  const createPdf = async (): Promise<jsPDF | null> => {
    const isTemplateMode = mode === 'template' || mode === 'freestyle';
    if (isTemplateMode && (!frontImage || !frontImageUrl)) {
        toast({ title: 'Front Image Missing', description: 'Please upload the front side of the ID card.', variant: 'destructive' });
        return null;
    }
    if (mode === 'multiple' && multipleCards.length === 0) {
        toast({ title: 'No Images', description: 'Please add one or more card images.', variant: 'destructive' });
        return null;
    }

    const { default: jsPDF } = await import('jspdf');
    const pdf = new jsPDF('portrait', 'mm', 'a4');
    const a4Width = 210;
    const a4Height = 297;
    const ID_CARD_ASPECT_RATIO = 85.6 / 53.98;

    const loadImage = (src: string) => {
        return new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new window.Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = (err) => reject(err);
            img.src = src;
        });
    };

    try {
        if (mode === 'multiple') {
            const cols = multiGridCols;
            const margin = 5; // mm
            const gutter = 3; // mm
            const imgWidthOnPdf = (a4Width - (margin * 2) - (gutter * (cols - 1))) / cols;
            const imgHeightOnPdf = imgWidthOnPdf / ID_CARD_ASPECT_RATIO;
            
            let currentX = margin;
            let currentY = margin;

            for (const card of multipleCards) {
                const img = await loadImage(card.dataUrl);
                if (currentX + imgWidthOnPdf > a4Width - margin) {
                    currentX = margin;
                    currentY += imgHeightOnPdf + gutter;
                }
                
                if(currentY + imgHeightOnPdf > a4Height - margin) {
                    toast({title: "Layout Limit", description: "Not all images fit on one page.", variant: "secondary"});
                    break;
                }

                pdf.addImage(img, 'JPEG', currentX, currentY, imgWidthOnPdf, imgHeightOnPdf);
                currentX += imgWidthOnPdf + gutter;
            }

        } else if (mode === 'template') {
            const template = templates.find(t => t.value === selectedTemplate) || templates[0];
            for (const pos of template.positions) {
                const imageUrl = pos.side === 'front' ? frontImageUrl : backImageUrl;
                if (imageUrl) {
                    const img = await loadImage(imageUrl);
                    const xPos = (parseFloat(pos.left) / 100) * a4Width;
                    const yPos = (parseFloat(pos.top) / 100) * a4Height;
                    const imgWidthOnPdf = (parseFloat(pos.width) / 100) * a4Width;
                    const imgHeightOnPdf = imgWidthOnPdf / ID_CARD_ASPECT_RATIO;
                    pdf.addImage(img, 'JPEG', xPos, yPos, imgWidthOnPdf, imgHeightOnPdf);
                }
            }
        } else { // freestyle mode
            const imgWidthOnPdf = (freestyleSize / 100) * a4Width;
            const imgHeightOnPdf = imgWidthOnPdf / ID_CARD_ASPECT_RATIO;

            if (frontImageUrl) {
                const img = await loadImage(frontImageUrl);
                const xPos = (freestylePositions.front.x / 100) * a4Width;
                const yPos = (freestylePositions.front.y / 100) * a4Height;
                pdf.addImage(img, 'JPEG', xPos, yPos, imgWidthOnPdf, imgHeightOnPdf);
            }
            if (backImageUrl) {
                const img = await loadImage(backImageUrl);
                const xPos = (freestylePositions.back.x / 100) * a4Width;
                const yPos = (freestylePositions.back.y / 100) * a4Height;
                pdf.addImage(img, 'JPEG', xPos, yPos, imgWidthOnPdf, imgHeightOnPdf);
            }
        }
        return pdf;
    } catch (err) {
        console.error("PDF generation error:", err);
        toast({ title: "PDF Generation Failed", description: "There was an error loading the images for the PDF. This can happen with some image formats or if the image host prevents access.", variant: "destructive" });
        return null;
    }
  };

  const handleDownload = async () => {
    if (!downloadFilename) {
        toast({ title: 'Filename Required', description: 'Please enter a valid filename.', variant: 'destructive' });
        return;
    }

    setIsGenerating(true);
    setIsDownloadDialogOpen(false);
    const pdf = await createPdf();
    if (pdf) {
        pdf.save(downloadFilename.endsWith('.pdf') ? downloadFilename : `${downloadFilename}.pdf`);
        toast({ title: 'PDF Generated', description: 'Your A4 PDF has been downloaded.' });
    }
    setIsGenerating(false);
  };

  const handlePrint = async () => {
    setIsGenerating(true);
    const pdf = await createPdf();
    if (pdf) {
        try {
            const pdfDataUri = pdf.output('datauristring');
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = 'none';
            iframe.src = pdfDataUri;
            document.body.appendChild(iframe);

            iframe.onload = () => {
                try {
                    iframe.contentWindow?.focus();
                    iframe.contentWindow?.print();
                } catch (e) {
                    toast({
                        title: 'Print Failed',
                        description: 'Could not open print dialog.',
                        variant: 'destructive',
                    });
                } finally {
                    setTimeout(() => {
                        if (document.body.contains(iframe)) {
                            document.body.removeChild(iframe);
                        }
                    }, 1000);
                }
            };
            toast({ title: 'Opening Print Dialog', description: 'Preparing your document for printing.' });
        } catch (e) {
            console.error("Printing failed", e);
            toast({
                title: 'Print Failed',
                description: 'An error occurred while preparing the document for printing.',
                variant: 'destructive',
            });
        }
    }
    setIsGenerating(false);
  };

  const handlePreview = async () => {
    setIsGenerating(true);
    setPdfPreviewUrl(null);
    const pdf = await createPdf();
    if (pdf) {
      setPdfPreviewUrl(pdf.output('datauristring'));
      setIsPreviewDialogOpen(true);
    }
    setIsGenerating(false);
  };

  const activeTemplate = templates.find(t => t.value === selectedTemplate) || templates[0];
  const A4_ASPECT_RATIO = 210 / 297; // width / height for portrait
  const ID_CARD_ASPECT_RATIO = 85.6 / 53.98;

  const isGenerateDisabled = (mode === 'template' || mode === 'freestyle')
    ? !frontImage
    : multipleCards.length === 0;
  

  return (
    <>
    <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          const side = e.currentTarget.getAttribute('data-side') as 'front' | 'back' | null;
          if (side) handleFileInputChange(e, side);
        }}
    />
    <input
        type="file"
        ref={multiFileInputRef}
        className="hidden"
        accept="image/*"
        multiple
        onChange={(e) => {
            if(e.target.files) handleMultipleFileSelect(Array.from(e.target.files));
        }}
    />
      <div className="space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-2xl font-headline">
              <Copy className="mr-2 h-6 w-6 text-primary" /> ID Card Copier
            </CardTitle>
            <CardDescription>
              Upload the front and back of your ID card, or multiple individual cards, and generate a PDF for printing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            <ToggleGroup type="single" value={mode} onValueChange={(value) => { if(value) setMode(value as any)}} className="justify-start">
              <ToggleGroupItem value="template" aria-label="Template Mode">Template</ToggleGroupItem>
              <ToggleGroupItem value="multiple" aria-label="Multiple Cards Mode">Multiple Cards</ToggleGroupItem>
              <ToggleGroupItem value="freestyle" aria-label="Freestyle Mode">Freestyle</ToggleGroupItem>
            </ToggleGroup>
            
            {mode === 'template' || mode === 'freestyle' ? (
                <>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="flex gap-2">
                           <Button variant="outline" className="flex-1" onClick={() => handleUploadButtonClick('front')}><UploadCloud className="mr-2 h-4 w-4" /> Front</Button>
                           <Button variant="outline" className="flex-1" onClick={() => { setSelectionTarget('front'); setIsQueueDialogOpen(true); }}><Library className="mr-2 h-4 w-4" /> Queue</Button>
                           <Button variant="outline" size="icon" disabled={!frontImage} onClick={() => { setCroppingImageSide('front'); setIsCropDialogOpen(true); }}><CropIcon className="h-4 w-4"/></Button>
                        </div>
                        <div className="flex gap-2">
                           <Button variant="outline" className="flex-1" onClick={() => handleUploadButtonClick('back')}><UploadCloud className="mr-2 h-4 w-4" /> Back</Button>
                           <Button variant="outline" className="flex-1" onClick={() => { setSelectionTarget('back'); setIsQueueDialogOpen(true); }}><Library className="mr-2 h-4 w-4" /> Queue</Button>
                           <Button variant="outline" size="icon" disabled={!backImage} onClick={() => { setCroppingImageSide('back'); setIsCropDialogOpen(true); }}><CropIcon className="h-4 w-4"/></Button>
                        </div>
                    </div>
                     <div className="flex flex-wrap items-center gap-4">
                        <div className="flex-grow space-y-2">
                            <Label htmlFor="layout-template">Layout Template</Label>
                            <Select value={selectedTemplate} onValueChange={(value) => setSelectedTemplate(value)} disabled={mode !== 'template'}>
                                <SelectTrigger id="layout-template" className="w-full md:w-[250px]">
                                    <SelectValue placeholder="Select a template" />
                                </SelectTrigger>
                                <SelectContent>
                                    {templates.map((template) => (
                                    <SelectItem key={template.value} value={template.value}>
                                        {template.label}
                                    </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </>
            ) : ( // Multiple Mode
                <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-6">
                         <Button variant="outline" className="w-full" onClick={() => multiFileInputRef.current?.click()}>
                            <UploadCloud className="mr-2 h-4 w-4" /> Upload Multiple Images
                        </Button>
                        <Button variant="outline" className="w-full" onClick={() => { setSelectionTarget('multiple'); setSelectedQueueDocs(new Set()); setIsQueueDialogOpen(true); }}>
                            <Library className="mr-2 h-4 w-4" /> Select Multiple from Queue
                        </Button>
                    </div>
                </div>
            )}
            
             {mode === 'freestyle' && (
              <Card className="p-4 shadow-inner bg-muted/50">
                <CardTitle className="text-lg mb-2">Freestyle Controls</CardTitle>
                <div className="space-y-2">
                    <Label htmlFor="freestyle-size">Card Size ({freestyleSize}%)</Label>
                    <div className="flex items-center gap-2">
                        <Expand className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <Slider
                            id="freestyle-size"
                            min={10}
                            max={80}
                            step={1}
                            value={[freestyleSize]}
                            onValueChange={(value) => setFreestyleSize(value[0])}
                        />
                    </div>
                </div>
              </Card>
            )}
            {mode === 'multiple' && (
                 <Card className="p-4 shadow-inner bg-muted/50">
                    <CardTitle className="text-lg mb-2">Multiple Card Controls</CardTitle>
                     <div className="space-y-2">
                        <Label htmlFor="grid-cols-slider">Grid Columns ({multiGridCols})</Label>
                        <div className="flex items-center gap-2">
                            <Columns className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                            <Slider
                                id="grid-cols-slider"
                                min={2} max={4} step={1}
                                value={[multiGridCols]}
                                onValueChange={(value) => setMultiGridCols(value[0])}
                            />
                        </div>
                    </div>
                 </Card>
            )}

            <div>
              <Label className="text-lg">A4 Preview</Label>
              <Card className="mt-1 overflow-hidden shadow-inner">
                <CardContent className="p-2 bg-gray-100 dark:bg-gray-800">
                  <div 
                    ref={previewRef}
                    className="mx-auto bg-white shadow-md relative" 
                    style={{ 
                      width: '100%', 
                      maxWidth: '420px', // Max width for preview container
                      aspectRatio: `${A4_ASPECT_RATIO}`,
                      border: '1px solid #ccc',
                      overflow: 'hidden' // Important for drag bounds
                    }}
                    aria-label="A4 paper preview"
                  >
                    {mode === 'template' && (
                      activeTemplate.positions.map((pos, index) => {
                        const imageUrl = pos.side === 'front' ? frontImageUrl : backImageUrl;
                        const placeholderText = pos.side === 'front' ? 'Front' : 'Back';
                        const showPlaceholder = !imageUrl && (pos.side === 'front' || (pos.side === 'back' && frontImageUrl));
                        
                        return (
                            <div 
                                key={index} 
                                className="absolute"
                                style={{ top: pos.top, left: pos.left, width: pos.width, height: 'auto', aspectRatio: `${ID_CARD_ASPECT_RATIO}` }}
                            >
                                {imageUrl ? (
                                    <Image src={imageUrl} alt={`ID ${pos.side} preview ${index}`} fill className="object-contain border border-dashed border-primary/50 rounded" data-ai-hint="id card"/>
                                ) : showPlaceholder ? (
                                    <div className="w-full h-full bg-muted/50 border border-dashed border-muted-foreground rounded flex items-center justify-center text-xs text-muted-foreground">
                                        {placeholderText}
                                    </div>
                                ) : null}
                            </div>
                        );
                      })
                    )}
                    
                    {mode === 'multiple' && (
                        <div className={cn("grid w-full h-full gap-2 p-2",
                            multiGridCols === 2 && "grid-cols-2",
                            multiGridCols === 3 && "grid-cols-3",
                            multiGridCols === 4 && "grid-cols-4",
                        )}>
                            {multipleCards.map(card => (
                                <div key={card.id} className="relative group bg-muted/30 border border-dashed rounded-sm">
                                    <Image src={card.dataUrl} alt={card.file.name} fill className="object-contain p-1" data-ai-hint="id card" />
                                    <Button
                                        variant="destructive" size="icon"
                                        className="absolute -top-2 -right-2 h-5 w-5 rounded-full z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => setMultipleCards(prev => prev.filter(c => c.id !== card.id))}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}

                    {mode === 'freestyle' && (
                       <>
                          {frontImageUrl && (
                              <div
                                  onMouseDown={(e) => handleDragStart(e, 'front')}
                                  onTouchStart={(e) => handleDragStart(e, 'front')}
                                  className={cn("absolute touch-none", "cursor-move")}
                                  style={{
                                      left: `${freestylePositions.front.x}%`,
                                      top: `${freestylePositions.front.y}%`,
                                      width: `${freestyleSize}%`,
                                      aspectRatio: `${ID_CARD_ASPECT_RATIO}`
                                  }}
                              >
                                  <Image src={frontImageUrl} alt="Draggable ID Front" layout="fill" objectFit="contain" className="border-2 border-blue-500 rounded shadow-lg pointer-events-none" data-ai-hint="id card"/>
                              </div>
                          )}
                           {backImageUrl && (
                              <div
                                  onMouseDown={(e) => handleDragStart(e, 'back')}
                                  onTouchStart={(e) => handleDragStart(e, 'back')}
                                  className={cn("absolute touch-none", "cursor-move")}
                                  style={{
                                      left: `${freestylePositions.back.x}%`,
                                      top: `${freestylePositions.back.y}%`,
                                      width: `${freestyleSize}%`,
                                      aspectRatio: `${ID_CARD_ASPECT_RATIO}`
                                  }}
                              >
                                  <Image src={backImageUrl} alt="Draggable ID Back" layout="fill" objectFit="contain" className="border-2 border-green-500 rounded shadow-lg pointer-events-none" data-ai-hint="id card"/>
                              </div>
                          )}
                          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-background/80 px-2 py-1 rounded text-xs text-muted-foreground shadow-lg pointer-events-none">
                              <p>Free Style Mode: Drag images to position them.</p>
                          </div>
                       </>
                    )}
                     <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">A4 Page Simulation</p>
                  </div>
                </CardContent>
              </Card>
               <p className="text-sm text-muted-foreground mt-1">
                This is a simplified visual representation. The actual output will be optimized for A4.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            <Button onClick={() => setIsDownloadDialogOpen(true)} disabled={isGenerateDisabled || isGenerating} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {isGenerating ? 'Processing...' : 'Generate PDF'}
            </Button>
            <Button onClick={handlePrint} disabled={isGenerateDisabled || isGenerating} variant="outline">
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
              Print
            </Button>
            <Button onClick={handlePreview} disabled={isGenerateDisabled || isGenerating} variant="outline">
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
              Preview PDF
            </Button>
            <Button variant="outline" onClick={handleReset} disabled={isGenerating}>
              <RefreshCw className="mr-2 h-4 w-4" /> Reset
            </Button>
          </CardFooter>
        </Card>
      </div>

    <Dialog open={isQueueDialogOpen} onOpenChange={setIsQueueDialogOpen}>
        <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
                <DialogTitle>Select Image from Queue</DialogTitle>
                <DialogDescription>
                    Choose an image from your document queue to use.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <ScrollArea className="h-96 pr-4">
                    {imageDocuments.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {imageDocuments.map(doc => {
                                let isSelected = false;
                                if (selectionTarget === 'multiple') {
                                    isSelected = selectedQueueDocs.has(doc.id);
                                } else {
                                    const imgName = selectionTarget === 'front' ? frontImage?.name : backImage?.name;
                                    isSelected = imgName === doc.name;
                                }

                                return (
                                    <div
                                        key={doc.id}
                                        className="relative group cursor-pointer"
                                        onClick={() => {
                                            if (selectionTarget === 'multiple') {
                                                setSelectedQueueDocs(prev => {
                                                    const newSet = new Set(prev);
                                                    if(newSet.has(doc.id)) newSet.delete(doc.id);
                                                    else newSet.add(doc.id);
                                                    return newSet;
                                                });
                                            } else {
                                                setSelectedQueueDocs(new Set([doc.id]));
                                            }
                                        }}
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
            <DialogFooter>
                <Button onClick={handleSelectFromQueue} disabled={selectedQueueDocs.size === 0}>
                    <PlusCircle className="mr-2 h-4 w-4"/> Add {selectedQueueDocs.size} selected
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="sm:max-w-4xl h-[90vh]">
          <DialogHeader>
            <DialogTitle>PDF Preview</DialogTitle>
            <DialogDescription>
              This is a preview of the generated A4 document.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-grow min-h-0 py-4">
            {isGenerating && !pdfPreviewUrl ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="ml-4">Generating preview...</p>
              </div>
            ) : pdfPreviewUrl ? (
              <embed src={pdfPreviewUrl} type="application/pdf" className="w-full h-full" />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p>Could not generate preview.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isCropDialogOpen} onOpenChange={setIsCropDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crop Image</DialogTitle>
            <DialogDescription>Adjust the selection to crop your image. The aspect ratio is locked for ID cards.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
             <ReactCrop
                crop={crop}
                onChange={c => setCrop(c)}
                onComplete={c => setCompletedCrop(c)}
                aspect={aspect}
                className="max-h-[70vh]"
            >
                <Image
                    ref={cropImgRef}
                    alt="Image to crop"
                    src={croppingImageSide === 'front' ? frontImageUrl! : backImageUrl!}
                    onLoad={onImageLoadForCrop}
                    width={800}
                    height={600}
                />
            </ReactCrop>
          </div>
          <DialogFooter>
             <Button variant="outline" onClick={() => setIsCropDialogOpen(false)}>Cancel</Button>
             <Button onClick={handleApplyCrop} disabled={!completedCrop?.width}>Apply Crop</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
       <Dialog open={isDownloadDialogOpen} onOpenChange={setIsDownloadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Name Your PDF File</DialogTitle>
            <DialogDescription>
              Enter a name for your PDF file before downloading. The .pdf extension will be added automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="filename">Filename</Label>
            <Input 
              id="filename" 
              value={downloadFilename}
              onChange={(e) => setDownloadFilename(e.target.value)}
              placeholder="e.g., id-cards.pdf"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDownloadDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleDownload} disabled={isGenerating}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
