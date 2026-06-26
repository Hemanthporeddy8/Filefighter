// src/app/blog/how-to-send-large-files-online-free/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Calendar, Clock, Share2, Shield, Zap, HelpCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: 'How to Send Large Files Online Free (No Limits 2026) | Editroy',
  description: 'Discover how to transfer large files online for free without size limits. Learn about WebRTC P2P direct transfer, browser-to-browser sharing, and privacy.',
  alternates: {
    canonical: 'https://www.editroy.com/blog/how-to-send-large-files-online-free',
  },
};

export default function SendLargeFilesPost() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Is there a file size limit for P2P sharing?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No. Because files are streamed directly from your device to the receiver without being uploaded to intermediate servers, there are no file size limits. You can transfer 10 GB, 50 GB, or larger files as long as both browser tabs remain open.',
        },
      },
      {
        '@type': 'Question',
        name: 'Are my files stored on the server?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No. Files travel in real time over an encrypted peer-to-peer connection directly between browsers. They are never stored on any cloud database or server, ensuring absolute privacy.',
        },
      },
    ],
  };

  return (
    <div className="flex flex-col min-h-screen bg-black text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

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
            <Link href="/blog">
              <Button 
                variant="outline" 
                size="sm" 
                className="border-slate-800 hover:bg-slate-900 text-slate-200"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Blog
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow py-12 px-4 sm:px-6">
        <article className="container max-w-3xl mx-auto space-y-8">
          
          {/* Post Header */}
          <div className="space-y-4 border-b border-slate-900 pb-8">
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 font-medium">
                File Sharing
              </span>
              <span className="text-slate-500">•</span>
              <span className="flex items-center gap-1 text-slate-500">
                <Calendar className="h-3.5 w-3.5" /> June 22, 2026
              </span>
              <span className="text-slate-500">•</span>
              <span className="flex items-center gap-1 text-slate-500">
                <Clock className="h-3.5 w-3.5" /> 5 min read
              </span>
            </div>
            
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              How to Send Large Files Online for Free (No Size Limits)
            </h1>
            
            <p className="text-lg text-slate-400 font-light leading-relaxed">
              Tired of 25MB email limits and slow cloud storage uploads? Here is how to share files of any size directly between browsers with complete privacy.
            </p>
          </div>

          {/* Post Body */}
          <div className="text-slate-300 space-y-6 leading-relaxed text-base">
            <p>
              Sharing large files online is a persistent headache. Email clients restrict attachments to 25MB, while popular cloud storage services like Google Drive, Dropbox, and WeTransfer require you to upload the file to their servers first, capped by storage limits unless you pay for a premium subscription.
            </p>
            <p>
              But what if you could transfer files directly from your device to your recipient's device, without size limits, without registration, and without uploading your private data to a third-party server? This is where <strong>WebRTC Peer-to-Peer (P2P) file sharing</strong> comes in.
            </p>

            <h2 className="text-2xl font-bold text-white pt-4">The Solution: WebRTC Peer-to-Peer (P2P)</h2>
            <p>
              WebRTC (Web Real-Time Communication) is an open-source technology that enables web browsers to establish direct connections with each other. By using WebRTC, files can stream frame-by-frame directly between the sender and receiver's browsers.
            </p>
            <p>
              This direct transfer mechanism has several key advantages:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-350">
              <li><strong>Zero Size Limits:</strong> Since the file is never saved on a server, there is no storage limit. You can send files of 10GB, 50GB, or even larger.</li>
              <li><strong>Maximum Speed:</strong> The transfer speed is only limited by your internet connection upload speed and the recipient's download speed, bypassing server bottlenecks.</li>
              <li><strong>Total Privacy:</strong> Files are encrypted end-to-end and travel directly between devices. Nobody else, including the website hosting the tool, can access your files.</li>
            </ul>

            <h2 className="text-2xl font-bold text-white pt-4">How to Share Files Step-by-Step Using Editroy</h2>
            <p>
              Our P2P FileShare tool simplifies direct transfers. Here is how to send files of any size in under a minute:
            </p>
            
            <div className="bg-slate-950 border border-slate-900 rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-bold text-indigo-400 flex items-center gap-2">
                <Zap className="h-5 w-5" /> Direct Room Transfer
              </h3>
              <ol className="list-decimal pl-5 space-y-2 text-slate-350 text-sm">
                <li>Go to the <strong>Editroy Dashboard</strong> and select <strong>Send File</strong>.</li>
                <li>Drag and drop your files into the transfer zone. The system will generate a temporary 6-digit <strong>Room Code</strong>.</li>
                <li>Share this code or the connection link with your recipient.</li>
                <li>The recipient enters the code under <strong>Receive File</strong>, and the file streams directly to their downloads folder. Keep both tabs open until the transfer is finished!</li>
              </ol>
            </div>

            <h2 className="text-2xl font-bold text-white pt-4">Frequently Asked Questions</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-indigo-400 flex-shrink-0" /> Can I close my browser tab during transfer?
                </h4>
                <p className="text-slate-350 text-sm">
                  No. Because it is a direct peer-to-peer stream, closing the tab terminates the connection. Both the sender and receiver must keep their browser tabs open until the transfer reaches 100%.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-indigo-400 flex-shrink-0" /> Is P2P file sharing safe?
                </h4>
                <p className="text-slate-350 text-sm">
                  Yes, it is the safest file-sharing protocol available. All connections are secured with WebRTC DTLS/SRTP encryption, ensuring that files cannot be intercepted on their path.
                </p>
              </div>
            </div>

            <p className="pt-6">
              Next time you need to share a massive video, document database, or folder structure, skip the cloud upload. Launch the Editroy FileShare utility and stream it directly.
            </p>
          </div>
        </article>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/20 py-8 text-center text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} Editroy. All rights reserved.</p>
      </footer>
    </div>
  );
}
