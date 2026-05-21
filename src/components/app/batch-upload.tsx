
// src/components/app/batch-upload.tsx
"use client";

import { useState } from 'react';
import type { DocumentQueueItem } from '@/types';
import { FileUpload } from './file-upload';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FilePlus2, X } from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useAuth } from '@/contexts/auth-context';

interface BatchUploadProps {
  onBatchCreate: (docs: DocumentQueueItem[]) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getDocumentType(fileType: string, fileName: string): DocumentQueueItem['type'] {
  const lowerName = fileName.toLowerCase();
  if (fileType.startsWith('application/pdf') || lowerName.endsWith('.pdf')) return 'PDF';
  if (fileType.startsWith('application/msword') || fileType.startsWith('application/vnd.openxmlformats-officedocument.wordprocessingml.document') || lowerName.endsWith('.doc') || lowerName.endsWith('.docx')) return 'Word';
  if (fileType.startsWith('application/vnd.ms-excel') || fileType.startsWith('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') || lowerName.endsWith('.xls') || lowerName.endsWith('.xlsx')) return 'Excel';
  if (fileType.startsWith('image/')) return 'Image';
  if (fileType.startsWith('video/')) return 'Video';
  if (fileType.startsWith('application/vnd.ms-powerpoint') || fileType.startsWith('application/vnd.openxmlformats-officedocument.presentationml.presentation') || lowerName.endsWith('.ppt') || lowerName.endsWith('.pptx')) return 'PowerPoint';
  if (fileType.startsWith('text/')) return 'Text';
  return 'PDF';
}

const fileToDataUri = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
};

export function BatchUpload({ onBatchCreate }: BatchUploadProps) {
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const [batchName, setBatchName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleFileSelect = (newFiles: File[]) => {
    setFilesToUpload(prev => {
        const existingNames = new Set(prev.map(f => f.name + f.size));
        const uniqueNewFiles = newFiles.filter(f => !existingNames.has(f.name + f.size));
        return [...prev, ...uniqueNewFiles];
    });
  };

  const handleRemoveFile = (fileToRemove: File) => {
    setFilesToUpload(prev => prev.filter(f => f !== fileToRemove));
  }

  const handleCreateBatch = async () => {
    if (filesToUpload.length === 0) {
      toast({ title: "No files selected", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    try {
      const filePromises = filesToUpload.map(async file => ({
        id: `doc-${file.name}-${file.lastModified}-${Math.random()}`,
        name: file.name,
        type: getDocumentType(file.type, file.name),
        status: 'Queued' as const,
        uploadedAt: new Date(),
        size: formatFileSize(file.size),
        dataUri: await fileToDataUri(file),
      }));
      const newDocs = await Promise.all(filePromises);

      const batchDoc: DocumentQueueItem = {
        id: `batch-${Date.now()}`,
        name: batchName || `Batch Upload (${newDocs.length} files)`,
        type: 'Batch',
        status: 'Queued',
        uploadedAt: new Date(),
        size: formatFileSize(newDocs.reduce((acc, _, index) => acc + filesToUpload[index].size, 0)),
        source: 'Direct Upload',
        senderContact: user?.email || 'user@editroy.com',
        files: newDocs,
      };

      onBatchCreate([batchDoc]);
      toast({ title: "Batch Created", description: `Added "${batchDoc.name}" to the queue.` });
    } catch (e) {
      console.error(e);
      toast({ title: "Error Creating Batch", description: "Could not process files.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="batch-name">Batch Name (Optional)</Label>
        <Input 
          id="batch-name" 
          value={batchName} 
          onChange={(e) => setBatchName(e.target.value)}
          placeholder={`e.g., "Monthly Reports"`}
        />
      </div>
      <FileUpload onFileSelect={handleFileSelect} id="batch-file-upload" multiple />
      {filesToUpload.length > 0 && (
        <div className="space-y-2">
            <Label>Files in Batch ({filesToUpload.length})</Label>
            <div className="max-h-48 overflow-y-auto space-y-1 rounded-md border p-2">
                {filesToUpload.map(file => (
                    <div key={file.name + file.lastModified} className="flex items-center justify-between text-sm p-1 rounded bg-muted/50">
                        <span className="truncate">{file.name}</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleRemoveFile(file)}>
                            <X className="h-3 w-3"/>
                        </Button>
                    </div>
                ))}
            </div>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button onClick={handleCreateBatch} disabled={filesToUpload.length === 0 || isProcessing}>
          {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FilePlus2 className="mr-2 h-4 w-4" />}
          Create Batch
        </Button>
      </div>
    </div>
  );
}
