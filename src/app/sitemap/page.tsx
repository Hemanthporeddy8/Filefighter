// src/app/sitemap/page.tsx
"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Map, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function HTMLSitemapPage() {
  const router = useRouter();

  const pdfTools = [
    { label: "Merge PDF Online", href: "/document-utilities/merge-pdf-online" },
    { label: "Split PDF Online", href: "/document-utilities/split-pdf-online" },
    { label: "Compress PDF Online", href: "/document-utilities/compress-pdf-online" },
    { label: "PDF to Word Online", href: "/document-utilities/pdf-to-word-online" },
    { label: "PDF to Excel Online", href: "/document-utilities/pdf-to-excel-online" },
    { label: "PDF to JPG Online", href: "/document-utilities/pdf-to-jpg-online" },
    { label: "Word to PDF Online", href: "/document-utilities/word-to-pdf-online" },
    { label: "Excel to PDF Online", href: "/document-utilities/excel-to-pdf-online" },
    { label: "Sign PDF Online", href: "/document-utilities/sign-pdf-online" },
    { label: "Protect PDF Online", href: "/document-utilities/protect-pdf-online" },
    { label: "Watermark PDF Online", href: "/document-utilities/watermark-pdf-online" },
    { label: "OCR PDF Online", href: "/document-utilities/ocr-pdf-online" },
    { label: "Image to PDF Online", href: "/document-utilities/image-to-pdf-online" },
    { label: "PDF Text Editor", href: "/pdf-text-editor" }
  ];

  const mediaTools = [
    { label: "Audio Separator", href: "/audio-separator" },
    { label: "Image Editor Online", href: "/edit-image-online" },
    { label: "Video Editor Online", href: "/video-editor-online" }
  ];

  const infoPages = [
    { label: "About Editroy", href: "/about" },
    { label: "Contact Us", href: "/contact" },
    { label: "Blog Index", href: "/blog" },
    { label: "FAQ / Help", href: "/faq" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Cookie Policy", href: "/cookie-policy" }
  ];

  const blogArticles = [
    { label: "Guide: Separate Vocals from Music Online", href: "/blog/how-to-separate-vocals-from-music-online" },
    { label: "Guide: Compress PDF Without Quality Loss", href: "/blog/how-to-compress-pdf-without-losing-quality" },
    { label: "Guide: PDF vs Word Document Comparison", href: "/blog/pdf-vs-word-which-format-to-use" }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-black text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-black/80 backdrop-blur-md">
        <div className="container max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Link href="/" className="text-2xl font-black tracking-tight text-white">
              EDIT<span className="text-indigo-500">ROY</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              className="border-slate-800 hover:bg-slate-900 text-slate-200"
              onClick={() => router.push('/')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Home
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow py-12 px-4 sm:px-6">
        <div className="container max-w-4xl mx-auto space-y-12">
          
          {/* Title */}
          <div className="flex items-center gap-3 border-b border-slate-900 pb-6">
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Map className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Sitemap</h1>
              <p className="text-sm text-slate-500 mt-1">Browse all available Editroy tools, guides, and pages.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* PDF Tools */}
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white border-l-2 border-indigo-500 pl-3">PDF & Document Tools</h2>
              <ul className="space-y-2.5 text-sm">
                {pdfTools.map((tool, idx) => (
                  <li key={idx}>
                    <Link href={tool.href} className="text-slate-400 hover:text-indigo-400 flex items-center gap-1.5 transition-colors group">
                      <ArrowRight className="h-3.5 w-3.5 opacity-50 group-hover:translate-x-0.5 transition-transform" />
                      {tool.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Media & Info */}
            <div className="space-y-8">
              
              {/* Media tools */}
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white border-l-2 border-indigo-500 pl-3">Video, Image & Audio Tools</h2>
                <ul className="space-y-2.5 text-sm">
                  {mediaTools.map((tool, idx) => (
                    <li key={idx}>
                      <Link href={tool.href} className="text-slate-400 hover:text-indigo-400 flex items-center gap-1.5 transition-colors group">
                        <ArrowRight className="h-3.5 w-3.5 opacity-50 group-hover:translate-x-0.5 transition-transform" />
                        {tool.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Info Pages */}
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white border-l-2 border-indigo-500 pl-3">Information & Legal</h2>
                <ul className="space-y-2.5 text-sm">
                  {infoPages.map((page, idx) => (
                    <li key={idx}>
                      <Link href={page.href} className="text-slate-400 hover:text-indigo-400 flex items-center gap-1.5 transition-colors group">
                        <ArrowRight className="h-3.5 w-3.5 opacity-50 group-hover:translate-x-0.5 transition-transform" />
                        {page.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Blog Articles */}
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white border-l-2 border-indigo-500 pl-3">Latest Blog Guides</h2>
                <ul className="space-y-2.5 text-sm">
                  {blogArticles.map((article, idx) => (
                    <li key={idx}>
                      <Link href={article.href} className="text-slate-400 hover:text-indigo-400 flex items-center gap-1.5 transition-colors group text-left">
                        <ArrowRight className="h-3.5 w-3.5 opacity-50 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
                        {article.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

            </div>

          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-black py-8">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-sm font-black tracking-tight text-white">
            EDIT<span className="text-indigo-500">ROY</span>
          </span>
          <div className="flex gap-6 text-xs text-slate-500">
            <Link href="/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
            <Link href="/about" className="hover:text-slate-300 transition-colors">About Us</Link>
            <Link href="/contact" className="hover:text-slate-300 transition-colors">Contact Support</Link>
            <Link href="/faq" className="hover:text-slate-300 transition-colors">FAQ</Link>
            <Link href="/cookie-policy" className="hover:text-slate-300 transition-colors">Cookie Policy</Link>
            <Link href="/sitemap" className="hover:text-slate-300 transition-colors">Sitemap</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
