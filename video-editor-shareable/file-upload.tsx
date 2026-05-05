
// src/components/app/file-upload.tsx
"use client";

import { useState, useCallback, type ChangeEvent, type DragEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { UploadCloud, FileText, XCircle, Files } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
  acceptedFileTypes?: string;
  label?: string;
  id?: string;
  multiple?: boolean;
  sessionId?: string; // Optional sessionId for direct uploads
}

export function FileUpload({
  onFileSelect,
  acceptedFileTypes = "*/*",
  label = "Upload a file",
  id = "file-upload",
  multiple = false,
  sessionId,
}: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = (fileList: FileList | null) => {
    if (!fileList) return [];
    
    const files = Array.from(fileList);
    const acceptedTypesArray = acceptedFileTypes.split(',').map(t => t.trim());

    const validFiles = files.filter(file => {
      if (acceptedFileTypes === "*/*") return true;
      return acceptedTypesArray.some(type => {
        const normalizedType = type.replace(/\*/g, '');
        if (normalizedType.startsWith('.')) { // file extension check
          return file.name.toLowerCase().endsWith(normalizedType.toLowerCase());
        } else { // MIME type check
          return file.type.startsWith(normalizedType);
        }
      });
    });
    
    if (files.length > validFiles.length) {
        console.warn("Some files were of an invalid type and were ignored.");
        // Maybe show a toast here in a real app
    }

    return multiple ? validFiles : (validFiles.length > 0 ? [validFiles[0]] : []);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = processFiles(event.target.files);
    setSelectedFiles(files);
    onFileSelect(files);
  };

  const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    const files = processFiles(event.dataTransfer.files);
    setSelectedFiles(files);
    onFileSelect(files);
  }, [onFileSelect, acceptedFileTypes, multiple]);

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const clearSelection = () => {
    setSelectedFiles([]);
    onFileSelect([]);
    const inputElement = document.getElementById(id) as HTMLInputElement;
    if (inputElement) {
      inputElement.value = "";
    }
  };
  
  const singleFile = selectedFiles[0];

  return (
    <div className="w-full space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
      <div
        className={cn(
          "flex flex-col items-center justify-center w-full min-h-[12rem] p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
          isDragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
          selectedFiles.length > 0 ? "border-primary bg-primary/5" : "bg-card"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onClick={() => document.getElementById(id)?.click()}
      >
        <Input
          id={id}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept={acceptedFileTypes}
          multiple={multiple}
        />
        {selectedFiles.length > 0 ? (
          <div className="text-center">
            {multiple ? <Files className="mx-auto h-12 w-12 text-primary" /> : <FileText className="mx-auto h-12 w-12 text-primary" />}
            
            {multiple ? (
              <p className="mt-2 text-sm font-medium text-foreground">{selectedFiles.length} file(s) selected</p>
            ) : (
              <p className="mt-2 text-sm font-medium text-foreground truncate max-w-xs">{singleFile.name}</p>
            )}

            {!multiple && singleFile && (
              <p className="text-xs text-muted-foreground">
                {(singleFile.size / 1024).toFixed(2)} KB
              </p>
            )}
            
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); clearSelection(); }} className="mt-2 text-destructive hover:text-destructive-foreground hover:bg-destructive">
              <XCircle className="mr-1 h-4 w-4" /> Clear selection
            </Button>
          </div>
        ) : (
          <div className="text-center">
            <UploadCloud className={cn("mx-auto h-12 w-12", isDragging ? "text-primary" : "text-muted-foreground")} />
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-semibold text-primary">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-muted-foreground">
              {multiple ? "Select multiple files" : "Select a single file"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {acceptedFileTypes !== "*/*" ? `Accepted: ${acceptedFileTypes}` : "Any file type"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
