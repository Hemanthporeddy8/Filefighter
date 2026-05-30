// src/app/pdf-to-word-online/page.tsx
import type { Metadata } from 'next';
import { buildToolMetadata, TOOL_SEO } from '@/lib/seo';
import { ToolSeoPage } from '@/components/seo/ToolSeoPage';
const KEY = 'pdf-to-word-online';
export const metadata: Metadata = buildToolMetadata(KEY);
export default function PdfToWordPage() { return <ToolSeoPage tool={TOOL_SEO[KEY]} />; }
