// src/app/pdf-text-editor/page.tsx
import type { Metadata } from 'next';
import { buildToolMetadata, TOOL_SEO } from '@/lib/seo';
import { ToolSeoPage } from '@/components/seo/ToolSeoPage';

const KEY = 'pdf-text-editor';
export const metadata: Metadata = buildToolMetadata(KEY);

export default function PdfTextEditorPage() {
  return <ToolSeoPage tool={TOOL_SEO[KEY]} />;
}
