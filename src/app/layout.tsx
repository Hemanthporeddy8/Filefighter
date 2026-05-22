import type {Metadata, Viewport} from 'next';
import './globals.css';
import { Providers } from './providers';
import Script from 'next/script';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#6366f1',
};

export const metadata: Metadata = {
  title: 'Editroy — AI-Powered Video & Document Editor',
  description: 'Editroy is a powerful online video editor and document manager. Edit videos, add overlays, text, audio and export in HD — all in your browser.',
  metadataBase: new URL('https://www.editroy.com'),
  alternates: { canonical: 'https://www.editroy.com' },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Editroy',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
    shortcut: '/icons/icon-192.png',
  },
  openGraph: {
    title: 'Editroy — AI-Powered Video & Document Editor',
    description: 'Edit videos, add overlays, text, transitions and export in HD — all in your browser. No install needed.',
    url: 'https://www.editroy.com',
    siteName: 'Editroy',
    type: 'website',
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: 'Editroy App Icon' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Editroy — AI-Powered Video Editor',
    description: 'Edit videos online for free. No installs, no limits.',
    site: '@editroy',
    images: ['/icons/icon-512.png'],
  },
  keywords: ['video editor', 'online video editor', 'free video editor', 'document editor', 'editroy', 'canva alternative', 'pwa'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Lato:ital,wght@0,400;0,700;1,400&family=Montserrat:ital,wght@0,400;0,700;1,400&family=Oswald:wght@400;700&family=Roboto:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet" />
        {/* PWA: register service worker */}
        <Script id="sw-register" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js')
                .then(function(reg) { console.log('[SW] Registered:', reg.scope); })
                .catch(function(err) { console.warn('[SW] Registration failed:', err); });
            });
          }
        `}</Script>
      </head>
      <body className="font-body antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
