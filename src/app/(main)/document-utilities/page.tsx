"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Search, 
  Sparkles, 
  Wand2, 
  FileText, 
  XCircle, 
  Loader2, 
  Merge, 
  Scissors, 
  Download,
  Table,
  FileCode,
  Presentation,
  RefreshCcw,
  RotateCw,
  Maximize,
  Compass,
  FileCheck,
  Lock,
  Unlock,
  PenTool,
  Hash,
  Eye,
  Settings,
  ClipboardList,
  Binary,
  Layers,
  FileSpreadsheet,
  Grid,
  FileEdit,
  Eraser,
  HelpCircle,
  FileDown
} from 'lucide-react';

import { UniversalConverterWheel } from '@/components/app/universal-converter-wheel';
import { DocumentToolCard } from '@/components/app/document-tool-card';
import { DOCUMENT_TOOLS, ToolCategory } from '@/lib/tools-data';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useDocumentTool, MetaFields, PageNumberOptions, WatermarkOptions, HeaderFooterOptions } from '@/hooks/use-document-tool';
import { FileUpload } from '@/components/app/file-upload';
import { DocumentPreview } from '@/components/app/document-preview';

// --- UTILS ---
const rangeToIndices = (range: string): number[] => {
  const indices: number[] = [];
  range.split(',').forEach(p => {
    const r = p.trim().split('-');
    if (!r[0]) return;
    const s = parseInt(r[0]) - 1;
    const e = r[1] ? parseInt(r[1]) - 1 : s;
    for (let i = s; i <= e; i++) {
      if (!isNaN(i)) indices.push(i);
    }
  });
  return Array.from(new Set(indices)).sort((a, b) => a - b);
};

const indicesToRange = (indices: number[]): string => {
  if (indices.length === 0) return '';
  const sorted = [...indices].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let i = 1; i <= sorted.length; i++) {
    if (i < sorted.length && sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `${start + 1}` : `${start + 1}-${end + 1}`);
      if (i < sorted.length) {
        start = sorted[i];
        end = sorted[i];
      }
    }
  }
  return ranges.join(', ');
};

// Signature Pad Component
const SignaturePad = ({ onSave }: { onSave: (dataUrl: string) => void }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000000';
    
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL('image/png'));
  };

  return (
    <div className="space-y-4">
      <canvas 
        ref={canvasRef}
        width={400}
        height={200}
        className="border border-primary/20 rounded-xl bg-white cursor-crosshair max-w-full touch-none"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={clear}>Clear Drawing</Button>
        <Button type="button" size="sm" onClick={save}>Confirm Signature</Button>
      </div>
    </div>
  );
};

