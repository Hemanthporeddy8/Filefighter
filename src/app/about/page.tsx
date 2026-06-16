// src/app/about/page.tsx
"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Info, ArrowLeft, Cpu, Shield, Zap, Lock } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function AboutPage() {
  const router = useRouter();

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
        <div className="container max-w-3xl mx-auto space-y-12">
          
          {/* Page Title */}
          <div className="flex items-center gap-3 border-b border-slate-900 pb-6">
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Info className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">About Editroy</h1>
              <p className="text-sm text-slate-500 mt-1">High-performance, privacy-first offline web tools.</p>
            </div>
          </div>

          {/* Intro Story */}
          <div className="space-y-6 text-slate-300 leading-relaxed">
            <p className="text-lg text-slate-200">
              Editroy was founded with a simple but powerful idea: **you shouldn't have to upload your private files to remote servers just to perform basic media editing and conversion tasks.**
            </p>
            <p>
              Traditional online video editors, voice removers, and PDF tools require you to transfer gigabytes of your data to the cloud. This poses major security risks, wastes internet bandwidth, and subjects your workflow to subscription walls, processing queues, and forced watermarks.
            </p>
            <p>
              We decided to do things differently. Editroy leverages the latest advances in browser-side execution to bring professional-grade desktop processing capabilities directly into your web browser.
            </p>
          </div>

          {/* Pillars Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
            <div className="p-6 rounded-2xl border border-slate-900 bg-slate-950/40 space-y-3">
              <div className="p-2.5 h-fit w-fit rounded-lg bg-indigo-500/10 text-indigo-400">
                <Cpu className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-white text-base">WebAssembly & WebCodecs</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                By running compiled C++ and Rust code inside the browser sandbox, we achieve near-native execution speed for audio, video, and PDF processing without remote server dependency.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-900 bg-slate-950/40 space-y-3">
              <div className="p-2.5 h-fit w-fit rounded-lg bg-emerald-500/10 text-emerald-400">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-white text-base">Guaranteed File Privacy</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Your creative projects, PDFs, and audios are processed purely in client-side RAM. They are never uploaded or analyzed. Your secrets remain entirely yours.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-900 bg-slate-950/40 space-y-3">
              <div className="p-2.5 h-fit w-fit rounded-lg bg-rose-500/10 text-rose-400">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-white text-base">Progressive Web App (PWA)</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Once cache files are loaded, Editroy functions perfectly offline. Edit, split vocal tracks, and crop videos during flights or areas with poor internet connection.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-900 bg-slate-950/40 space-y-3">
              <div className="p-2.5 h-fit w-fit rounded-lg bg-amber-500/10 text-amber-400">
                <Shield className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-white text-base">Zero Paywalls or Limits</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                No credit card, no registration, and no artificial watermarks. Editroy is committed to remaining completely free and open for creators worldwide.
              </p>
            </div>
          </div>

          {/* Contact CTA */}
          <div className="border-t border-slate-900 pt-8 space-y-4">
            <h2 className="text-xl font-bold text-white">Have feedback or suggestions?</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              We are constantly refining our local AI models and editing workflows. If you encounter bugs, have feature requests, or want to collaborate, please visit our <Link href="/contact" className="text-indigo-400 hover:underline">Contact Page</Link> or send us an email.
            </p>
            <div className="flex gap-4">
              <Button 
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                onClick={() => router.push('/contact')}
              >
                Get in Touch
              </Button>
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
          </div>
        </div>
      </footer>
    </div>
  );
}
