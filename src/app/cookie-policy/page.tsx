// src/app/cookie-policy/page.tsx
"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function CookiePolicyPage() {
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
              <ShieldAlert className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Cookie Policy</h1>
              <p className="text-sm text-slate-500 mt-1">Last Updated: June 17, 2026</p>
            </div>
          </div>

          <div className="space-y-6 text-slate-300 leading-relaxed text-sm">
            <p>
              This Cookie Policy explains how Editroy ("we", "us", "our") uses cookies and similar tracking technologies when you visit <a href="https://www.editroy.com" className="text-indigo-400 hover:underline">https://www.editroy.com</a>.
            </p>

            <h2 className="text-xl font-bold text-white mt-8 mb-2">1. What Are Cookies?</h2>
            <p>
              Cookies are small text files placed on your device by websites you visit. They are widely used to make websites work more efficiently, store user preferences, and provide analytical information to website owners. Cookies may be "session cookies" (deleted automatically when you close your browser) or "persistent cookies" (remaining on your device for a set period).
            </p>

            <h2 className="text-xl font-bold text-white mt-8 mb-2">2. How We Use Cookies</h2>
            
            <h3 className="text-lg font-bold text-white mt-4 mb-1">Essential Cookies</h3>
            <p>
              These are absolutely necessary for the website to function properly and cannot be disabled in our systems. They are typically set in response to actions made by you, such as setting your privacy preferences, logging in, or uploading files. You can set your browser to block these cookies, but some parts of our site may not function as a result.
            </p>

            <h3 className="text-lg font-bold text-white mt-4 mb-1">Analytics Cookies</h3>
            <p>
              We use Google Analytics to understand how visitors interact with our website. These cookies collect aggregated, anonymized information about page views, session duration, and traffic sources. No personally identifiable information is collected or stored.
            </p>

            <h3 className="text-lg font-bold text-white mt-4 mb-1">Advertising Cookies (Google AdSense)</h3>
            <p>
              We display advertisements served by Google AdSense on our platform. Google uses cookies to serve ads based on your previous visits to our site or other websites. Google's use of advertising cookies enables it and its partners to serve ads to users based on their visit to our site and/or other sites on the Internet.
            </p>
            <p>
              You can choose to opt out of personalized advertising by visiting the Google Ad Settings page at <a href="https://adssettings.google.com" className="text-indigo-400 hover:underline" target="_blank" rel="noopener noreferrer">https://adssettings.google.com</a>.
            </p>

            <h2 className="text-xl font-bold text-white mt-8 mb-2">3. Managing Cookies</h2>
            <p>
              Most web browsers allow you to control cookies through their settings preferences. To learn how to manage cookies on popular browsers, use the links below:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-400 pl-4">
              <li><a href="https://support.google.com/chrome/answer/95647" className="text-indigo-400 hover:underline" target="_blank" rel="noopener noreferrer">Google Chrome</a></li>
              <li><a href="https://support.mozilla.org/en-US/kb/enable-and-disable-cookies-website-preferences" className="text-indigo-400 hover:underline" target="_blank" rel="noopener noreferrer">Mozilla Firefox</a></li>
              <li><a href="https://support.apple.com/en-gb/guide/safari/sfri11471/mac" className="text-indigo-400 hover:underline" target="_blank" rel="noopener noreferrer">Apple Safari</a></li>
              <li><a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge" className="text-indigo-400 hover:underline" target="_blank" rel="noopener noreferrer">Microsoft Edge</a></li>
            </ul>
            <p>
              Please note that disabling cookies may affect the performance and features of some of our browser-based editing tools.
            </p>

            <h2 className="text-xl font-bold text-white mt-8 mb-2">4. Contact Us</h2>
            <p>
              If you have any questions about our use of cookies or this Cookie Policy, please contact us at <span className="text-indigo-400">support@editroy.com</span>.
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
