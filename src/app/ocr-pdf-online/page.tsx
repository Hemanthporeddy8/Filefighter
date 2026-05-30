// src/app/ocr-pdf-online/page.tsx
import type { Metadata } from 'next';
import { buildToolMetadata, TOOL_SEO } from '@/lib/seo';
import { ToolSeoPage } from '@/components/seo/ToolSeoPage';
const KEY = 'ocr-pdf-online';
export const metadata: Metadata = buildToolMetadata(KEY);
export default function OcrPdfPage() { return <ToolSeoPage tool={TOOL_SEO[KEY]} />; }
