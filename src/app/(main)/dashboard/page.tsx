// src/app/(main)/dashboard/page.tsx
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DocumentQueueItem, DocumentSource } from "@/types";
import { Trash2, UploadCloud, CheckCircle, AlertTriangle, Loader2, Clock, FilePlus, FilePlus2, Mail, QrCode, Printer, Pencil, ImageIcon, Download, Eye, Settings, Bell, Send, X, RefreshCw, Share2, Copy, MessageSquare, Merge } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { QrCodeDisplay } from "@/components/app/qr-code-display";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
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
import { FileUpload } from "@/components/app/file-upload";
import { useToast } from '@/hooks/use-toast';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useAuth } from '@/contexts/auth-context';
import { useDocumentQueue } from '@/contexts/document-context';
import { Checkbox } from '@/components/ui/checkbox';
import jsPDF from 'jspdf';
import { QRCodeCanvas } from 'qrcode.react';
import { formatDistanceToNow } from 'date-fns';
import { BatchUpload } from '@/components/app/batch-upload';
import { useWebRTC } from '@/hooks/use-webrtc';
import { cn } from '@/lib/utils';


const StatusBadge = ({ status }: { status: DocumentQueueItem['status'] }) => {
  switch (status) {
    case 'Pending Review':
      return <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300"><Clock className="mr-1 h-3 w-3" />{status}</Badge>;
    case 'Processing':
      return <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300"><Loader2 className="mr-1 h-3 w-3 animate-spin" />{status}</Badge>;
    case 'Completed':
      return <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-white"><CheckCircle className="mr-1 h-3 w-3" />{status}</Badge>;
    case 'Error':
      return <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />{status}</Badge>;
    case 'Queued':
      return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />{status}</Badge>;
    case 'Edited':
      return <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300"><Pencil className="mr-1 h-3 w-3" />{status}</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}


const SourceDisplay = ({ source, senderContact }: { source?: DocumentSource; senderContact?: string }) => {
  if (!source) return <span className="text-muted-foreground">Unknown</span>;

  let icon = null;
  switch (source) {
    case 'Gmail':
      icon = <Mail className="mr-1 h-4 w-4 text-red-500" />;
      break;
    case 'WhatsApp Bot':
      icon = <MessageSquare className="mr-1 h-4 w-4 text-green-500" />;
      break;
    case 'QR Upload':
        icon = <QrCode className="mr-1 h-4 w-4 text-purple-500" />;
        break;
    case 'Direct Upload':
      icon = <UploadCloud className="mr-1 h-4 w-4 text-blue-500" />;
      break;
    default:
      icon = <Clock className="mr-1 h-4 w-4 text-gray-500" />;
  }

  return (
    <div className="flex items-center">
      {icon}
      <span>{source}</span>
    </div>
  );
};

const getBatchTypeSummary = (files: DocumentQueueItem['files']): string => {
    if (!files || files.length === 0) {
        return 'Batch (empty)';
    }

    const counts = files.reduce((acc, file) => {
        const type = file.type || 'Unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const summary = Object.entries(counts)
        .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
        .join(', ');

    return `Batch (${summary})`;
};

export default function DashboardPage() {
  const { documents, addDocuments, deleteMultipleDocuments, autoDeletePolicy, setAutoDeletePolicy, qrSessionId: legacyQrSessionId, notifications, clearNotifications, forcePoll, isPolling } = useDocumentQueue();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<'all' | 'selected' | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [batchToView, setBatchToView] = useState<DocumentQueueItem | null>(null);
  const [selectedBatchFileNames, setSelectedBatchFileNames] = useState<Set<string>>(new Set());
  const [isSelectionModeActive, setIsSelectionModeActive] = useState(false);

  const { toast } = useToast();
  const router = useRouter();
  const { user } = useAuth();
  
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  
  // --- WebRTC Integration START ---
  const [isSameShareDialogOpen, setIsSameShareDialogOpen] = useState(false);
  const [webRTCSessionId, setWebRTCSessionId] = useState<string | null>(null);

  // Initialize WebRTC hook as host when the dialog opens
  const { isConnected, receivedFiles, clearReceivedFiles, statusMessage } = useWebRTC(true, webRTCSessionId);

  useEffect(() => {
    if (isSameShareDialogOpen && !webRTCSessionId) {
      // Generate a unique session ID for this WebRTC session
      setWebRTCSessionId(`webrtc-session-${Date.now()}`);
    } else if (!isSameShareDialogOpen) {
      // Reset session when dialog closes
      setWebRTCSessionId(null);
    }
  }, [isSameShareDialogOpen, webRTCSessionId]);
  
  const getWebRTCShareUrl = () => {
    if (typeof window !== 'undefined' && webRTCSessionId) {
        return `${window.location.origin}/share?sessionId=${webRTCSessionId}`;
    }
    return '';
  };
  
  useEffect(() => {
    if (receivedFiles.length > 0) {
      const docsToCreate: DocumentQueueItem[] = [];
      const filePromises = receivedFiles.map(file => {
          return new Promise<DocumentQueueItem>(resolve => {
            const fileBlob = new Blob([file.data], { type: file.type });
            const dataUri = URL.createObjectURL(fileBlob);
            
            const fileItem = {
              id: `doc-${file.name}-${Date.now()}-${Math.random()}`,
              name: file.name,
              type: file.type.startsWith('image/') ? 'Image' : file.type.startsWith('video/') ? 'Video' : 'PDF',
              status: 'Queued',
              uploadedAt: new Date(),
              size: formatFileSize(file.size),
              source: 'QR Upload',
              senderContact: 'Same Share User',
              dataUri: dataUri,
            };
            docsToCreate.push(fileItem as DocumentQueueItem);
            resolve(fileItem as DocumentQueueItem);
          });
      });

      Promise.all(filePromises).then((newDocs) => {
        addDocuments(newDocs);
        toast({
          title: "File(s) Received!",
          description: `${newDocs.length} file(s) arrived via Same Share.`,
        });
        clearReceivedFiles();
      })
    }
  }, [receivedFiles, addDocuments, toast, clearReceivedFiles]);
  // --- WebRTC Integration END ---

  const uniqueId = useMemo(() => `EDITROY-USER-${user?.id || '12345'}`, [user]);

  const selectedBatchFiles = useMemo(() => {
    if (!batchToView?.files) return [];
    return batchToView.files.filter(file => selectedBatchFileNames.has(file.name));
  }, [batchToView, selectedBatchFileNames]);

  const handleEditDocument = (docId: string, editor?: 'id-copier' | 'passport-photo' | 'image-editor' | 'print-setup' | 'document-utilities' | 'video-editor') => {
    let targetPath: string | null = null;
    let finalDocId = docId;
    let docToEdit: DocumentQueueItem | Omit<DocumentQueueItem, 'id' | 'files' | 'status'> | undefined;

    const topLevelDoc = documents.find(d => d.id === docId);

    if (topLevelDoc) {
        docToEdit = topLevelDoc;
    } else {
        // Search inside batches if not a top-level doc
        for (const batchDoc of documents.filter(d => d.type === 'Batch' && d.files)) {
            const fileInBatch = batchDoc.files?.find(f => `batch-file-${f.name}` === docId);
            if (fileInBatch) {
                docToEdit = fileInBatch;
                // We need to pass the *parent* batch document's ID to the editor
                // so it can find the source document to update later.
                finalDocId = batchDoc.id; 
                break;
            }
        }
    }
    
    if (!docToEdit) {
        toast({ title: 'Document Not Found', description: 'Could not find the document to edit.', variant: 'destructive' });
        return;
    }

    const docType = docToEdit.type;

    if (!editor) {
        switch (docType) {
            case 'Image': targetPath = '/image-editor'; break;
            case 'Video': targetPath = '/video-editor'; break;
            default: targetPath = '/document-utilities';
        }
    } else {
        const editorMap = {
            'image-editor': '/image-editor',
            'id-copier': '/id-copier',
            'passport-photo': '/passport-photo',
            'print-setup': '/print-setup',
            'document-utilities': '/document-utilities',
            'video-editor': '/video-editor',
        };
        targetPath = editorMap[editor as keyof typeof editorMap];
    }
    
    // Pass the correct docId to the editor page
    router.push(`${targetPath}?docId=${encodeURIComponent(finalDocId)}`);
  };

  const handleDownload = (doc: DocumentQueueItem | Omit<DocumentQueueItem, 'id' | 'files' | 'status'>) => {
    if (!('dataUri' in doc) || !doc.dataUri) {
        toast({ title: 'Cannot Download', description: 'No data available for this document.', variant: 'destructive' });
        return;
    }
    const link = document.createElement('a');
    link.href = doc.dataUri;
    link.download = doc.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: 'Download Started', description: `Downloading ${doc.name}.` });
  };
  
  const handleSendBack = async (doc: DocumentQueueItem, fileToSend: Omit<DocumentQueueItem, 'id' | 'files' | 'status'>) => {
    if (!fileToSend || !fileToSend.dataUri || !doc.senderSessionId) {
      toast({ title: 'Cannot Send Back', description: 'Missing data or sender information.', variant: 'destructive' });
      return;
    }
  
    toast({ title: 'Sending...', description: `Sending ${fileToSend.name} back to user.` });
  
    try {
      const response = await fetch(fileToSend.dataUri);
      const blob = await response.blob();
      const file = new File([blob], fileToSend.name, { type: blob.type });
  
      const formData = new FormData();
      formData.append('file', file);
      formData.append('senderSessionId', doc.senderSessionId);
      formData.append('fileName', fileToSend.name);
  
      const sendResponse = await fetch('/api/send-back', {
        method: 'POST',
        body: formData,
      });
  
      if (!sendResponse.ok) {
        throw new Error('Server failed to process the file.');
      }
  
      toast({ title: 'File Sent', description: `${fileToSend.name} has been sent back successfully.` });
    } catch (error) {
      console.error("Failed to send file back:", error);
      toast({ title: 'Send Back Failed', description: 'Could not send the file back to the user.', variant: 'destructive' });
    }
  };

  const handleDirectPrint = (doc: DocumentQueueItem | Omit<DocumentQueueItem, 'id' | 'files' | 'status'>) => {
    if (!('dataUri' in doc) || !doc.dataUri) {
      toast({ title: 'Cannot Print', description: 'No printable data is available.', variant: 'destructive' });
      return;
    }
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.visibility = 'hidden';
      iframe.style.height = '0';
      iframe.style.width = '0';
      iframe.style.border = 'none';
      iframe.src = doc.dataUri;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          toast({ title: 'Print Failed', description: 'Could not open print dialog.', variant: 'destructive' });
        } finally {
          setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 1000);
        }
      };
    } catch (e) {
      console.error("Printing failed", e);
      toast({ title: 'Print Failed', description: 'An error occurred while preparing document for printing.', variant: 'destructive' });
    }
  };
  
  // This is the legacy QR code generator for the printable sheet.
  const getQrCodeUrl = (type: 'upload' | 'share') => {
    if (typeof window !== 'undefined' && legacyQrSessionId) {
        const page = type === 'upload' ? '/upload' : '/share'; // Point share to upload page for now
        return `${window.location.origin}${page}?sessionId=${legacyQrSessionId}`;
    }
    return '';
  };

  const downloadQrSheet = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;

    const getQrDataUrl = (canvasId: string): string => {
        const canvasWrapper = document.getElementById(canvasId);
        if (canvasWrapper) {
            const innerCanvas = canvasWrapper.querySelector('canvas');
            if (innerCanvas) { return innerCanvas.toDataURL('image/png'); }
        }
        return '';
    };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('Editroy - Upload Your Documents', pageWidth / 2, margin + 5, { align: 'center' });

    const directUploadY = margin + 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Option 1: Direct Upload via QR', margin, directUploadY);
    const qrUploadDataUrl = getQrDataUrl('direct-upload-qr');
    if (qrUploadDataUrl) doc.addImage(qrUploadDataUrl, 'PNG', margin, directUploadY + 5, 60, 60);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const directUploadText = "Scan this QR code with your phone's camera to open a web page. You can then upload files directly from your phone to this dashboard.";
    doc.text(directUploadText, margin + 70, directUploadY + 15, { maxWidth: pageWidth - margin * 2 - 70 });

    const whatsappY = directUploadY + 80;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Option 2: Upload via WhatsApp', margin, whatsappY);
    const qrWhatsAppDataUrl = getQrDataUrl('hidden-whatsapp-qr-wrapper');
    if (qrWhatsAppDataUrl) doc.addImage(qrWhatsAppDataUrl, 'PNG', margin, whatsappY + 5, 60, 60);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const whatsappText = `1. Scan to open a chat with our bot.\n2. Send the message: Connect me using ID: ${uniqueId}\n3. Once connected, send documents to the bot.`;
    doc.text(whatsappText, margin + 70, whatsappY + 15, { maxWidth: pageWidth - margin * 2 - 70 });
    
    doc.save('Editroy_QR_Sheet.pdf');
  };
  
  const handleBatchSelectionChange = (fileName: string, isSelected: boolean) => {
    setSelectedBatchFileNames(prev => {
        const newSet = new Set(prev);
        if (isSelected) { newSet.add(fileName); } else { newSet.delete(fileName); }
        return newSet;
    });
  };

  const handleBatchSelectAll = (isChecked: boolean) => {
      if (isChecked) { setSelectedBatchFileNames(new Set(batchToView?.files?.map(f => f.name) || [])); } 
      else { setSelectedBatchFileNames(new Set()); }
  };

  const handleMergePdfs = () => {
    if (selectedBatchFiles.length < 2) return;
    const pdfs = selectedBatchFiles.filter(f => f.type === 'PDF');
    if (pdfs.length !== selectedBatchFiles.length) {
      toast({ title: 'Invalid Selection', description: 'Please select only PDF files to merge.', variant: 'destructive' });
      return;
    }
    sessionStorage.setItem('mergePdfSources', JSON.stringify({ uris: pdfs.map(f => f.dataUri), names: pdfs.map(f => f.name) }));
    router.push('/document-utilities?tool=mergePdf');
    setBatchToView(null);
  };

  const handleCreatePdfFromImages = () => {
    if (selectedBatchFiles.length === 0) return;
    const images = selectedBatchFiles.filter(f => f.type === 'Image');
    if (images.length !== selectedBatchFiles.length) {
      toast({ title: 'Invalid Selection', description: 'Please select only Image files to create a PDF.', variant: 'destructive' });
      return;
    }
    sessionStorage.setItem('imageToPdfSources', JSON.stringify(images.map(f => ({ id: f.name, name: f.name, dataUri: f.dataUri }))));
    router.push('/image-editor?tool=imageToPdf');
    setBatchToView(null);
  };
  
  const handleSelectionChange = (docId: string, isSelected: boolean) => {
    setSelectedDocs(prev => {
        const newSet = new Set(prev);
        if (isSelected) newSet.add(docId);
        else newSet.delete(docId);
        return newSet;
    });
  };

  const handleSelectAll = (isChecked: boolean) => {
      if (isChecked) setSelectedDocs(new Set(documents.map(d => d.id)));
      else setSelectedDocs(new Set());
  };
  
  const handleDeleteAction = () => {
    if (showDeleteConfirm === 'all') {
      deleteMultipleDocuments(documents.map(d => d.id));
      toast({ title: 'All Documents Deleted', description: 'The queue has been cleared.' });
    } else if (showDeleteConfirm === 'selected') {
      deleteMultipleDocuments(Array.from(selectedDocs));
      toast({ title: 'Documents Deleted', description: `${selectedDocs.size} documents have been removed.` });
    }
    setSelectedDocs(new Set());
    setIsSelectionModeActive(false);
    setShowDeleteConfirm(null);
  };

  return (
  <div className="space-y-6">

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline text-primary">Editroy Dashboard</CardTitle>
          <CardDescription>Welcome back! Here's an overview of your document queue and available tools.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex-grow space-y-4">
            <p>You can manage your uploaded documents below or access various tools from the sidebar to process your files.</p>
            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  <FilePlus2 className="mr-2 h-4 w-4" /> Create Batch & Upload
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create a New Batch</DialogTitle>
                  <DialogDescription>Add one or more files to create a single batch item in your queue.</DialogDescription>
                </DialogHeader>
                <BatchUpload onBatchCreate={(docs) => {
                    addDocuments(docs);
                    setIsUploadDialogOpen(false);
                }}/>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Receive Files</CardTitle>
          <CardDescription>Scan the QR code from another device to send files directly to this dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr,auto] items-center gap-6 border rounded-lg p-4">
            <div className="space-y-2 min-w-0">
              <p className="text-sm text-muted-foreground">Scan the QR code with your phone to open a simple upload page. Files sent from there will appear instantly in your queue below.</p>
            </div>
            <div className="flex flex-col items-center space-y-2">
              <QrCodeDisplay value={getQrCodeUrl('upload')} size={120} id="direct-upload-qr" className="rounded-md" />
              <p className="text-xs text-muted-foreground">QR Upload</p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap items-start gap-4">
          <Button onClick={downloadQrSheet}>
            <Download className="mr-2 h-4 w-4" /> Download Printable QR Sheet
          </Button>
          <Button variant="outline" onClick={() => setIsSameShareDialogOpen(true)}>
            <Share2 className="mr-2 h-4 w-4" /> Same Share
          </Button>
        </CardFooter>
      </Card>
      


      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-start justify-between">
            <div className="space-y-1.5">
                <CardTitle className="text-2xl font-headline">Document Queue</CardTitle>
                <CardDescription>Documents awaiting review and processing.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={forcePoll} disabled={isPolling} title="Refresh Queue">
                    <RefreshCw className={isPolling ? 'animate-spin' : ''}/>
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="relative">
                            <Bell className="h-5 w-5" />
                            {notifications.length > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                                </span>
                            )}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80">
                        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {notifications.length > 0 ? (
                            notifications.map(noti => (
                                <DropdownMenuItem key={noti.id} className="flex flex-col items-start gap-1">
                                    <p className="text-sm whitespace-normal">{noti.message}</p>
                                    <p className="text-xs text-muted-foreground">{formatDistanceToNow(noti.time, { addSuffix: true })}</p>
                                </DropdownMenuItem>
                            ))
                        ) : ( <DropdownMenuItem disabled>No new notifications</DropdownMenuItem> )}
                         <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => clearNotifications()}>Clear Notifications</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm"><Settings className="mr-2 h-4 w-4" />Auto-Delete Policy</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Delete Documents After</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup value={autoDeletePolicy} onValueChange={setAutoDeletePolicy}>
                            <DropdownMenuRadioItem value="never">Never</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="15m">15 Minutes</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="30m">30 Minutes</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="1h">1 Hour</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="5h">5 Hours</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="8h">8 Hours</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="1">1 Day</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="destructive" size="sm"><Trash2 className="mr-2 h-4 w-4" />Manual Delete</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => setIsSelectionModeActive(true)} disabled={documents.length === 0}>
                            Delete Selected...
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setShowDeleteConfirm('all')} disabled={documents.length === 0}>
                            Delete All ({documents.length})
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </CardHeader>
        {isSelectionModeActive && (
          <CardFooter className="bg-primary/10 border-y py-2 px-4 flex justify-between items-center">
              <p className="text-sm font-medium text-primary">{selectedDocs.size} document(s) selected.</p>
              <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={() => setShowDeleteConfirm('selected')} disabled={selectedDocs.size === 0}>
                      <Trash2 className="mr-2 h-4 w-4" /> Delete Selected
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setIsSelectionModeActive(false); setSelectedDocs(new Set()); }}>
                      <X className="mr-2 h-4 w-4" /> Cancel
                  </Button>
              </div>
          </CardFooter>
        )}
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {isSelectionModeActive && (
                    <TableHead className="w-10">
                      <Checkbox
                          onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                          checked={selectedDocs.size > 0 && selectedDocs.size === documents.length ? true : selectedDocs.size > 0 ? "indeterminate" : false}
                          aria-label="Select all rows"
                      />
                    </TableHead>
                  )}
                  <TableHead className="w-[250px] min-w-[250px]">Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id} className="hover:bg-muted/50 transition-colors" data-state={selectedDocs.has(doc.id) ? 'selected' : ''}>
                    {isSelectionModeActive && (
                      <TableCell>
                        <Checkbox
                          onCheckedChange={(checked) => handleSelectionChange(doc.id, Boolean(checked))}
                          checked={selectedDocs.has(doc.id)}
                          aria-label={`Select row for ${doc.name}`}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-medium" title={doc.name}>{doc.name}</TableCell>
                    <TableCell>{doc.type === 'Batch' ? getBatchTypeSummary(doc.files) : doc.type}</TableCell>
                    <TableCell><StatusBadge status={doc.status} /></TableCell>
                    <TableCell>{doc.size}</TableCell>
                    <TableCell>{doc.uploadedAt.toLocaleString()}</TableCell>
                    <TableCell title={doc.senderContact}>{doc.senderContact || 'N/A'}</TableCell>
                    <TableCell><SourceDisplay source={doc.source} senderContact={doc.senderContact} /></TableCell>
                    <TableCell className="text-right space-x-1">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Document Actions"><Pencil className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {doc.type === 'Image' && (
                                    <>
                                        <DropdownMenuItem onSelect={() => setImagePreviewUrl(doc.dataUri || null)}><Eye className="mr-2 h-4 w-4" /><span>Preview</span></DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => handleEditDocument(doc.id, 'image-editor')}><ImageIcon className="mr-2 h-4 w-4" /><span>Full Image Editor</span></DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => handleEditDocument(doc.id, 'id-copier')}><Copy className="mr-2 h-4 w-4" /><span>Send to ID & Photo Studio</span></DropdownMenuItem>
                                    </>
                                )}
                                {doc.type === 'Video' && <DropdownMenuItem onSelect={() => handleEditDocument(doc.id, 'video-editor')}><Pencil className="mr-2 h-4 w-4" /><span>Edit in Video Editor</span></DropdownMenuItem> }
                                {doc.type !== 'Image' && doc.type !== 'Video' && doc.type !== 'Batch' && <DropdownMenuItem onSelect={() => handleEditDocument(doc.id, 'document-utilities')}><Pencil className="mr-2 h-4 w-4" /><span>Edit</span></DropdownMenuItem>}
                                {doc.type === 'Batch' && <DropdownMenuItem onSelect={() => { setBatchToView(doc); setSelectedBatchFileNames(new Set()); }}><Eye className="mr-2 h-4 w-4" /><span>View Batch</span></DropdownMenuItem>}

                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => handleDownload(doc)}><Download className="mr-2 h-4 w-4" /><span>Download</span></DropdownMenuItem>
                                {doc.type !== 'Batch' && <DropdownMenuItem onSelect={() => handleEditDocument(doc.id, 'print-setup')}><Printer className="mr-2 h-4 w-4" /><span>Print Setup</span></DropdownMenuItem>}
                                <DropdownMenuSeparator />
                                {doc.source === 'QR Upload' && doc.type !== 'Batch' && doc.status === 'Edited' &&
                                  <DropdownMenuItem onSelect={() => handleSendBack(doc, doc)}><Send className="mr-2 h-4 w-4" /><span>Send Edited Version</span></DropdownMenuItem>
                                }
                                {doc.source === 'QR Upload' && doc.type !== 'Batch' && doc.status !== 'Edited' &&
                                  <DropdownMenuItem onSelect={() => handleSendBack(doc, doc)}><Send className="mr-2 h-4 w-4" /><span>Send Original Back</span></DropdownMenuItem>
                                }
                                {doc.source === 'QR Upload' && doc.type === 'Batch' && (
                                  <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>
                                      <Send className="mr-2 h-4 w-4" />
                                      <span>Send Back to QR User</span>
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuPortal>
                                      <DropdownMenuSubContent>
                                        <DropdownMenuItem onSelect={() => doc.files && handleSendBack(doc, doc.files[0])}>
                                          <span>Send Original</span>
                                        </DropdownMenuItem>
                                        {doc.files && doc.files.length > 1 && (
                                          <DropdownMenuItem onSelect={() => doc.files && handleSendBack(doc, doc.files[doc.files.length - 1])}>
                                            <span>Send Edited Version</span>
                                          </DropdownMenuItem>
                                        )}
                                      </DropdownMenuSubContent>
                                    </DropdownMenuPortal>
                                  </DropdownMenuSub>
                                )}
                                <DropdownMenuItem className="text-destructive" onSelect={() => { setSelectedDocs(new Set([doc.id])); setShowDeleteConfirm('selected'); }}><Trash2 className="mr-2 h-4 w-4" /><span>Delete</span></DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
           {documents.length === 0 && ( <p className="text-center text-muted-foreground py-8">Your document queue is empty. Upload a document to get started.</p> )}
        </CardContent>
      </Card>
      
      <AlertDialog open={!!showDeleteConfirm} onOpenChange={(open) => !open && setShowDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
                This will permanently delete {showDeleteConfirm === 'all' ? `all ${documents.length}` : selectedDocs.size} document(s) from your queue. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteConfirm(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAction} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <Dialog open={!!batchToView} onOpenChange={(open) => !open && setBatchToView(null)}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Files in: {batchToView?.name}</DialogTitle>
            <DialogDescription>Select files to perform batch actions, or edit them individually.</DialogDescription>
          </DialogHeader>
          <div className="py-4 flex-grow min-h-0">
            <ScrollArea className="h-full pr-4">
              <Table>
                <TableHeader><TableRow>
                     <TableHead className="w-10"><Checkbox onCheckedChange={(checked) => handleBatchSelectAll(Boolean(checked))} checked={selectedBatchFileNames.size > 0 && selectedBatchFileNames.size === batchToView?.files?.length ? true : selectedBatchFileNames.size > 0 ? "indeterminate" : false}/></TableHead>
                    <TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Size</TableHead><TableHead className="text-right">Actions</TableHead>
                  </TableRow></TableHeader>
                <TableBody>
                  {batchToView?.files?.map((file) => (
                    <TableRow key={file.name}>
                        <TableCell><Checkbox onCheckedChange={(checked) => handleBatchSelectionChange(file.name, Boolean(checked))} checked={selectedBatchFileNames.has(file.name)}/></TableCell>
                      <TableCell className="font-medium" title={file.name}>{file.name}</TableCell>
                      <TableCell>{file.type}</TableCell><TableCell>{file.size}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleEditDocument(`batch-file-${file.name}`)}><Pencil className="mr-2 h-4 w-4" /> Edit/View</Button>
                            {batchToView.source === 'QR Upload' && (
                                <Button variant="outline" size="sm" onClick={() => handleSendBack(batchToView, file)}><Send className="mr-2 h-4 w-4" /> Send Back</Button>
                            )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
          <DialogFooter className="border-t pt-4">
                {selectedBatchFileNames.size > 0 && (
                    <div className="flex w-full items-center justify-between">
                        <p className="text-sm text-muted-foreground">{selectedBatchFileNames.size} file(s) selected</p>
                        <div className="flex gap-2">
                            {selectedBatchFiles.every(f => f.type === 'PDF') && selectedBatchFiles.length > 1 && ( <Button size="sm" onClick={handleMergePdfs}><Merge className="mr-2 h-4 w-4"/> Merge PDFs</Button> )}
                            {selectedBatchFiles.every(f => f.type === 'Image') && ( <Button size="sm" onClick={handleCreatePdfFromImages}><FilePlus className="mr-2 h-4 w-4"/> Create PDF</Button> )}
                        </div>
                    </div>
                )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!imagePreviewUrl} onOpenChange={(open) => !open && setImagePreviewUrl(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader><DialogTitle>Image Preview</DialogTitle></DialogHeader>
          <div className="py-4">{imagePreviewUrl && <Image src={imagePreviewUrl} alt="Image Preview" width={800} height={600} className="w-full h-auto object-contain max-h-[70vh] rounded-md" data-ai-hint="document image"/>}</div>
        </DialogContent>
      </Dialog>

      <Dialog open={isSameShareDialogOpen} onOpenChange={setIsSameShareDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Same Share (Direct P2P Transfer)</DialogTitle>
                <DialogDescription>
                    Scan the QR code with another device on any network to send files directly to this dashboard. Powered by WebRTC for a zero-cost, private transfer.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4 flex flex-col items-center">
                {webRTCSessionId ? (
                    <>
                        <QrCodeDisplay value={getWebRTCShareUrl()} size={256} id="same-share-webrtc-qr" />
                        <div className="flex items-center gap-2 text-sm">
                            <span className={cn("h-2.5 w-2.5 rounded-full", isConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse')}></span>
                            <span>{isConnected ? 'A peer is connected.' : 'Waiting for a peer to connect...'}</span>
                        </div>
                        <p className="text-xs text-muted-foreground text-center">
                            This QR code is unique for this session. Close this dialog to invalidate it.
                        </p>
                    </>
                ) : (
                    <div className="h-[256px] flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin"/>
                        <p className="ml-2">Initializing secure session...</p>
                    </div>
                )}
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsSameShareDialogOpen(false)}>Close</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
