// src/app/(main)/video-editor/page.tsx
import Link from 'next/link';
import { ArrowRight, Video, Sparkles, Scissors, Layers, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Free Online Video Editor — No Watermark | Editroy',
  description: 'Edit videos online for free. Trim, merge, add text and music, apply transitions. No watermark, no signup. Export in HD from your browser.',
  alternates: {
    canonical: 'https://www.editroy.com/video-editor',
  },
};

export default function VideoEditorLanding() {
  const faqs = [
    {
      q: 'Does the exported video have a watermark?',
      a: 'No. Editroy is completely free and never adds watermarks, stamps, or branding to your exported video files.',
    },
    {
      q: 'What video formats are supported?',
      a: 'You can import video clips in standard formats like MP4, MOV, and WebM. The editor compiles and exports files in optimized MP4 format.',
    },
    {
      q: 'Does rendering upload my large video files?',
      a: 'No. All video encoding, clipping, and rendering are processed entirely inside your browser using local system hardware. Your video files never leave your device.',
    },
    {
      q: 'Is there a video duration limit?',
      a: 'There are no artificial limits on video length. However, very long videos (over 10-15 minutes) or high-resolution 4K clips will require more system RAM and processing time.',
    },
    {
      q: 'Which browsers are recommended for video editing?',
      a: 'For best performance and rendering speed, we recommend using Google Chrome, Microsoft Edge, Opera, or other Chromium-based browsers with hardware acceleration enabled.',
    },
  ];

  return (
    <div className="container py-16 max-w-5xl mx-auto space-y-16 animate-in fade-in duration-500">
      
      {/* Hero Section */}
      <section className="text-center space-y-6 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest">
          <Sparkles className="h-3 w-3" />
          <span>On-Device Processing</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-none text-foreground/90">
          Free Online Video Editor
        </h1>
        <p className="text-muted-foreground text-md sm:text-lg max-w-xl mx-auto leading-relaxed">
          Trim, cut, merge, and add music to your videos with an interactive timeline. 100% free with no watermark and zero uploads.
        </p>
        <div className="pt-4">
          <Link href="/dashboard/video-editor">
            <Button size="lg" className="h-12 px-8 text-md font-bold gap-2">
              Launch Video Editor <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-primary/10 pt-16">
        <div className="space-y-4">
          <h2 className="text-2xl font-black tracking-tight text-foreground/95 flex items-center gap-2">
            <Scissors className="h-5 w-5 text-primary" /> What can you do with the Video Editor?
          </h2>
          <div className="space-y-4 text-sm text-muted-foreground/90 leading-relaxed">
            <p>
              <strong className="text-foreground">Timeline Video Trimming:</strong> Easily cut, slice, rearrange, and merge clips on a multi-track interactive timeline designed for precise timing.
            </p>
            <p>
              <strong className="text-foreground">Audio & Music Overlay:</strong> Import background audio tracks or voiceovers, adjust volumes, and layer multiple sound elements below your video tracks.
            </p>
            <p>
              <strong className="text-foreground">Titles & Captions:</strong> Create text slides, add stylized title cards, or overlay explanatory subtitles at specific times on the timeline.
            </p>
            <p>
              <strong className="text-foreground">Transitions & Filters:</strong> Apply smooth transitions between video clips and adjust color filters to make your videos visually cohesive.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-black tracking-tight text-foreground/95 flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" /> Multi-Purpose Tool
          </h2>
          <div className="space-y-4 text-sm text-muted-foreground/90 leading-relaxed">
            <p>
              <strong className="text-foreground">Content Creators:</strong> Quickly format and edit vertical clips for TikTok, YouTube Shorts, and Instagram Reels without any watermark.
            </p>
            <p>
              <strong className="text-foreground">Educators & Presenters:</strong> Crop and annotate screen recordings, add background audio, and cut out boring gaps.
            </p>
            <p>
              <strong className="text-foreground">Personal Use:</strong> Edit family videos, trim down large recording files before sharing, and compile video collages securely.
            </p>
          </div>
        </div>
      </section>

      {/* Workflows / How to Use */}
      <section className="space-y-8 border-t border-primary/10 pt-16 text-left">
        <h2 className="text-2xl font-black text-center tracking-tight text-foreground/90">Common Editing Workflows</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="p-6 rounded-2xl border border-primary/5 bg-card/30 backdrop-blur-sm space-y-3">
            <h3 className="font-bold text-md text-foreground">To Trim and Cut:</h3>
            <ol className="list-decimal pl-4 text-xs text-muted-foreground/85 space-y-2">
              <li>Click "Launch Editor" and import your video files.</li>
              <li>Drag a clip onto the timeline track.</li>
              <li>Position the playhead line at the cut point.</li>
              <li>Click the split/scissors tool to cut the clip.</li>
              <li>Delete the unwanted segment and drag clips together.</li>
            </ol>
          </div>

          <div className="p-6 rounded-2xl border border-primary/5 bg-card/30 backdrop-blur-sm space-y-3">
            <h3 className="font-bold text-md text-foreground">To Add Background Music:</h3>
            <ol className="list-decimal pl-4 text-xs text-muted-foreground/85 space-y-2">
              <li>Import your audio file (MP3/WAV) to the media bin.</li>
              <li>Drag the audio track onto the timeline track.</li>
              <li>Resize the audio file boundaries to fit your video length.</li>
              <li>Adjust the volume slider to create a balanced mix.</li>
              <li>Align the audio track start to sync with video hooks.</li>
            </ol>
          </div>

          <div className="p-6 rounded-2xl border border-primary/5 bg-card/30 backdrop-blur-sm space-y-3">
            <h3 className="font-bold text-md text-foreground">To Export Your Video:</h3>
            <ol className="list-decimal pl-4 text-xs text-muted-foreground/85 space-y-2">
              <li>Click the "Export" button in the top right corner.</li>
              <li>Select your target resolution (720p or 1080p HD).</li>
              <li>Choose a frame rate (30fps or 60fps).</li>
              <li>Wait for the local rendering engine to compile the frames.</li>
              <li>Download the compiled MP4 file to your device.</li>
            </ol>
          </div>

        </div>
      </section>

      {/* FAQ Section */}
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

    </div>
  );
}
