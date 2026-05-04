// src/app/(main)/print-setup/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Printer, Settings2, Eye, FileText, Layers, Palette, Columns } from 'lucide-react';
import { FileUpload } from '@/components/app/file-upload';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { useDocumentQueue } from '@/contexts/document-context';
import { useSearchParams } from 'next/navigation';

const paperSizes = [
  { value: 'a4', label: 'A4 (210 x 297 mm)', aspectRatio: 210 / 297, widthMM: 210, heightMM: 297 },
  { value: 'a5', label: 'A5 (148 x 210 mm)', aspectRatio: 148 / 210, widthMM: 148, heightMM: 210 },
  { value: 'letter', label: 'Letter (8.5 x 11 in)', aspectRatio: 8.5 / 11, widthMM: 215.9, heightMM: 279.4 },
  { value: 'legal', label: 'Legal (8.5 x 14 in)', aspectRatio: 8.5 / 14, widthMM: 215.9, heightMM: 355.6 },
];

const nUpOptions = [
  { value: '1', label: '1 page per sheet' },
  { value: '2', label: '2 pages per sheet' },
  { value: '4', label: '4 pages per sheet' },
  { value: '8', label: '8 pages per sheet' },
];

const MockPageContent = ({ isColor }: { isColor: boolean }) => (
    <div className="w-full h-full p-2 flex flex-col gap-1 overflow-hidden bg-white border border-gray-200">
        {/* Header */}
        <div className={cn("h-2 w-1/3 rounded-sm", isColor ? "bg-blue-500" : "bg-gray-500")} />
        <div className="space-y-0.5">
             <div className={cn("h-1 w-full rounded-sm", isColor ? "bg-blue-300" : "bg-gray-300")} />
             <div className={cn("h-1 w-5/6 rounded-sm", isColor ? "bg-blue-300" : "bg-gray-300")} />
        </div>
        
        {/* Image and Text block */}
        <div className="flex-grow flex gap-1">
            <div className="w-1/3 h-full flex flex-col gap-0.5">
                 <div className={cn("h-1 w-full rounded-sm", isColor ? "bg-blue-300" : "bg-gray-300")} />
                 <div className={cn("h-1 w-full rounded-sm", isColor ? "bg-blue-300" : "bg-gray-300")} />
                 <div className={cn("h-1 w-full rounded-sm", isColor ? "bg-blue-300" : "bg-gray-300")} />
            </div>
            <div className={cn("w-2/3 h-full rounded-sm", isColor ? "bg-pink-200" : "bg-gray-200")} />
        </div>

        <div className="space-y-0.5">
             <div className={cn("h-1 w-full rounded-sm", isColor ? "bg-blue-300" : "bg-gray-300")} />
             <div className={cn("h-1 w-full rounded-sm", isColor ? "bg-blue-300" : "bg-gray-300")} />
             <div className={cn("h-1 w-3/4 rounded-sm", isColor ? "bg-blue-300" : "bg-gray-300")} />
        </div>
    </div>
);

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


