import type {Metadata} from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Editroy — AI-Powered Video & Document Editor',
  description: 'Editroy is a powerful online video editor and document manager. Edit videos, add overlays, text, audio and export in HD — all in your browser.',
  metadataBase: new URL('https://www.editroy.com'),
  alternates: { canonical: 'https://www.editroy.com' },
  openGraph: {
    title: 'Editroy — AI-Powered Video & Document Editor',
    description: 'Edit videos, add overlays, text, transitions and export in HD — all in your browser. No install needed.',
    url: 'https://www.editroy.com',
    siteName: 'Editroy',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Editroy — AI-Powered Video Editor',
    description: 'Edit videos online for free. No installs, no limits.',
    site: '@editroy',
  },
  keywords: ['video editor', 'online video editor', 'free video editor', 'document editor', 'editroy', 'canva alternative'],
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
      </head>
      <body className="font-body antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
