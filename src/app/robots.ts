// src/app/robots.ts
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/_next/', '/image-editor', '/video-editor'],
      },
    ],
    sitemap: 'https://www.editroy.com/sitemap.xml',
    host: 'https://www.editroy.com',
  };
}
