"use client";

import { useState, useEffect, useRef } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { 
  FileText, 
  ImageIcon, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  GripVertical,
  Maximize2,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';

// Configure PDF.js worker
if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
}

interface DocumentPreviewProps {
  file?: File | null;
  files?: File[];
  mode: 'pages' | 'files' | 'single';
  selectedIndices?: number[];
  onSelectionChange?: (indices: number[]) => void;
  onReorder?: (files: File[]) => void;
  className?: string;
}

const EMPTY_FILES: File[] = [];
const EMPTY_INDICES: number[] = [];

export function DocumentPreview({
  file,
  files = EMPTY_FILES,
  mode,
  selectedIndices = EMPTY_INDICES,
  onSelectionChange,
  onReorder,
  className
}: DocumentPreviewProps) {
  const [thumbnails, setThumbnails] = useState<(string | null)[]>([]);
  const [loading, setLoading] = useState(false);
  const [fullscreenPreview, setFullscreenPreview] = useState<string | null>(null);
  const [totalProgress, setTotalProgress] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [pageCounts, setPageCounts] = useState<Record<number, number>>({});
  const [currentFilePages, setCurrentFilePages] = useState<Record<number, number>>({});

  useEffect(() => {
    // Abort previous rendering tasks
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    if (mode === 'pages' && file) {
      renderPdfPages(file, abortControllerRef.current.signal);
    } else if (mode === 'files' && files.length > 0) {
      renderFiles(files, abortControllerRef.current.signal);
    } else if (mode === 'single' && file) {
      renderFiles([file], abortControllerRef.current.signal);
    }

    return () => {
       if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [file, files, mode]);

  // Memory Cleanup - Revoke Blob URLs when thumbnails change or component unmounts
  useEffect(() => {
    return () => {
      thumbnails.forEach(t => {
        if (t?.startsWith('blob:')) URL.revokeObjectURL(t);
      });
    };
  }, []);

  const renderPdfPages = async (pdfFile: File, signal: AbortSignal) => {
    setLoading(true);
    setTotalProgress(0);

    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;
      
      // Store total pages for reference, but only pre-render the first page
      setThumbnails(new Array(numPages).fill(null));
      setPageCounts(prev => ({ ...prev, [0]: numPages })); 
      setLoading(false);

      if (numPages > 0) {
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.5 }); 
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (context) {
          await page.render({ canvasContext: context, viewport, intent: 'display' }).promise;
          const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.85));
          if (blob) {
            const blobUrl = URL.createObjectURL(blob);
            setThumbnails(prev => {
              const next = [...prev];
              next[0] = blobUrl;
              return next;
            });
          }
          setTotalProgress(100);
          canvas.width = 0; canvas.height = 0;
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Error rendering PDF cover:', err);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  };

  const [inspectingPage, setInspectingPage] = useState<number | null>(null);
  const [inspectingSubPage, setInspectingSubPage] = useState(1);
  const [highResLoading, setHighResLoading] = useState(false);

  const handleInspect = async (idx: number, subPage: number = 1) => {
    // Determine the source file based on the preview mode
    const sourceFile = mode === 'pages' || mode === 'single' ? file : files[idx];
    if (!sourceFile) return;

    setInspectingPage(idx);
    setInspectingSubPage(subPage);
    setHighResLoading(true);
    setFullscreenPreview(null);

    try {
      if (sourceFile.type === 'application/pdf') {
        const arrayBuffer = await sourceFile.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdf.numPages;
        setPageCounts(prev => ({ ...prev, [idx]: totalPages }));

        const pageNumber = mode === 'pages' ? idx + 1 : subPage;
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        if (context) {
          await page.render({ canvasContext: context, viewport }).promise;
          // For fullscreen, PNG is best for quality but consider WebP if extremely large
          setFullscreenPreview(canvas.toDataURL('image/png'));
          canvas.width = 0; canvas.height = 0;
        }
      } else if (sourceFile.type.startsWith('image/')) {
        setFullscreenPreview(URL.createObjectURL(sourceFile));
      }
    } catch (err) {
      console.error('High-res render failed:', err);
    } finally {
      setHighResLoading(false);
    }
  };
  const handleSpecificPageRender = async (fileIndex: number, pageNumber: number) => {
    const f = files[fileIndex];
    if (!f || f.type !== 'application/pdf') return;

    try {
      const arrayBuffer = await f.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 0.5 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      if (context) {
        await page.render({ canvasContext: context, viewport }).promise;
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.85));
        if (blob) {
           const blobUrl = URL.createObjectURL(blob);
           setThumbnails(prev => {
             const next = [...prev];
             // Revoke old blob to prevent memory leak
             const old = next[fileIndex];
             if (old?.startsWith('blob:')) URL.revokeObjectURL(old);
             next[fileIndex] = blobUrl;
             return next;
           });
        }
        canvas.width = 0; canvas.height = 0;
      }
    } catch (err) {
      console.error('Failed to render preview page:', err);
    }
  };

  const renderFiles = async (fileList: File[], signal: AbortSignal) => {
    setLoading(true);
    setThumbnails(new Array(fileList.length).fill(null));
    
    try {
      for (let i = 0; i < fileList.length; i++) {
        if (signal.aborted) break;
        const f = fileList[i];
        
        let thumbUrl = '';
        if (f.type === 'application/pdf') {
          const arrayBuffer = await f.arrayBuffer();
          const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
          const totalPages = pdf.numPages;
          setPageCounts(prev => ({ ...prev, [i]: totalPages }));
          setCurrentFilePages(prev => ({ ...prev, [i]: 1 }));

          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 0.5 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          if (context) {
            await page.render({ canvasContext: context, viewport }).promise;
            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.85));
            if (blob) thumbUrl = URL.createObjectURL(blob);
            canvas.width = 0; canvas.height = 0;
          }
        } else if (f.type.startsWith('image/')) {
          thumbUrl = URL.createObjectURL(f);
          setPageCounts(prev => ({ ...prev, [i]: 1 }));
          setCurrentFilePages(prev => ({ ...prev, [i]: 1 }));
        }

        setThumbnails(prev => {
          const next = [...prev];
          next[i] = thumbUrl;
          return next;
        });
        
        // Yield to main thread
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Error rendering files:', err);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  };

  const toggleSelection = (index: number) => {
    if (!onSelectionChange) return;
    const newSelection = selectedIndices.includes(index)
      ? selectedIndices.filter(i => i !== index)
      : [...selectedIndices, index].sort((a, b) => a - b);
    onSelectionChange(newSelection);
  };

  // Removed general loading check to allow placeholders
  
  return (
    <div className={cn("w-full space-y-4", className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex flex-col">
           <h3 className="text-sm font-black uppercase tracking-widest text-foreground/70">
            {mode === 'pages' ? `Structure Interface (${thumbnails.length} Nodes)` : 'Atomic File Preview'}
          </h3>
          {totalProgress > 0 && totalProgress < 100 && (
            <p className="text-[10px] font-bold text-primary animate-pulse uppercase tracking-tight">Syncing Content... {totalProgress}%</p>
          )}
        </div>
        {mode === 'pages' && onSelectionChange && (
          <div className="flex gap-2">
             <Button variant="outline" size="sm" className="text-[10px] h-7 px-3 rounded-full border-primary/20 hover:bg-primary/10" onClick={() => onSelectionChange(Array.from({length: thumbnails.length}, (_, i) => i))}>Select All</Button>
             <Button variant="outline" size="sm" className="text-[10px] h-7 px-3 rounded-full border-primary/20 hover:bg-primary/10" onClick={() => onSelectionChange([])}>Clear</Button>
          </div>
        )}
      </div>

      <ScrollArea className="h-[450px] w-full rounded-3xl border-2 border-primary/5 bg-muted/20 p-6 shadow-2xl backdrop-blur-sm">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          <AnimatePresence mode="popLayout">
            {thumbnails.map((thumb, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "group relative cursor-pointer rounded-2xl overflow-hidden border-2 transition-all duration-500 shadow-md hover:shadow-2xl hover:-translate-y-2 bg-card",
                  mode === 'pages' && selectedIndices.includes(idx) 
                    ? "border-primary ring-8 ring-primary/5" 
                    : "border-primary/5 hover:border-primary/30"
                )}
                onClick={() => mode === 'pages' && toggleSelection(idx)}
              >
                {/* Selection Checkbox */}
                {mode === 'pages' && (
                  <div className={cn(
                    "absolute top-3 right-3 z-20 p-1.5 rounded-full transition-all duration-500 shadow-lg",
                    selectedIndices.includes(idx) 
                      ? "bg-primary text-white scale-110 rotate-0" 
                      : "bg-black/20 text-white/50 opacity-0 group-hover:opacity-100 -rotate-12"
                  )}>
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                )}

                {/* Index Ribbon */}
                <div className="absolute bottom-3 left-3 z-20 px-3 py-1 rounded-xl bg-black/60 backdrop-blur-lg text-[10px] text-white font-black tracking-tighter border border-white/10 shadow-lg flex items-center gap-2">
                  {mode === 'pages' ? `PAGE ${idx + 1}` : (files[idx]?.name.split('.')[0] || 'SOURCE')}
                </div>

                {/* Content Visualizer */}
                <div className="aspect-[3/4] overflow-hidden relative flex items-center justify-center bg-muted/10">
                  {thumb ? (
                    <motion.img 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      src={thumb} 
                      alt={`Node ${idx}`} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-muted/50 to-muted animate-pulse">
                       <FileText className="h-12 w-12 text-primary/20" />
                       <div className="h-1.5 w-16 bg-primary/10 rounded-full" />
                    </div>
                  )}

                  {/* Hover Actions */}
                  {thumb && (
                    <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                       <Button 
                         variant="secondary" 
                         size="sm" 
                         className="rounded-full shadow-2xl bg-white/90 text-primary font-bold hover:scale-110 transition-transform"
                         onClick={(e) => {
                           e.stopPropagation();
                           handleInspect(idx);
                         }}
                       >
                         <Maximize2 className="h-4 w-4 mr-2" /> Inspect
                       </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* Fullscreen Preview Modal */}
      <AnimatePresence>
        {(fullscreenPreview || inspectingPage !== null) && (
          <motion.div 
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-8 lg:p-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setFullscreenPreview(null); setInspectingPage(null); }}
          >
            <Button 
              variant="outline" 
              size="icon" 
              className="absolute top-8 right-8 rounded-full bg-white/10 border-white/20 text-white hover:bg-white/20 z-[110]"
              onClick={() => { setFullscreenPreview(null); setInspectingPage(null); }}
            >
              <X className="h-6 w-6" />
            </Button>

            {highResLoading ? (
              <div className="flex flex-col items-center gap-6 text-white/70">
                <div className="relative h-20 w-20">
                    <div className="absolute inset-0 rounded-full border-4 border-white/10" />
                    <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                </div>
                <p className="text-xl font-headline tracking-widest animate-pulse">OPTIMIZING FIDELITY...</p>
              </div>
            ) : (
              <motion.img 
                src={fullscreenPreview || ''} 
                className="max-w-full max-h-full rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/10 object-contain"
                initial={{ scale: 0.85, opacity: 0, rotateY: 15 }}
                animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                exit={{ scale: 0.85, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              />
            )}
            
            {/* Status Indicator & Modal Navigation */}
            {!highResLoading && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 w-full px-8">
                {inspectingPage !== null && (mode === 'files' || mode === 'single') && pageCounts[inspectingPage] > 1 && (
                  <div className="flex items-center gap-6 bg-black/40 backdrop-blur-2xl border border-white/10 p-2 rounded-full shadow-2xl">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={inspectingSubPage <= 1}
                      className="text-white hover:bg-white/10 rounded-full h-12 w-12"
                      onClick={(e) => { e.stopPropagation(); handleInspect(inspectingPage, inspectingSubPage - 1); }}
                    >
                      <ChevronLeft className="h-8 w-8" />
                    </Button>
                    
                    <div className="flex flex-col items-center min-w-[120px]">
                      <span className="text-white font-black text-lg tracking-tighter">PAGE {inspectingSubPage}</span>
                      <span className="text-white/40 text-[10px] uppercase font-bold tracking-widest">OF {pageCounts[inspectingPage]} PAGES</span>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={inspectingSubPage >= pageCounts[inspectingPage]}
                      className="text-white hover:bg-white/10 rounded-full h-12 w-12"
                      onClick={(e) => { e.stopPropagation(); handleInspect(inspectingPage, inspectingSubPage + 1); }}
                    >
                      <ChevronRight className="h-8 w-8" />
                    </Button>
                  </div>
                )}
                
                <div className="px-6 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl text-white/50 text-[10px] font-black uppercase tracking-widest">
                  Nodes Inspect Mode: High-Fidelity {mode === 'pages' ? 'Page-Level' : 'Deep-File'} Render
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
