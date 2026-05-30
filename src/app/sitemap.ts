// src/app/sitemap.ts
import type { MetadataRoute } from 'next';

const BASE = 'https://www.editroy.com';
const now = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  const toolPages = [
    // AI tools
    '/bg-remover-online',
    '/audio-separator',
    '/video-background-remover',
    '/pdf-text-editor',
    '/same-edit',
    '/edit-image-online',
    '/video-editor-online',
    // PDF tools
    '/merge-pdf-online',
    '/split-pdf-online',
    '/pdf-to-word-online',
    '/pdf-to-excel-online',
    '/pdf-to-jpg-online',
    '/word-to-pdf-online',
    '/excel-to-pdf-online',
    '/compress-pdf-online',
    '/sign-pdf-online',
    '/protect-pdf-online',
    '/ocr-pdf-online',
    '/watermark-pdf-online',
    '/image-to-pdf-online',
  ];

  const appPages = [
    '/dashboard',
    '/image-editor',
    '/video-editor',
    '/document-utilities',
  ];

  return [
    // Root
    {
      url: BASE,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    // Tool SEO landing pages — highest priority for crawlers
    ...toolPages.map((path) => ({
      url: `${BASE}${path}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    })),
    // App pages
    ...appPages.map((path) => ({
      url: `${BASE}${path}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
