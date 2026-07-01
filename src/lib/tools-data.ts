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
  // 1. Organize
  { id: 'merge-pdf',    name: 'Merge PDF',     description: 'Combine multiple PDF files into one clean, organized document instantly. Reorder files via drag-and-drop with absolute security.',  icon: '📑', category: 'Organize', isPlaceholder: false, color: '#4f46e5' },
  { id: 'split-pdf',   name: 'Split PDF',      description: 'Extract specific pages, select page ranges, or split every single page of a PDF document into a separate file instantly and privately.',   icon: '✂️', category: 'Organize', isPlaceholder: false, color: '#ef4444' },
  { id: 'delete-pages',name: 'Delete Pages',   description: 'Remove unwanted pages.',           icon: '🗑️', category: 'Organize', isPlaceholder: false, color: '#6366f1' },
  { id: 'extract-pages',name:'Extract Pages',  description: 'Extract specific pages.',          icon: '📤', category: 'Organize', isPlaceholder: false, color: '#8b5cf6' },
  { id: 'rotate-pdf',  name: 'Rotate PDF',     description: 'Rotate PDF pages.',               icon: '🔄', category: 'Organize', isPlaceholder: false, color: '#f59e0b' },
  { id: 'reorder-pdf', name: 'Reorder PDF',    description: 'Drag to reorder pages.',          icon: '⇄',  category: 'Organize', isPlaceholder: false, color: '#ec4899' },
  { id: 'resize-pdf',  name: 'Resize PDF',     description: 'Change page dimensions.',         icon: '📏', category: 'Organize', isPlaceholder: false, color: '#0ea5e9' },

  // 2. Convert to PDF
  { id: 'word-to-pdf', name: 'Word to PDF',    description: 'Convert DOCX to PDF.',            icon: '📄', category: 'Convert to PDF', isPlaceholder: false, color: '#2563eb' },
  { id: 'excel-to-pdf',name: 'Excel to PDF',   description: 'Convert XLSX to PDF.',            icon: '📊', category: 'Convert to PDF', isPlaceholder: false, color: '#10b981' },
  { id: 'ppt-to-pdf',  name: 'PPT to PDF',     description: 'Convert PPTX to PDF.',            icon: '📽️', category: 'Convert to PDF', isPlaceholder: false, color: '#f97316' },
  { id: 'image-to-pdf',name: 'Image to PDF',   description: 'JPG/PNG to PDF.',                 icon: '📸', category: 'Convert to PDF', isPlaceholder: false, color: '#10b981' },
  { id: 'text-to-pdf', name: 'Text to PDF',    description: 'Convert TXT to PDF.',             icon: '📝', category: 'Convert to PDF', isPlaceholder: false, color: '#3b82f6' },
  { id: 'html-to-pdf', name: 'HTML to PDF',    description: 'Convert Web page to PDF.',        icon: '🌐', category: 'Convert to PDF', isPlaceholder: false, color: '#06b6d4' },
  { id: 'md-to-pdf',   name: 'Markdown to PDF',description: 'Convert MD to PDF.',              icon: '⬇️', category: 'Convert to PDF', isPlaceholder: false, color: '#6366f1' },

  // 3. Convert from PDF
  { id: 'pdf-to-word', name: 'PDF to Word',    description: 'Convert PDF sheets to editable Microsoft Word DOCX files. All formatting is preserved, processed fully client-side.',            icon: '📄', category: 'Convert from PDF', isPlaceholder: false, color: '#2563eb' },
  { id: 'pdf-to-excel',name: 'PDF to Excel',   description: 'Convert PDF to XLSX.',            icon: '📊', category: 'Convert from PDF', isPlaceholder: false, color: '#059669' },
  { id: 'pdf-to-ppt',  name: 'PDF to PPT',     description: 'Convert PDF to PPTX.',            icon: '📽️', category: 'Convert from PDF', isPlaceholder: false, color: '#f97316' },
  { id: 'pdf-to-image',name: 'PDF to Image',   description: 'PDF to JPG/PNG.',                 icon: '🖼️', category: 'Convert from PDF', isPlaceholder: false, color: '#db2777' },
  { id: 'pdf-to-text', name: 'PDF to Text',    description: 'Extract plain text.',             icon: '📃', category: 'Convert from PDF', isPlaceholder: false, color: '#4b5563' },
  { id: 'pdf-to-html', name: 'PDF to HTML',    description: 'Convert PDF to web page.',        icon: '🌐', category: 'Convert from PDF', isPlaceholder: false, color: '#06b6d4' },
  { id: 'pdf-to-json', name: 'PDF to JSON',    description: 'Extract PDF structure as JSON.',  icon: '📦', category: 'Convert from PDF', isPlaceholder: false, color: '#7c3aed' },

  // 4. Edit & Optimize
  { id: 'compress-pdf', name: 'Compress PDF',  description: 'Reduce the file size of your PDF documents with optimized compression ratios, running entirely offline to ensure your private documents stay local.',               icon: '📉', category: 'Edit & Optimize', isPlaceholder: false, color: '#ef4444' },
  { id: 'flatten-pdf',  name: 'Flatten PDF',   description: 'Merge form fields into content.', icon: '🥞', category: 'Edit & Optimize', isPlaceholder: false, color: '#0ea5e9' },
  { id: 'page-numbers', name: 'Page Numbers',  description: 'Add page numbering.',             icon: '🔢', category: 'Edit & Optimize', isPlaceholder: false, color: '#8b5cf6' },
  { id: 'watermark',    name: 'Watermark',     description: 'Add text/image stamps.',          icon: '🌊', category: 'Edit & Optimize', isPlaceholder: false, color: '#0ea5e9' },
  { id: 'header-footer',name: 'Header/Footer', description: 'Add custom headers & footers.',   icon: '🔝', category: 'Edit & Optimize', isPlaceholder: false, color: '#6366f1' },
  { id: 'grayscale-pdf',name: 'Grayscale PDF', description: 'Convert to black & white.',       icon: '🏁', category: 'Edit & Optimize', isPlaceholder: false, color: '#6b7280' },
  { id: 'repair-pdf',   name: 'Repair PDF',    description: 'Attempt to fix corrupted PDFs.',  icon: '🔧', category: 'Edit & Optimize', isPlaceholder: false, color: '#d97706' },

  // 5. Security
  { id: 'protect-pdf', name: 'Protect PDF',    description: 'Encrypt your sensitive PDF files with strong passwords and access restrictions directly inside your browser for total local document security.',        icon: '🔒', category: 'Security', isPlaceholder: false, color: '#ef4444' },
  { id: 'unlock-pdf',  name: 'Unlock PDF',     description: 'Remove PDF password.',            icon: '🔓', category: 'Security', isPlaceholder: false, color: '#22c55e' },
  { id: 'sign-pdf',    name: 'Sign PDF',       description: 'Draw or type digital signatures to sign PDF documents instantly. Secure local processing ensures your signature data is never stored on servers.',            icon: '🖋️', category: 'Security', isPlaceholder: false, color: '#4f46e5' },
  { id: 'redact-pdf',  name: 'Redact PDF',     description: 'Black out sensitive info.',       icon: '⬛', category: 'Security', isPlaceholder: false, color: '#111827' },

  // 6. Advanced
  { id: 'compare-pdf', name: 'Compare PDF',    description: 'Side-by-side text diff.',         icon: '🔍', category: 'Advanced', isPlaceholder: false, color: '#3b82f6' },
  { id: 'ocr-pdf',     name: 'OCR PDF',        description: 'Make scanned PDF searchable.',    icon: '🆔', category: 'Advanced', isPlaceholder: false, color: '#10b981' },
  { id: 'metadata',    name: 'Edit Metadata',  description: 'Edit Author, Title, Keywords.',   icon: '🏷️', category: 'Advanced', isPlaceholder: false, color: '#6366f1' },

  // 7. Office Tools
  { id: 'word-merge',    name: 'Word Merge',    description: 'Combine multiple .docx files.',  icon: '📚', category: 'Office Tools', isPlaceholder: false, color: '#2563eb' },
  { id: 'word-split',    name: 'Word Split',    description: 'Split Word doc by headings.',    icon: '✂️', category: 'Office Tools', isPlaceholder: false, color: '#7c3aed' },
  { id: 'word-watermark',name: 'Word Watermark',description: 'Add watermark to .docx.',        icon: '📝', category: 'Office Tools', isPlaceholder: false, color: '#0d9488' },
  { id: 'excel-csv',     name: 'Excel ⇄ CSV',  description: 'Convert between XLSX and CSV.',   icon: '🔄', category: 'Office Tools', isPlaceholder: false, color: '#16a34a' },
  { id: 'excel-merge',   name: 'Excel Merge',  description: 'Combine multiple workbooks.',     icon: '📊', category: 'Office Tools', isPlaceholder: false, color: '#0891b2' },
  { id: 'excel-split',   name: 'Excel Split',  description: 'Split each sheet to a file.',     icon: '📁', category: 'Office Tools', isPlaceholder: false, color: '#d97706' },
  { id: 'excel-pivot',   name: 'Pivot Table',  description: 'Analyze data with pivot.',        icon: '📈', category: 'Office Tools', isPlaceholder: false, color: '#16a34a' },
  { id: 'excel-clean',   name: 'Data Cleaning',description: 'Remove empty rows & columns.',    icon: '✨', category: 'Office Tools', isPlaceholder: false, color: '#0d9488' },
  { id: 'excel-formula', name: 'Formula List', description: 'Extract all formulas from sheet.',icon: '🧮', category: 'Office Tools', isPlaceholder: false, color: '#ea580c' },
];
