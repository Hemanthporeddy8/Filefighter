// src/lib/pdf-scratch/builder.ts

/**
 * Compiles an array of HTML5 canvases into a single multi-page PDF document.
 * Outputs a downloadable Blob in standard %PDF-1.4 format with zero external dependencies.
 */
export async function buildPdfFromCanvasesScratch(canvases: HTMLCanvasElement[]): Promise<Blob> {
  const chunks: any[] = [];
  
  // PDF 1.4 Header
  chunks.push("%PDF-1.4\n");
  
  let currentOffset = 8; // Length of "%PDF-1.4\n"
  const offsets: number[] = [];
  
  const addChunk = (chunk: string | Uint8Array) => {
    chunks.push(chunk);
    const len = typeof chunk === 'string' 
      ? new TextEncoder().encode(chunk).length 
      : chunk.byteLength;
    currentOffset += len;
  };
  
  const numPages = canvases.length;
  
  // Catalog
  offsets[1] = currentOffset;
  addChunk(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  
  // Pages
  const pageIds = Array.from({ length: numPages }, (_, i) => 3 + i * 3);
  offsets[2] = currentOffset;
  addChunk(`2 0 obj\n<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${numPages} >>\nendobj\n`);
  
  for (let i = 0; i < numPages; i++) {
    const canvas = canvases[i];
    const width = canvas.width;
    const height = canvas.height;
    
    const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const base64Data = jpegDataUrl.split(',')[1];
    const binaryString = atob(base64Data);
    
    const jpegBytes = new Uint8Array(binaryString.length);
    for (let b = 0; b < binaryString.length; b++) {
      jpegBytes[b] = binaryString.charCodeAt(b);
    }
    
    const pageId = 3 + i * 3;
    const contentId = 4 + i * 3;
    const imageId = 5 + i * 3;
    
    // Page Object
    offsets[pageId] = currentOffset;
    addChunk(`${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im1 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`);
    
    // Contents stream (draws image Im1 at page boundaries)
    const contentText = `q\n${width} 0 0 ${height} 0 0 cm\n/Im1 Do\nQ\n`;
    const contentBytes = new TextEncoder().encode(contentText);
    
    offsets[contentId] = currentOffset;
    addChunk(`${contentId} 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`);
    addChunk(contentBytes);
    addChunk(`\nendstream\nendobj\n`);
    
    // Image Object Stream
    offsets[imageId] = currentOffset;
    addChunk(`${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
    addChunk(jpegBytes);
    addChunk(`\nendstream\nendobj\n`);
  }
  
  // Cross-reference table (xref) for indexing offsets
  const startXref = currentOffset;
  let xrefText = `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < offsets.length; id++) {
    const offsetStr = String(offsets[id]).padStart(10, '0');
    xrefText += `${offsetStr} 00000 n \n`;
  }
  
  addChunk(xrefText);
  addChunk(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`);
  
  return new Blob(chunks, { type: 'application/pdf' });
}
