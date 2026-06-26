// src/app/blog/page.tsx
"use client";

import Link from 'next/link';
import { BookOpen, ArrowLeft, ArrowRight, Calendar, Clock } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function BlogIndexPage() {
  const articles = [
    {
      title: "How to Send Large Files Online Free (No Limits 2026)",
      description: "Discover how to transfer large files online for free without size limits. Learn about WebRTC P2P direct transfer, browser-to-browser sharing, and privacy.",
      slug: "how-to-send-large-files-online-free",
      date: "June 22, 2026",
      readTime: "5 min read",
      category: "File Sharing"
    },
    {
      title: "How to Remove Video Backgrounds Without Green Screen",
      description: "Learn how to remove video backgrounds without a green screen online for free. Step-by-step guide to video background removal using browser-based AI.",
      slug: "how-to-remove-video-backgrounds-without-green-screen",
      date: "June 23, 2026",
      readTime: "5 min read",
      category: "Video Tools"
    },
    {
      title: "How to Compress Images Online Without Quality Loss",
      description: "Learn how to optimize and compress PNG, JPG, and WebP images online for free. Boost page speeds and decrease storage without losing image quality.",
      slug: "how-to-compress-images-online-without-quality-loss",
      date: "June 24, 2026",
      readTime: "4 min read",
      category: "Image Tools"
    },
    {
      title: "How to Separate Vocals from Music Online for Free",
      description: "Learn how to separate vocals from music online for free using AI. Step-by-step guide to extracting instrumental tracks, stems, and vocals from any song.",
      slug: "how-to-separate-vocals-from-music-online",
      date: "June 17, 2026",
      readTime: "5 min read",
      category: "Audio Tools"
    },
    {
      title: "How to Compress a PDF Without Losing Quality",
      description: "Learn how to reduce PDF file size without losing quality. Free online methods to compress PDFs for email, web, and storage — step-by-step guide.",
      slug: "how-to-compress-pdf-without-losing-quality",
      date: "June 16, 2026",
      readTime: "4 min read",
      category: "PDF Tools"
    },
    {
      title: "PDF vs Word Document: Which Format Should You Use?",
      description: "PDF vs Word: what's the difference and when to use each format? Complete comparison guide for documents, forms, contracts, and sharing files professionally.",
      slug: "pdf-vs-word-which-format-to-use",
      date: "June 15, 2026",
      readTime: "5 min read",
      category: "Document Guides"
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-black text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-black/80 backdrop-blur-md">
        <div className="container max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2 text-2xl font-black tracking-tight text-white">
              <img src="/icons/icon-192.png" alt="Editroy Logo" className="h-8 w-8 object-contain logo-img" style={{ filter: 'invert(1) grayscale(1) brightness(10)' }} />
              <span>EDIT<span className="text-indigo-500">ROY</span></span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button 
                variant="outline" 
                size="sm" 
                className="border-slate-800 hover:bg-slate-900 text-slate-200"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Home
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow py-12 px-4 sm:px-6">
        <div className="container max-w-5xl mx-auto space-y-12">
          
          {/* Page Title */}
          <div className="flex items-center gap-3 border-b border-slate-900 pb-6">
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
              <BookOpen className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Editroy Blog</h1>
              <p className="text-sm text-slate-500 mt-1">Free editing guides, tutorials, and document management tips.</p>
            </div>
          </div>

          {/* Articles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {articles.map((article, index) => (
              <Link 
                href={`/blog/${article.slug}`}
                key={index} 
                className="flex flex-col justify-between p-6 rounded-2xl border border-slate-900 bg-slate-950/40 hover:border-indigo-500/50 hover:bg-slate-950 transition-all duration-300 group cursor-pointer text-left"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 font-medium">
                      {article.category}
                    </span>
                    <div className="flex items-center gap-3 text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {article.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {article.readTime}
                      </span>
                    </div>
                  </div>

                  <h2 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-2">
                    {article.title}
                  </h2>
                  
                  <p className="text-slate-400 text-sm leading-relaxed line-clamp-3">
                    {article.description}
                  </p>
                </div>

                <div className="flex items-center text-indigo-400 text-sm font-semibold mt-6 group-hover:text-indigo-300 transition-colors">
                  Read Article <ArrowRight className="ml-2 h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
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
