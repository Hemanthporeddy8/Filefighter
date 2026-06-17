// src/app/faq/page.tsx
"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HelpCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function FAQPage() {
  const router = useRouter();

  const faqs = [
    {
      q: "Is Editroy completely free to use?",
      a: "Yes. All tools on Editroy are free to use with no account, subscription, or credit card required. We are supported by advertising."
    },
    {
      q: "Do I need to create an account?",
      a: "No account is required to use any Editroy tool. Open a tool, upload your file, and download your result — no signup at any step."
    },
    {
      q: "What devices and browsers are supported?",
      a: "Editroy works on any modern browser — Chrome, Firefox, Safari, and Edge — on Windows, Mac, Linux, iOS, and Android. No software installation needed."
    },
    {
      q: "Are my uploaded files safe and private?",
      a: "Yes. Files are transferred over HTTPS encryption. Server-processed files are automatically deleted after your session ends (typically within 1 hour). We never read, sell, or share your files with third parties. For local browser-based tools, files are processed purely in client memory and never touch our servers."
    },
    {
      q: "Does Editroy process files locally or on servers?",
      a: "It depends on the tool. Simple text tools and some image tools process files entirely in your browser using WebAssembly — data never leaves your device. More complex tools (PDF processing, audio separation, video editing) require server processing for performance. In all cases, files are deleted after your session."
    },
    {
      q: "What file formats does Editroy support?",
      a: "Supported formats vary by tool. PDF tools support .pdf files. Image tools support JPG, PNG, WebP, GIF, BMP. Audio tools support MP3, WAV, FLAC, AAC, OGG. Video tools support MP4, MKV, AVI, MOV. Document tools support .docx, .xlsx, .pptx."
    },
    {
      q: "Is there a file size limit?",
      a: "Each tool has its own file size limit listed on its page. For most tools, files up to 200MB are supported. Audio and video files may have higher limits due to their nature."
    },
    {
      q: "Can I edit a scanned PDF?",
      a: "Scanned PDFs contain images of text. First use the OCR PDF tool to convert it to searchable text, then use the PDF Text Editor."
    },
    {
      q: "Will merged or converted PDFs have watermarks?",
      a: "No. Editroy never adds watermarks to your output files. What you upload comes back clean, with no Editroy branding added."
    },
    {
      q: "How long does audio separation take?",
      a: "Processing time depends on file length and server load. A 3-minute song typically takes 30-90 seconds. Longer files or busy periods may take 2-5 minutes."
    }
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
        <div className="container max-w-3xl mx-auto space-y-8">
          <div className="flex items-center gap-3 border-b border-slate-900 pb-6">
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
              <HelpCircle className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Frequently Asked Questions</h1>
              <p className="text-sm text-slate-500 mt-1">Answers to common questions about Editroy's free online tools.</p>
            </div>
          </div>

          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <div 
                key={index} 
                className="p-6 rounded-2xl border border-slate-900 bg-slate-950/20 space-y-3"
              >
                <h3 className="font-bold text-white text-base flex gap-2">
                  <CheckCircle2 className="h-5.5 w-5.5 text-indigo-500 flex-shrink-0 mt-0.5" />
                  {faq.q}
                </h3>
                <p className="text-slate-450 text-sm leading-relaxed pl-7">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-900 pt-8 text-center space-y-4">
            <p className="text-sm text-slate-500">
              Still have questions? Our support team is here to help.
            </p>
            <Button 
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
              onClick={() => router.push('/contact')}
            >
              Contact Support
            </Button>
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
