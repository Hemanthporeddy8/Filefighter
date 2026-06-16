// src/app/page.tsx
"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Video, Image as ImageIcon, Music, FileText, Layers, Lock, Shield, Zap, ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const router = useRouter();

  const tools = [
    {
      title: "Video Editor",
      desc: "Trim, crop, merge videos, add music & overlays. Fully browser-based HD exports with no watermark.",
      icon: <Video className="h-6 w-6 text-indigo-500" />,
      link: "/video-editor-online"
    },
    {
      title: "AI Background Remover",
      desc: "Instantly erase image backgrounds locally in your browser. Fast, precise, and 100% private.",
      icon: <ImageIcon className="h-6 w-6 text-emerald-500" />,
      link: "/bg-remover-online"
    },
    {
      title: "Vocal Separator & Vocal Remover",
      desc: "Split audio files into vocals, drums, bass, and melody stems offline using state-of-the-art AI.",
      icon: <Music className="h-6 w-6 text-rose-500" />,
      link: "/audio-separator"
    },
    {
      title: "PDF Text Editor",
      desc: "Edit PDF content, edit text, adjust fonts, and change colors directly in your browser without converting.",
      icon: <FileText className="h-6 w-6 text-amber-500" />,
      link: "/pdf-text-editor"
    },
    {
      title: "Same Edit (Batch Editor)",
      desc: "Configure editing rules once and apply them to hundreds of images in bulk in one click.",
      icon: <Zap className="h-6 w-6 text-purple-500" />,
      link: "/same-edit"
    },
    {
      title: "Document & PDF Utilities",
      desc: "Merge, split, convert, compress, sign, and password-protect PDF files instantly.",
      icon: <Layers className="h-6 w-6 text-blue-500" />,
      link: "/document-utilities"
    }
  ];

  const faqs = [
    {
      q: "Are the tools on Editroy really free?",
      a: "Yes. All Editroy tools are completely free to use. There are no credit systems, no hidden watermarks, and no signups required to start editing."
    },
    {
      q: "Where are my uploaded files stored?",
      a: "Nowhere. Editroy uses cutting-edge browser technologies like WebAssembly and WebCodecs to process all videos, images, and audio files directly on your own device. Your files are never uploaded to any server, ensuring total privacy."
    },
    {
      q: "Can I use Editroy offline?",
      a: "Yes. Editroy is built as a Progressive Web App (PWA). Once loaded, the models and components are cached, allowing you to use background removal, video editing, and PDF manipulation completely offline without an internet connection."
    },
    {
      q: "Is there a file size limit?",
      a: "Because all processing happens locally on your computer or phone, the limit depends on your device's memory. We recommend video clips under 200MB and images under 15MB for optimal performance."
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-black text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-black/80 backdrop-blur-md">
        <div className="container max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-tight text-white">
              EDIT<span className="text-indigo-500">ROY</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/about" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
              About
            </Link>
            <Link href="/contact" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
              Contact
            </Link>
            <Button 
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg transition-all"
              onClick={() => router.push('/dashboard')}
            >
              Launch Dashboard
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 sm:py-32 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/20 via-black to-black">
        <div className="container max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/20 bg-indigo-500/5 text-indigo-400 text-xs font-semibold tracking-wider uppercase">
            <Shield className="h-3.5 w-3.5" /> 100% Private Client-Side AI Suite
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Free Browser-Based <span className="bg-gradient-to-r from-indigo-400 to-indigo-200 bg-clip-text text-transparent">Creator Tools</span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
            Privacy-first offline editing suite. Edit videos, remove backgrounds, isolate audio tracks, and manage documents — 100% free with no signups or watermarks.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button 
              size="lg" 
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-3 rounded-lg shadow-lg shadow-indigo-600/20 flex items-center gap-2 group transition-all"
              onClick={() => router.push('/dashboard')}
            >
              Get Started <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
            <a href="#tools">
              <Button size="lg" variant="outline" className="border-slate-800 hover:bg-slate-900 text-slate-200 font-semibold px-8 py-3 rounded-lg transition-all">
                Browse Tools
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Core Benefits */}
      <section className="py-16 border-y border-slate-900 bg-slate-950/20">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex gap-4 p-6 rounded-2xl border border-slate-900 bg-black/40">
              <div className="p-3 h-fit rounded-xl bg-indigo-500/10 text-indigo-400">
                <Lock className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-white text-lg">Zero Server Uploads</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Your files never leave your device. All calculations occur inside your browser using WebAssembly.
                </p>
              </div>
            </div>
            <div className="flex gap-4 p-6 rounded-2xl border border-slate-900 bg-black/40">
              <div className="p-3 h-fit rounded-xl bg-emerald-500/10 text-emerald-400">
                <Shield className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-white text-lg">No Account Needed</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Start editing immediately. No email verification, no credit card, and absolutely no limits.
                </p>
              </div>
            </div>
            <div className="flex gap-4 p-6 rounded-2xl border border-slate-900 bg-black/40">
              <div className="p-3 h-fit rounded-xl bg-rose-500/10 text-rose-400">
                <Zap className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-white text-lg">Offline Processing</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Fully operational even when you are disconnected. Caches directly into your browser memory.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tools Section */}
      <section id="tools" className="py-20 sm:py-28">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Our Free Creator Suite</h2>
            <p className="text-slate-400">High-performance tools running fully on-device. Choose a tool to get started.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tools.map((tool, index) => (
              <Link key={index} href={tool.link} className="block group">
                <div className="h-full p-8 rounded-2xl border border-slate-800 bg-slate-950/10 hover:bg-slate-950/40 hover:border-indigo-500/30 transition-all duration-300 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="p-3 h-fit w-fit rounded-xl bg-slate-900 border border-slate-800 group-hover:border-indigo-500/20 group-hover:bg-indigo-500/5 transition-all">
                      {tool.icon}
                    </div>
                    <h3 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors">{tool.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{tool.desc}</p>
                  </div>
                  <div className="mt-6 flex items-center text-xs font-semibold text-indigo-400 group-hover:text-indigo-300 gap-1.5">
                    Launch Tool <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 sm:py-28 border-t border-slate-900 bg-slate-950/10">
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 space-y-12">
          <h2 className="text-3xl font-extrabold text-center text-white tracking-tight">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <div key={index} className="p-6 rounded-xl border border-slate-900 bg-black/40 space-y-2">
                <h3 className="font-bold text-white text-lg flex gap-2"><CheckCircle className="h-5.5 w-5.5 text-indigo-500 flex-shrink-0 mt-0.5" /> {faq.q}</h3>
                <p className="text-slate-400 text-sm leading-relaxed pl-7">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-900 bg-black py-12">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start gap-2">
            <span className="text-xl font-black tracking-tight text-white">
              EDIT<span className="text-indigo-500">ROY</span>
            </span>
            <p className="text-xs text-slate-500">© {new Date().getFullYear()} Editroy. Free offline creator tools.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-xs font-medium text-slate-500">
            <Link href="/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
            <Link href="/about" className="hover:text-slate-300 transition-colors">About Us</Link>
            <Link href="/contact" className="hover:text-slate-300 transition-colors">Contact Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
