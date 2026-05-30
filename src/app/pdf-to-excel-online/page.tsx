// src/app/pdf-to-excel-online/page.tsx
import type { Metadata } from 'next';
import { buildToolMetadata, TOOL_SEO } from '@/lib/seo';
import { ToolSeoPage } from '@/components/seo/ToolSeoPage';
const KEY = 'pdf-to-excel-online';
export const metadata: Metadata = buildToolMetadata(KEY);
export default function PdfToExcelPage() { return <ToolSeoPage tool={TOOL_SEO[KEY]} />; }
