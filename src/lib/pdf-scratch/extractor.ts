// src/lib/pdf-scratch/extractor.ts

/**
 * Parses raw PDF ArrayBuffer binary data and carves out scanned page JPEG images.
 * This acts as a high-performance, 100% dependency-free scanned PDF importer.
 */
export async function extractImagesFromPdfScratch(arrayBuffer: ArrayBuffer): Promise<string[]> {
  const bytes = new Uint8Array(arrayBuffer);
  const images: string[] = [];
  
  let i = 0;
  while (i < bytes.length - 1) {
    // Search for JPEG SOI (Start of Image) marker: 0xFF, 0xD8
    if (bytes[i] === 0xFF && bytes[i + 1] === 0xD8) {
      const start = i;
      let end = -1;
      
      // Scan forward for JPEG EOI (End of Image) marker: 0xFF, 0xD9
      let j = i + 2;
      while (j < bytes.length - 1) {
        if (bytes[j] === 0xFF && bytes[j + 1] === 0xD9) {
          end = j + 2;
          break;
        }
        j++;
      }
      
      if (end !== -1) {
        const size = end - start;
        if (size > 2000) { // Loosened threshold to catch highly compressed scanned pages
          const slice = bytes.slice(start, end);
          const blob = new Blob([slice], { type: 'image/jpeg' });
          const url = URL.createObjectURL(blob);
          images.push(url);
          i = end;
          continue;
        }
      }
    }
    i++;
  }
  return images;
}
