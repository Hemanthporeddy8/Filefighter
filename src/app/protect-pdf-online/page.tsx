// src/app/protect-pdf-online/page.tsx
import type { Metadata } from 'next';
import { buildToolMetadata, TOOL_SEO } from '@/lib/seo';
import { ToolSeoPage } from '@/components/seo/ToolSeoPage';
const KEY = 'protect-pdf-online';
export const metadata: Metadata = buildToolMetadata(KEY);
export default function ProtectPdfPage() { return <ToolSeoPage tool={TOOL_SEO[KEY]} />; }
