// src/app/contact/page.tsx
"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, MessageSquare, ArrowLeft, Send, CheckCircle2 } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function ContactPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'General Inquiry',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real application, you would submit to an API endpoint.
    // For this privacy-focused client-side app, we mock success state.
    console.log("Contact form submitted:", formData);
    setSubmitted(true);
  };

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
        <div className="container max-w-3xl mx-auto space-y-8">
          
          {/* Page Title */}
          <div className="flex items-center gap-3 border-b border-slate-900 pb-6">
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Mail className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Contact Us</h1>
              <p className="text-sm text-slate-500 mt-1">Get in touch with the Editroy support team.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Info Panel */}
            <div className="md:col-span-1 space-y-6">
              <div className="space-y-2">
                <h3 className="font-bold text-white text-base">Support & Contact</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Have questions about file safety, WebAssembly models, or audio separator pipelines? Reach out directly.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-500/5 text-indigo-400 border border-slate-900">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Support Email</p>
                    <p className="text-xs font-semibold text-slate-200">support@editroy.com</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-500/5 text-indigo-400 border border-slate-900">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Response Time</p>
                    <p className="text-xs font-semibold text-slate-200">Within 24-48 Hours</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Form Panel */}
            <div className="md:col-span-2">
              {submitted ? (
                <div className="p-8 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 text-center space-y-4">
                  <div className="inline-flex p-3 rounded-full bg-indigo-500/10 text-indigo-400 mx-auto">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h3 className="font-bold text-white text-lg">Message Sent Successfully!</h3>
                  <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
                    Thank you for reaching out to Editroy. Our support team will review your message and get back to you shortly.
                  </p>
                  <Button 
                    variant="outline"
                    className="border-slate-800 hover:bg-slate-900 text-slate-300"
                    onClick={() => {
                      setSubmitted(false);
                      setFormData({ name: '', email: '', subject: 'General Inquiry', message: '' });
                    }}
                  >
                    Send Another Message
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="p-6 rounded-2xl border border-slate-900 bg-slate-950/20 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="name" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Your Name</label>
                      <input 
                        type="text" 
                        id="name"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-black border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                        placeholder="John Doe"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="email" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email Address</label>
                      <input 
                        type="email" 
                        id="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full bg-black border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="subject" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Subject</label>
                    <select 
                      id="subject"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full bg-black border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                    >
                      <option value="General Inquiry">General Inquiry</option>
                      <option value="Feature Request">Feature Request</option>
                      <option value="Bug Report">Bug Report</option>
                      <option value="Business Cooperation">Business Cooperation</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="message" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Your Message</label>
                    <textarea 
                      id="message"
                      required
                      rows={5}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full bg-black border border-slate-850 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                      placeholder="Write your feedback or questions here..."
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center justify-center gap-2"
                  >
                    Send Message <Send className="h-4 w-4" />
                  </Button>
                </form>
              )}
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
