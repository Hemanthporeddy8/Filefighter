// src/app/pdf-to-jpg-online/page.tsx
import type { Metadata } from 'next';
import { buildToolMetadata, TOOL_SEO } from '@/lib/seo';
import { ToolSeoPage } from '@/components/seo/ToolSeoPage';
const KEY = 'pdf-to-jpg-online';
export const metadata: Metadata = buildToolMetadata(KEY);
export default function PdfToJpgPage() { return <ToolSeoPage tool={TOOL_SEO[KEY]} />; }
