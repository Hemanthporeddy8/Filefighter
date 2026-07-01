// src/app/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { 
  Sparkles, 
  Wand2, 
  ShieldCheck, 
  Zap, 
  ArrowRight, 
  FileText, 
  Music, 
  Video, 
  Share2, 
  Lock 
} from 'lucide-react';
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: 'Editroy — Free AI Video, Audio & Document Utilities Online',
  description: 'Browser-based creative tools. Run AI background removal, vocal separation, PDF editing, and secure P2P file transfers 100% on-device. Free, private, no signup.',
  alternates: {
    canonical: 'https://www.editroy.com',
  },
};

export default function HomePage() {
  const toolsShowcase = [
    {
      category: 'AI Media Tools',
      icon: <Sparkles className="h-6 w-6 text-indigo-400" />,
      items: [
        { name: 'Audio Separator (Vocal Remover)', desc: 'Extract high-quality vocals and isolate instrument backing tracks from any audio file 100% locally in your browser using state-of-the-art AI.', path: '/audio-separator' },
        { name: 'AI Image BG Remover', desc: 'Instantly remove backgrounds from images with professional edge-detection AI. Your photos remain fully secure and never leave your local device.', path: '/edit-image-online' },
        { name: 'Video BG Remover', desc: 'Automatically isolate subjects and cut out backgrounds from videos without green screen. Processed entirely client-side for maximum speed and privacy.', path: '/video-editor-online' },
        { name: 'PDF Text Editor', desc: 'Modify text, rearrange page layouts, and edit content in any PDF document. Your edits are processed locally in the browser with no server uploads.', path: '/pdf-text-editor' },
      ],
    },
    {
      category: 'PDF & Document Utilities',
      icon: <FileText className="h-6 w-6 text-indigo-400" />,
      items: [
        { name: 'Merge PDF', desc: 'Combine multiple PDF files into one clean, organized document instantly. Reorder files via drag-and-drop with absolute security and no file size limits.', path: '/document-utilities/merge-pdf-online' },
        { name: 'Compress PDF', desc: 'Reduce the file size of your PDF documents with optimized compression ratios, running entirely offline to ensure your private documents stay local.', path: '/document-utilities/compress-pdf-online' },
        { name: 'PDF to Word', desc: 'Convert PDF sheets to editable Microsoft Word DOCX files. All formatting is preserved, processed fully client-side without registration.', path: '/document-utilities/pdf-to-word-online' },
        { name: 'Sign PDF', desc: 'Draw or type digital signatures to sign PDF documents instantly. Secure local processing ensures your signature data is never stored on servers.', path: '/document-utilities/sign-pdf-online' },
        { name: 'Split PDF', desc: 'Extract specific pages, select page ranges, or split every single page of a PDF document into a separate file instantly and privately.', path: '/document-utilities/split-pdf-online' },
        { name: 'Protect PDF', desc: 'Encrypt your sensitive PDF files with strong passwords and access restrictions directly inside your browser for total local document security.', path: '/document-utilities/protect-pdf-online' },
      ],
    },
    {
      category: 'File Sharing Utilities',
      icon: <Share2 className="h-6 w-6 text-indigo-400" />,
      items: [
        { name: 'P2P FileShare', desc: 'Transfer large files of any size directly between devices. Uses secure peer-to-peer streaming, ensuring your files never pass through a cloud server.', path: '/dashboard' },
      ],
    },
  ];

  const homepageFaqs = [
    {
      q: 'How are Editroy tools free and private?',
      a: 'All our tools run entirely inside your browser using local technologies like WebAssembly, WebGL, and WebGPU. Since your files never leave your device and are never uploaded to any cloud server, we do not incur expensive backend processing fees. We pass these savings directly to you.',
    },
    {
      q: 'Do I need to sign up or create an account?',
      a: 'No. You can use all our tools (including background removal, vocal separation, PDF editing, and file sharing) instantly without giving an email or setting up an account.',
    },
    {
      q: 'Is there a file size limit for PDF compression or conversion?',
      a: 'Since processing is done on your local hardware inside the browser sandbox, there are no hard limits enforced by our servers. Very large files may depend on your device memory (RAM) capacity.',
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-black text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-black/80 backdrop-blur-md">
        <div className="container max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <img src="/icons/icon-192.png" alt="Editroy Logo" className="h-8 w-8 object-contain logo-img" style={{ filter: 'invert(1) grayscale(1) brightness(10)' }} />
            <span className="text-2xl font-black tracking-tight text-white">
              EDIT<span className="text-indigo-500">ROY</span>
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
            <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
            <Link href="/faq" className="hover:text-white transition-colors">FAQ</Link>
            <Link href="/about" className="hover:text-white transition-colors">About Us</Link>
            <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-5 text-xs font-semibold">
                Launch Editor
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 md:py-28 px-4 text-center bg-gradient-to-b from-indigo-950/20 via-black to-black border-b border-slate-900">
        <div className="container max-w-4xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-medium tracking-wide">
            <Sparkles className="h-3.5 w-3.5 animate-pulse" />
            <span>100% Browser-Based On-Device Processing</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-tight">
            The Ultimate Online <span className="text-indigo-500">Creative Utilities</span> Suite
          </h1>
          
          <p className="text-lg md:text-xl text-slate-400 font-light max-w-2xl mx-auto leading-relaxed">
            Run AI background removal, vocal separation, PDF editing, and secure P2P file transfers entirely in your browser. Free, private, and unlimited.
          </p>

          <div className="flex flex-wrap justify-center gap-4 pt-6">
            <Link href="/dashboard">
              <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-8 gap-2 font-semibold">
                Open Dashboard <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/blog">
              <Button size="lg" variant="outline" className="border-slate-800 hover:bg-slate-900 text-slate-200 rounded-full px-8">
                Read Blog Guides
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Privacy Section */}
      <section className="py-16 px-4 bg-slate-950/30 border-b border-slate-900">
        <div className="container max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex gap-4 items-start">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-2">Absolute Privacy</h3>
              <p className="text-sm text-slate-400 leading-relaxed">Files are processed in your browser memory and never uploaded to our servers. Your data stays 100% yours.</p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-2">Instant Speed</h3>
              <p className="text-sm text-slate-400 leading-relaxed">No backend processing delay. Tasks like PDF merging or image cutting complete instantly, powered by your local hardware.</p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-2">No Signup Required</h3>
              <p className="text-sm text-slate-400 leading-relaxed">Start converting and editing immediately. No accounts, no emails, no watermarks, and no usage quotas.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Tools Catalog */}
      <section className="py-20 px-4">
        <div className="container max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold text-white tracking-tight">Explore Our Web Applications</h2>
            <p className="text-slate-400 text-sm max-w-md mx-auto">Get started with our lightweight tools, optimized for privacy and speed.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {toolsShowcase.map((cat, i) => (
              <div key={i} className="p-6 rounded-2xl border border-slate-900 bg-slate-950/40 space-y-6">
                <div className="flex items-center gap-3">
                  {cat.icon}
                  <h3 className="text-xl font-bold text-white">{cat.category}</h3>
                </div>
                <div className="h-[1px] bg-slate-900" />
                <ul className="space-y-4">
                  {cat.items.map((item, idx) => (
                    <li key={idx} className="group">
                      <Link href={item.path} className="block space-y-1">
                        <h4 className="text-sm font-bold text-slate-200 group-hover:text-indigo-400 transition-colors flex items-center gap-1.5">
                          {item.name} <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-all -translate-x-1 group-hover:translate-x-0" />
                        </h4>
                        <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQs Section */}
      <section className="py-16 px-4 bg-slate-950/30 border-t border-b border-slate-900">
        <div className="container max-w-4xl mx-auto space-y-12">
          <h2 className="text-3xl font-bold text-white tracking-tight text-center">Frequently Asked Questions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {homepageFaqs.map((faq, i) => (
              <div key={i} className="space-y-2">
                <h3 className="text-base font-bold text-indigo-400">{faq.q}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-slate-900 text-slate-500 text-xs bg-black">
        <div className="container max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <p>&copy; {new Date().getFullYear()} Editroy. All rights reserved.</p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3">
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
