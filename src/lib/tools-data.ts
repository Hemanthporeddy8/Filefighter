// src/lib/tools-data.ts

export type ToolCategory = 'Organize' | 'Convert to PDF' | 'Convert from PDF' | 'Edit & Optimize' | 'Security' | 'Advanced' | 'Office Tools';

export interface DocumentTool {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: ToolCategory;
  isPlaceholder: boolean;
  color?: string;
}

export const DOCUMENT_TOOLS: DocumentTool[] = [
  // 1. Organize (removed: crop-pdf, resize-pdf — redundant placeholders)
  { id: 'merge-pdf', name: 'Merge PDF', description: 'Combine multiple PDFs into one.', icon: '📑', category: 'Organize', isPlaceholder: false, color: '#4f46e5' },
  { id: 'split-pdf', name: 'Split PDF', description: 'Separate pages into new files.', icon: '✂️', category: 'Organize', isPlaceholder: false, color: '#ef4444' },
  { id: 'delete-pages', name: 'Delete Pages', description: 'Remove unwanted pages.', icon: '🗑️', category: 'Organize', isPlaceholder: false, color: '#6366f1' },
  { id: 'extract-pages', name: 'Extract Pages', description: 'Extract specific pages.', icon: '📤', category: 'Organize', isPlaceholder: false, color: '#8b5cf6' },
  { id: 'rotate-pdf', name: 'Rotate PDF', description: 'Rotate PDF pages.', icon: '🔄', category: 'Organize', isPlaceholder: false, color: '#f59e0b' },
  { id: 'reorder-pdf', name: 'Reorder PDF', description: 'Change page order.', icon: '⇄', category: 'Organize', isPlaceholder: false, color: '#ec4899' },

  // 2. Convert to PDF
  { id: 'word-to-pdf', name: 'Word to PDF', description: 'Convert DOCX to PDF.', icon: '📄', category: 'Convert to PDF', isPlaceholder: false, color: '#2563eb' },
  { id: 'excel-to-pdf', name: 'Excel to PDF', description: 'Convert XLSX to PDF.', icon: '📊', category: 'Convert to PDF', isPlaceholder: false, color: '#10b981' },
  { id: 'ppt-to-pdf', name: 'PPT to PDF', description: 'Convert PPTX to PDF.', icon: '📽️', category: 'Convert to PDF', isPlaceholder: false, color: '#f97316' },
  { id: 'image-to-pdf', name: 'Image to PDF', description: 'JPG/PNG to PDF.', icon: '📸', category: 'Convert to PDF', isPlaceholder: false, color: '#10b981' },
  { id: 'text-to-pdf', name: 'Text to PDF', description: 'Convert TXT to PDF.', icon: '📝', category: 'Convert to PDF', isPlaceholder: false, color: '#3b82f6' },
  { id: 'html-to-pdf', name: 'HTML to PDF', description: 'Convert Web to PDF.', icon: '🌐', category: 'Convert to PDF', isPlaceholder: false, color: '#06b6d4' },
  { id: 'md-to-pdf', name: 'Markdown to PDF', description: 'Convert MD to PDF.', icon: '⬇️', category: 'Convert to PDF', isPlaceholder: false, color: '#6366f1' },

  // 3. Convert from PDF (removed: pdf-to-ppt, pdf-to-html, pdf-to-json — all placeholders with no unique value)
  { id: 'pdf-to-word', name: 'PDF to Word', description: 'Convert PDF to DOCX.', icon: '📄', category: 'Convert from PDF', isPlaceholder: false, color: '#2563eb' },
  { id: 'pdf-to-excel', name: 'PDF to Excel', description: 'Convert PDF to XLSX.', icon: '📊', category: 'Convert from PDF', isPlaceholder: false, color: '#059669' },
  { id: 'pdf-to-image', name: 'PDF to Image', description: 'PDF to JPG/PNG.', icon: '🖼️', category: 'Convert from PDF', isPlaceholder: false, color: '#db2777' },
  { id: 'pdf-to-text', name: 'PDF to Text', description: 'Extract plain text.', icon: '📃', category: 'Convert from PDF', isPlaceholder: false, color: '#4b5563' },

  // 4. Edit & Optimize
  { id: 'compress-pdf', name: 'Compress PDF', description: 'Reduce file size.', icon: '📉', category: 'Edit & Optimize', isPlaceholder: false, color: '#ef4444' },
  { id: 'repair-pdf', name: 'Repair PDF', description: 'Fix corrupted PDFs.', icon: '🔧', category: 'Edit & Optimize', isPlaceholder: true },
  { id: 'grayscale-pdf', name: 'Grayscale PDF', description: 'Black & white conversion.', icon: '🏁', category: 'Edit & Optimize', isPlaceholder: true },
  { id: 'flatten-pdf', name: 'Flatten PDF', description: 'Merge layers and forms.', icon: '🥞', category: 'Edit & Optimize', isPlaceholder: false, color: '#0ea5e9' },
  { id: 'page-numbers', name: 'Page Numbers', description: 'Add numbering to PDF.', icon: '🔢', category: 'Edit & Optimize', isPlaceholder: false, color: '#8b5cf6' },
  { id: 'watermark', name: 'Watermark', description: 'Add text/image stamps.', icon: '🌊', category: 'Edit & Optimize', isPlaceholder: false, color: '#0ea5e9' },
  { id: 'header-footer', name: 'Header/Footer', description: 'Add custom headers.', icon: '🔝', category: 'Edit & Optimize', isPlaceholder: false, color: '#6366f1' },

  // 5. Security
  { id: 'protect-pdf', name: 'Protect PDF', description: 'Add password encryption.', icon: '🔒', category: 'Security', isPlaceholder: false, color: '#ef4444' },
  { id: 'unlock-pdf', name: 'Unlock PDF', description: 'Remove PDF password.', icon: '🔓', category: 'Security', isPlaceholder: false, color: '#22c55e' },
  { id: 'sign-pdf', name: 'Sign PDF', description: 'Sign with draw/type.', icon: '🖋️', category: 'Security', isPlaceholder: false, color: '#4f46e5' },
  { id: 'redact-pdf', name: 'Redact PDF', description: 'Black out sensitive info.', icon: '⬛', category: 'Security', isPlaceholder: false, color: '#111827' },

  // 6. Advanced
  { id: 'compare-pdf', name: 'Compare PDF', description: 'Check text differences.', icon: '🔍', category: 'Advanced', isPlaceholder: false, color: '#3b82f6' },
  { id: 'ocr-pdf', name: 'OCR PDF', description: 'Make scanned PDF searchable.', icon: '🆔', category: 'Advanced', isPlaceholder: false, color: '#10b981' },
  { id: 'metadata', name: 'Edit Metadata', description: 'Edit Author, Title, etc.', icon: '🏷️', category: 'Advanced', isPlaceholder: false, color: '#6366f1' },
  { id: 'font-analysis', name: 'Font Analysis', description: 'Deep font usage report.', icon: '🔤', category: 'Advanced', isPlaceholder: false, color: '#ec4899' },

  // 7. Office Tools
  { id: 'word-watermark', name: 'Word Watermark', description: 'Add watermark to .docx', icon: '📝', category: 'Office Tools', isPlaceholder: true },
  { id: 'word-merge', name: 'Word Merge', description: 'Combine .docx files', icon: '📚', category: 'Office Tools', isPlaceholder: true },
  { id: 'word-split', name: 'Word Split', description: 'Split .docx pages', icon: '✂️', category: 'Office Tools', isPlaceholder: true },
  { id: 'excel-csv', name: 'Excel ⇄ CSV', description: 'Format conversion', icon: '🔄', category: 'Office Tools', isPlaceholder: true },
  { id: 'excel-merge', name: 'Excel Merge', description: 'Combine workbooks', icon: '📊', category: 'Office Tools', isPlaceholder: true },
  { id: 'excel-split', name: 'Excel Split', description: 'Split sheets to files', icon: '📁', category: 'Office Tools', isPlaceholder: true },
  { id: 'excel-pivot', name: 'Pivot Table', description: 'Smart data analysis', icon: '📈', category: 'Office Tools', isPlaceholder: false, color: '#16a34a' },
  { id: 'excel-clean', name: 'Data Cleaning', description: 'Remove empty rows', icon: '✨', category: 'Office Tools', isPlaceholder: false, color: '#0d9488' },
  { id: 'excel-formula', name: 'Formula Debugger', description: 'Trace precedents', icon: '🧮', category: 'Office Tools', isPlaceholder: false, color: '#ea580c' },
];
