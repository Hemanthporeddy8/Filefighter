// src/app/audio-separator/page.tsx
import type { Metadata } from 'next';
import { buildToolMetadata, TOOL_SEO } from '@/lib/seo';
import { ToolSeoPage } from '@/components/seo/ToolSeoPage';

const KEY = 'audio-separator';
export const metadata: Metadata = buildToolMetadata(KEY);

export default function AudioSeparatorPage() {
  return <ToolSeoPage tool={TOOL_SEO[KEY]} />;
}