export default function DocumentUtilitiesPage() {
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom states for the fully implemented tools
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [multipleFiles, setMultipleFiles] = useState<File[]>([]);
  const [pagesRange, setPagesRange] = useState('1');
  const [rotationAngle, setRotationAngle] = useState<0 | 90 | 180 | 270>(90);
  const [pageSizePreset, setPageSizePreset] = useState('a4');
  const [customWidth, setCustomWidth] = useState(595);
  const [customHeight, setCustomHeight] = useState(842);
  
  // Watermark, header/footer, page numbers
  const [pageNumberPos, setPageNumberPos] = useState<'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center'>('bottom-center');
  const [pageNumberStart, setPageNumberStart] = useState(1);
  const [pageNumberPrefix, setPageNumberPrefix] = useState('');
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.3);
  const [watermarkRotation, setWatermarkRotation] = useState(45);
  const [watermarkFontSize, setWatermarkFontSize] = useState(50);
  const [watermarkColor, setWatermarkColor] = useState('#ff0000');
  const [headerText, setHeaderText] = useState('');
  const [footerText, setFooterText] = useState('');
  const [headerFooterSize, setHeaderFooterSize] = useState(10);
  
  // Security
  const [pdfPassword, setPdfPassword] = useState('');
  const [pdfOwnerPassword, setPdfOwnerPassword] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [signaturePage, setSignaturePage] = useState(0);
  const [signatureX, setSignatureX] = useState(100);
  const [signatureY, setSignatureY] = useState(100);
  const [signatureW, setSignatureW] = useState(150);
  const [signatureH, setSignatureH] = useState(60);
  
  const [redactPage, setRedactPage] = useState(0);
  const [redactX, setRedactX] = useState(100);
  const [redactY, setRedactY] = useState(100);
  const [redactW, setRedactW] = useState(150);
  const [redactH, setRedactH] = useState(50);

  // Advanced & Results
  const [compareFileA, setCompareFileA] = useState<File | null>(null);
  const [compareFileB, setCompareFileB] = useState<File | null>(null);
  const [compareResult, setCompareResult] = useState<{added: string[]; removed: string[]; common: number} | null>(null);
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [metaFields, setMetaFields] = useState<MetaFields>({ title: '', author: '', subject: '', keywords: '', creator: '' });
  const [pivotResult, setPivotResult] = useState<{headers: string[]; rows: string[][]} | null>(null);
  const [excelFormulas, setExcelFormulas] = useState<{sheet:string;cell:string;formula:string}[] | null>(null);

  const categories: ToolCategory[] = [
    'Organize', 
    'Convert to PDF', 
    'Convert from PDF', 
    'Edit & Optimize', 
    'Security', 
    'Advanced', 
    'Office Tools'
  ];

  // URL query parameter routing for SEO landing pages
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const toolParam = params.get('tool') || params.get('activeToolId');
      if (toolParam) {
        setActiveToolId(toolParam);
      }
    }
  }, []);

  const filteredTools = useMemo(() => {
    return DOCUMENT_TOOLS.filter(tool => 
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const activeTool = useMemo(() => 
    DOCUMENT_TOOLS.find(t => t.id === activeToolId), 
    [activeToolId]
  );

  const handleToolSelect = (id: string) => {
    setActiveToolId(id);
    setSingleFile(null);
    setMultipleFiles([]);
    setCompareFileA(null);
    setCompareFileB(null);
    setCompareResult(null);
    setOcrText(null);
    setPivotResult(null);
    setExcelFormulas(null);
    setSignatureDataUrl(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const { 
    isProcessing, 
    processStep, 
    chainConverter, 
    mergePdfs, 
    splitPdf,
    deletePdfPages,
    extractPdfPages,
    rotatePdfPages,
    reorderPdfPages,
    resizePdf,
    compressPdf,
    flattenPdf,
    addPageNumbers,
    addWatermark,
    addHeaderFooter,
    grayscalePdf,
    repairPdf,
    protectPdf,
    unlockPdf,
    redactPdf,
    embedSignatureToPdf,
    editMetadata,
    getMetadata,
    comparePdfs,
    ocrPdf,
    extractToJson,
    excelToCsv,
    csvToExcel,
    mergeExcel,
    splitExcel,
    cleanExcel,
    getExcelFormulas,
    getPivotData,
    mergeWord,
    splitWord,
    addWordWatermark
  } = useDocumentTool();

  // Load metadata if active tool is 'metadata' and file is uploaded
  useEffect(() => {
    const fetchMetadata = async () => {
      if (activeToolId === 'metadata' && singleFile) {
        const meta = await getMetadata(singleFile);
        if (meta) {
          setMetaFields(meta);
        }
      }
    };
    fetchMetadata();
  }, [singleFile, activeToolId]);

  // Handle color conversion from Hex to RGB decimal array [r, g, b]
  const parseHexToRgbDecimal = (hex: string): [number, number, number] => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [isNaN(r) ? 1 : r, isNaN(g) ? 0 : g, isNaN(b) ? 0 : b];
  };

  // --- UNIVERSAL CHAIN RENDERER ---
  const renderChainingTool = (): React.ReactNode => {
    const parts = activeToolId?.split('-to-');
    if (!parts || parts.length < 2) return null;
    const [source, target] = parts;

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => setActiveToolId(null)} className="rounded-full">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <h2 className="text-2xl font-bold flex items-center gap-2 uppercase">
            {source} <RefreshCcw className="h-4 w-4 text-primary animate-spin-slow" /> {target}
          </h2>
        </div>

        <Card className="border-primary/20 shadow-xl overflow-hidden backdrop-blur-md bg-card/60">
          <CardHeader className="text-center border-b bg-muted/20">
            <CardTitle>Universal Star-Chain Engine</CardTitle>
            <CardDescription>Converting via high-fidelity PDF intermediary</CardDescription>
          </CardHeader>
          <CardContent className="p-12 space-y-8">
            <FileUpload 
              label={`Select ${source.toUpperCase()} source file`} 
              onFileSelect={(fs) => setSingleFile(fs[0])} 
              acceptedFileTypes={
                source === 'image' 
                  ? 'image/*,.jpg,.jpeg,.png,.webp,.gif,.svg' 
                  : source === 'word' 
                  ? '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
                  : source === 'excel' 
                  ? '.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
                  : source === 'ppt' 
                  ? '.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation' 
                  : `.${source}`
              } 
            />

            {singleFile && (
              <div className="space-y-6">
                <div className="flex flex-col items-center gap-6 p-10 rounded-3xl bg-primary/5 border-2 border-dashed border-primary/20 text-center shadow-inner">
                   <DocumentPreview file={singleFile} mode="single" className="max-w-md mx-auto" />
                   <div className="space-y-1">
                      <p className="font-black text-2xl tracking-tight line-clamp-1">{singleFile.name}</p>
                      <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] font-bold">Authenticated Source Node</p>
                   </div>
                </div>

                {isProcessing ? (
                  <div className="space-y-4 py-4 animate-pulse">
                     <div className="flex items-center justify-center gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <span className="text-2xl font-black text-primary">{processStep}</span>
                     </div>
                  </div>
                ) : (
                  <Button 
                    className="w-full h-16 text-xl font-black shadow-2xl bg-gradient-to-r from-primary to-blue-600 hover:scale-[1.02] transition-all" 
                    onClick={() => chainConverter(singleFile, target)}
                  >
                    Start Infinity Conversion
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // --- GENERAL FORM SUBMIT HANDLERS ---
  const handleActionClick = async (actionFn: () => Promise<any>) => {
    await actionFn();
  };

  // --- RENDER ACTION OR LOADING BAR ---
  const renderActionSection = (actionName: string, onClick: () => any, disabled = false) => {
    if (isProcessing) {
      return (
        <div className="space-y-4 py-4 animate-pulse">
           <div className="flex items-center justify-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-xl font-bold text-primary">{processStep}</span>
           </div>
        </div>
      );
    }
    return (
      <Button 
        className="w-full h-14 text-lg font-bold shadow-lg bg-gradient-to-r from-primary to-indigo-600" 
        onClick={onClick} 
        disabled={disabled}
      >
        {actionName}
      </Button>
    );
  };

  const renderToolView = (): React.ReactNode => {
    // 1. Organize
    if (activeToolId === 'merge-pdf') {
      return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <FileUpload label="Drop PDFs here to merge" onFileSelect={(fs) => setMultipleFiles(prev => [...prev, ...fs])} acceptedFileTypes="application/pdf" multiple />
          {multipleFiles.length > 0 && (
            <div className="space-y-6">
               <DocumentPreview files={multipleFiles} mode="files" />
               <div className="space-y-3">
                  {multipleFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border group hover:border-primary/20">
                      <span className="text-sm font-bold truncate max-w-[280px]">#{i+1}: {f.name}</span>
                      <XCircle className="h-5 w-5 text-muted-foreground cursor-pointer hover:text-destructive" onClick={() => setMultipleFiles(prev => prev.filter((_, idx) => idx !== i))} />
                    </div>
                  ))}
               </div>
               {renderActionSection("Merge & Download PDF", () => mergePdfs(multipleFiles), multipleFiles.length < 2)}
            </div>
          )}
        </div>
      );
    }

    if (activeToolId === 'split-pdf') {
      return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <FileUpload label="Upload PDF to split" onFileSelect={(fs) => setSingleFile(fs[0])} acceptedFileTypes="application/pdf" />
          {singleFile && (
            <div className="space-y-6">
               <div className="bg-muted/30 p-6 rounded-2xl border space-y-4">
                  <label className="text-sm font-black uppercase tracking-wider text-primary">Page extraction settings</label>
                  <Input value={pagesRange} onChange={(e) => setPagesRange(e.target.value)} placeholder="e.g. 1-3, 5 (comma separated or ranges)" className="h-12 text-lg font-bold" />
                  <p className="text-xs text-muted-foreground italic">Specify which pages to split out (e.g. "1-2, 5") or click pages in the preview.</p>
               </div>
               {renderActionSection("Split & Download PDF", () => splitPdf(singleFile, pagesRange))}
            </div>
          )}
        </div>
      );
    }

    if (activeToolId === 'delete-pages') {
      return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <FileUpload label="Upload PDF" onFileSelect={(fs) => setSingleFile(fs[0])} acceptedFileTypes="application/pdf" />
          {singleFile && (
            <div className="space-y-6">
               <div className="bg-muted/30 p-6 rounded-2xl border space-y-4">
                  <label className="text-sm font-black uppercase tracking-wider text-primary font-bold">Pages to delete</label>
                  <Input value={pagesRange} onChange={(e) => setPagesRange(e.target.value)} placeholder="e.g. 1, 3-5" className="h-12 text-lg font-bold" />
               </div>
               {renderActionSection("Delete Pages & Download", () => deletePdfPages(singleFile, rangeToIndices(pagesRange)))}
            </div>
          )}
        </div>
      );
    }

    if (activeToolId === 'extract-pages') {
      return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <FileUpload label="Upload PDF" onFileSelect={(fs) => setSingleFile(fs[0])} acceptedFileTypes="application/pdf" />
          {singleFile && (
            <div className="space-y-6">
               <div className="bg-muted/30 p-6 rounded-2xl border space-y-4">
                  <label className="text-sm font-black uppercase tracking-wider text-primary font-bold">Pages to extract</label>
                  <Input value={pagesRange} onChange={(e) => setPagesRange(e.target.value)} placeholder="e.g. 2, 4-6" className="h-12 text-lg font-bold" />
               </div>
               {renderActionSection("Extract Pages & Download", () => extractPdfPages(singleFile, rangeToIndices(pagesRange)))}
            </div>
          )}
        </div>
      );
    }

    if (activeToolId === 'rotate-pdf') {
      return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <FileUpload label="Upload PDF" onFileSelect={(fs) => setSingleFile(fs[0])} acceptedFileTypes="application/pdf" />
          {singleFile && (
            <div className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/30 p-6 rounded-2xl border">
                  <div className="space-y-2">
                     <label className="text-sm font-bold text-primary">Rotation Angle</label>
                     <select 
                       value={rotationAngle} 
                       onChange={(e) => setRotationAngle(Number(e.target.value) as any)}
                       className="w-full h-12 rounded-lg border border-primary/20 bg-background px-3 font-semibold"
                     >
                       <option value={90}>90° Clockwise</option>
                       <option value={180}>180° Flip</option>
                       <option value={270}>270° Counter-Clockwise</option>
                     </select>
                  </div>
                  <div className="space-y-2">
                     <label className="text-sm font-bold text-primary">Target Pages (optional)</label>
                     <Input value={pagesRange} onChange={(e) => setPagesRange(e.target.value)} placeholder="e.g. 1, 3 (empty for all pages)" className="h-12" />
                  </div>
               </div>
               {renderActionSection("Rotate Pages & Download", () => {
                 const indices = pagesRange ? rangeToIndices(pagesRange) : [];
                 return rotatePdfPages(singleFile, indices, rotationAngle);
               })}
            </div>
          )}
        </div>
      );
    }

    if (activeToolId === 'reorder-pdf') {
      return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <FileUpload label="Upload PDF" onFileSelect={(fs) => setSingleFile(fs[0])} acceptedFileTypes="application/pdf" />
          {singleFile && (
            <div className="space-y-6">
               <div className="bg-muted/30 p-6 rounded-2xl border space-y-4">
                  <label className="text-sm font-black uppercase tracking-wider text-primary font-bold">New page sequence</label>
                  <Input value={pagesRange} onChange={(e) => setPagesRange(e.target.value)} placeholder="e.g. 3, 2, 1, 4" className="h-12 text-lg font-bold" />
                  <p className="text-xs text-muted-foreground">Type page index order comma separated. e.g. "3, 1, 2, 4" changes first 4 page positions.</p>
               </div>
               {renderActionSection("Reorder Pages & Download", () => reorderPdfPages(singleFile, rangeToIndices(pagesRange)))}
            </div>
          )}
        </div>
      );
    }

    if (activeToolId === 'resize-pdf') {
      return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <FileUpload label="Upload PDF" onFileSelect={(fs) => setSingleFile(fs[0])} acceptedFileTypes="application/pdf" />
          {singleFile && (
            <div className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/30 p-6 rounded-2xl border">
                  <div className="space-y-2">
                     <label className="text-sm font-bold text-primary">Page Size Preset</label>
                     <select 
                       value={pageSizePreset} 
                       onChange={(e) => {
                         setPageSizePreset(e.target.value);
                         if (e.target.value === 'a4') { setCustomWidth(595); setCustomHeight(842); }
                         else if (e.target.value === 'letter') { setCustomWidth(612); setCustomHeight(792); }
                         else if (e.target.value === 'legal') { setCustomWidth(612); setCustomHeight(1008); }
                       }}
                       className="w-full h-12 rounded-lg border border-primary/20 bg-background px-3"
                     >
                       <option value="a4">A4 (595 x 842 pt)</option>
                       <option value="letter">Letter (612 x 792 pt)</option>
                       <option value="legal">Legal (612 x 1008 pt)</option>
                       <option value="custom">Custom Dimensions</option>
                     </select>
                  </div>
                  {pageSizePreset === 'custom' && (
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1">
                          <label className="text-xs font-bold">Width (pt)</label>
                          <Input type="number" value={customWidth} onChange={(e) => setCustomWidth(Number(e.target.value))} />
                       </div>
                       <div className="space-y-1">
                          <label className="text-xs font-bold">Height (pt)</label>
                          <Input type="number" value={customHeight} onChange={(e) => setCustomHeight(Number(e.target.value))} />
                       </div>
                    </div>
                  )}
               </div>
               {renderActionSection("Resize & Download PDF", () => resizePdf(singleFile, customWidth, customHeight))}
            </div>
          )}
        </div>
      );
    }

    // 4. Edit & Optimize
    if (activeToolId === 'compress-pdf') {
      return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <FileUpload label="Upload PDF to compress" onFileSelect={(fs) => setSingleFile(fs[0])} acceptedFileTypes="application/pdf" />
          {singleFile && (
            <div className="space-y-6">
               <div className="bg-primary/5 p-6 rounded-2xl border text-center">
                  <p className="font-bold text-lg mb-2">Optimized Hyper-Compression Engine</p>
                  <p className="text-sm text-muted-foreground">Strips redundant streams, flattens unused content objects, and speeds up loading performance.</p>
               </div>
               {renderActionSection("Compress & Download PDF", () => compressPdf(singleFile))}
            </div>
          )}
        </div>
      );
    }

    if (activeToolId === 'flatten-pdf') {
      return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <FileUpload label="Upload PDF to flatten" onFileSelect={(fs) => setSingleFile(fs[0])} acceptedFileTypes="application/pdf" />
          {singleFile && (
            <div className="space-y-6">
               <div className="bg-primary/5 p-6 rounded-2xl border text-center">
                  <p className="font-bold text-lg mb-2">Flatten Form Fields</p>
                  <p className="text-sm text-muted-foreground">Locks interactive AcroForm text fields into standard visual page objects to prevent modification.</p>
               </div>
               {renderActionSection("Flatten Form & Download PDF", () => flattenPdf(singleFile))}
            </div>
          )}
        </div>
      );
    }

    if (activeToolId === 'page-numbers') {
      return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <FileUpload label="Upload PDF" onFileSelect={(fs) => setSingleFile(fs[0])} acceptedFileTypes="application/pdf" />
          {singleFile && (
            <div className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-muted/30 p-6 rounded-2xl border">
                  <div className="space-y-2">
                     <label className="text-sm font-bold text-primary">Position</label>
                     <select 
                       value={pageNumberPos} 
                       onChange={(e) => setPageNumberPos(e.target.value as any)}
                       className="w-full h-12 rounded-lg border border-primary/20 bg-background px-3"
                     >
                       <option value="bottom-center">Bottom Center</option>
                       <option value="bottom-right">Bottom Right</option>
                       <option value="bottom-left">Bottom Left</option>
                       <option value="top-center">Top Center</option>
                     </select>
                  </div>
                  <div className="space-y-2">
                     <label className="text-sm font-bold text-primary">Start At Number</label>
                     <Input type="number" value={pageNumberStart} onChange={(e) => setPageNumberStart(Number(e.target.value))} className="h-12" />
                  </div>
                  <div className="space-y-2">
                     <label className="text-sm font-bold text-primary">Prefix Text</label>
                     <Input value={pageNumberPrefix} onChange={(e) => setPageNumberPrefix(e.target.value)} placeholder="e.g. Page " className="h-12" />
                  </div>
               </div>
               {renderActionSection("Add Page Numbers & Download", () => addPageNumbers(singleFile, { position: pageNumberPos, startAt: pageNumberStart, prefix: pageNumberPrefix }))}
            </div>
          )}
        </div>
      );
    }

    if (activeToolId === 'watermark') {
      return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <FileUpload label="Upload PDF" onFileSelect={(fs) => setSingleFile(fs[0])} acceptedFileTypes="application/pdf" />
          {singleFile && (
            <div className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/30 p-6 rounded-2xl border">
                  <div className="space-y-2 md:col-span-2">
                     <label className="text-sm font-bold text-primary">Watermark Text</label>
                     <Input value={watermarkText} onChange={(e) => setWatermarkText(e.target.value)} className="h-12 text-lg font-bold" />
                  </div>
                  <div className="space-y-2">
                     <label className="text-sm font-bold text-primary">Opacity ({Math.round(watermarkOpacity * 100)}%)</label>
                     <Input type="range" min="0.05" max="1" step="0.05" value={watermarkOpacity} onChange={(e) => setWatermarkOpacity(Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                     <label className="text-sm font-bold text-primary">Rotation Angle ({watermarkRotation}°)</label>
                     <Input type="range" min="-90" max="90" value={watermarkRotation} onChange={(e) => setWatermarkRotation(Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                     <label className="text-sm font-bold text-primary">Font Size ({watermarkFontSize}pt)</label>
                     <Input type="number" min="10" max="150" value={watermarkFontSize} onChange={(e) => setWatermarkFontSize(Number(e.target.value))} className="h-12" />
                  </div>
                  <div className="space-y-2">
                     <label className="text-sm font-bold text-primary">Watermark Color</label>
                     <div className="flex gap-4 items-center">
                       <Input type="color" value={watermarkColor} onChange={(e) => setWatermarkColor(e.target.value)} className="h-12 w-16 p-0 border-none cursor-pointer" />
                       <span className="font-mono text-sm uppercase">{watermarkColor}</span>
                     </div>
                  </div>
               </div>
               {renderActionSection("Add Watermark & Download PDF", () => {
                 const rgbDec = parseHexToRgbDecimal(watermarkColor);
                 return addWatermark(singleFile, {
                   text: watermarkText,
                   opacity: watermarkOpacity,
                   rotation: watermarkRotation,
                   fontSize: watermarkFontSize,
                   color: rgbDec
                 });
               })}
            </div>
          )}
        </div>
      );
    }

    if (activeToolId === 'header-footer') {
      return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <FileUpload label="Upload PDF" onFileSelect={(fs) => setSingleFile(fs[0])} acceptedFileTypes="application/pdf" />
          {singleFile && (
            <div className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/30 p-6 rounded-2xl border">
                  <div className="space-y-2">
                     <label className="text-sm font-bold text-primary">Header Text (Left aligned, top)</label>
                     <Input value={headerText} onChange={(e) => setHeaderText(e.target.value)} placeholder="e.g. Confidential Document" className="h-12" />
                  </div>
                  <div className="space-y-2">
                     <label className="text-sm font-bold text-primary">Footer Text (Left aligned, bottom)</label>
                     <Input value={footerText} onChange={(e) => setFooterText(e.target.value)} placeholder="e.g. © 2026 Editroy Corporation" className="h-12" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                     <label className="text-sm font-bold text-primary">Font Size ({headerFooterSize}pt)</label>
                     <Input type="number" min="8" max="24" value={headerFooterSize} onChange={(e) => setHeaderFooterSize(Number(e.target.value))} className="h-12" />
                  </div>
               </div>
               {renderActionSection("Embed Header/Footer & Download", () => addHeaderFooter(singleFile, { header: headerText, footer: footerText, fontSize: headerFooterSize }))}
            </div>
          )}
        </div>
      );
    }

    if (activeToolId === 'grayscale-pdf') {
      return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <FileUpload label="Upload PDF" onFileSelect={(fs) => setSingleFile(fs[0])} acceptedFileTypes="application/pdf" />
          {singleFile && (
            <div className="space-y-6">
               <div className="bg-primary/5 p-6 rounded-2xl border text-center">
                  <p className="font-bold text-lg mb-2">Monochrome Vectorization Engine</p>
                  <p className="text-sm text-muted-foreground">Converts all colored images inside each PDF page into grayscale. Ideal for saving printing toner.</p>
               </div>
               {renderActionSection("Convert to Grayscale & Download", () => grayscalePdf(singleFile))}
            </div>
          )}
        </div>
      );
    }

    if (activeToolId === 'repair-pdf') {
      return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <FileUpload label="Upload Corrupt PDF" onFileSelect={(fs) => setSingleFile(fs[0])} acceptedFileTypes="application/pdf" />
          {singleFile && (
            <div className="space-y-6">
               <div className="bg-primary/5 p-6 rounded-2xl border text-center">
                  <p className="font-bold text-lg mb-2">Automated PDF Structure Repair</p>
                  <p className="text-sm text-muted-foreground">Attempts to rebuild damaged cross-reference tables, fix corrupted stream headers, and extract pages safely.</p>
               </div>
               {renderActionSection("Repair PDF & Download", () => repairPdf(singleFile))}
            </div>
          )}
        </div>
      );
    }

    // 5. Security
    if (activeToolId === 'protect-pdf') {
      return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <FileUpload label="Upload PDF to Protect" onFileSelect={(fs) => setSingleFile(fs[0])} acceptedFileTypes="application/pdf" />
          {singleFile && (
            <div className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/30 p-6 rounded-2xl border">
                  <div className="space-y-2">
                     <label className="text-sm font-bold text-primary">User Password (To open PDF)</label>
                     <Input type="password" value={pdfPassword} onChange={(e) => setPdfPassword(e.target.value)} placeholder="Required to open" className="h-12 font-mono" />
                  </div>
                  <div className="space-y-2">
                     <label className="text-sm font-bold text-primary">Owner Password (To edit/copy PDF)</label>
                     <Input type="password" value={pdfOwnerPassword} onChange={(e) => setPdfOwnerPassword(e.target.value)} placeholder="Required to restrict modifications" className="h-12 font-mono" />
                  </div>
               </div>
               {renderActionSection("Encrypt & Protect PDF", () => protectPdf(singleFile, pdfPassword, pdfOwnerPassword), !pdfPassword)}
            </div>
          )}
        </div>
      );
    }

    if (activeToolId === 'unlock-pdf') {
      return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <FileUpload label="Upload Locked PDF" onFileSelect={(fs) => setSingleFile(fs[0])} acceptedFileTypes="application/pdf" />
          {singleFile && (
            <div className="space-y-6">
               <div className="bg-muted/30 p-6 rounded-2xl border space-y-4">
                  <label className="text-sm font-bold text-primary">Enter PDF Decryption Password</label>
                  <Input type="password" value={unlockPassword} onChange={(e) => setUnlockPassword(e.target.value)} placeholder="Password" className="h-12 font-mono text-lg" />
               </div>
               {renderActionSection("Decrypt & Unlock PDF", () => unlockPdf(singleFile, unlockPassword), !unlockPassword)}
            </div>
          )}
        </div>
      );
    }

    if (activeToolId === 'sign-pdf') {
      return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <FileUpload label="Upload PDF to Sign" onFileSelect={(fs) => setSingleFile(fs[0])} acceptedFileTypes="application/pdf" />
          {singleFile && (
            <div className="space-y-6">
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                  <Card className="border p-6 bg-card/60 space-y-4">
                     <h3 className="font-bold text-lg text-primary flex items-center gap-2"><PenTool className="h-5 w-5"/> Create Signature</h3>
                     <SignaturePad onSave={(dataUrl) => setSignatureDataUrl(dataUrl)} />
                     {signatureDataUrl && (
                       <div className="p-4 rounded-xl border bg-white flex flex-col items-center gap-2">
                          <p className="text-xs text-muted-foreground">Confirmed Signature Stamp Preview</p>
                          <img src={signatureDataUrl} alt="Signature Preview" className="max-h-20 object-contain" />
                       </div>
                     )}
                  </Card>

                  <Card className="border p-6 bg-card/60 space-y-4">
                     <h3 className="font-bold text-lg text-primary flex items-center gap-2"><Maximize className="h-5 w-5"/> Position Coordinates</h3>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                           <label className="text-xs font-bold">Target Page</label>
                           <Input type="number" min="1" value={signaturePage + 1} onChange={(e) => setSignaturePage(Number(e.target.value) - 1)} />
                        </div>
                        <div className="space-y-1">
                           <label className="text-xs font-bold">X Position (px)</label>
                           <Input type="number" value={signatureX} onChange={(e) => setSignatureX(Number(e.target.value))} />
                        </div>
                        <div className="space-y-1">
                           <label className="text-xs font-bold">Y Position (px)</label>
                           <Input type="number" value={signatureY} onChange={(e) => setSignatureY(Number(e.target.value))} />
                        </div>
                        <div className="space-y-1">
                           <label className="text-xs font-bold">Width (px)</label>
                           <Input type="number" value={signatureW} onChange={(e) => setSignatureW(Number(e.target.value))} />
                        </div>
                        <div className="space-y-1">
                           <label className="text-xs font-bold">Height (px)</label>
                           <Input type="number" value={signatureH} onChange={(e) => setSignatureH(Number(e.target.value))} />
                        </div>
                     </div>
                  </Card>
               </div>
               {renderActionSection("Apply Signature & Download PDF", () => embedSignatureToPdf(singleFile, signatureDataUrl!, signaturePage, signatureX, signatureY, signatureW, signatureH), !signatureDataUrl)}
            </div>
          )}
        </div>
      );
    }

    if (activeToolId === 'redact-pdf') {
      return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <FileUpload label="Upload PDF to Redact" onFileSelect={(fs) => setSingleFile(fs[0])} acceptedFileTypes="application/pdf" />
          {singleFile && (
            <div className="space-y-6">
               <div className="bg-muted/30 p-6 rounded-2xl border space-y-4">
                  <h3 className="font-bold text-lg text-primary flex items-center gap-2"><Eraser className="h-5 w-5"/> Redaction Blackout Area</h3>
                  <div className="grid grid-cols-5 gap-4">
                     <div className="space-y-1">
                        <label className="text-xs font-bold">Page</label>
                        <Input type="number" min="1" value={redactPage + 1} onChange={(e) => setRedactPage(Number(e.target.value) - 1)} />
                     </div>
                     <div className="space-y-1">
                        <label className="text-xs font-bold">X (px)</label>
                        <Input type="number" value={redactX} onChange={(e) => setRedactX(Number(e.target.value))} />
                     </div>
                     <div className="space-y-1">
                        <label className="text-xs font-bold">Y (px)</label>
                        <Input type="number" value={redactY} onChange={(e) => setRedactY(Number(e.target.value))} />
                     </div>
                     <div className="space-y-1">
                        <label className="text-xs font-bold">Width (px)</label>
                        <Input type="number" value={redactW} onChange={(e) => setRedactW(Number(e.target.value))} />
                     </div>
                     <div className="space-y-1">
                        <label className="text-xs font-bold">Height (px)</label>
                        <Input type="number" value={redactH} onChange={(e) => setRedactH(Number(e.target.value))} />
                     </div>
                  </div>
                  <p className="text-xs text-muted-foreground italic mt-2">Applies a solid, permanent vector black box mask over coordinates to conceal sensitive passwords, personal IDs, or numbers.</p>
               </div>
               {renderActionSection("Apply Redaction Mask & Download", () => redactPdf(singleFile, [{ page: redactPage, x: redactX, y: redactY, w: redactW, h: redactH }]))}
            </div>
          )}
        </div>
      );
    }

    // 6. Advanced
    if (activeToolId === 'compare-pdf') {
      return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <FileUpload label="Select Original PDF (A)" onFileSelect={(fs) => setCompareFileA(fs[0])} acceptedFileTypes="application/pdf" />
             <FileUpload label="Select Modified PDF (B)" onFileSelect={(fs) => setCompareFileB(fs[0])} acceptedFileTypes="application/pdf" />
          </div>
          {compareFileA && compareFileB && (
            <div className="space-y-6">
               {renderActionSection("Run Comparison Analysis", async () => {
                 const res = await comparePdfs(compareFileA, compareFileB);
                 if (res) setCompareResult(res);
               })}

               {compareResult && (
                 <Card className="border p-6 bg-card/60 space-y-6">
                    <h3 className="font-bold text-lg text-primary">Text comparison statistics</h3>
                    <div className="grid grid-cols-3 gap-4 text-center">
                       <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                          <p className="text-2xl font-black text-green-500">+{compareResult.added.length}</p>
                          <p className="text-xs text-muted-foreground">Unique words added in B</p>
                       </div>
                       <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30">
                          <p className="text-2xl font-black text-destructive">-{compareResult.removed.length}</p>
                          <p className="text-xs text-muted-foreground">Words deleted from A</p>
                       </div>
                       <div className="p-4 rounded-xl bg-primary/10 border border-primary/30">
                          <p className="text-2xl font-black text-primary">{compareResult.common}</p>
                          <p className="text-xs text-muted-foreground">Shared words in both</p>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="space-y-2">
                          <label className="text-sm font-bold text-green-500">Added Words Snippet</label>
                          <div className="p-4 rounded-xl border font-mono text-xs max-h-40 overflow-y-auto bg-muted/20">
                            {compareResult.added.join(', ') || 'No additions found.'}
                          </div>
                       </div>
                       <div className="space-y-2">
                          <label className="text-sm font-bold text-destructive">Removed Words Snippet</label>
                          <div className="p-4 rounded-xl border font-mono text-xs max-h-40 overflow-y-auto bg-muted/20">
                            {compareResult.removed.join(', ') || 'No removals found.'}
                          </div>
                       </div>
                    </div>
                 </Card>
               )}
            </div>
          )}
        </div>
      );
    }

    if (activeToolId === 'ocr-pdf') {
      return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <FileUpload label="Upload Scanned PDF" onFileSelect={(fs) => setSingleFile(fs[0])} acceptedFileTypes="application/pdf" />
          {singleFile && (
            <div className="space-y-6">
               {renderActionSection("Run OCR Scan Engine", async () => {
                 const text = await ocrPdf(singleFile);
                 if (text) setOcrText(text);
               })}

               {ocrText && (
                 <Card className="border p-6 bg-card/60 space-y-4">
                    <div className="flex justify-between items-center">
                       <label className="font-bold text-primary">OCR Extracted Plaintext Output</label>
                       <Button size="sm" variant="outline" onClick={() => {
                         navigator.clipboard.writeText(ocrText);
                       }}>Copy Text</Button>
                    </div>
                    <textarea 
                      value={ocrText} 
                      readOnly 
                      className="w-full h-80 rounded-xl border font-mono text-sm p-4 bg-muted/20"
                    />
                 </Card>
               )}
            </div>
          )}
        </div>
      );
    }

    if (activeToolId === 'metadata') {
      return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <FileUpload label="Upload PDF to Edit Metadata" onFileSelect={(fs) => setSingleFile(fs[0])} acceptedFileTypes="application/pdf" />
          {singleFile && (
            <div className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/30 p-6 rounded-2xl border">
                  <div className="space-y-1">
                     <label className="text-sm font-bold text-primary">Document Title</label>
                     <Input value={metaFields.title || ''} onChange={(e) => setMetaFields(prev => ({ ...prev, title: e.target.value }))} className="h-12" />
                  </div>
                  <div className="space-y-1">
                     <label className="text-sm font-bold text-primary">Author Name</label>
                     <Input value={metaFields.author || ''} onChange={(e) => setMetaFields(prev => ({ ...prev, author: e.target.value }))} className="h-12" />
                  </div>
                  <div className="space-y-1">
                     <label className="text-sm font-bold text-primary">Subject Category</label>
                     <Input value={metaFields.subject || ''} onChange={(e) => setMetaFields(prev => ({ ...prev, subject: e.target.value }))} className="h-12" />
                  </div>
                  <div className="space-y-1">
                     <label className="text-sm font-bold text-primary">Tags / Keywords</label>
                     <Input value={metaFields.keywords || ''} onChange={(e) => setMetaFields(prev => ({ ...prev, keywords: e.target.value }))} className="h-12" />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                     <label className="text-sm font-bold text-primary">Creator Application Name</label>
                     <Input value={metaFields.creator || ''} onChange={(e) => setMetaFields(prev => ({ ...prev, creator: e.target.value }))} className="h-12" />
                  </div>
               </div>
               {renderActionSection("Save Document Metadata & Download", () => editMetadata(singleFile, metaFields))}
            </div>
          )}
        </div>
      );
    }

    // 7. Office Tools
    if (activeToolId === 'word-merge') {
      return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <FileUpload label="Select DOCX files to merge" onFileSelect={(fs) => setMultipleFiles(prev => [...prev, ...fs])} acceptedFileTypes=".docx" multiple />
          {multipleFiles.length > 0 && (
            <div className="space-y-6">
               <div className="space-y-3">
                  {multipleFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border">
                      <span className="text-sm font-bold">#{i+1}: {f.name}</span>
                      <XCircle className="h-5 w-5 text-muted-foreground cursor-pointer hover:text-destructive" onClick={() => setMultipleFiles(prev => prev.filter((_, idx) => idx !== i))} />
                    </div>
                  ))}
               </div>
               {renderActionSection("Merge DOCX Files into PDF", () => mergeWord(multipleFiles), multipleFiles.length < 2)}
            </div>
          )}
        </div>
      );
    }

    if (activeToolId === 'word-split') {
      return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <FileUpload label="Upload Word Document (.docx)" onFileSelect={(fs) => setSingleFile(fs[0])} acceptedFileTypes=".docx" />
          {singleFile && (
            <div className="space-y-6">
               <div className="bg-primary/5 p-6 rounded-2xl border text-center">
                  <p className="font-bold text-lg mb-2">Heading-based Document Splitter</p>
                  <p className="text-sm text-muted-foreground">Scans your document structure and extracts every main section/chapter as a standalone PDF.</p>
               </div>
               {renderActionSection("Split Word Sections & Download PDFs", () => splitWord(singleFile))}
            </div>
          )}
        </div>
      );
    }

    if (activeToolId === 'word-watermark') {
      return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <FileUpload label="Upload Word Document (.docx)" onFileSelect={(fs) => setSingleFile(fs[0])} acceptedFileTypes=".docx" />
          {singleFile && (
            <div className="space-y-6">
               <div className="bg-muted/30 p-6 rounded-2xl border space-y-4">
                  <label className="text-sm font-bold text-primary">Watermark Text</label>
                  <Input value={watermarkText} onChange={(e) => setWatermarkText(e.target.value)} placeholder="CONFIDENTIAL" className="h-12 text-lg font-bold" />
               </div>
               {renderActionSection("Apply Watermark & Export PDF", () => addWordWatermark(singleFile, watermarkText))}
            </div>
          )}
        </div>
      );
    }

    if (activeToolId === 'excel-csv') {
      return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <FileUpload label="Upload XLSX or CSV File" onFileSelect={(fs) => setSingleFile(fs[0])} acceptedFileTypes=".xlsx,.xls,.csv" />
          {singleFile && (
            <div className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <Button className="h-16 text-lg font-bold bg-primary hover:bg-primary/95" onClick={() => excelToCsv(singleFile)}>
                    Excel ➔ CSV Extract
                 </Button>
                 <Button className="h-16 text-lg font-bold bg-blue-600 hover:bg-blue-700" onClick={() => csvToExcel(singleFile)}>
                    CSV ➔ Excel Converter
                 </Button>
               </div>
            </div>
          )}
        </div>
      );
    }

    if (activeToolId === 'excel-merge') {
      return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <FileUpload label="Select Excel workbooks to merge" onFileSelect={(fs) => setMultipleFiles(prev => [...prev, ...fs])} acceptedFileTypes=".xlsx,.xls" multiple />
          {multipleFiles.length > 0 && (
            <div className="space-y-6">
               <div className="space-y-3">
                  {multipleFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border">
                      <span className="text-sm font-bold">#{i+1}: {f.name}</span>
                      <XCircle className="h-5 w-5 text-muted-foreground cursor-pointer" onClick={() => setMultipleFiles(prev => prev.filter((_, idx) => idx !== i))} />
                    </div>
                  ))}
               </div>
               {renderActionSection("Assemble Excel Sheets & Download", () => mergeExcel(multipleFiles), multipleFiles.length < 2)}
            </div>
          )}
        </div>
      );
    }

    if (activeToolId === 'excel-split') {
      return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <FileUpload label="Upload Excel Document" onFileSelect={(fs) => setSingleFile(fs[0])} acceptedFileTypes=".xlsx,.xls" />
          {singleFile && (
            <div className="space-y-6">
               <div className="bg-primary/5 p-6 rounded-2xl border text-center">
                  <p className="font-bold text-lg mb-2">Workbook Sheet Splitter</p>
                  <p className="text-sm text-muted-foreground">Splits every individual sheet tab from your workbook into a standalone Excel XLSX file.</p>
               </div>
               {renderActionSection("Split Worksheet tabs", () => splitExcel(singleFile))}
            </div>
          )}
        </div>
      );
    }

    if (activeToolId === 'excel-pivot') {
      return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <FileUpload label="Upload Workbook (.xlsx/.xls)" onFileSelect={(fs) => setSingleFile(fs[0])} acceptedFileTypes=".xlsx,.xls" />
          {singleFile && (
            <div className="space-y-6">
               {renderActionSection("Generate Pivot Data View", async () => {
                 const res = await getPivotData(singleFile);
                 if (res) setPivotResult(res);
               })}

               {pivotResult && (
                 <Card className="border p-6 bg-card/60 overflow-hidden space-y-4">
                    <h3 className="font-bold text-lg text-primary flex items-center gap-2"><Table className="h-5 w-5"/> Workbook Sheet Grid Analysis</h3>
                    <div className="overflow-x-auto border rounded-xl max-h-96">
                       <table className="w-full text-xs text-left border-collapse">
                          <thead className="bg-muted border-b font-bold">
                             <tr>
                               {pivotResult.headers.map((h, i) => <th key={i} className="p-3 border-r">{h}</th>)}
                             </tr>
                          </thead>
                          <tbody>
                             {pivotResult.rows.slice(0, 100).map((row, idx) => (
                               <tr key={idx} className="border-b hover:bg-muted/10">
                                 {row.map((cell, cidx) => <td key={cidx} className="p-3 border-r truncate max-w-[120px]">{cell}</td>)}
                               </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                    {pivotResult.rows.length > 100 && (
                      <p className="text-[10px] text-muted-foreground text-center">Displaying first 100 rows of aggregated dataset.</p>
                    )}
                 </Card>
               )}
            </div>
          )}
        </div>
      );
    }

    if (activeToolId === 'excel-clean') {
      return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <FileUpload label="Upload Excel Sheet to Clean" onFileSelect={(fs) => setSingleFile(fs[0])} acceptedFileTypes=".xlsx,.xls" />
          {singleFile && (
            <div className="space-y-6">
               <div className="bg-primary/5 p-6 rounded-2xl border text-center">
                  <p className="font-bold text-lg mb-2">Automated Dataset Cleaning</p>
                  <p className="text-sm text-muted-foreground">Scans sheets and strips out completely blank rows, columns, null cells, or stray styling wrappers.</p>
               </div>
               {renderActionSection("Clean Workbook & Download", () => cleanExcel(singleFile))}
            </div>
          )}
        </div>
      );
    }

    if (activeToolId === 'excel-formula') {
      return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <FileUpload label="Upload Workbook" onFileSelect={(fs) => setSingleFile(fs[0])} acceptedFileTypes=".xlsx,.xls" />
          {singleFile && (
            <div className="space-y-6">
               {renderActionSection("Extract Worksheet Formulas", async () => {
                 const res = await getExcelFormulas(singleFile);
                 if (res) setExcelFormulas(res);
               })}

               {excelFormulas && (
                 <Card className="border p-6 bg-card/60 overflow-hidden space-y-4">
                    <h3 className="font-bold text-lg text-primary">Extracted Sheet Formulas ({excelFormulas.length})</h3>
                    {excelFormulas.length === 0 ? (
                      <p className="text-muted-foreground py-6 text-center text-sm">No formulas found in the uploaded workbook.</p>
                    ) : (
                      <div className="overflow-x-auto border rounded-xl max-h-96">
                         <table className="w-full text-xs text-left">
                            <thead className="bg-muted border-b font-bold">
                               <tr>
                                 <th className="p-3 border-r">Sheet Tab</th>
                                 <th className="p-3 border-r">Cell Coordinate</th>
                                 <th className="p-3">Excel Formula String</th>
                               </tr>
                            </thead>
                            <tbody>
                               {excelFormulas.map((item, idx) => (
                                 <tr key={idx} className="border-b hover:bg-muted/10 font-mono">
                                   <td className="p-3 border-r font-bold text-primary">{item.sheet}</td>
                                   <td className="p-3 border-r font-bold text-indigo-500">{item.cell}</td>
                                   <td className="p-3 text-emerald-500">={item.formula}</td>
                                 </tr>
                               ))}
                            </tbody>
                         </table>
                      </div>
                    )}
                 </Card>
               )}
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  const renderDefaultToolUI = (): React.ReactNode => {
    if (activeToolId?.includes('-to-')) {
      const content = renderChainingTool();
      if (content) return content;
    }

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => setActiveToolId(null)} className="rounded-full shadow-sm">
            <ArrowLeft className="h-4 w-4 mr-2" /> Dashboard
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{activeTool?.icon}</span>
            <h2 className="text-2xl font-bold capitalize">{activeTool?.name}</h2>
          </div>
        </div>
        <Card className="border-primary/10 shadow-lg overflow-hidden backdrop-blur-sm bg-card/50">
          <CardHeader className="bg-muted/10 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              Engine Porting
            </CardTitle>
            <CardDescription>{activeTool?.description}</CardDescription>
          </CardHeader>
          <CardContent className="p-12 text-center space-y-6">
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl bg-muted/20 border-primary/10">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-primary/60" />
              </div>
              <p className="text-muted-foreground mb-4 font-bold">Migration Porting</p>
              <p className="text-xs text-muted-foreground/80 max-w-sm">
                Our engineering team is porting the specialized <strong>{activeTool?.name}</strong> logic to the next-gen stack. Use the Selection Wheel for unified conversions.
              </p>
              <Button className="mt-8 px-8 rounded-full" variant="outline">Notify Me</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderToolUI = (): React.ReactNode => {
    const isCustomHandled = [
      'merge-pdf', 'split-pdf', 'delete-pages', 'extract-pages', 'rotate-pdf', 
      'reorder-pdf', 'resize-pdf', 'compress-pdf', 'flatten-pdf', 'page-numbers', 
      'watermark', 'header-footer', 'grayscale-pdf', 'repair-pdf', 'protect-pdf', 
      'unlock-pdf', 'sign-pdf', 'redact-pdf', 'compare-pdf', 'ocr-pdf', 'metadata', 
      'word-merge', 'word-split', 'word-watermark', 'excel-csv', 'excel-merge', 
      'excel-split', 'excel-pivot', 'excel-clean', 'excel-formula'
    ].includes(activeToolId || '');

    if (isCustomHandled) {
      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => setActiveToolId(null)} className="rounded-full shadow-sm">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{activeTool?.icon}</span>
              <h2 className="text-2xl font-black capitalize tracking-tight">{activeTool?.name}</h2>
            </div>
          </div>
          <Card className="border border-primary/20 shadow-xl overflow-hidden backdrop-blur-md bg-card/60 p-8">
            <CardHeader className="border-b px-0 pt-0 pb-6 mb-6">
              <CardTitle className="text-2xl font-black tracking-tight">{activeTool?.name}</CardTitle>
              <CardDescription className="text-md font-bold">{activeTool?.description}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
               {renderToolView()}
            </CardContent>
          </Card>
        </div>
      );
    }

    return renderDefaultToolUI();
  };

  const renderDashboard = (): React.ReactNode => (
    <div className="space-y-12 animate-in fade-in duration-700">
      <div className="flex flex-col items-center text-center max-w-2xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest animate-pulse">
          <Sparkles className="h-3 w-3" />
          <span>Professional Suite</span>
        </div>
        <h1 className="text-5xl font-black tracking-tight text-foreground/90 leading-tight">Document Utilities</h1>
        <p className="text-muted-foreground text-lg max-lg">Ultimate Starless Conversion Engine</p>
        <div className="relative w-full max-w-md mt-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/60" />
          <Input 
            placeholder="Search 40+ tools..." 
            className="pl-12 h-14 bg-card/40 backdrop-blur-xl border-primary/20 shadow-xl rounded-2xl text-lg"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {!searchQuery && (
        <section className="py-4">
           <UniversalConverterWheel onSelectTool={handleToolSelect} />
        </section>
      )}

      <div className="space-y-20 pb-20">
        {categories.map((category) => {
          const toolsInCategory = filteredTools.filter(t => t.category === category);
          if (toolsInCategory.length === 0) return null;
          return (
            <div key={category} className="space-y-8">
              <div className="flex items-center gap-6">
                <h2 className="text-2xl font-black text-foreground/80 tracking-tight">{category}</h2>
                <div className="h-[2px] flex-grow bg-gradient-to-r from-muted to-transparent rounded-full" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {toolsInCategory.map((tool) => (
                  <DocumentToolCard key={tool.id} tool={tool} onClick={handleToolSelect} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="container py-16 max-w-7xl mx-auto min-h-screen">
      {activeToolId ? renderToolUI() : renderDashboard()}
    </div>
  );
}
