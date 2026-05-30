// src/app/split-pdf-online/page.tsx
import type { Metadata } from 'next';
import { buildToolMetadata, TOOL_SEO } from '@/lib/seo';
import { ToolSeoPage } from '@/components/seo/ToolSeoPage';
const KEY = 'split-pdf-online';
export const metadata: Metadata = buildToolMetadata(KEY);
export default function SplitPdfPage() { return <ToolSeoPage tool={TOOL_SEO[KEY]} />; }
