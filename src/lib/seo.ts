// src/lib/seo.ts
// Centralised SEO metadata for every tool landing page.

export interface ToolFaq {
  question: string;
  answer: string;
}

export interface ToolStep {
  icon: string;
  heading: string;
  body: string;
}

export interface RelatedTool {
  label: string;
  href: string;
  icon: string;
}

export interface ToolSeoMeta {
  /** Page <title> */
  title: string;
  /** Meta description (150–160 chars) */
  description: string;
  /** Canonical URL path, e.g. /bg-remover-online */
  canonical: string;
  /** Short H1 hero headline */
  h1: string;
  /** Short tagline shown under H1 */
  tagline: string;
  /** Bullet feature list (shown in hero) */
  features: string[];
  /** 3-step "How it works" */
  howItWorks: ToolStep[];
  /** FAQ items */
  faqs: ToolFaq[];
  /** Related tools to cross-link */
  relatedTools: RelatedTool[];
  /** Schema.org SoftwareApplication name */
  appName: string;
  /** OG image path (relative to /public) */
  ogImage?: string;
  /** Keywords for <meta keywords> */
  keywords: string[];
  /** URL of the iframe src */
  iframeSrc: string;
  /** Minimum iframe height in px */
  iframeHeight?: number;
}

const BASE = 'https://www.editroy.com';

