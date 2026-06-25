// src/app/sitemap.ts
import type { MetadataRoute } from 'next';

const BASE = 'https://www.editroy.com';
const now = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  const toolPages = [
    // AI tools
    '/ai-tools',
    '/audio-separator',
    '/pdf-text-editor',
    '/same-edit',
    '/edit-image-online',
    '/video-editor-online',
    // PDF tools nested under document-utilities
    '/document-utilities/merge-pdf-online',
    '/document-utilities/split-pdf-online',
    '/document-utilities/pdf-to-word-online',
    '/document-utilities/pdf-to-excel-online',
    '/document-utilities/pdf-to-jpg-online',
    '/document-utilities/word-to-pdf-online',
    '/document-utilities/excel-to-pdf-online',
    '/document-utilities/compress-pdf-online',
    '/document-utilities/sign-pdf-online',
    '/document-utilities/protect-pdf-online',
    '/document-utilities/ocr-pdf-online',
    '/document-utilities/watermark-pdf-online',
    '/document-utilities/image-to-pdf-online',
  ];

  const appPages = [
    '/dashboard',
    '/document-utilities',
  ];

  const infoPages = [
    '/privacy',
    '/terms',
    '/about',
    '/contact',
    '/cookie-policy',
    '/faq',
    '/sitemap',
  ];

  const blogPages = [
    '/blog',
    '/blog/how-to-separate-vocals-from-music-online',
    '/blog/how-to-compress-pdf-without-losing-quality',
    '/blog/pdf-vs-word-which-format-to-use',
    '/blog/how-to-send-large-files-online-free',
    '/blog/how-to-remove-video-backgrounds-without-green-screen',
    '/blog/how-to-compress-images-online-without-quality-loss',
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
    // Compliance & Info pages
    ...infoPages.map((path) => ({
      url: `${BASE}${path}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
    // Blog pages
    ...blogPages.map((path) => ({
      url: `${BASE}${path}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ];
}
