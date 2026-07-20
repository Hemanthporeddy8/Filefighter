// src/app/(main)/video-editor/page.tsx
import Link from 'next/link';
import { ArrowRight, Video, Sparkles, Scissors, Layers, Music, Shield, Zap, Star, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Free Online Video Editor — No Watermark, No Signup | Editroy',
  description: 'Edit videos online for free. Trim, merge, add text and music, apply transitions and effects. No watermark, no signup required. Export HD video directly from your browser.',
  alternates: {
    canonical: 'https://www.editroy.com/video-editor',
  },
};

export default function VideoEditorLanding() {
  const faqs = [
    {
      q: 'Does the exported video have a watermark?',
      a: 'No. Editroy is completely free and never adds watermarks, stamps, branding text, or logos to your exported video files. You get a clean, professional output every single time.',
    },
    {
      q: 'What video formats can I import into the editor?',
      a: 'You can import video clips in standard formats including MP4 (H.264/H.265), MOV (QuickTime), and WebM (VP8/VP9). The editor automatically handles format detection and decodes your clips on import.',
    },
    {
      q: 'Does the video editor upload my files to a server?',
      a: 'No. All video decoding, trimming, merging, and encoding are processed entirely inside your browser using your device\'s local hardware. Your video files never leave your computer or phone — they are never transmitted to any server.',
    },
    {
      q: 'Is there a video duration or file size limit?',
      a: 'There are no artificial limits imposed by our servers. However, very long videos (over 15-20 minutes) or high-resolution 4K clips will require more system RAM and processing time. We recommend keeping clips under 10 minutes for the fastest export experience.',
    },
    {
      q: 'Which browsers work best for video editing?',
      a: 'For best performance and rendering speed, we recommend Google Chrome (v100+), Microsoft Edge (v100+), or Opera. These Chromium-based browsers have the best support for WebCodecs, WebAssembly SIMD, and hardware acceleration needed for smooth video editing.',
    },
    {
      q: 'Can I add background music to my video?',
      a: 'Yes. You can import audio files (MP3, WAV, AAC, OGG) as separate audio tracks in the timeline. Adjust the volume of each audio track independently, trim music to specific durations, and layer multiple audio elements below your video tracks.',
    },
    {
      q: 'Can I remove the background from a video?',
      a: 'Yes. Editroy includes an AI-powered video background removal tool that uses on-device machine learning to separate the foreground subject from the background, frame by frame. It works without a green screen and is fully private since all processing runs locally in your browser.',
    },
    {
      q: 'What resolution is the exported video?',
      a: 'The editor exports video at up to 1080p Full HD resolution by default. The output quality depends on the resolution of your original source video clips. The export format is WebM (VP9) for maximum compatibility with modern browsers and platforms.',
    },
    {
      q: 'How do I add subtitles or captions to my video?',
      a: 'Use the "Text" layer tool to add text tracks to your video timeline. Position the text layer at specific timestamps, choose from multiple fonts and sizes, and style it with colors and backgrounds. Each text clip is synced to the timeline so it appears and disappears at the exact right moment.',
    },
    {
      q: 'Is Editroy video editor suitable for beginners?',
      a: 'Absolutely. The interface is designed to be intuitive and beginner-friendly. The drag-and-drop timeline, simple clip trimming handles, and one-click export make it easy for anyone to create polished videos without prior video editing experience.',
    },
  ];

  const features = [
    { icon: Scissors, title: 'Timeline Trimming & Splitting', desc: 'Cut, slice, and rearrange clips on a multi-track visual timeline. Split clips at any point, remove unwanted segments, and merge multiple videos into one seamless sequence.' },
    { icon: Music, title: 'Audio & Music Tracks', desc: 'Add background music, voiceovers, and sound effects. Control volume per track, fade audio in and out, and layer multiple audio elements precisely on the timeline.' },
    { icon: Layers, title: 'Text, Titles & Captions', desc: 'Create animated title cards, add subtitles at any timestamp, and overlay custom text in any font and color. Sync text layers precisely to your video timeline.' },
    { icon: Sparkles, title: 'Transitions & Effects', desc: 'Apply smooth fade, dissolve, and cut transitions between video clips. Use color filters, brightness, and contrast adjustments to make your videos visually consistent.' },
    { icon: Video, title: 'AI Background Removal', desc: 'Remove video backgrounds without a green screen using on-device AI. The model processes each frame locally to separate the subject from the background with natural edge blending.' },
    { icon: Zap, title: 'Fast Browser-Based Encoding', desc: 'Uses the browser\'s native WebCodecs API for GPU-accelerated video encoding. Export HD videos significantly faster than traditional software-based encoders.' },
    { icon: Shield, title: 'Complete Privacy', desc: 'No file uploads to servers. No cloud processing. All video data stays on your device and is processed using your local CPU and GPU. 100% private by design.' },
    { icon: Star, title: 'No Watermark, Free Forever', desc: 'Export your finished videos in full quality without any watermarks, logos, or branding. Editroy is completely free with no subscription required.' },
  ];

  return (
    <div className="container py-16 max-w-5xl mx-auto space-y-20 animate-in fade-in duration-500">
      
      {/* Hero Section */}
      <section className="text-center space-y-6 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest">
          <Sparkles className="h-3 w-3" />
          <span>On-Device Processing • No Watermark • 100% Free</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-none text-foreground/90">
          Free Online Video Editor
        </h1>
        <p className="text-muted-foreground text-md sm:text-lg max-w-xl mx-auto leading-relaxed">
          Trim, cut, merge, add text, music, transitions, and export HD videos — right in your browser. No watermark, no signup, and your video files never leave your device.
        </p>
        <div className="pt-4">
          <Link href="/dashboard/video-editor">
            <Button size="lg" className="h-12 px-8 text-md font-bold gap-2">
              Launch Video Editor <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* What is it */}
      <section className="space-y-6 border-t border-primary/10 pt-16">
        <h2 className="text-2xl font-black tracking-tight text-foreground/90">What is Editroy Video Editor?</h2>
        <div className="space-y-4 text-sm text-muted-foreground/90 leading-relaxed max-w-4xl">
          <p>
            Editroy Video Editor is a <strong className="text-foreground">free, browser-based video editing tool</strong> that lets you create professional videos without downloading any software. It uses modern browser technologies — WebCodecs, WebAssembly, and the Web Audio API — to give you a powerful multi-track timeline editor that runs entirely on your device.
          </p>
          <p>
            The key differentiator of Editroy is its <strong className="text-foreground">privacy-first architecture</strong>. When you import videos into the editor, they are loaded directly into your browser's memory. None of your video data is transmitted to any cloud server, stored on remote infrastructure, or processed by third-party services. This is especially important for users editing personal videos, confidential business recordings, or sensitive content that should never leave their device.
          </p>
          <p>
            From simple tasks like trimming a clip to complex projects involving multiple video tracks, audio layers, text overlays, and color correction, Editroy's timeline editor provides the tools you need in a clean, intuitive interface that anyone can use without prior video editing experience.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="space-y-8 border-t border-primary/10 pt-16">
        <h2 className="text-2xl font-black tracking-tight text-foreground/90 text-center">All Video Editing Features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <div key={i} className="p-5 rounded-2xl border border-primary/5 bg-card/30 backdrop-blur-sm space-y-3">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="font-bold text-sm text-foreground">{f.title}</h3>
              <p className="text-xs text-muted-foreground/80 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Who Uses It + Comparison */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-primary/10 pt-16">
        <div className="space-y-4">
          <h2 className="text-2xl font-black tracking-tight text-foreground/95 flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" /> Who uses Editroy Video Editor?
          </h2>
          <div className="space-y-4 text-sm text-muted-foreground/90 leading-relaxed">
            <p>
              <strong className="text-foreground">Content Creators & YouTubers:</strong> Quickly trim and edit raw footage, add intro/outro title cards, layer background music, and export clean HD content for YouTube, Instagram Reels, and TikTok without paying for expensive software subscriptions.
            </p>
            <p>
              <strong className="text-foreground">Business Professionals:</strong> Create polished product demo videos, company presentation recordings, and training materials. Add branded text overlays, company logos, and professional transitions without needing a dedicated video production team.
            </p>
            <p>
              <strong className="text-foreground">Students & Educators:</strong> Edit lecture recordings, class projects, and educational content. Cut out irrelevant segments, add explanatory text captions, and export video assignments in the required format.
            </p>
            <p>
              <strong className="text-foreground">Casual Video Editors:</strong> Trim holiday videos, cut wedding recordings, merge short clips into compilations, and add music to family memories — all with a simple, easy-to-understand interface.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-black tracking-tight text-foreground/95 flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> How Editroy compares to other editors
          </h2>
          <div className="space-y-4 text-sm text-muted-foreground/90 leading-relaxed">
            <p>
              <strong className="text-foreground">vs Adobe Premiere Pro:</strong> Adobe Premiere is an industry-standard desktop application starting at $54/month. Editroy offers free core video editing capabilities in the browser with no monthly cost for typical use cases.
            </p>
            <p>
              <strong className="text-foreground">vs CapCut (online):</strong> CapCut uploads your video files to their servers and stores them remotely. Editroy processes everything locally, making it the better choice for users who need privacy and data security.
            </p>
            <p>
              <strong className="text-foreground">vs iMovie:</strong> iMovie is only available on Apple devices. Editroy works on Windows, Mac, Linux, Android, and iOS — any device with a modern browser.
            </p>
            <p>
              <strong className="text-foreground">vs Clideo / VEED.io:</strong> These tools add watermarks unless you pay. Editroy never adds watermarks to your exported videos, completely free of charge.
            </p>
          </div>
        </div>
      </section>

      {/* How-to Guides */}
      <section className="space-y-8 border-t border-primary/10 pt-16 text-left">
        <h2 className="text-2xl font-black text-center tracking-tight text-foreground/90">Step-by-Step Video Editing Guides</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="p-6 rounded-2xl border border-primary/5 bg-card/30 backdrop-blur-sm space-y-3">
            <h3 className="font-bold text-md text-foreground">How to Trim & Cut a Video:</h3>
            <ol className="list-decimal pl-4 text-xs text-muted-foreground/85 space-y-2">
              <li>Click "Launch Video Editor" and import your video file.</li>
              <li>Your clip appears automatically in the timeline track below.</li>
              <li>Drag the left or right edge of the clip to trim the start or end.</li>
              <li>Move the playhead to the exact cut point and use the Split button.</li>
              <li>Click on unwanted segments and press Delete to remove them.</li>
              <li>Click "Export" to download your trimmed video without watermarks.</li>
            </ol>
          </div>

          <div className="p-6 rounded-2xl border border-primary/5 bg-card/30 backdrop-blur-sm space-y-3">
            <h3 className="font-bold text-md text-foreground">How to Add Music to a Video:</h3>
            <ol className="list-decimal pl-4 text-xs text-muted-foreground/85 space-y-2">
              <li>Open your project in the video editor workspace.</li>
              <li>Click "+ Audio" in the toolbar and import your music file (MP3, WAV).</li>
              <li>The audio clip appears as a new track below your video track.</li>
              <li>Drag the audio clip to align it with your video's start point.</li>
              <li>Use the volume slider in the Properties panel to set music level.</li>
              <li>Trim the audio to end at the same time as your video, then export.</li>
            </ol>
          </div>

          <div className="p-6 rounded-2xl border border-primary/5 bg-card/30 backdrop-blur-sm space-y-3">
            <h3 className="font-bold text-md text-foreground">How to Remove Video Background (No Green Screen):</h3>
            <ol className="list-decimal pl-4 text-xs text-muted-foreground/85 space-y-2">
              <li>Import your video clip and select it on the timeline.</li>
              <li>Open the "Background Remover" tab in the Properties panel.</li>
              <li>Click "Remove Background" — the AI model loads locally in your browser.</li>
              <li>Wait for processing (speed depends on clip length and your device).</li>
              <li>The subject is isolated with a transparent background automatically.</li>
              <li>Layer a background image or video below, then export your final video.</li>
            </ol>
          </div>

        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto space-y-8 border-t border-primary/10 pt-16 text-left">
        <h2 className="text-2xl font-black text-center tracking-tight text-foreground/90">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <details key={i} className="group p-5 rounded-2xl border border-primary/5 bg-card/30 backdrop-blur-sm [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex items-center justify-between cursor-pointer focus:outline-none">
                <span className="font-bold text-sm text-foreground/95">{faq.q}</span>
                <span className="transition-transform duration-200 group-open:rotate-180">
                  <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18" className="text-muted-foreground/60"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </span>
              </summary>
              <p className="mt-4 text-xs text-muted-foreground/85 leading-relaxed pl-3 border-l-2 border-primary/20">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="text-center space-y-4 border-t border-primary/10 pt-16">
        <h2 className="text-2xl font-black tracking-tight text-foreground/90">Start Editing Videos for Free — Right Now</h2>
        <p className="text-sm text-muted-foreground/80 max-w-lg mx-auto">
          No download, no account, no watermark. Open the editor in your browser and start cutting your first video in under 30 seconds.
        </p>
        <Link href="/dashboard/video-editor">
          <Button size="lg" className="h-12 px-8 text-md font-bold gap-2 mt-4">
            Open Video Editor <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </section>

    </div>
  );
}
