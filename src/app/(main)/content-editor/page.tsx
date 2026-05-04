"use client";

import { useState, useRef, useEffect, useCallback, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
    FilePenLine, ArrowLeft, ArrowRight, Download, 
    Loader2, FileType, RefreshCw, Type, CheckSquare, 
    Signature as SignatureIcon, Image as ImageIcon,
    Trash2, Move, MousePointer2, Plus
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// TYPE IMPORTS
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

interface Annotation {
    id: string;
    type: 'text' | 'checkbox' | 'image' | 'signature';
    x: number;
    y: number;
    width: number;
    height: number;
    content?: string;
    checked?: boolean;
    imageSrc?: string;
}

export default function ContentEditorPage() {
    const { toast } = useToast();

    // Core state
    const [file, setFile] = useState<File | null>(null);
    const [fileType, setFileType] = useState<'pdf' | 'docx' | 'xlsx' | null>(null);
    const [originalFilename, setOriginalFilename] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    // PDF specific state
    const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [scale, setScale] = useState(1.5);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isRendering, setIsRendering] = useState(false);

    // Annotations state
    const [annotations, setAnnotations] = useState<Record<number, Annotation[]>>({});
    const [activeTool, setActiveTool] = useState<'select' | 'text' | 'checkbox' | 'image' | 'signature'>('select');
    const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

    // DOCX/XLSX specific state
    const [docHtmlContent, setDocHtmlContent] = useState('');
    const [excelData, setExcelData] = useState<any[][]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    // Dragging state
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const resetState = () => {
        setFile(null);
        setFileType(null);
        setOriginalFilename('');
        setIsLoading(false);
        setPdfDoc(null);
        setCurrentPage(1);
        setAnnotations({});
        setDocHtmlContent('');
        setExcelData([]);
        setSelectedAnnotationId(null);
    };

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        resetState();
        setIsLoading(true);
        setFile(selectedFile);
        
        const fileName = selectedFile.name.toLowerCase();
        try {
            if (fileName.endsWith('.pdf')) {
                setFileType('pdf');
                setOriginalFilename(selectedFile.name.replace('.pdf', '_edited.pdf'));
                await loadPdf(selectedFile);
            } else if (fileName.endsWith('.docx')) {
                setFileType('docx');
                setOriginalFilename(selectedFile.name.replace('.docx', '_edited.pdf'));
                await loadDocx(selectedFile);
            } else if (fileName.endsWith('.xlsx')) {
                setFileType('xlsx');
                setOriginalFilename(selectedFile.name.replace('.xlsx', '_edited.pdf'));
                await loadXlsx(selectedFile);
            } else {
                toast({ title: 'Unsupported File', description: 'Please upload a PDF, DOCX, or XLSX file.', variant: 'destructive'});
                resetState();
            }
        } catch (error) {
            console.error("Error loading file:", error);
            toast({ title: 'Upload Error', description: 'Failed to process the file.', variant: 'destructive'});
            resetState();
        }
        setIsLoading(false);
    };

    const loadPdf = async (pdfFile: File) => {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.mjs`;
        const buffer = await pdfFile.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
        setPdfDoc(doc);
    };

    const loadDocx = async (docxFile: File) => {
        const mammoth = await import('mammoth');
        const arrayBuffer = await docxFile.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setDocHtmlContent(result.value);
    };

    const loadXlsx = async (xlsxFile: File) => {
        const XLSX = await import('xlsx');
        const buffer = await xlsxFile.arrayBuffer();
        const wb = XLSX.read(buffer);
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        setExcelData(data);
    };

    const renderPdfPage = useCallback(async (num: number) => {
        if (!pdfDoc || !canvasRef.current) return;
        setIsRendering(true);
        try {
            const page = await pdfDoc.getPage(num);
            const viewport = page.getViewport({ scale });
            const canvas = canvasRef.current;
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                await page.render({ canvasContext: ctx, viewport }).promise;
            }
        } catch (error) {
            console.error("Render error:", error);
        } finally {
            setIsRendering(false);
        }
    }, [pdfDoc, scale]);

    useEffect(() => {
        if (fileType === 'pdf' && pdfDoc) {
            renderPdfPage(currentPage);
        }
    }, [pdfDoc, currentPage, renderPdfPage, fileType]);

    const addAnnotation = (e: React.MouseEvent) => {
        if (activeTool === 'select' || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;

        const newId = Date.now().toString();
        const newAnnotation: Annotation = {
            id: newId,
            type: activeTool,
            x: e.clientX - rect.left - (activeTool === 'checkbox' ? 12 : 75),
            y: e.clientY - rect.top - (activeTool === 'checkbox' ? 12 : 20),
            width: activeTool === 'text' ? 150 : (activeTool === 'checkbox' ? 24 : 200),
            height: activeTool === 'checkbox' ? 24 : (activeTool === 'signature' ? 80 : 150),
            content: activeTool === 'text' ? 'New Text' : '',
            checked: false
        };

        setAnnotations(prev => ({
            ...prev,
            [currentPage]: [...(prev[currentPage] || []), newAnnotation]
        }));
        setSelectedAnnotationId(newId);
        setActiveTool('select');
    };

    const handleDragStart = (e: React.MouseEvent, anno: Annotation) => {
        if (activeTool !== 'select') return;
        e.stopPropagation();
        setSelectedAnnotationId(anno.id);
        setIsDragging(true);
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
            setDragOffset({
                x: e.clientX - rect.left - anno.x,
                y: e.clientY - rect.top - anno.y
            });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !selectedAnnotationId || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const newX = e.clientX - rect.left - dragOffset.x;
        const newY = e.clientY - rect.top - dragOffset.y;
        updateAnnotation(selectedAnnotationId, { x: newX, y: newY });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleImageUpload = (id: string) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (re) => {
                    updateAnnotation(id, { imageSrc: re.target?.result as string });
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    };

    const updateAnnotation = (id: string, updates: Partial<Annotation>) => {
        setAnnotations(prev => ({
            ...prev,
            [currentPage]: prev[currentPage].map(prevAnno => 
                prevAnno.id === id ? { ...prevAnno, ...updates } : prevAnno
            )
        }));
    };

    const deleteAnnotation = (id: string) => {
        setAnnotations(prev => ({
            ...prev,
            [currentPage]: prev[currentPage].filter(a => a.id !== id)
        }));
        setSelectedAnnotationId(null);
    };

    const handleDownload = async () => {
        if (!fileType || !file) return;
        setIsLoading(true);
        toast({ title: "Exporting...", description: "Adding annotations to document." });

        try {
            if (fileType === 'pdf') {
                const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
                const pdfBytes = await file.arrayBuffer();
                const pdfDoc = await PDFDocument.load(pdfBytes);
                const pages = pdfDoc.getPages();
                const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
                const scriptFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

                // Process each page's annotations
                for (const pageIndexStr in annotations) {
                    const pageIndex = parseInt(pageIndexStr) - 1;
                    if (pageIndex >= pages.length) continue;
                    
                    const page = pages[pageIndex];
                    const { width: pWidth, height: pHeight } = page.getSize();
                    
                    // We need to calculate the actual display dimensions to map coordinates
                    // Current scale simplified mapping:
                    const annos = annotations[parseInt(pageIndexStr)];
                    
                    for (const anno of annos) {
                        const x = anno.x / scale;
                        const y = pHeight - (anno.y / scale) - (anno.height / scale);
                        const w = anno.width / scale;
                        const h = anno.height / scale;

                        if (anno.type === 'text' || anno.type === 'signature') {
                            page.drawText(anno.content || '', {
                                x: x + 2,
                                y: y + (anno.type === 'signature' ? 10 : 5),
                                size: (anno.type === 'signature' ? 24 : 12),
                                font: anno.type === 'signature' ? scriptFont : font,
                                color: rgb(0, 0, 0),
                            });
                        } else if (anno.type === 'checkbox') {
                            page.drawRectangle({
                                x, y, width: w, height: h,
                                borderWidth: 1, borderColor: rgb(0, 0, 0),
                            });
                            if (anno.checked) {
                                page.drawText('X', { x: x + 4, y: y + 4, size: 12, font, color: rgb(0, 0, 0) });
                            }
                        } else if (anno.type === 'image' && anno.imageSrc) {
                            const imageBytes = await fetch(anno.imageSrc).then(res => res.arrayBuffer());
                            let embed;
                            if (anno.imageSrc.includes('png')) embed = await pdfDoc.embedPng(imageBytes);
                            else embed = await pdfDoc.embedJpg(imageBytes);
                            
                            page.drawImage(embed, { x, y, width: w, height: h });
                        }
                    }
                }

                const resultBytes = await pdfDoc.save();
                downloadBlob(new Blob([resultBytes as any], { type: 'application/pdf' }), originalFilename);
            } else {
                // Word or Excel - Use jsPDF + html2canvas for "Print to PDF" effect
                const html2canvas = (await import('html2canvas')).default;
                const { jsPDF } = await import('jspdf');
                
                if (containerRef.current) {
                    const canvas = await html2canvas(containerRef.current, {
                        scale: 2,
                        useCORS: true,
                        logging: false
                    });
                    const imgData = canvas.toDataURL('image/png');
                    const pdf = new jsPDF({
                        orientation: canvas.width > canvas.height ? 'l' : 'p',
                        unit: 'px',
                        format: [canvas.width, canvas.height]
                    });
                    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
                    pdf.save(originalFilename);
                }
            }
            toast({ title: "Success", description: "Document exported successfully." });
        } catch (error) {
            console.error("Export error:", error);
            toast({ title: "Export Failed", description: "There was an error generating the PDF.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const downloadBlob = (blob: Blob, name: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Card className="min-h-[80vh] flex flex-col">
            <CardHeader className="border-b bg-muted/30">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="flex items-center text-2xl font-headline">
                            <FilePenLine className="mr-2 h-6 w-6 text-primary" /> Content Editor
                        </CardTitle>
                        <CardDescription>
                            Professional editing for PDF, Word, and Excel files.
                        </CardDescription>
                    </div>
                    {fileType && (
                        <div className="flex bg-background border rounded-lg p-1 gap-1">
                            <Button 
                                variant={activeTool === 'select' ? 'default' : 'ghost'} 
                                size="sm" onClick={() => setActiveTool('select')}
                                title="Selection Tool"
                            >
                                <MousePointer2 className="h-4 w-4" />
                            </Button>
                            <Button 
                                variant={activeTool === 'text' ? 'default' : 'ghost'} 
                                size="sm" onClick={() => setActiveTool('text')}
                                title="Text Tool"
                            >
                                <Type className="h-4 w-4" />
                            </Button>
                            <Button 
                                variant={activeTool === 'checkbox' ? 'default' : 'ghost'} 
                                size="sm" onClick={() => setActiveTool('checkbox')}
                                title="Checkbox Tool"
                            >
                                <CheckSquare className="h-4 w-4" />
                            </Button>
                            <Button 
                                variant={activeTool === 'image' ? 'default' : 'ghost'} 
                                size="sm" onClick={() => setActiveTool('image')}
                                title="Image Tool"
                            >
                                <ImageIcon className="h-4 w-4" />
                            </Button>
                            <Button 
                                variant={activeTool === 'signature' ? 'default' : 'ghost'} 
                                size="sm" onClick={() => setActiveTool('signature')}
                                title="Signature Tool"
                            >
                                <SignatureIcon className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>
            </CardHeader>
            
            <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
                <div className="p-4 border-b bg-muted/10 flex flex-wrap gap-2 items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Input id="file-upload" type="file" accept=".pdf,.docx,.xlsx" onChange={handleFileChange} className="max-w-[200px] h-9 text-xs"/>
                        {fileType && <Button variant="outline" size="sm" onClick={resetState}><RefreshCw className="h-4 w-4"/></Button>}
                    </div>
                    
                    {fileType === 'pdf' && pdfDoc && (
                        <div className="flex items-center gap-3">
                            <div className="flex items-center bg-background border rounded-md">
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                                    disabled={currentPage <= 1}
                                    className="h-8 w-8 p-0"
                                >
                                    <ArrowLeft className="h-4 w-4"/>
                                </Button>
                                <span className="text-xs px-2 min-w-[80px] text-center border-x">
                                    {currentPage} / {pdfDoc.numPages}
                                </span>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => setCurrentPage(p => Math.min(pdfDoc.numPages, p + 1))} 
                                    disabled={currentPage >= pdfDoc.numPages}
                                    className="h-8 w-8 p-0"
                                >
                                    <ArrowRight className="h-4 w-4"/>
                                </Button>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="h-8 w-8">-</Button>
                                <span className="text-xs w-10 text-center">{Math.round(scale * 100)}%</span>
                                <Button variant="ghost" size="sm" onClick={() => setScale(s => Math.min(3, s + 0.1))} className="h-8 w-8">+</Button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-auto bg-muted/40 p-10 flex justify-center items-start relative">
                    {isLoading ? (
                        <div className="flex flex-col items-center gap-2 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                            <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50"/>
                            <p className="text-sm text-muted-foreground animate-pulse">Processing document...</p>
                        </div>
                    ) : !fileType ? (
                        <div className="flex flex-col items-center gap-4 py-20 text-center">
                            <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                                <FileType className="h-10 w-10 text-primary" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-xl font-semibold">No Document Loaded</h3>
                                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                    Upload a PDF, Word, or Excel file to start adding annotations, text, and signatures.
                                </p>
                            </div>
                            <Button onClick={() => document.getElementById('file-upload')?.click()}>
                                <Plus className="mr-2 h-4 w-4" /> Select File
                            </Button>
                        </div>
                    ) : (
                        <div 
                            ref={containerRef}
                            onClick={addAnnotation}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            className={cn(
                                "relative shadow-2xl bg-white transition-all overflow-hidden mx-auto",
                                activeTool !== 'select' ? "cursor-crosshair" : "cursor-default border-primary/20",
                                fileType === 'pdf' ? "mb-10" : "p-12 min-h-[11in] w-[8.5in]"
                            )}
                        >
                            {/* Document Render Layer */}
                            {fileType === 'pdf' && (
                                <div className="relative">
                                    <canvas ref={canvasRef} className="block" />
                                    {isRendering && <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
                                </div>
                            )}

                            {fileType === 'docx' && (
                                <div className="p-16 max-w-[800px] prose prose-sm focus:outline-none" dangerouslySetInnerHTML={{ __html: docHtmlContent }} />
                            )}

                            {fileType === 'xlsx' && (
                                <div className="p-8">
                                    <table className="border-collapse text-xs w-full">
                                        <tbody>
                                            {excelData.slice(0, 100).map((row, i) => (
                                                <tr key={i}>
                                                    {row.map((cell, j) => (
                                                        <td key={j} className="border border-muted-foreground/20 p-2 min-w-[80px]">
                                                            {cell}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Annotations Layer */}
                            <div className="absolute inset-0 pointer-events-none">
                                {(annotations[currentPage] || []).map((anno) => (
                                    <div
                                        key={anno.id}
                                        className={cn(
                                            "absolute pointer-events-auto border-2 border-transparent group transition-all duration-75",
                                            selectedAnnotationId === anno.id && "border-primary/40 bg-primary/5 shadow-lg ring-1 ring-primary/20",
                                            activeTool === 'select' && "cursor-grab active:cursor-grabbing hover:bg-muted/5 hover:border-muted-foreground/20"
                                        )}
                                        style={{ 
                                            left: anno.x, 
                                            top: anno.y, 
                                            width: anno.width, 
                                            height: anno.height 
                                        }}
                                        onMouseDown={(e) => handleDragStart(e, anno)}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedAnnotationId(anno.id);
                                        }}
                                    >
                                        {selectedAnnotationId === anno.id && (
                                            <div className="absolute -top-8 right-0 flex gap-1 z-10 bg-background/80 backdrop-blur-sm p-1 rounded-md border shadow-sm">
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteAnnotation(anno.id);
                                                    }}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                                <div className="h-4 w-[1px] bg-border mx-1" />
                                                <Move className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                        )}

                                        {anno.type === 'text' && (
                                            <textarea
                                                className="w-full h-full bg-transparent border-none resize-none focus:outline-none p-1 text-sm font-sans"
                                                value={anno.content}
                                                onChange={(e) => updateAnnotation(anno.id, { content: e.target.value })}
                                                placeholder="Type here..."
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        )}

                                        {anno.type === 'checkbox' && (
                                            <div 
                                                className={cn(
                                                    "w-full h-full border-2 border-black flex items-center justify-center cursor-pointer bg-white transition-colors",
                                                    anno.checked && "bg-black"
                                                )}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    updateAnnotation(anno.id, { checked: !anno.checked });
                                                }}
                                            >
                                                {anno.checked && <div className="w-2.5 h-2.5 bg-white rotate-45" style={{ borderRadius: '1px' }} />}
                                            </div>
                                        )}

                                        {anno.type === 'image' && (
                                            <div 
                                                className="w-full h-full bg-muted/20 flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded-md overflow-hidden"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleImageUpload(anno.id);
                                                }}
                                            >
                                                {anno.imageSrc ? (
                                                    <img src={anno.imageSrc} alt="uploaded" className="w-full h-full object-contain" />
                                                ) : (
                                                    <>
                                                        <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                                                        <span className="text-[10px] font-medium text-muted-foreground mt-1">UPLOAD</span>
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {anno.type === 'signature' && (
                                            <div className="w-full h-full bg-muted/10 flex items-center justify-center border-b-2 border-black relative">
                                                <SignatureIcon className="absolute top-1 left-1 h-3 w-3 text-muted-foreground opacity-30" />
                                                <textarea
                                                    className="w-full h-full bg-transparent border-none resize-none focus:outline-none p-2 text-xl font-handwriting italic text-center leading-relaxed"
                                                    value={anno.content}
                                                    onChange={(e) => updateAnnotation(anno.id, { content: e.target.value })}
                                                    placeholder="Your Name"
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>

            <CardFooter className="border-t p-4 flex justify-end gap-2 bg-muted/10">
                <Button variant="ghost" disabled={!fileType}>Reset Edits</Button>
                <Button onClick={handleDownload} disabled={!fileType}>
                    <Download className="mr-2 h-4 w-4"/>
                    {fileType === 'pdf' ? 'Download Edited PDF' : 'Export as PDF'}
                </Button>
            </CardFooter>
        </Card>
    );
}
