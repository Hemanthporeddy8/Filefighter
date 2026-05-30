// src/app/same-edit/page.tsx
import type { Metadata } from 'next';
import { buildToolMetadata, TOOL_SEO } from '@/lib/seo';
import { ToolSeoPage } from '@/components/seo/ToolSeoPage';

const KEY = 'same-edit';
export const metadata: Metadata = buildToolMetadata(KEY);

export default function SameEditPage() {
  return <ToolSeoPage tool={TOOL_SEO[KEY]} />;
}
