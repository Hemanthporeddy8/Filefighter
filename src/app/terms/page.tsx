// src/app/terms/page.tsx
"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, ArrowLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function TermsPage() {
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
        <div className="container max-w-3xl mx-auto space-y-8">
          <div className="flex items-center gap-3 border-b border-slate-900 pb-6">
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
              <FileText className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Terms of Service</h1>
              <p className="text-sm text-slate-500 mt-1">Last Updated: June 16, 2026</p>
            </div>
          </div>

          <div className="space-y-6 text-slate-300 leading-relaxed text-sm">
            <p>
              Welcome to Editroy! These Terms of Service outline the rules and regulations for the use of Editroy's Website, located at <a href="https://www.editroy.com" className="text-indigo-400 hover:underline">https://www.editroy.com</a>.
            </p>
            <p>
              By accessing this website, we assume you accept these terms and conditions. Do not continue to use Editroy if you do not agree to take all of the terms and conditions stated on this page.
            </p>

            <h2 className="text-xl font-bold text-white mt-8 mb-2">1. Cookies</h2>
            <p>
              We employ the use of cookies. By accessing Editroy, you agreed to use cookies in agreement with Editroy's Privacy Policy. 
            </p>
            <p>
              Most interactive websites use cookies to let us retrieve the user's details for each visit. Cookies are used by our website to enable the functionality of certain areas to make it easier for people visiting our website. Some of our affiliate/advertising partners may also use cookies.
            </p>

            <h2 className="text-xl font-bold text-white mt-8 mb-2">2. License & Intellectual Property</h2>
            <p>
              Unless otherwise stated, Editroy and/or its licensors own the intellectual property rights for all material on Editroy. All intellectual property rights are reserved. You may access this from Editroy for your own personal use subjected to restrictions set in these terms and conditions.
            </p>
            <p>
              You must not:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-400 pl-4">
              <li>Republish material from Editroy.</li>
              <li>Sell, rent or sub-license material from Editroy.</li>
              <li>Reproduce, duplicate or copy material from Editroy.</li>
              <li>Redistribute content from Editroy.</li>
            </ul>

            <h2 className="text-xl font-bold text-white mt-8 mb-2">3. User Responsibility & File Security</h2>
            <p>
              All video clips, images, and audio tracks you upload to Editroy remain your sole intellectual property. Because Editroy does not copy, save, or upload your files to our servers, you are completely responsible for the custody, licensing, and contents of the files you choose to import. Editroy has no control over and assumes no liability for the content processed by the user locally.
            </p>

            <h2 className="text-xl font-bold text-white mt-8 mb-2">4. Hyperlinking to our Content</h2>
            <p>
              The following organizations may link to our Website without prior written approval:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-400 pl-4">
              <li>Government agencies.</li>
              <li>Search engines.</li>
              <li>News organizations.</li>
              <li>Online directory distributors may link to our Website in the same manner as they hyperlink to the Websites of other listed businesses.</li>
            </ul>

            <h2 className="text-xl font-bold text-white mt-8 mb-2">5. Disclaimer & Limit of Liability</h2>
            <p>
              This website and its browser-based tools are provided "as is", with all faults, and Editroy makes no express or implied representations or warranties of any kind related to this website or the materials contained on this website.
            </p>
            <p>
              In no event shall Editroy, nor any of its officers, directors, and employees, be liable to you for anything arising out of or in any way connected with your use of this website, whether such liability is under contract, tort, or otherwise, and Editroy, including its officers, directors, and employees, shall not be liable for any indirect, consequential, or special liability arising out of or in any way related to your use of this website.
            </p>

            <h2 className="text-xl font-bold text-white mt-8 mb-2">6. Governing Law</h2>
            <p>
              These Terms will be governed by and construed in accordance with the laws of our operating jurisdiction, and you submit to the non-exclusive jurisdiction of the state and federal courts located in our country for the resolution of any disputes.
            </p>

            <h2 className="text-xl font-bold text-white mt-8 mb-2">7. Contact Information</h2>
            <p>
              If you have any questions about these Terms, please contact us at <span className="text-indigo-400">support@editroy.com</span>.
            </p>
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