export default function PrintSetupPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [selectedPaperSize, setSelectedPaperSize] = useState('a4');
  const [margins, setMargins] = useState({ top: '20', bottom: '20', left: '20', right: '20' }); // in mm
  const [nUpValue, setNUpValue] = useState('1');
  const [pageRange, setPageRange] = useState('');
  const [isColor, setIsColor] = useState(true);
  const [isDuplex, setIsDuplex] = useState(false);
  const { toast } = useToast();
  const { documents } = useDocumentQueue();
  const searchParams = useSearchParams();

  const handleFileSelect = (files: File[]) => {
    setSelectedFile(files[0] || null);
  };
  
  useEffect(() => {
    const docId = searchParams.get('docId');
    if (docId) {
        const doc = documents.find(d => d.id === docId);
        if (doc && doc.dataUri) {
            try {
                const newFile = dataURLtoFile(doc.dataUri, doc.name);
                handleFileSelect([newFile]);
                toast({ title: "Document Loaded", description: "Ready to configure print settings." });
            } catch (error) {
                toast({ title: "Load Failed", description: "Could not load the transferred document.", variant: "destructive" });
            }
        }
    }
  }, [searchParams, documents, toast]);

  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setFileUrl(url);

      // Cleanup function to revoke the object URL
      return () => {
        URL.revokeObjectURL(url);
        setFileUrl(null);
      };
    }
  }, [selectedFile]);


  const handleMarginChange = (e: React.ChangeEvent<HTMLInputElement>, side: keyof typeof margins) => {
    setMargins(prev => ({ ...prev, [side]: e.target.value }));
  };


  const handlePrint = () => {
    if (!selectedFile || !fileUrl) return;
    
    // Create a hidden iframe for printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    
    iframe.src = fileUrl;
    
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      
      // Remove the iframe after printing dialog closes (approximate)
      setTimeout(() => {
        if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
        }
      }, 1000);
    };

    toast({ title: "Opening Print Dialog", description: "Your document is being sent to the printer." });
  };

  const currentPaper = paperSizes.find(p => p.value === selectedPaperSize) || paperSizes[0];
  
  const getPaddingStyle = () => {
    if (!selectedFile) return {};
    const top = (Number(margins.top) / currentPaper.heightMM) * 100;
    const bottom = (Number(margins.bottom) / currentPaper.heightMM) * 100;
    const left = (Number(margins.left) / currentPaper.widthMM) * 100;
    const right = (Number(margins.right) / currentPaper.widthMM) * 100;
    
    // Clamp values to prevent weird layouts if user enters huge numbers
    const clamp = (val: number) => Math.max(0, Math.min(val, 49));

    return {
        padding: `${clamp(top)}% ${clamp(right)}% ${clamp(bottom)}% ${clamp(left)}%`
    };
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl font-headline">
            <Printer className="mr-2 h-6 w-6 text-primary" /> Print Setup & Preview
          </CardTitle>
          <CardDescription>
            Upload a document to configure print settings and preview the layout.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <FileUpload
            label="Upload Document"
            onFileSelect={handleFileSelect}
            id="print-setup-upload"
          />

          {/* Document Viewer */}
          <Card className="shadow-inner">
            <CardHeader>
              <CardTitle className="text-xl flex items-center"><Eye className="mr-2 h-5 w-5 text-primary/80"/>Document Preview</CardTitle>
              <CardDescription>A preview of your uploaded file. Layout options are simulated below.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96 bg-muted/50 rounded-md flex items-center justify-center border border-dashed">
                {selectedFile && fileUrl ? (
                    <embed src={fileUrl} type={selectedFile.type} className="w-full h-full" />
                ) : (
                  <p className="text-muted-foreground">Upload a document to see a preview.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Print Settings */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-1">
              <Label htmlFor="paper-size" className="font-medium">Paper Size</Label>
              <Select value={selectedPaperSize} onValueChange={setSelectedPaperSize} disabled={!selectedFile}>
                <SelectTrigger id="paper-size"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {paperSizes.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="n-up" className="font-medium"><Layers className="inline mr-1 h-4 w-4"/>Pages per Sheet (N-up)</Label>
              <Select value={nUpValue} onValueChange={setNUpValue} disabled={!selectedFile}>
                <SelectTrigger id="n-up"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {nUpOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="page-range" className="font-medium">Page Selection & Range</Label>
              <Input 
                id="page-range" 
                placeholder="e.g., 1-3, 5, 7-10" 
                value={pageRange} 
                onChange={e => setPageRange(e.target.value)} 
                disabled={!selectedFile}
              />
            </div>

            <div className="md:col-span-2 lg:col-span-3 space-y-2">
              <Label className="font-medium block mb-1">Margins (mm)</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div>
                  <Label htmlFor="margin-top" className="text-xs">Top</Label>
                  <Input id="margin-top" type="number" value={margins.top} onChange={e => handleMarginChange(e, 'top')} disabled={!selectedFile}/>
                </div>
                <div>
                  <Label htmlFor="margin-bottom" className="text-xs">Bottom</Label>
                  <Input id="margin-bottom" type="number" value={margins.bottom} onChange={e => handleMarginChange(e, 'bottom')} disabled={!selectedFile}/>
                </div>
                <div>
                  <Label htmlFor="margin-left" className="text-xs">Left</Label>
                  <Input id="margin-left" type="number" value={margins.left} onChange={e => handleMarginChange(e, 'left')} disabled={!selectedFile}/>
                </div>
                <div>
                  <Label htmlFor="margin-right" className="text-xs">Right</Label>
                  <Input id="margin-right" type="number" value={margins.right} onChange={e => handleMarginChange(e, 'right')} disabled={!selectedFile}/>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch id="color-mode" checked={isColor} onCheckedChange={setIsColor} disabled={!selectedFile}/>
              <Label htmlFor="color-mode" className="font-medium flex items-center"><Palette className="inline mr-1 h-4 w-4"/>{isColor ? 'Color Printing' : 'Black & White'}</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch id="duplex-mode" checked={isDuplex} onCheckedChange={setIsDuplex} disabled={!selectedFile}/>
              <Label htmlFor="duplex-mode" className="font-medium flex items-center"><Columns className="inline mr-1 h-4 w-4"/>{isDuplex ? 'Double-sided' : 'Single-sided'}</Label>
            </div>
          </div>

          {/* Simulated Print Preview */}
           <Card className="shadow-inner">
            <CardHeader>
              <CardTitle className="text-xl flex items-center"><Settings2 className="mr-2 h-5 w-5 text-primary/80"/>Layout Simulation</CardTitle>
              <CardDescription>A simulation of how your document will be laid out on the page with the current settings.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96 w-full bg-muted/30 rounded-md flex items-center justify-center border border-dashed p-4 overflow-hidden relative">
                {selectedFile ? (
                <div 
                    className="bg-gray-400 shadow-lg h-full"
                    style={{ 
                        aspectRatio: currentPaper.aspectRatio,
                    }}
                >
                    <div className="w-full h-full bg-white"
                        style={getPaddingStyle()}
                    >
                         <div className={cn(
                            "w-full h-full grid gap-1",
                            nUpValue === '1' && 'grid-cols-1 grid-rows-1',
                            nUpValue === '2' && 'grid-cols-1 grid-rows-2',
                            nUpValue === '4' && 'grid-cols-2 grid-rows-2',
                            nUpValue === '8' && 'grid-cols-2 grid-rows-4',
                        )}>
                            {Array.from({ length: Math.min(Number(nUpValue), 8) }).map((_, i) => (
                                <div key={i}>
                                    <MockPageContent isColor={isColor}/>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                ) : (
                    <p className="text-center text-muted-foreground">
                        Upload a document and configure settings to see a layout simulation.
                    </p>
                )}
                 {selectedFile && (
                    <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground p-1 bg-background/50 rounded">
                        {isColor ? 'Color' : 'B&W'} / {isDuplex ? 'Duplex' : 'Single-sided'}
                    </div>
                 )}
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">Note: The layout simulation uses mock content to show margins and page division.</p>
            </CardContent>
          </Card>

        </CardContent>
        <CardFooter className="flex gap-2">
          <Button 
            className="bg-accent hover:bg-accent/90 text-accent-foreground" 
            disabled={!selectedFile}
            onClick={handlePrint}
          >
            <Printer className="mr-2 h-4 w-4" /> Print Document
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={!selectedFile}>
                <Eye className="mr-2 h-4 w-4" /> Preview Layout
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-4xl">
              <DialogHeader>
                <DialogTitle>Layout Preview</DialogTitle>
                <DialogDescription>
                  A preview of your document's layout with the selected print settings. The final output may vary slightly.
                </DialogDescription>
              </DialogHeader>
              <div className="p-4 bg-muted/50 rounded-md my-4 flex justify-center items-center overflow-auto h-[70vh]">
                {selectedFile ? (
                  <div 
                      className="bg-background shadow-2xl"
                      style={{ 
                          height: '95%',
                          aspectRatio: currentPaper.aspectRatio,
                      }}
                  >
                      <div className="w-full h-full bg-white text-black"
                          style={getPaddingStyle()}
                      >
                           <div className={cn(
                              "w-full h-full grid gap-2",
                              nUpValue === '1' && 'grid-cols-1 grid-rows-1',
                              nUpValue === '2' && 'grid-cols-1 grid-rows-2',
                              nUpValue === '4' && 'grid-cols-2 grid-rows-2',
                              nUpValue === '8' && 'grid-cols-2 grid-rows-4',
                          )}>
                              {Array.from({ length: Math.min(Number(nUpValue), 8) }).map((_, i) => (
                                  <div key={i} className="overflow-hidden">
                                      <MockPageContent isColor={isColor}/>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
                ) : (
                  <p>No document uploaded to preview.</p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </CardFooter>
      </Card>
    </div>
  );
}
