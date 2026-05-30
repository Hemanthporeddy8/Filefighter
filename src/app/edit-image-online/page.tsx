// src/app/edit-image-online/page.tsx
import type { Metadata } from 'next';
import { buildToolMetadata, TOOL_SEO } from '@/lib/seo';
import { ToolSeoPage } from '@/components/seo/ToolSeoPage';

const KEY = 'image-editor';
export const metadata: Metadata = buildToolMetadata(KEY);

export default function ImageEditorLandingPage() {
  return <ToolSeoPage tool={TOOL_SEO[KEY]} />;
}
