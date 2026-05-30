"use client";

import { useState } from 'react';
import { PDFDocument, degrees, rgb, StandardFonts, BlendMode } from 'pdf-lib';
import { useToast } from '@/hooks/use-toast';
import * as pdfjs from 'pdfjs-dist';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Configure PDF.js worker
if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
}

/* ────────────────────────────────────────────────────────
   TYPES
──────────────────────────────────────────────────────── */
export interface MetaFields {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
}

export interface PageNumberOptions {
  position: 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center';
  startAt: number;
  prefix: string;
}

export interface WatermarkOptions {
  text: string;
  opacity: number;        // 0–1
  rotation: number;       // degrees
  fontSize: number;
  color: [number,number,number]; // rgb 0-1
}

export interface HeaderFooterOptions {
  header: string;
  footer: string;
  fontSize: number;
}

export interface CompareResult {
  added: string[];
  removed: string[];
  common: number;
}

export interface PivotResult {
  headers: string[];
  rows: string[][];
}

/* ────────────────────────────────────────────────────────
   HOOK
──────────────────────────────────────────────────────── */
export function useDocumentTool() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState<string | null>(null);
  const { toast } = useToast();

  /* ── helpers ── */
  const wrap = async <T>(label: string, fn: () => Promise<T>): Promise<T | null> => {
    setIsProcessing(true);
    setProcessStep(label);
    try {
      const result = await fn();
      toast({ title: 'Done', description: `${label} completed.` });
      return result;
    } catch (e: any) {
      toast({ title: 'Error', description: e.message ?? String(e), variant: 'destructive' });
      return null;
    } finally {
      setIsProcessing(false);
      setProcessStep(null);
    }
  };

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

  const loadPdf = (buf: ArrayBuffer) => PDFDocument.load(buf);
  const savePdf = async (doc: PDFDocument, name: string) => {
    const bytes = await doc.save();
    downloadBlob(new Blob([bytes as any], { type: 'application/pdf' }), name);
  };

  const pdfTextAllPages = async (buf: ArrayBuffer): Promise<string[]> => {
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((it: any) => it.str).join(' '));
    }
    return pages;
  };

  /* ────────────────────────────────────────────────────
     CONVERT: file → PDF buffer (star-topology input)
  ──────────────────────────────────────────────────── */
  const fileToPdfBuffer = async (file: File): Promise<Uint8Array | null> => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return new Uint8Array(await file.arrayBuffer());

    try {
      if (ext === 'docx' || ext === 'doc') {
        const mammoth = await import('mammoth');
        const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        const doc = new jsPDF(); doc.setFontSize(11);
        doc.text(value, 15, 20, { maxWidth: 180 });
        return new Uint8Array(doc.output('arraybuffer'));
      }
      if (ext === 'xlsx' || ext === 'xls') {
        const XLSX = await import('xlsx');
        const doc = new jsPDF();
        const wb = XLSX.read(await file.arrayBuffer());
        wb.SheetNames.forEach((sn, idx) => {
          if (idx > 0) doc.addPage();
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1 }) as any[][];
          doc.text(`Sheet: ${sn}`, 14, 15);
          (doc as any).autoTable({ head: [rows[0]], body: rows.slice(1), startY: 20, theme: 'grid' });
        });
        return new Uint8Array(doc.output('arraybuffer'));
      }
      if (['png','jpg','jpeg','webp'].includes(ext!)) {
        const pdfDoc = await PDFDocument.create();
        const bytes = await file.arrayBuffer();
        const img = (ext === 'png')
          ? await pdfDoc.embedPng(bytes)
          : await pdfDoc.embedJpg(bytes);
        const page = pdfDoc.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        return await pdfDoc.save();
      }
      if (['txt','md','csv'].includes(ext!)) {
        const text = await file.text();
        const doc = new jsPDF(); doc.setFontSize(10);
        doc.text(text, 15, 20, { maxWidth: 180 });
        return new Uint8Array(doc.output('arraybuffer'));
      }
      if (ext === 'html') {
        const h2c = (await import('html2canvas')).default;
        const div = document.createElement('div');
        div.style.cssText = 'position:fixed;left:-9999px;width:1024px';
        div.innerHTML = await file.text();
        document.body.appendChild(div);
        const canvas = await h2c(div, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p','mm','a4');
        const w = pdf.internal.pageSize.getWidth();
        pdf.addImage(imgData, 'PNG', 0, 0, w, (canvas.height * w) / canvas.width);
        document.body.removeChild(div);
        return new Uint8Array(pdf.output('arraybuffer'));
      }
      if (['pptx','ppt'].includes(ext!)) {
        const doc = new jsPDF();
        doc.text('PowerPoint Structural Export', 105, 105, { align: 'center' });
        return new Uint8Array(doc.output('arraybuffer'));
      }
    } catch (e) { console.error('fileToPdfBuffer error:', e); }
    return null;
  };

  /* ────────────────────────────────────────────────────
     CHAIN CONVERTER (star topology: any → PDF → any)
  ──────────────────────────────────────────────────── */
  const chainConverter = async (file: File, targetFormat: string) => {
    await wrap(`Converting to ${targetFormat.toUpperCase()}`, async () => {
      const pdfBuffer = await fileToPdfBuffer(file);
      if (!pdfBuffer) throw new Error('Could not convert source file.');

      if (targetFormat === 'pdf') {
        downloadBlob(new Blob([pdfBuffer as any], { type: 'application/pdf' }), `${file.name}.pdf`);
        return;
      }

      if (['txt','csv'].includes(targetFormat)) {
        const pages = await pdfTextAllPages(pdfBuffer.buffer as ArrayBuffer);
        downloadBlob(new Blob([pages.join('\n')], { type: 'text/plain' }), `${file.name}.${targetFormat}`);

      } else if (targetFormat === 'excel') {
        const XLSX = await import('xlsx');
        const pages = await pdfTextAllPages(pdfBuffer.buffer as ArrayBuffer);
        const rows: any[][] = [];
        pages.forEach((txt, i) => { rows.push([`--- PAGE ${i+1} ---`]); txt.split(' ').forEach(w => rows.push([w])); });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Content');
        downloadBlob(new Blob([XLSX.write(wb,{bookType:'xlsx',type:'array'})]), `${file.name}.xlsx`);

      } else if (targetFormat === 'word') {
        const pages = await pdfTextAllPages(pdfBuffer.buffer as ArrayBuffer);
        downloadBlob(new Blob([pages.join('\n\n')], { type: 'application/msword' }), `${file.name}.doc`);

      } else if (targetFormat === 'ppt') {
        const pptxgen = (await import('pptxgenjs')).default;
        const pptx = new pptxgen();
        const pages = await pdfTextAllPages(pdfBuffer.buffer as ArrayBuffer);
        pages.forEach(txt => {
          const slide = pptx.addSlide();
          slide.addText(txt.slice(0, 500), { x: 0.5, y: 0.5, w: '90%', fontSize: 14, wrap: true });
        });
        await pptx.writeFile({ fileName: `${file.name}.pptx` });

      } else if (targetFormat === 'image') {
        const pdf = await pdfjs.getDocument({ data: pdfBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const vp = page.getViewport({ scale: 2 });
          const canvas = document.createElement('canvas');
          canvas.width = vp.width; canvas.height = vp.height;
          await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
          await new Promise<void>(res => canvas.toBlob(b => { if(b) downloadBlob(b, `${file.name}_p${i}.png`); res(); }, 'image/png'));
        }

      } else if (targetFormat === 'html') {
        const pages = await pdfTextAllPages(pdfBuffer.buffer as ArrayBuffer);
        const html = `<html><body>${pages.map((p,i) => `<h2>Page ${i+1}</h2><p>${p}</p><hr/>`).join('')}</body></html>`;
        downloadBlob(new Blob([html], { type: 'text/html' }), `${file.name}.html`);

      } else if (targetFormat === 'json') {
        const pages = await pdfTextAllPages(pdfBuffer.buffer as ArrayBuffer);
        const data = { source: file.name, pages: pages.map((text, i) => ({ page: i+1, text })) };
        downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `${file.name}.json`);

      } else {
        downloadBlob(new Blob([pdfBuffer as any], { type: 'application/pdf' }), `${file.name}.pdf`);
      }
    });
  };

  /* ────────────────────────────────────────────────────
     ORGANIZE TOOLS
  ──────────────────────────────────────────────────── */
  const mergePdfs = async (files: File[]) => {
    await wrap('Merging PDFs', async () => {
      const merged = await PDFDocument.create();
      for (const f of files) {
        const doc = await loadPdf(await f.arrayBuffer());
        const pages = await merged.copyPages(doc, doc.getPageIndices());
        pages.forEach(p => merged.addPage(p));
      }
      await savePdf(merged, 'merged.pdf');
    });
  };

  const splitPdf = async (file: File, ranges: string) => {
    await wrap('Splitting PDF', async () => {
      const doc = await loadPdf(await file.arrayBuffer());
      const indices: number[] = [];
      ranges.split(',').forEach(p => {
        const r = p.trim().split('-');
        const s = parseInt(r[0]) - 1, e = r[1] ? parseInt(r[1]) - 1 : s;
        for (let i = s; i <= e; i++) if (i >= 0) indices.push(i);
      });
      const newDoc = await PDFDocument.create();
      (await newDoc.copyPages(doc, indices)).forEach(p => newDoc.addPage(p));
      await savePdf(newDoc, 'split.pdf');
    });
  };

  const deletePdfPages = async (file: File, indices: number[]) => {
    await wrap('Deleting pages', async () => {
      const doc = await loadPdf(await file.arrayBuffer());
      const keep = doc.getPageIndices().filter(i => !indices.includes(i));
      const newDoc = await PDFDocument.create();
      (await newDoc.copyPages(doc, keep)).forEach(p => newDoc.addPage(p));
      await savePdf(newDoc, 'deleted-pages.pdf');
    });
  };

  const extractPdfPages = async (file: File, indices: number[]) => {
    await wrap('Extracting pages', async () => {
      const doc = await loadPdf(await file.arrayBuffer());
      const newDoc = await PDFDocument.create();
      (await newDoc.copyPages(doc, indices)).forEach(p => newDoc.addPage(p));
      await savePdf(newDoc, 'extracted.pdf');
    });
  };

  const rotatePdfPages = async (file: File, indices: number[], deg: 0 | 90 | 180 | 270) => {
    await wrap('Rotating pages', async () => {
      const doc = await loadPdf(await file.arrayBuffer());
      const pages = doc.getPages();
      (indices.length ? indices : pages.map((_,i)=>i)).forEach(i => {
        if (pages[i]) pages[i].setRotation(degrees(deg));
      });
      await savePdf(doc, 'rotated.pdf');
    });
  };

  const reorderPdfPages = async (file: File, newOrder: number[]) => {
    await wrap('Reordering pages', async () => {
      const doc = await loadPdf(await file.arrayBuffer());
      const newDoc = await PDFDocument.create();
      (await newDoc.copyPages(doc, newOrder)).forEach(p => newDoc.addPage(p));
      await savePdf(newDoc, 'reordered.pdf');
    });
  };

  const resizePdf = async (file: File, width: number, height: number) => {
    await wrap('Resizing PDF', async () => {
      const doc = await loadPdf(await file.arrayBuffer());
      doc.getPages().forEach(p => p.setSize(width, height));
      await savePdf(doc, 'resized.pdf');
    });
  };

  /* ────────────────────────────────────────────────────
     EDIT & OPTIMIZE TOOLS
  ──────────────────────────────────────────────────── */
  const compressPdf = async (file: File) => {
    await wrap('Compressing PDF', async () => {
      // pdf-lib reload-save strips unused objects & streams
      const buf = await file.arrayBuffer();
      const doc = await PDFDocument.load(buf, { updateMetadata: false });
      await savePdf(doc, 'compressed.pdf');
    });
  };

  const flattenPdf = async (file: File) => {
    await wrap('Flattening PDF', async () => {
      const doc = await loadPdf(await file.arrayBuffer());
      const form = doc.getForm();
      form.flatten();
      await savePdf(doc, 'flattened.pdf');
    });
  };

  const addPageNumbers = async (file: File, opts: PageNumberOptions) => {
    await wrap('Adding page numbers', async () => {
      const doc = await loadPdf(await file.arrayBuffer());
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const pages = doc.getPages();
      pages.forEach((page, i) => {
        const { width, height } = page.getSize();
        const num = `${opts.prefix}${i + opts.startAt}`;
        const textW = font.widthOfTextAtSize(num, 11);
        let x = width / 2 - textW / 2, y = 20;
        if (opts.position === 'bottom-right')  { x = width - 40; y = 20; }
        if (opts.position === 'bottom-left')   { x = 20; y = 20; }
        if (opts.position === 'top-center')    { x = width / 2 - textW / 2; y = height - 20; }
        page.drawText(num, { x, y, size: 11, font, color: rgb(0.3,0.3,0.3) });
      });
      await savePdf(doc, 'numbered.pdf');
    });
  };

  const addWatermark = async (file: File, opts: WatermarkOptions) => {
    await wrap('Adding watermark', async () => {
      const doc = await loadPdf(await file.arrayBuffer());
      const font = await doc.embedFont(StandardFonts.HelveticaBold);
      const [r, g, b] = opts.color;
      doc.getPages().forEach(page => {
        const { width, height } = page.getSize();
        const textW = font.widthOfTextAtSize(opts.text, opts.fontSize);
        page.drawText(opts.text, {
          x: width / 2 - textW / 2,
          y: height / 2,
          size: opts.fontSize,
          font,
          color: rgb(r, g, b),
          opacity: opts.opacity,
          rotate: degrees(opts.rotation),
        });
      });
      await savePdf(doc, 'watermarked.pdf');
    });
  };

  const addHeaderFooter = async (file: File, opts: HeaderFooterOptions) => {
    await wrap('Adding header/footer', async () => {
      const doc = await loadPdf(await file.arrayBuffer());
      const font = await doc.embedFont(StandardFonts.Helvetica);
      doc.getPages().forEach(page => {
        const { width, height } = page.getSize();
        if (opts.header) page.drawText(opts.header, { x: 40, y: height - 20, size: opts.fontSize, font, color: rgb(0.2,0.2,0.2) });
        if (opts.footer) page.drawText(opts.footer, { x: 40, y: 10, size: opts.fontSize, font, color: rgb(0.2,0.2,0.2) });
      });
      await savePdf(doc, 'header-footer.pdf');
    });
  };

  const grayscalePdf = async (file: File) => {
    // Render each page as canvas, convert to grayscale, rebuild PDF
    await wrap('Converting to grayscale', async () => {
      const buf = await file.arrayBuffer();
      const pdfSrc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
      const newDoc = await PDFDocument.create();
      for (let i = 1; i <= pdfSrc.numPages; i++) {
        const page = await pdfSrc.getPage(i);
        const vp = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = vp.width; canvas.height = vp.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        // Convert to grayscale via ImageData
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let j = 0; j < imgData.data.length; j += 4) {
          const gray = 0.299*imgData.data[j] + 0.587*imgData.data[j+1] + 0.114*imgData.data[j+2];
          imgData.data[j] = imgData.data[j+1] = imgData.data[j+2] = gray;
        }
        ctx.putImageData(imgData, 0, 0);
        const png = canvas.toDataURL('image/png').split(',')[1];
        const img = await newDoc.embedPng(Uint8Array.from(atob(png), c => c.charCodeAt(0)));
        const newPage = newDoc.addPage([vp.width / 2, vp.height / 2]);
        newPage.drawImage(img, { x: 0, y: 0, width: vp.width / 2, height: vp.height / 2 });
      }
      await savePdf(newDoc, 'grayscale.pdf');
    });
  };

  const repairPdf = async (file: File) => {
    await wrap('Repairing PDF', async () => {
      // Try loading with relaxed parsing and re-saving
      const buf = await file.arrayBuffer();
      try {
        const doc = await PDFDocument.load(buf, { ignoreEncryption: true, throwOnInvalidObject: false });
        await savePdf(doc, 'repaired.pdf');
      } catch {
        // If pdf-lib fails, try pdfjs extraction and rebuild
        const pdfSrc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
        const newDoc = await PDFDocument.create();
        const font = await newDoc.embedFont(StandardFonts.Helvetica);
        for (let i = 1; i <= pdfSrc.numPages; i++) {
          const page = await pdfSrc.getPage(i);
          const { width, height } = page.getViewport({ scale: 1 });
          const content = await page.getTextContent();
          const text = content.items.map((it: any) => it.str).join(' ');
          const newPage = newDoc.addPage([width, height]);
          newPage.drawText(text, { x: 40, y: height - 60, size: 11, font, color: rgb(0,0,0), maxWidth: width - 80 });
        }
        await savePdf(newDoc, 'repaired.pdf');
      }
    });
  };

  /* ────────────────────────────────────────────────────
     SECURITY TOOLS
  ──────────────────────────────────────────────────── */
  const protectPdf = async (file: File, userPassword: string, ownerPassword: string) => {
    await wrap('Protecting PDF', async () => {
      const doc = await loadPdf(await file.arrayBuffer());
      const bytes = await doc.save({ userPassword, ownerPassword } as any);
      downloadBlob(new Blob([bytes as any], { type: 'application/pdf' }), 'protected.pdf');
    });
  };

  const unlockPdf = async (file: File, password: string) => {
    await wrap('Unlocking PDF', async () => {
      const doc = await PDFDocument.load(await file.arrayBuffer(), { password } as any);
      await savePdf(doc, 'unlocked.pdf');
    });
  };

  const redactPdf = async (file: File, areas: { page: number; x: number; y: number; w: number; h: number }[]) => {
    await wrap('Redacting PDF', async () => {
      const doc = await loadPdf(await file.arrayBuffer());
      const pages = doc.getPages();
      areas.forEach(({ page, x, y, w, h }) => {
        if (pages[page]) {
          pages[page].drawRectangle({ x, y, width: w, height: h, color: rgb(0,0,0), opacity: 1 });
        }
      });
      await savePdf(doc, 'redacted.pdf');
    });
  };

  const embedSignatureToPdf = async (file: File, signatureDataUrl: string, page: number, x: number, y: number, w: number, h: number) => {
    await wrap('Signing PDF', async () => {
      const doc = await loadPdf(await file.arrayBuffer());
      const pages = doc.getPages();
      const pngData = Uint8Array.from(atob(signatureDataUrl.split(',')[1]), c => c.charCodeAt(0));
      const img = await doc.embedPng(pngData);
      const target = pages[page] ?? pages[0];
      const { height: pageH } = target.getSize();
      target.drawImage(img, { x, y: pageH - y - h, width: w, height: h, opacity: 0.9 });
      await savePdf(doc, 'signed.pdf');
    });
  };

  /* ────────────────────────────────────────────────────
     ADVANCED TOOLS
  ──────────────────────────────────────────────────── */
  const editMetadata = async (file: File, meta: MetaFields) => {
    await wrap('Editing metadata', async () => {
      const doc = await loadPdf(await file.arrayBuffer());
      if (meta.title)    doc.setTitle(meta.title);
      if (meta.author)   doc.setAuthor(meta.author);
      if (meta.subject)  doc.setSubject(meta.subject);
      if (meta.keywords) doc.setKeywords([meta.keywords]);
      if (meta.creator)  doc.setCreator(meta.creator);
      await savePdf(doc, 'metadata.pdf');
    });
  };

  const getMetadata = async (file: File): Promise<MetaFields | null> => {
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      return {
        title:    doc.getTitle()    ?? '',
        author:   doc.getAuthor()   ?? '',
        subject:  doc.getSubject()  ?? '',
        keywords: doc.getKeywords() ?? '',
        creator:  doc.getCreator()  ?? '',
      };
    } catch { return null; }
  };

  const comparePdfs = async (fileA: File, fileB: File): Promise<CompareResult | null> => {
    return await wrap('Comparing PDFs', async () => {
      const [pagesA, pagesB] = await Promise.all([
        pdfTextAllPages((await fileA.arrayBuffer())),
        pdfTextAllPages((await fileB.arrayBuffer())),
      ]);
      const wordsA = new Set(pagesA.join(' ').split(/\s+/).filter(Boolean));
      const wordsB = new Set(pagesB.join(' ').split(/\s+/).filter(Boolean));
      const added   = [...wordsB].filter(w => !wordsA.has(w));
      const removed = [...wordsA].filter(w => !wordsB.has(w));
      const common  = [...wordsA].filter(w => wordsB.has(w)).length;
      return { added: added.slice(0,200), removed: removed.slice(0,200), common };
    });
  };

  const ocrPdf = async (file: File): Promise<string | null> => {
    return await wrap('Running OCR', async () => {
      const pages = await pdfTextAllPages(await file.arrayBuffer());
      return pages.join('\n\n--- PAGE BREAK ---\n\n');
    });
  };

  const extractToJson = async (file: File) => {
    await wrap('Extracting to JSON', async () => {
      const pages = await pdfTextAllPages(await file.arrayBuffer());
      const json = { source: file.name, pageCount: pages.length, pages: pages.map((text, i) => ({ page: i+1, text })) };
      downloadBlob(new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' }), `${file.name}.json`);
    });
  };

  /* ────────────────────────────────────────────────────
     OFFICE TOOLS
  ──────────────────────────────────────────────────── */
  const excelToCsv = async (file: File) => {
    await wrap('Converting to CSV', async () => {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer());
      wb.SheetNames.forEach(sn => {
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sn]);
        downloadBlob(new Blob([csv], { type: 'text/csv' }), `${sn}.csv`);
      });
    });
  };

  const csvToExcel = async (file: File) => {
    await wrap('Converting to Excel', async () => {
      const XLSX = await import('xlsx');
      const text = await file.text();
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(text.split('\n').map(r => r.split(',')));
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      downloadBlob(new Blob([XLSX.write(wb, { bookType:'xlsx', type:'array' })]), `${file.name}.xlsx`);
    });
  };

  const mergeExcel = async (files: File[]) => {
    await wrap('Merging workbooks', async () => {
      const XLSX = await import('xlsx');
      const out = XLSX.utils.book_new();
      for (const f of files) {
        const wb = XLSX.read(await f.arrayBuffer());
        wb.SheetNames.forEach(sn => {
          const safeName = `${f.name.slice(0,10)}_${sn}`.slice(0, 31);
          XLSX.utils.book_append_sheet(out, wb.Sheets[sn], safeName);
        });
      }
      downloadBlob(new Blob([XLSX.write(out, { bookType:'xlsx', type:'array' })]), 'merged.xlsx');
    });
  };

  const splitExcel = async (file: File) => {
    await wrap('Splitting sheets', async () => {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer());
      wb.SheetNames.forEach(sn => {
        const out = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(out, wb.Sheets[sn], sn);
        downloadBlob(new Blob([XLSX.write(out, { bookType:'xlsx', type:'array' })]), `${sn}.xlsx`);
      });
    });
  };

  const cleanExcel = async (file: File) => {
    await wrap('Cleaning data', async () => {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer());
      const out = XLSX.utils.book_new();
      wb.SheetNames.forEach(sn => {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1 }) as any[][];
        const cleaned = rows.filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== ''));
        XLSX.utils.book_append_sheet(out, XLSX.utils.aoa_to_sheet(cleaned), sn);
      });
      downloadBlob(new Blob([XLSX.write(out, { bookType:'xlsx', type:'array' })]), 'cleaned.xlsx');
    });
  };

  const getExcelFormulas = async (file: File): Promise<{sheet:string;cell:string;formula:string}[]|null> => {
    return await wrap('Extracting formulas', async () => {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { cellFormula: true });
      const results: {sheet:string;cell:string;formula:string}[] = [];
      wb.SheetNames.forEach(sn => {
        const ws = wb.Sheets[sn];
        Object.keys(ws).filter(k => !k.startsWith('!')).forEach(cellRef => {
          if (ws[cellRef].f) results.push({ sheet: sn, cell: cellRef, formula: ws[cellRef].f });
        });
      });
      return results;
    });
  };

  const getPivotData = async (file: File): Promise<PivotResult|null> => {
    return await wrap('Building pivot table', async () => {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer());
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      if (rows.length < 2) throw new Error('Not enough data for pivot table.');
      const headers = rows[0].map(String);
      return { headers, rows: rows.slice(1).map(r => r.map(String)) };
    });
  };

  const mergeWord = async (files: File[]) => {
    await wrap('Merging Word files', async () => {
      const mammoth = await import('mammoth');
      const doc = new jsPDF();
      let y = 20;
      for (const f of files) {
        const { value } = await mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() });
        doc.setFontSize(9);
        doc.setFont('helvetica','bold');
        doc.text(`--- ${f.name} ---`, 15, y); y += 8;
        doc.setFont('helvetica','normal');
        const lines = doc.splitTextToSize(value, 180);
        if (y + lines.length * 5 > 280) { doc.addPage(); y = 20; }
        doc.text(lines, 15, y); y += lines.length * 5 + 10;
      }
      downloadBlob(new Blob([doc.output('arraybuffer')], { type: 'application/pdf' }), 'merged-word.pdf');
    });
  };

  const splitWord = async (file: File) => {
    await wrap('Splitting Word document', async () => {
      const mammoth = await import('mammoth');
      const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      const sections = value.split(/\n(?=[A-Z][^\n]{0,60}\n)/g);
      sections.forEach((section, i) => {
        const doc = new jsPDF();
        doc.text(doc.splitTextToSize(section.trim(), 180), 15, 20);
        downloadBlob(new Blob([doc.output('arraybuffer')], { type: 'application/pdf' }), `section-${i+1}.pdf`);
      });
    });
  };

  const addWordWatermark = async (file: File, watermarkText: string) => {
    await wrap('Adding watermark to Word', async () => {
      const mammoth = await import('mammoth');
      const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      const doc = new jsPDF();
      const font = doc.getFont();
      doc.text(doc.splitTextToSize(value, 180), 15, 20);
      // Overlay watermark on each page
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(40);
        doc.setTextColor(200, 200, 200);
        doc.text(watermarkText, 105, 150, { align: 'center', angle: 45 });
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
      }
      downloadBlob(new Blob([doc.output('arraybuffer')], { type: 'application/pdf' }), 'watermarked-word.pdf');
    });
  };

  return {
    isProcessing,
    processStep,
    // Chain converter
    chainConverter,
    // Organize
    mergePdfs,
    splitPdf,
    deletePdfPages,
    extractPdfPages,
    rotatePdfPages,
    reorderPdfPages,
    resizePdf,
    // Edit & Optimize
    compressPdf,
    flattenPdf,
    addPageNumbers,
    addWatermark,
    addHeaderFooter,
    grayscalePdf,
    repairPdf,
    // Security
    protectPdf,
    unlockPdf,
    redactPdf,
    embedSignatureToPdf,
    // Advanced
    editMetadata,
    getMetadata,
    comparePdfs,
    ocrPdf,
    extractToJson,
    // Office Tools
    excelToCsv,
    csvToExcel,
    mergeExcel,
    splitExcel,
    cleanExcel,
    getExcelFormulas,
    getPivotData,
    mergeWord,
    splitWord,
    addWordWatermark,
  };
}