export const TOOL_SEO: Record<string, ToolSeoMeta> = {

  'bg-remover-online': {
    title: 'AI Background Remover Online Free | Editroy',
    description:
      'Remove image backgrounds online for free. Fast, private, browser-based AI background removal. No signup required. Supports PNG, JPG, WebP.',
    canonical: `${BASE}/bg-remover-online`,
    h1: 'AI Background Remover — 100% Free',
    tagline: 'Remove any background instantly. Runs in your browser. No data leaves your device.',
    features: [
      'One-click background removal with AI',
      'Works on photos, logos, and product images',
      'Download in transparent PNG',
      'Completely private — processed locally',
      'No signup, no watermark, forever free',
    ],
    appName: 'Editroy Background Remover',
    iframeSrc: '/background-remover/index.html',
    iframeHeight: 820,
    ogImage: '/icons/icon-512.png',
    keywords: [
      'background remover', 'remove background online', 'ai background remover',
      'free background remover', 'transparent background', 'photo background eraser',
      'background remover no signup', 'remove bg', 'editroy',
    ],
    howItWorks: [
      { icon: '📤', heading: 'Upload your image', body: 'Drag & drop or click to select any PNG, JPG, or WebP image.' },
      { icon: '🤖', heading: 'AI removes the background', body: 'Our on-device AI model instantly detects and removes the background — no server needed.' },
      { icon: '💾', heading: 'Download transparent PNG', body: 'Get your image with a clean transparent background, ready to use anywhere.' },
    ],
    faqs: [
      { question: 'Is the background remover really free?', answer: 'Yes — 100% free, forever. No credits, no signup, no watermark.' },
      { question: 'Does my image get uploaded to a server?', answer: 'No. The AI model runs entirely in your browser. Your images never leave your device.' },
      { question: 'What file formats are supported?', answer: 'PNG, JPG, JPEG, and WebP are all supported. Output is always transparent PNG.' },
      { question: 'How accurate is the AI?', answer: 'Our AI uses a state-of-the-art segmentation model (RMBG-2.0) that handles hair, fur, complex edges and product shots with high precision.' },
      { question: 'Is there a file size limit?', answer: 'For best performance we recommend images under 10 MB, but the tool handles larger images too depending on your device.' },
    ],
    relatedTools: [
      { label: 'Image Editor', href: '/edit-image-online', icon: '🖼️' },
      { label: 'Video BG Remover', href: '/video-background-remover', icon: '🎬' },
      { label: 'Audio Separator', href: '/audio-separator', icon: '🎵' },
    ],
  },

  'audio-separator': {
    title: 'AI Audio Separator — Vocal Remover Online Free | Editroy',
    description:
      'Separate vocals from music online for free. Extract stems, remove vocals, isolate instruments with AI. Browser-based, no signup needed.',
    canonical: `${BASE}/audio-separator`,
    h1: 'AI Audio Separator & Vocal Remover',
    tagline: 'Split any song into vocals and instrumentals — instantly, in your browser.',
    features: [
      'Separate vocals from music with one click',
      'Extract drums, bass, and melody stems',
      'Supports MP3, WAV, FLAC, OGG',
      'Runs entirely in your browser',
      'Free, no watermark, no account needed',
    ],
    appName: 'Editroy Audio Separator',
    iframeSrc: '/ai-tools/index.html',
    iframeHeight: 850,
    ogImage: '/icons/icon-512.png',
    keywords: [
      'audio separator', 'vocal remover', 'music stem splitter', 'remove vocals online',
      'instrumental extractor', 'karaoke maker', 'free vocal remover', 'audio splitter', 'editroy',
    ],
    howItWorks: [
      { icon: '🎵', heading: 'Upload your track', body: 'Select any MP3, WAV, FLAC or OGG audio file from your device.' },
      { icon: '🤖', heading: 'AI separates the stems', body: 'The on-device AI model isolates vocals, drums, bass and other instruments in seconds.' },
      { icon: '💾', heading: 'Download each stem', body: 'Download vocals-only, instrumentals-only, or individual stems as separate files.' },
    ],
    faqs: [
      { question: 'What audio formats does the separator support?', answer: 'MP3, WAV, FLAC, OGG and M4A are all supported.' },
      { question: 'Does the audio separation run on my device?', answer: 'Yes. Processing happens entirely in your browser using WebAssembly. No audio is ever sent to a server.' },
      { question: 'Can I use it to make karaoke tracks?', answer: 'Absolutely. Just separate the vocals and use the instrumental stem as your karaoke backing track.' },
      { question: 'Is this tool free?', answer: 'Yes — completely free with no signup, no watermark and no credit system.' },
    ],
    relatedTools: [
      { label: 'Video Editor', href: '/video-editor-online', icon: '🎬' },
      { label: 'Background Remover', href: '/bg-remover-online', icon: '✂️' },
      { label: 'Image Editor', href: '/edit-image-online', icon: '🖼️' },
    ],
  },

  'video-background-remover': {
    title: 'Video Background Remover Online Free | Editroy',
    description:
      'Remove video backgrounds without a green screen — free, browser-based AI. Works on any video. No signup required.',
    canonical: `${BASE}/video-background-remover`,
    h1: 'Video Background Remover — No Green Screen Needed',
    tagline: 'Erase your video background with AI. Works on any footage — in your browser.',
    features: [
      'Remove video backgrounds without a green screen',
      'Supports MP4, WebM, MOV',
      'Replace with custom color or image',
      'Fully private — processed on your device',
      'Free, no watermark, no account',
    ],
    appName: 'Editroy Video Background Remover',
    iframeSrc: '/ai-tools/index.html',
    iframeHeight: 850,
    ogImage: '/icons/icon-512.png',
    keywords: [
      'video background remover', 'remove video background', 'ai video background',
      'background removal video', 'no green screen', 'virtual background video', 'editroy',
    ],
    howItWorks: [
      { icon: '🎥', heading: 'Upload your video', body: 'Select an MP4, WebM or MOV file. Works with phone recordings, screen recordings and more.' },
      { icon: '🤖', heading: 'AI removes the background', body: 'Frame-by-frame AI segmentation erases your background in real time — no green screen needed.' },
      { icon: '💾', heading: 'Download or use a custom BG', body: 'Set a solid colour or upload an image as the new background, then export your video.' },
    ],
    faqs: [
      { question: 'Do I need a green screen?', answer: 'No. The AI detects and removes backgrounds from any video automatically.' },
      { question: 'What video formats are supported?', answer: 'MP4, WebM, and MOV are all supported.' },
      { question: 'Will the video quality be affected?', answer: 'Output quality matches your input. We do not re-encode or compress your video beyond what is needed for background removal.' },
      { question: 'Is it really free?', answer: 'Yes — completely free, no watermark, no signup.' },
    ],
    relatedTools: [
      { label: 'BG Remover (Image)', href: '/bg-remover-online', icon: '✂️' },
      { label: 'Audio Separator', href: '/audio-separator', icon: '🎵' },
      { label: 'Video Editor', href: '/video-editor-online', icon: '🎬' },
    ],
  },

  'pdf-text-editor': {
    title: 'Free Online PDF Text Editor | Editroy',
    description:
      'Edit PDF text directly in your browser for free. Change fonts, colours and content without converting to Word. No signup needed.',
    canonical: `${BASE}/pdf-text-editor`,
    h1: 'Free Online PDF Text Editor',
    tagline: 'Edit PDF text, fonts and colours directly — no conversion, no signup.',
    features: [
      'Edit text directly inside any PDF',
      'Change fonts, sizes and colours',
      'Add, delete or rewrite paragraphs',
      'Preserve original layout and formatting',
      'Free, private, runs in your browser',
    ],
    appName: 'Editroy PDF Text Editor',
    iframeSrc: '/my-pdf-editor-main/my-pdf-editor-main/index.html',
    iframeHeight: 850,
    ogImage: '/icons/icon-512.png',
    keywords: [
      'pdf text editor', 'edit pdf online', 'pdf editor free', 'pdf text changer',
      'online pdf editor', 'edit pdf without word', 'pdf editor no signup', 'editroy',
    ],
    howItWorks: [
      { icon: '📄', heading: 'Upload your PDF', body: 'Drag & drop or click to open any PDF document.' },
      { icon: '✏️', heading: 'Edit text directly', body: 'Click on any text block to edit it — change content, font, size and colour.' },
      { icon: '💾', heading: 'Download the edited PDF', body: 'Save your changes and download the updated PDF — same layout, new content.' },
    ],
    faqs: [
      { question: 'Can I edit any PDF?', answer: 'You can edit text-based PDFs. Scanned image PDFs require OCR (coming soon).' },
      { question: 'Will the PDF layout be preserved?', answer: 'Yes. The editor works on the PDF layer directly, preserving all formatting, images and page structure.' },
      { question: 'Is the PDF sent to a server?', answer: 'No. All processing is done locally in your browser. Your documents stay on your device.' },
      { question: 'Is it free?', answer: 'Yes — completely free with no signup required.' },
    ],
    relatedTools: [
      { label: 'Image Editor', href: '/edit-image-online', icon: '🖼️' },
      { label: 'Background Remover', href: '/bg-remover-online', icon: '✂️' },
      { label: 'Video Editor', href: '/video-editor-online', icon: '🎬' },
    ],
  },

  'same-edit': {
    title: 'Same Edit Tool — Batch Apply Edits to Multiple Images | Editroy',
    description:
      'Apply the same edit to hundreds of images at once. Batch background removal, colour correction and more. Free, browser-based, no signup.',
    canonical: `${BASE}/same-edit`,
    h1: 'Same Edit — Batch Apply to Multiple Images',
    tagline: 'Edit one image, apply to all. Batch-process hundreds of photos instantly.',
    features: [
      'Apply one edit across hundreds of images',
      'Batch background removal and colour grading',
      'Drag & drop multiple files at once',
      'Fully private — runs in your browser',
      'Free with no account needed',
    ],
    appName: 'Editroy Same Edit',
    iframeSrc: '/ai-tools/index.html',
    iframeHeight: 850,
    ogImage: '/icons/icon-512.png',
    keywords: [
      'same edit', 'batch image editor', 'apply same edit multiple images',
      'bulk photo editor', 'batch background remover', 'editroy',
    ],
    howItWorks: [
      { icon: '📸', heading: 'Upload your images', body: 'Drag & drop multiple images at once. Supports PNG, JPG and WebP.' },
      { icon: '⚙️', heading: 'Apply your edit', body: 'Configure the edit once — background removal, crop, colour — and apply it to all images automatically.' },
      { icon: '💾', heading: 'Download all results', body: 'Download all edited images as a ZIP in one click.' },
    ],
    faqs: [
      { question: 'How many images can I process at once?', answer: 'You can batch-process as many images as your browser memory allows — typically dozens to hundreds of images.' },
      { question: 'What edits can be applied in batch?', answer: 'Background removal, colour correction and crop operations can all be applied in batch mode.' },
      { question: 'Is this free?', answer: 'Yes — entirely free, no signup, no watermark.' },
    ],
    relatedTools: [
      { label: 'Background Remover', href: '/bg-remover-online', icon: '✂️' },
      { label: 'Image Editor', href: '/edit-image-online', icon: '🖼️' },
      { label: 'Audio Separator', href: '/audio-separator', icon: '🎵' },
    ],
  },

  'image-editor': {
    title: 'Free Online Image Editor — No Signup | Editroy',
    description:
      'Edit images online for free. Crop, resize, add text, apply filters and remove backgrounds — all in your browser. No signup required.',
    canonical: `${BASE}/edit-image-online`,
    h1: 'Free Online Image Editor',
    tagline: 'Crop, resize, filter, and edit any image — right in your browser.',
    features: [
      'Crop, resize, rotate and flip images',
      'Add text, stickers and overlays',
      'Apply filters and colour adjustments',
      'Remove backgrounds with AI',
      'Free, no signup, no watermark',
    ],
    appName: 'Editroy Image Editor',
    iframeSrc: '/ai-tools/index.html',
    iframeHeight: 850,
    ogImage: '/icons/icon-512.png',
    keywords: [
      'image editor online', 'free image editor', 'photo editor online', 'edit image browser',
      'crop image online', 'resize image free', 'photo editing tool', 'editroy',
    ],
    howItWorks: [
      { icon: '🖼️', heading: 'Upload your image', body: 'Open any PNG, JPG, WebP or GIF image from your device.' },
      { icon: '✏️', heading: 'Edit to your needs', body: 'Crop, resize, rotate, add filters, text overlays, and more using intuitive tools.' },
      { icon: '💾', heading: 'Export in any format', body: 'Download your finished image as PNG, JPG or WebP at full resolution.' },
    ],
    faqs: [
      { question: 'What image formats does the editor support?', answer: 'PNG, JPG, JPEG, WebP, GIF and BMP are all supported for input. Output is PNG or JPG.' },
      { question: 'Can I undo changes?', answer: 'Yes — the editor has full undo/redo history for all editing actions.' },
      { question: 'Is the image editor free?', answer: 'Yes — completely free with no signup, no limits and no watermark.' },
    ],
    relatedTools: [
      { label: 'Background Remover', href: '/bg-remover-online', icon: '✂️' },
      { label: 'Same Edit (Batch)', href: '/same-edit', icon: '⚡' },
      { label: 'Video Editor', href: '/video-editor-online', icon: '🎬' },
    ],
  },

  'video-editor-online': {
    title: 'Free Online Video Editor — No Watermark | Editroy',
    description:
      'Edit videos online for free. Trim, merge, add text and music, apply transitions. No watermark, no signup. Export in HD from your browser.',
    canonical: `${BASE}/video-editor-online`,
    h1: 'Free Online Video Editor — No Watermark',
    tagline: 'Trim, merge, add music and text to videos — free with no watermark.',
    features: [
      'Trim, cut and merge video clips',
      'Add text overlays, captions and titles',
      'Insert music and sound effects',
      'Apply transitions and visual effects',
      'Export in HD — no watermark, free forever',
    ],
    appName: 'Editroy Video Editor',
    iframeSrc: '/video-editor/index.html',
    iframeHeight: 900,
    ogImage: '/icons/icon-512.png',
    keywords: [
      'free video editor online', 'video editor no watermark', 'online video editor',
      'trim video online', 'merge videos online', 'add music to video', 'editroy',
    ],
    howItWorks: [
      { icon: '🎥', heading: 'Import your clips', body: 'Upload MP4, MOV, or WebM videos and add them to the timeline.' },
      { icon: '✂️', heading: 'Edit on the timeline', body: 'Trim, split, merge clips, add text overlays, music and transitions.' },
      { icon: '🚀', heading: 'Export in HD', body: 'Export your finished video in full HD — no watermark, no quality loss.' },
    ],
    faqs: [
      { question: 'Is the video editor really free?', answer: 'Yes — completely free with no watermark and no signup required.' },
      { question: 'What video formats are supported?', answer: 'MP4, MOV, WebM, and AVI are supported. Output is in MP4.' },
      { question: 'Is there a video length limit?', answer: 'There is no hard limit. Very long videos may take more time to process depending on your device.' },
      { question: 'Does it run in the browser?', answer: 'Yes — no software installation is needed. Everything runs directly in Chrome, Firefox or Edge.' },
    ],
    relatedTools: [
      { label: 'Video BG Remover', href: '/video-background-remover', icon: '🎭' },
      { label: 'Audio Separator', href: '/audio-separator', icon: '🎵' },
      { label: 'Background Remover', href: '/bg-remover-online', icon: '✂️' },
    ],
  },

  /* ─────────────────────────────────────────
     PDF TOOL LANDING PAGES
  ───────────────────────────────────────── */

  'merge-pdf-online': {
    title: 'Merge PDF Online Free — Combine PDFs | Editroy',
    description: 'Combine multiple PDF files into one online for free. Fast, private, browser-based PDF merger. No signup, no watermark.',
    canonical: `${BASE}/document-utilities/merge-pdf-online`,
    h1: 'Merge PDF Online — Free & Instant',
    tagline: 'Drag, drop and combine multiple PDFs into one file in seconds.',
    features: [
      'Merge unlimited PDFs into one file',
      'Drag to reorder pages before merging',
      'Fully private — processed in your browser',
      'Free, no signup, no watermark',
      'Download merged PDF instantly',
    ],
    appName: 'Editroy PDF Merger',
    iframeSrc: '/document-utilities?tool=merge-pdf',
    iframeHeight: 820,
    ogImage: '/icons/icon-512.png',
    keywords: ['merge pdf', 'combine pdf online', 'pdf merger free', 'join pdf files', 'merge pdf online free', 'editroy'],
    howItWorks: [
      { icon: '📤', heading: 'Upload your PDFs', body: 'Select two or more PDF files from your device.' },
      { icon: '🔀', heading: 'Arrange the order', body: 'Drag and drop to set the page order before merging.' },
      { icon: '💾', heading: 'Download merged PDF', body: 'Get your single combined PDF file in one click.' },
    ],
    faqs: [
      { question: 'How many PDFs can I merge at once?', answer: 'You can merge as many PDF files as you need — there is no limit.' },
      { question: 'Is the PDF merger free?', answer: 'Yes — completely free, no signup and no watermark.' },
      { question: 'Does merging affect PDF quality?', answer: 'No. All pages are merged at their original quality with no re-compression.' },
    ],
    relatedTools: [
      { label: 'Split PDF', href: '/split-pdf-online', icon: '✂️' },
      { label: 'Compress PDF', href: '/compress-pdf-online', icon: '📉' },
      { label: 'PDF to Word', href: '/pdf-to-word-online', icon: '📄' },
    ],
  },

  'split-pdf-online': {
    title: 'Split PDF Online Free — Extract Pages | Editroy',
    description: 'Split a PDF into multiple files or extract specific pages online for free. No signup, browser-based, instant download.',
    canonical: `${BASE}/document-utilities/split-pdf-online`,
    h1: 'Split PDF Online — Extract Any Pages Free',
    tagline: 'Separate pages, extract ranges, or split every page into its own PDF.',
    features: [
      'Split PDF by page range or single pages',
      'Extract specific pages visually',
      'Download each part separately',
      'Completely private — runs in your browser',
      'Free, no signup, no watermark',
    ],
    appName: 'Editroy PDF Splitter',
    iframeSrc: '/document-utilities?tool=split-pdf',
    iframeHeight: 820,
    ogImage: '/icons/icon-512.png',
    keywords: ['split pdf', 'split pdf online', 'extract pages from pdf', 'separate pdf pages', 'pdf splitter free', 'editroy'],
    howItWorks: [
      { icon: '📄', heading: 'Upload your PDF', body: 'Select the PDF you want to split.' },
      { icon: '🖱️', heading: 'Pick your pages', body: 'Click or type the page range you want to extract.' },
      { icon: '💾', heading: 'Download the result', body: 'Save the extracted pages as a new PDF file.' },
    ],
    faqs: [
      { question: 'Can I extract just one page from a PDF?', answer: 'Yes — enter a single page number and only that page will be extracted.' },
      { question: 'Is the PDF splitter free?', answer: 'Yes — completely free with no signup required.' },
      { question: 'Will it split all pages at once?', answer: 'You can extract any range of pages you choose, or split every page into separate files.' },
    ],
    relatedTools: [
      { label: 'Merge PDF', href: '/merge-pdf-online', icon: '📑' },
      { label: 'Compress PDF', href: '/compress-pdf-online', icon: '📉' },
      { label: 'PDF to Word', href: '/pdf-to-word-online', icon: '📄' },
    ],
  },

  'pdf-to-word-online': {
    title: 'PDF to Word Converter Online Free | Editroy',
    description: 'Convert PDF to editable Word DOCX online for free. Accurate layout, instant download. No signup, no email required.',
    canonical: `${BASE}/document-utilities/pdf-to-word-online`,
    h1: 'PDF to Word Converter — Free Online',
    tagline: 'Convert any PDF to editable DOCX in seconds. Layout preserved.',
    features: [
      'Convert PDF to fully editable DOCX',
      'Preserves fonts, tables and layout',
      'Supports scanned PDFs with OCR',
      'Completely private — browser-based',
      'Free, no signup, no watermark',
    ],
    appName: 'Editroy PDF to Word',
    iframeSrc: '/document-utilities?tool=pdf-to-word',
    iframeHeight: 820,
    ogImage: '/icons/icon-512.png',
    keywords: ['pdf to word', 'pdf to docx online', 'convert pdf to word free', 'pdf to word converter', 'editroy'],
    howItWorks: [
      { icon: '📄', heading: 'Upload your PDF', body: 'Select the PDF you want to convert to Word.' },
      { icon: '⚙️', heading: 'Conversion happens instantly', body: 'The engine converts your PDF to a fully editable DOCX preserving the original layout.' },
      { icon: '💾', heading: 'Download the DOCX', body: 'Save the editable Word document to your device.' },
    ],
    faqs: [
      { question: 'Will the formatting be preserved?', answer: 'Yes — fonts, tables, images and layout are all preserved during conversion.' },
      { question: 'Can it convert scanned PDFs?', answer: 'Yes — OCR technology extracts text from scanned or image-based PDFs.' },
      { question: 'Is the PDF to Word converter free?', answer: 'Yes — completely free with no signup required.' },
    ],
    relatedTools: [
      { label: 'Word to PDF', href: '/word-to-pdf-online', icon: '📝' },
      { label: 'PDF to Excel', href: '/pdf-to-excel-online', icon: '📊' },
      { label: 'Compress PDF', href: '/compress-pdf-online', icon: '📉' },
    ],
  },

  'pdf-to-excel-online': {
    title: 'PDF to Excel Converter Online Free | Editroy',
    description: 'Convert PDF tables to editable Excel XLSX online for free. Extract data accurately. No signup required.',
    canonical: `${BASE}/document-utilities/pdf-to-excel-online`,
    h1: 'PDF to Excel Converter — Free Online',
    tagline: 'Extract tables from any PDF into an editable Excel spreadsheet.',
    features: [
      'Convert PDF tables to editable XLSX',
      'Accurately extracts rows and columns',
      'Works on multi-page PDFs',
      'Completely private — browser-based',
      'Free, no signup, no watermark',
    ],
    appName: 'Editroy PDF to Excel',
    iframeSrc: '/document-utilities?tool=pdf-to-excel',
    iframeHeight: 820,
    ogImage: '/icons/icon-512.png',
    keywords: ['pdf to excel', 'pdf to xlsx online', 'convert pdf to excel free', 'extract table from pdf', 'editroy'],
    howItWorks: [
      { icon: '📄', heading: 'Upload your PDF', body: 'Select the PDF containing the table data you want to extract.' },
      { icon: '📊', heading: 'Tables are extracted', body: 'The engine detects and accurately extracts all tables into Excel rows and columns.' },
      { icon: '💾', heading: 'Download the XLSX', body: 'Save the editable Excel spreadsheet to your device.' },
    ],
    faqs: [
      { question: 'What if my PDF has multiple tables?', answer: 'All tables across all pages are extracted into the spreadsheet, each on its own sheet.' },
      { question: 'Is the PDF to Excel converter free?', answer: 'Yes — completely free with no signup required.' },
      { question: 'Can it handle scanned PDFs?', answer: 'Yes — OCR is used to extract tables from scanned or image-based PDFs.' },
    ],
    relatedTools: [
      { label: 'PDF to Word', href: '/pdf-to-word-online', icon: '📄' },
      { label: 'Excel to PDF', href: '/excel-to-pdf-online', icon: '📊' },
      { label: 'Compress PDF', href: '/compress-pdf-online', icon: '📉' },
    ],
  },

  'pdf-to-jpg-online': {
    title: 'PDF to JPG Converter Online Free | Editroy',
    description: 'Convert PDF pages to high-quality JPG or PNG images online for free. No signup, instant download, browser-based.',
    canonical: `${BASE}/document-utilities/pdf-to-jpg-online`,
    h1: 'PDF to JPG — Convert PDF Pages to Images Free',
    tagline: 'Turn any PDF page into a high-quality JPG or PNG image instantly.',
    features: [
      'Convert every PDF page to a JPG image',
      'Choose output quality (high/medium)',
      'Download all images as a ZIP',
      'Completely private — browser-based',
      'Free, no signup, no watermark',
    ],
    appName: 'Editroy PDF to Image',
    iframeSrc: '/document-utilities?tool=pdf-to-image',
    iframeHeight: 820,
    ogImage: '/icons/icon-512.png',
    keywords: ['pdf to jpg', 'pdf to image online', 'convert pdf to jpg free', 'pdf to png', 'pdf page to image', 'editroy'],
    howItWorks: [
      { icon: '📄', heading: 'Upload your PDF', body: 'Select the PDF you want to convert to images.' },
      { icon: '🖼️', heading: 'Pages become images', body: 'Every page of the PDF is rendered as a high-quality JPG or PNG.' },
      { icon: '💾', heading: 'Download as ZIP', body: 'Download all images at once in a single ZIP file.' },
    ],
    faqs: [
      { question: 'What image formats can I get?', answer: 'You can download pages as JPG or PNG — both at high quality.' },
      { question: 'Is the PDF to JPG converter free?', answer: 'Yes — completely free with no signup required.' },
      { question: 'Can I convert just one page?', answer: 'Yes — choose to convert all pages or select specific pages only.' },
    ],
    relatedTools: [
      { label: 'Image to PDF', href: '/image-to-pdf-online', icon: '📸' },
      { label: 'PDF to Word', href: '/pdf-to-word-online', icon: '📄' },
      { label: 'Compress PDF', href: '/compress-pdf-online', icon: '📉' },
    ],
  },

  'word-to-pdf-online': {
    title: 'Word to PDF Converter Online Free | Editroy',
    description: 'Convert Word DOCX to PDF online for free. Perfect layout, instant download. No signup, no email, browser-based.',
    canonical: `${BASE}/document-utilities/word-to-pdf-online`,
    h1: 'Word to PDF Converter — Free Online',
    tagline: 'Convert any Word document to a perfectly formatted PDF in seconds.',
    features: [
      'Convert DOCX and DOC to PDF',
      'Preserves all formatting and fonts',
      'Works on any device — no install needed',
      'Completely private — browser-based',
      'Free, no signup, no watermark',
    ],
    appName: 'Editroy Word to PDF',
    iframeSrc: '/document-utilities?tool=word-to-pdf',
    iframeHeight: 820,
    ogImage: '/icons/icon-512.png',
    keywords: ['word to pdf', 'docx to pdf online', 'convert word to pdf free', 'word to pdf converter', 'editroy'],
    howItWorks: [
      { icon: '📝', heading: 'Upload your Word file', body: 'Select a .doc or .docx file from your device.' },
      { icon: '⚙️', heading: 'Converted instantly', body: 'The engine converts the document to PDF with perfect layout fidelity.' },
      { icon: '💾', heading: 'Download your PDF', body: 'Save the resulting PDF to your device instantly.' },
    ],
    faqs: [
      { question: 'Does it support both DOC and DOCX?', answer: 'Yes — both older .doc and modern .docx formats are supported.' },
      { question: 'Will fonts and images be preserved?', answer: 'Yes — all fonts, images, tables and formatting are preserved.' },
      { question: 'Is it free?', answer: 'Yes — completely free with no signup required.' },
    ],
    relatedTools: [
      { label: 'PDF to Word', href: '/pdf-to-word-online', icon: '📄' },
      { label: 'Excel to PDF', href: '/excel-to-pdf-online', icon: '📊' },
      { label: 'Compress PDF', href: '/compress-pdf-online', icon: '📉' },
    ],
  },

  'excel-to-pdf-online': {
    title: 'Excel to PDF Converter Online Free | Editroy',
    description: 'Convert Excel spreadsheets to PDF online for free. All sheets, charts and formatting preserved. No signup required.',
    canonical: `${BASE}/document-utilities/excel-to-pdf-online`,
    h1: 'Excel to PDF Converter — Free Online',
    tagline: 'Convert any Excel spreadsheet to a perfectly formatted PDF.',
    features: [
      'Convert XLS and XLSX to PDF',
      'All sheets, charts and formatting preserved',
      'Fit to page options included',
      'Completely private — browser-based',
      'Free, no signup, no watermark',
    ],
    appName: 'Editroy Excel to PDF',
    iframeSrc: '/document-utilities?tool=excel-to-pdf',
    iframeHeight: 820,
    ogImage: '/icons/icon-512.png',
    keywords: ['excel to pdf', 'xlsx to pdf online', 'convert excel to pdf free', 'spreadsheet to pdf', 'editroy'],
    howItWorks: [
      { icon: '📊', heading: 'Upload your Excel file', body: 'Select a .xls or .xlsx file from your device.' },
      { icon: '⚙️', heading: 'Converted instantly', body: 'All sheets and charts are converted to PDF pages with full formatting.' },
      { icon: '💾', heading: 'Download your PDF', body: 'Save the resulting PDF instantly.' },
    ],
    faqs: [
      { question: 'Are all sheets converted?', answer: 'Yes — each sheet becomes a page or set of pages in the PDF.' },
      { question: 'Will charts be preserved?', answer: 'Yes — charts, images and all visual elements are preserved.' },
      { question: 'Is it free?', answer: 'Yes — completely free with no signup required.' },
    ],
    relatedTools: [
      { label: 'Word to PDF', href: '/word-to-pdf-online', icon: '📝' },
      { label: 'PDF to Excel', href: '/pdf-to-excel-online', icon: '📊' },
      { label: 'Compress PDF', href: '/compress-pdf-online', icon: '📉' },
    ],
  },

  'compress-pdf-online': {
    title: 'Compress PDF Online Free — Reduce File Size | Editroy',
    description: 'Compress PDF files online for free. Reduce PDF size without losing quality. No signup, instant download, browser-based.',
    canonical: `${BASE}/document-utilities/compress-pdf-online`,
    h1: 'Compress PDF Online — Reduce Size Free',
    tagline: 'Make any PDF smaller without losing quality — instantly, in your browser.',
    features: [
      'Reduce PDF file size by up to 80%',
      'Choose compression level (light/standard/heavy)',
      'Maintains visual quality',
      'Completely private — browser-based',
      'Free, no signup, no watermark',
    ],
    appName: 'Editroy PDF Compressor',
    iframeSrc: '/document-utilities?tool=compress-pdf',
    iframeHeight: 820,
    ogImage: '/icons/icon-512.png',
    keywords: ['compress pdf', 'reduce pdf size online', 'pdf compressor free', 'shrink pdf file', 'compress pdf online free', 'editroy'],
    howItWorks: [
      { icon: '📄', heading: 'Upload your PDF', body: 'Select the PDF you want to compress.' },
      { icon: '📉', heading: 'Choose compression level', body: 'Pick light, standard or heavy compression based on your needs.' },
      { icon: '💾', heading: 'Download compressed PDF', body: 'Get the smaller PDF file instantly.' },
    ],
    faqs: [
      { question: 'How much will the PDF shrink?', answer: 'Typical reductions are 30–80% depending on the content and compression level you choose.' },
      { question: 'Will quality be affected?', answer: 'Light compression has no visible quality loss. Heavy compression may slightly reduce image sharpness.' },
      { question: 'Is the PDF compressor free?', answer: 'Yes — completely free with no signup required.' },
    ],
    relatedTools: [
      { label: 'Merge PDF', href: '/merge-pdf-online', icon: '📑' },
      { label: 'Split PDF', href: '/split-pdf-online', icon: '✂️' },
      { label: 'PDF to Word', href: '/pdf-to-word-online', icon: '📄' },
    ],
  },

  'sign-pdf-online': {
    title: 'Sign PDF Online Free — Add Signature | Editroy',
    description: 'Sign a PDF online for free. Draw, type or upload your signature. No signup, no printing, no scanning needed.',
    canonical: `${BASE}/document-utilities/sign-pdf-online`,
    h1: 'Sign PDF Online — Add Your Signature Free',
    tagline: 'Draw, type or upload your signature and place it on any PDF — no printing needed.',
    features: [
      'Draw your signature with a mouse or stylus',
      'Type a signature with custom fonts',
      'Upload an image of your signature',
      'Place signature anywhere on the PDF',
      'Free, no signup, no watermark',
    ],
    appName: 'Editroy PDF Signer',
    iframeSrc: '/document-utilities?tool=sign-pdf',
    iframeHeight: 820,
    ogImage: '/icons/icon-512.png',
    keywords: ['sign pdf online', 'pdf signature online free', 'add signature to pdf', 'esign pdf', 'online pdf signer', 'editroy'],
    howItWorks: [
      { icon: '📄', heading: 'Upload your PDF', body: 'Select the PDF document that needs your signature.' },
      { icon: '🖊️', heading: 'Create your signature', body: 'Draw, type or upload a signature image.' },
      { icon: '💾', heading: 'Place and download', body: 'Position the signature on any page and download the signed PDF.' },
    ],
    faqs: [
      { question: 'Is the signature legally binding?', answer: 'The signature is a digital image overlay. For legally binding e-signatures, a dedicated e-sign service is recommended.' },
      { question: 'Can I sign multiple pages?', answer: 'Yes — you can place your signature on any page of the document.' },
      { question: 'Is it free?', answer: 'Yes — completely free with no signup required.' },
    ],
    relatedTools: [
      { label: 'Protect PDF', href: '/protect-pdf-online', icon: '🔒' },
      { label: 'Compress PDF', href: '/compress-pdf-online', icon: '📉' },
      { label: 'Merge PDF', href: '/merge-pdf-online', icon: '📑' },
    ],
  },

  'protect-pdf-online': {
    title: 'Protect PDF with Password Online Free | Editroy',
    description: 'Add password protection to any PDF online for free. Secure your documents with encryption. No signup required.',
    canonical: `${BASE}/document-utilities/protect-pdf-online`,
    h1: 'Protect PDF with Password — Free Online',
    tagline: 'Encrypt any PDF with a password to keep your documents private.',
    features: [
      'Add password protection to any PDF',
      '256-bit AES encryption',
      'Set open and permission passwords',
      'Completely private — browser-based',
      'Free, no signup, no watermark',
    ],
    appName: 'Editroy PDF Protector',
    iframeSrc: '/document-utilities?tool=protect-pdf',
    iframeHeight: 820,
    ogImage: '/icons/icon-512.png',
    keywords: ['protect pdf', 'password protect pdf online', 'encrypt pdf free', 'lock pdf with password', 'editroy'],
    howItWorks: [
      { icon: '📄', heading: 'Upload your PDF', body: 'Select the PDF you want to password protect.' },
      { icon: '🔐', heading: 'Set your password', body: 'Enter the password and choose encryption strength.' },
      { icon: '💾', heading: 'Download protected PDF', body: 'Get the encrypted, password-protected PDF instantly.' },
    ],
    faqs: [
      { question: 'What encryption is used?', answer: '256-bit AES encryption — the same standard used by banks and governments.' },
      { question: 'Can I set different passwords for opening and editing?', answer: 'Yes — you can set an open password and a separate permissions password.' },
      { question: 'Is it free?', answer: 'Yes — completely free with no signup required.' },
    ],
    relatedTools: [
      { label: 'Sign PDF', href: '/sign-pdf-online', icon: '🖋️' },
      { label: 'Compress PDF', href: '/compress-pdf-online', icon: '📉' },
      { label: 'Merge PDF', href: '/merge-pdf-online', icon: '📑' },
    ],
  },

  'ocr-pdf-online': {
    title: 'OCR PDF Online Free — Make Scanned PDF Searchable | Editroy',
    description: 'Make scanned PDFs searchable and selectable with OCR online for free. Extract text from image-based PDFs. No signup.',
    canonical: `${BASE}/document-utilities/ocr-pdf-online`,
    h1: 'OCR PDF — Make Scanned PDFs Searchable Free',
    tagline: 'Extract and search text from any scanned or image PDF using OCR.',
    features: [
      'Convert scanned PDFs to searchable text',
      'Supports 40+ languages',
      'Maintain original layout with text overlay',
      'Completely private — browser-based',
      'Free, no signup, no watermark',
    ],
    appName: 'Editroy OCR PDF',
    iframeSrc: '/document-utilities?tool=ocr-pdf',
    iframeHeight: 820,
    ogImage: '/icons/icon-512.png',
    keywords: ['ocr pdf', 'pdf ocr online free', 'make pdf searchable', 'scanned pdf to text', 'image pdf to text', 'editroy'],
    howItWorks: [
      { icon: '📄', heading: 'Upload scanned PDF', body: 'Select the scanned or image-based PDF.' },
      { icon: '🔍', heading: 'OCR processes the text', body: 'Optical character recognition extracts all text from every page.' },
      { icon: '💾', heading: 'Download searchable PDF', body: 'Get a PDF where all text is now selectable and searchable.' },
    ],
    faqs: [
      { question: 'What languages does OCR support?', answer: 'Over 40 languages are supported including English, Spanish, French, German, Hindi and more.' },
      { question: 'Will the original layout be preserved?', answer: 'Yes — the recognized text is overlaid on the original page without changing the visual appearance.' },
      { question: 'Is OCR PDF free?', answer: 'Yes — completely free with no signup required.' },
    ],
    relatedTools: [
      { label: 'PDF to Word', href: '/pdf-to-word-online', icon: '📄' },
      { label: 'PDF to Text', href: '/pdf-text-editor', icon: '📃' },
      { label: 'Compress PDF', href: '/compress-pdf-online', icon: '📉' },
    ],
  },

  'watermark-pdf-online': {
    title: 'Add Watermark to PDF Online Free | Editroy',
    description: 'Add a text or image watermark to any PDF online for free. Customise position, opacity and font. No signup required.',
    canonical: `${BASE}/document-utilities/watermark-pdf-online`,
    h1: 'Watermark PDF Online — Free & Instant',
    tagline: 'Stamp any PDF with a text or image watermark. Fully customisable.',
    features: [
      'Add text or image watermarks to PDFs',
      'Customise position, opacity, rotation and size',
      'Apply to all pages or specific pages',
      'Completely private — browser-based',
      'Free, no signup, no watermark',
    ],
    appName: 'Editroy PDF Watermark',
    iframeSrc: '/document-utilities?tool=watermark',
    iframeHeight: 820,
    ogImage: '/icons/icon-512.png',
    keywords: ['watermark pdf', 'add watermark to pdf online', 'pdf watermark free', 'stamp pdf', 'editroy'],
    howItWorks: [
      { icon: '📄', heading: 'Upload your PDF', body: 'Select the PDF you want to watermark.' },
      { icon: '🌊', heading: 'Configure watermark', body: 'Enter your text or upload an image, then adjust position, size and opacity.' },
      { icon: '💾', heading: 'Download watermarked PDF', body: 'Get the stamped PDF with your watermark applied to all pages.' },
    ],
    faqs: [
      { question: 'Can I add an image watermark?', answer: 'Yes — you can upload a PNG, JPG or SVG as the watermark image.' },
      { question: 'Can I control watermark opacity?', answer: 'Yes — set opacity from fully transparent to fully opaque.' },
      { question: 'Is the watermark tool free?', answer: 'Yes — completely free with no signup required.' },
    ],
    relatedTools: [
      { label: 'Protect PDF', href: '/protect-pdf-online', icon: '🔒' },
      { label: 'Compress PDF', href: '/compress-pdf-online', icon: '📉' },
      { label: 'Sign PDF', href: '/sign-pdf-online', icon: '🖋️' },
    ],
  },

  'image-to-pdf-online': {
    title: 'Image to PDF Converter Online Free | Editroy',
    description: 'Convert JPG, PNG and WebP images to PDF online for free. Combine multiple images into one PDF. No signup required.',
    canonical: `${BASE}/document-utilities/image-to-pdf-online`,
    h1: 'Image to PDF Converter — Free Online',
    tagline: 'Convert one or multiple images into a single PDF document instantly.',
    features: [
      'Convert JPG, PNG, WebP to PDF',
      'Combine multiple images into one PDF',
      'Control page size and margins',
      'Completely private — browser-based',
      'Free, no signup, no watermark',
    ],
    appName: 'Editroy Image to PDF',
    iframeSrc: '/document-utilities?tool=image-to-pdf',
    iframeHeight: 820,
    ogImage: '/icons/icon-512.png',
    keywords: ['image to pdf', 'jpg to pdf online', 'png to pdf free', 'convert image to pdf', 'photos to pdf', 'editroy'],
    howItWorks: [
      { icon: '🖼️', heading: 'Upload your images', body: 'Select one or more JPG, PNG or WebP images.' },
      { icon: '⚙️', heading: 'Configure PDF options', body: 'Choose page size, orientation and margins.' },
      { icon: '💾', heading: 'Download the PDF', body: 'Get all images compiled into a single PDF document.' },
    ],
    faqs: [
      { question: 'Can I combine multiple images into one PDF?', answer: 'Yes — upload as many images as you need and they will be placed on separate pages.' },
      { question: 'What image formats are supported?', answer: 'JPG, JPEG, PNG and WebP are all supported.' },
      { question: 'Is it free?', answer: 'Yes — completely free with no signup required.' },
    ],
    relatedTools: [
      { label: 'PDF to Image', href: '/pdf-to-jpg-online', icon: '🖼️' },
      { label: 'Compress PDF', href: '/compress-pdf-online', icon: '📉' },
      { label: 'Merge PDF', href: '/merge-pdf-online', icon: '📑' },
    ],
  },
};

/** Build Next.js Metadata object for a tool page */
export function buildToolMetadata(toolKey: string) {
  const t = TOOL_SEO[toolKey];
  if (!t) throw new Error(`No SEO metadata found for tool: ${toolKey}`);
  return {
    title: t.title,
    description: t.description,
    keywords: t.keywords,
    alternates: { canonical: t.canonical },
    openGraph: {
      title: t.title,
      description: t.description,
      url: t.canonical,
      siteName: 'Editroy',
      type: 'website' as const,
      images: [{ url: t.ogImage ?? '/icons/icon-512.png', width: 512, height: 512, alt: t.appName }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: t.title,
      description: t.description,
      site: '@editroy',
      images: [t.ogImage ?? '/icons/icon-512.png'],
    },
  };
}
