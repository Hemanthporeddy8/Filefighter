// src/app/privacy/page.tsx
"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, ArrowLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function PrivacyPage() {
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
              <Shield className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Privacy Policy</h1>
              <p className="text-sm text-slate-500 mt-1">Last Updated: June 16, 2026</p>
            </div>
          </div>

          <div className="space-y-6 text-slate-300 leading-relaxed text-sm">
            <p>
              At Editroy, accessible from <a href="https://www.editroy.com" className="text-indigo-400 hover:underline">https://www.editroy.com</a>, one of our main priorities is the privacy of our visitors. This Privacy Policy document contains types of information that is collected and recorded by Editroy and how we use it.
            </p>

            <h2 className="text-xl font-bold text-white mt-8 mb-2">1. Client-Side Data & Processing</h2>
            <p>
              Unlike traditional web tools, Editroy processes all user-uploaded files (including videos, images, and audio tracks) **locally in your browser** using WebAssembly (Wasm) and HTML5 WebCodecs. 
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-400 pl-4">
              <li>No media files are ever uploaded, sent, or saved to our servers.</li>
              <li>Your creative content never leaves your computer, phone, or tablet.</li>
              <li>All editing, AI background removal, and file exporting occurs offline in your browser's private memory sandbox.</li>
            </ul>

            <h2 className="text-xl font-bold text-white mt-8 mb-2">2. Log Files</h2>
            <p>
              Editroy follows a standard procedure of using log files. These files log visitors when they visit websites. All hosting companies do this as part of hosting services' analytics. The information collected by log files includes internet protocol (IP) addresses, browser type, Internet Service Provider (ISP), date and time stamp, referring/exit pages, and possibly the number of clicks. These are not linked to any information that is personally identifiable. The purpose of the information is for analyzing trends, administering the site, tracking users' movement on the website, and gathering demographic information.
            </p>

            <h2 className="text-xl font-bold text-white mt-8 mb-2">3. Google DoubleClick DART Cookie</h2>
            <p>
              Google is one of the third-party vendors on our site. It also uses cookies, known as DART cookies, to serve ads to our site visitors based upon their visit to www.editroy.com and other sites on the internet. However, visitors may choose to decline the use of DART cookies by visiting the Google ad and content network Privacy Policy at the following URL: <a href="https://policies.google.com/technologies/ads" className="text-indigo-400 hover:underline" target="_blank" rel="noopener noreferrer">https://policies.google.com/technologies/ads</a>.
            </p>

            <h2 className="text-xl font-bold text-white mt-8 mb-2">4. Our Advertising Partners</h2>
            <p>
              Some of the advertisers on our site may use cookies and web beacons. Our advertising partners include:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-400 pl-4">
              <li><strong>Google AdSense:</strong> Each of our advertising partners has their own Privacy Policy for their policies on user data. For easy access, we hyperlinked to their Privacy Policies above.</li>
            </ul>

            <h2 className="text-xl font-bold text-white mt-8 mb-2">5. Third-Party Privacy Policies</h2>
            <p>
              Editroy's Privacy Policy does not apply to other advertisers or websites. Thus, we are advising you to consult the respective Privacy Policies of these third-party ad servers for more detailed information. It may include their practices and instructions about how to opt-out of certain options.
            </p>
            <p>
              You can choose to disable cookies through your individual browser options. To know more detailed information about cookie management with specific web browsers, it can be found at the browsers' respective websites.
            </p>

            <h2 className="text-xl font-bold text-white mt-8 mb-2">6. GDPR Data Protection Rights</h2>
            <p>
              We would like to make sure you are fully aware of all of your data protection rights. Every user is entitled to the following:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-400 pl-4">
              <li><strong>The right to access:</strong> You have the right to request copies of your personal data.</li>
              <li><strong>The right to rectification:</strong> You have the right to request that we correct any information you believe is inaccurate.</li>
              <li><strong>The right to erasure:</strong> You have the right to request that we erase your personal data, under certain conditions.</li>
              <li><strong>The right to restrict processing:</strong> You have the right to request that we restrict the processing of your personal data, under certain conditions.</li>
            </ul>

            <h2 className="text-xl font-bold text-white mt-8 mb-2">7. Children's Information</h2>
            <p>
              Another part of our priority is adding protection for children while using the internet. We encourage parents and guardians to observe, participate in, and/or monitor and guide their online activity.
            </p>
            <p>
              Editroy does not knowingly collect any Personal Identifiable Information from children under the age of 13. If you think that your child provided this kind of information on our website, we strongly encourage you to contact us immediately and we will do our best efforts to promptly remove such information from our records.
            </p>

            <h2 className="text-xl font-bold text-white mt-8 mb-2">8. Contact Us</h2>
            <p>
              If you have additional questions or require more information about our Privacy Policy, do not hesitate to contact us at <span className="text-indigo-400">support@editroy.com</span>.
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
