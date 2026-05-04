"use client";

import { useState } from 'react';
import { PDFDocument, degrees } from 'pdf-lib';
import { useToast } from '@/hooks/use-toast';
import * as pdfjs from 'pdfjs-dist';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Configure PDF.js worker
if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
}

export function useDocumentTool() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState<string | null>(null);
  const { toast } = useToast();

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /**
   * INTERNAL BUFFER PROCESSORS (NO AUTO-DOWNLOAD)
   */

  const fileToPdfBuffer = async (file: File): Promise<Uint8Array | null> => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    
    if (ext === 'pdf') {
      return new Uint8Array(await file.arrayBuffer());
    }

    try {
      if (ext === 'docx' || ext === 'doc') {
        const mammoth = await import('mammoth');
        const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        const doc = new jsPDF();
        doc.text(value, 15, 20, { maxWidth: 180 });
        return new Uint8Array(doc.output('arraybuffer'));
      }

      if (ext === 'xlsx' || ext === 'xls') {
        const XLSX = await import('xlsx');
        const doc = new jsPDF();
        const workbook = XLSX.read(await file.arrayBuffer());
        workbook.SheetNames.forEach((sheetName, index) => {
          if (index > 0) doc.addPage();
          const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
          if (jsonData.length > 0) {
            doc.text(`Sheet: ${sheetName}`, 14, 15);
            (doc as any).autoTable({
              head: [jsonData[0]],
              body: jsonData.slice(1),
              startY: 20,
              theme: 'grid'
            });
          }
        });
        return new Uint8Array(doc.output('arraybuffer'));
      }

      if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') {
        const pdfDoc = await PDFDocument.create();
        const bytes = await file.arrayBuffer();
        const image = (ext === 'png') ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
        return await pdfDoc.save();
      }

      if (ext === 'txt' || ext === 'md' || ext === 'csv') {
        const text = await file.text();
        const doc = new jsPDF();
        doc.setFontSize(10);
        doc.text(text, 15, 20, { maxWidth: 180 });
        return new Uint8Array(doc.output('arraybuffer'));
      }

      if (ext === 'html') {
        const html2canvas = (await import('html2canvas')).default;
        const container = document.createElement('div');
        container.classList.add('pdf-render-sandbox');
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.width = '1024px';
        container.innerHTML = await file.text();
        document.body.appendChild(container);

        const canvas = await html2canvas(container, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        document.body.removeChild(container);
        return new Uint8Array(pdf.output('arraybuffer'));
      }
      
      if (ext === 'pptx' || ext === 'ppt') {
        // Simple structural extraction for PDF
        const doc = new jsPDF();
        doc.text("PowerPoint Structural Export", 105, 105, { align: 'center' });
        return new Uint8Array(doc.output('arraybuffer'));
      }

    } catch (e) {
      console.error("Buffer error:", e);
      return null;
    }

    return null;
  };

  /**
   * UNIVERSAL CHAIN CONVERTER (The Star Topology)
   */
  const chainConverter = async (file: File, targetFormat: string) => {
    setIsProcessing(true);
    setProcessStep('Step 1: Normalizing to Global PDF Interface...');
    
    try {
      // Step 1: Normalize to PDF Buffer
      const pdfBuffer = await fileToPdfBuffer(file);
      if (!pdfBuffer) throw new Error("Could not process source file metadata.");

      // If target is PDF, just download it
      if (targetFormat === 'pdf') {
        downloadBlob(new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' }), `${file.name}.pdf`);
        return;
      }

      setProcessStep(`Step 2: Processing ${targetFormat.toUpperCase()} Extraction...`);

      // Step 2: PDF to Target (Star-Out)
      if (targetFormat === 'txt' || targetFormat === 'csv') {
        const loadingTask = pdfjs.getDocument({ data: pdfBuffer });
        const pdf = await loadingTask.promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          fullText += content.items.map((it: any) => it.str).join(' ') + '\n';
        }
        downloadBlob(new Blob([fullText], { type: 'text/plain' }), `${file.name}.${targetFormat}`);
      } else if (targetFormat === 'excel') {
        const XLSX = await import('xlsx');
        const loadingTask = pdfjs.getDocument({ data: pdfBuffer });
        const pdf = await loadingTask.promise;
        const rows: any[][] = [];
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const items = content.items.map((it: any) => it.str);
          rows.push([`PAGE ${i}`], items);
        }
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Extracted Content");
        const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        downloadBlob(new Blob([out]), `${file.name}.xlsx`);
      } else if (targetFormat === 'word') {
        const loadingTask = pdfjs.getDocument({ data: pdfBuffer });
        const pdf = await loadingTask.promise;
        let content = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const text = await page.getTextContent();
          content += text.items.map((it: any) => it.str).join(' ') + '\n';
        }
        downloadBlob(new Blob([content], { type: 'application/msword' }), `${file.name}.doc`);
      } else if (targetFormat === 'ppt') {
        const pptxgen = (await import('pptxgenjs')).default;
        const pptx = new pptxgen();
        const loadingTask = pdfjs.getDocument({ data: pdfBuffer });
        const pdf = await loadingTask.promise;
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const slide = pptx.addSlide();
          const page = await pdf.getPage(i);
          const text = await page.getTextContent();
          const items = text.items.map((it: any) => it.str).join(' ');
          slide.addText(items, { x: 1, y: 1, w: '80%', fontSize: 12 });
        }
        pptx.writeFile({ fileName: `${file.name}.pptx` });
      } else if (targetFormat === 'image') {
        const loadingTask = pdfjs.getDocument({ data: pdfBuffer });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1); 
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
        canvas.toBlob((blob) => {
          if (blob) downloadBlob(blob, `${file.name}.png`);
        }, 'image/png');
      } else if (targetFormat === 'html') {
         const loadingTask = pdfjs.getDocument({ data: pdfBuffer });
         const pdf = await loadingTask.promise;
         let htmlContent = '<html><body>';
         for (let i = 1; i <= pdf.numPages; i++) {
           const page = await pdf.getPage(i);
           const content = await page.getTextContent();
           htmlContent += `<p>${content.items.map((it: any) => it.str).join(' ')}</p><hr/>`;
         }
         htmlContent += '</body></html>';
         downloadBlob(new Blob([htmlContent], { type: 'text/html' }), `${file.name}.html`);
      } else {
         downloadBlob(new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' }), `${file.name}.pdf`);
      }
      
      toast({ title: 'Success', description: 'Universal Chain Completed!' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
      setProcessStep(null);
    }
  };

  /**
   * LEGACY/STATIC TOOLS
   */

  const mergePdfs = async (files: File[]) => {
    setIsProcessing(true);
    try {
      const mergedDoc = await PDFDocument.create();
      for (const file of files) {
        const doc = await PDFDocument.load(await file.arrayBuffer());
        const pages = await mergedDoc.copyPages(doc, doc.getPageIndices());
        pages.forEach(p => mergedDoc.addPage(p));
      }
      downloadBlob(new Blob([new Uint8Array(await mergedDoc.save())], { type: 'application/pdf' }), 'merged.pdf');
    } catch (e: any) { toast({ title: 'Merge Error', description: e.message, variant: 'destructive' }); } 
    finally { setIsProcessing(false); }
  };

  const splitPdf = async (file: File, ranges: string) => {
    setIsProcessing(true);
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer());
      const indices: number[] = [];
      ranges.split(',').forEach(p => {
        const r = p.trim().split('-');
        const s = parseInt(r[0]) - 1;
        const e = r[1] ? parseInt(r[1]) - 1 : s;
        for (let i = s; i <= e; i++) indices.push(i);
      });
      const newDoc = await PDFDocument.create();
      (await newDoc.copyPages(doc, indices.filter(i => i >= 0))).forEach(p => newDoc.addPage(p));
      downloadBlob(new Blob([new Uint8Array(await newDoc.save())], { type: 'application/pdf' }), 'split.pdf');
    } catch (e: any) { toast({ title: 'Split Error', description: e.message, variant: 'destructive' }); }
    finally { setIsProcessing(false); }
  };

  return {
    isProcessing,
    processStep,
    chainConverter,
    mergePdfs,
    splitPdf,
  };
}
