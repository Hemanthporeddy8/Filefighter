// src/app/video-editor-online/page.tsx
import type { Metadata } from 'next';
import { buildToolMetadata, TOOL_SEO } from '@/lib/seo';
import { ToolSeoPage } from '@/components/seo/ToolSeoPage';

const KEY = 'video-editor-online';
export const metadata: Metadata = buildToolMetadata(KEY);

export default function VideoEditorOnlinePage() {
  return <ToolSeoPage tool={TOOL_SEO[KEY]} />;
}
