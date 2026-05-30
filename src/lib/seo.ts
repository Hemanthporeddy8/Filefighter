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
