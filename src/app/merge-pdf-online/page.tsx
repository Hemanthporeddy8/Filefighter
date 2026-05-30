// src/app/merge-pdf-online/page.tsx
import type { Metadata } from 'next';
import { buildToolMetadata, TOOL_SEO } from '@/lib/seo';
import { ToolSeoPage } from '@/components/seo/ToolSeoPage';
const KEY = 'merge-pdf-online';
export const metadata: Metadata = buildToolMetadata(KEY);
export default function MergePdfPage() { return <ToolSeoPage tool={TOOL_SEO[KEY]} />; }
