// src/app/video-background-remover/page.tsx
import type { Metadata } from 'next';
import { buildToolMetadata, TOOL_SEO } from '@/lib/seo';
import { ToolSeoPage } from '@/components/seo/ToolSeoPage';

const KEY = 'video-background-remover';
export const metadata: Metadata = buildToolMetadata(KEY);

export default function VideoBgRemoverPage() {
  return <ToolSeoPage tool={TOOL_SEO[KEY]} />;
}
