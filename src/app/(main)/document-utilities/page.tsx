"use client";

import { useState, useMemo } from 'react';
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
  RefreshCcw
} from 'lucide-react';

import { UniversalConverterWheel } from '@/components/app/universal-converter-wheel';
import { DocumentToolCard } from '@/components/app/document-tool-card';
import { DOCUMENT_TOOLS, ToolCategory } from '@/lib/tools-data';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useDocumentTool } from '@/hooks/use-document-tool';
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

export default function DocumentUtilitiesPage() {
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [chainFile, setChainFile] = useState<File | null>(null);
  const [mergeFiles, setMergeFiles] = useState<File[]>([]);
  const [splitFile, setSplitFile] = useState<File | null>(null);
  const [splitRanges, setSplitRanges] = useState('1');

  const categories: ToolCategory[] = [
    'Organize', 
    'Convert to PDF', 
    'Convert from PDF', 
    'Edit & Optimize', 
    'Security', 
    'Advanced', 
    'Office Tools'
  ];

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
    setChainFile(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const { isProcessing, processStep, chainConverter, mergePdfs, splitPdf } = useDocumentTool();

  // Memoize split indices at top level to avoid hook rule violations
  const memoizedSplitIndices = useMemo(() => rangeToIndices(splitRanges), [splitRanges]);


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
              onFileSelect={(fs) => setChainFile(fs[0])} 
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

            {chainFile && (
              <div className="space-y-6">
                <div className="flex flex-col items-center gap-6 p-10 rounded-3xl bg-primary/5 border-2 border-dashed border-primary/20 text-center shadow-inner">
                   <DocumentPreview file={chainFile} mode="single" className="max-w-md mx-auto" />
                   <div className="space-y-1">
                      <p className="font-black text-2xl tracking-tight line-clamp-1">{chainFile.name}</p>
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
                    onClick={() => chainConverter(chainFile, target)}
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

  const renderMergeTool = (): React.ReactNode => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => setActiveToolId(null)} className="rounded-full">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <h2 className="text-2xl font-bold flex items-center gap-2">📑 Merge PDF</h2>
      </div>
      <Card className="border-primary/20 shadow-xl p-8">
        <FileUpload label="Drop PDFs here" onFileSelect={(fs) => setMergeFiles(prev => [...prev, ...fs])} acceptedFileTypes="application/pdf" multiple />
        {mergeFiles.length > 0 && (
          <div className="mt-8 space-y-6">
             <DocumentPreview files={mergeFiles} mode="files" />
             <div className="space-y-4">
                {mergeFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-primary/5 group hover:border-primary/20 transition-all">
                    <div className="flex items-center gap-4">
                       <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center font-black text-primary text-xs">#{i+1}</div>
                       <span className="text-sm font-bold truncate max-w-[200px]">{f.name}</span>
                    </div>
                    <XCircle className="h-5 w-5 text-muted-foreground cursor-pointer hover:text-destructive transition-colors" onClick={() => setMergeFiles(prev => prev.filter((_, idx) => idx !== i))} />
                  </div>
                ))}
             </div>
             <Button className="w-full h-16 text-lg font-black shadow-lg bg-gradient-to-r from-primary to-blue-600" onClick={() => mergePdfs(mergeFiles)} disabled={isProcessing || mergeFiles.length < 2}>
                {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <Merge className="mr-2" />} Assemble & Launch
             </Button>
          </div>
        )}
      </Card>
    </div>
  );

  const renderSplitTool = (): React.ReactNode => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => setActiveToolId(null)} className="rounded-full">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <h2 className="text-2xl font-bold flex items-center gap-2">✂️ Split PDF</h2>
      </div>
      <Card className="border-primary/20 shadow-xl p-8">
        <FileUpload label="Drop PDF to split" onFileSelect={(fs) => setSplitFile(fs[0])} acceptedFileTypes="application/pdf" />
        {splitFile && (
          <div className="mt-8 space-y-8">
             <DocumentPreview 
                file={splitFile} 
                mode="pages" 
                selectedIndices={memoizedSplitIndices}
                onSelectionChange={(indices) => setSplitRanges(indicesToRange(indices))}
             />
             <div className="space-y-4 bg-muted/20 p-6 rounded-2xl border-2 border-dashed border-primary/20">
                <div className="flex items-center justify-between">
                   <label className="text-sm font-black uppercase tracking-widest text-primary">Target Page Ranges</label>
                   <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">Manual override enabled</span>
                </div>
                <Input 
                  value={splitRanges} 
                  onChange={(e) => setSplitRanges(e.target.value)} 
                  placeholder="e.g. 1-3, 5" 
                  className="h-14 bg-white dark:bg-black/40 border-primary/20 text-lg font-bold"
                />
                <p className="text-[10px] text-muted-foreground mt-2 italic px-2">Example: "1-3, 5" will extract pages 1, 2, 3, AND 5 into a new PDF.</p>
             </div>
             <Button className="w-full h-16 text-lg font-black shadow-xl bg-gradient-to-r from-primary to-indigo-600 hover:scale-[1.01] transition-all" onClick={() => splitPdf(splitFile, splitRanges)} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <Scissors className="mr-2" />} Extract Selected Content
             </Button>
          </div>
        )}
      </Card>
    </div>
  );

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
    switch (activeToolId) {
      case 'merge-pdf': return renderMergeTool();
      case 'split-pdf': return renderSplitTool();
      default: return renderDefaultToolUI();
    }
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
            placeholder="Search 47 tools..." 
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
