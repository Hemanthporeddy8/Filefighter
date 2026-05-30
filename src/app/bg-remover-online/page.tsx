// src/app/bg-remover-online/page.tsx
import type { Metadata } from 'next';
import { buildToolMetadata, TOOL_SEO } from '@/lib/seo';
import { ToolSeoPage } from '@/components/seo/ToolSeoPage';

const KEY = 'bg-remover-online';
export const metadata: Metadata = buildToolMetadata(KEY);

export default function BgRemoverPage() {
  return <ToolSeoPage tool={TOOL_SEO[KEY]} />;
}
