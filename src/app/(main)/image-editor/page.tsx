// src/app/(main)/image-editor/page.tsx
import Link from 'next/link';
import { ArrowRight, Image as ImageIcon, Sparkles, Crop, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Free Online Image Editor — No Signup | Editroy',
  description: 'Edit images online for free. Crop, resize, add text, apply filters and remove backgrounds — all in your browser. No signup required.',
  alternates: {
    canonical: 'https://www.editroy.com/image-editor',
  },
};

export default function ImageEditorLanding() {
  const faqs = [
    {
      q: 'Is the image editor completely free?',
      a: 'Yes, Editroy’s image editor is 100% free with no registration, daily limits, or hidden subscriptions. You can edit as many photos as you want without watermarks.',
    },
    {
      q: 'Does editing my image reduce its quality?',
      a: 'No. The editor performs all adjustments and manipulations on the original resolution of your image. Quality changes only happen if you choose to compress the file when saving.',
    },
    {
      q: 'Where are my images processed?',
      a: 'All processing happens locally on your computer using browser WebGL/WebAssembly capabilities. Your images are never uploaded to any external server, ensuring absolute privacy.',
    },
    {
      q: 'Can I undo edits if I make a mistake?',
      a: 'Yes. The workspace provides a comprehensive multi-step undo and redo history tracking tool, allowing you to easily roll back edits step-by-step.',
    },
    {
      q: 'Is there a limit to the image size I can import?',
      a: 'Since calculations run entirely in your local browser sandbox, there are no file size limits imposed by our servers. Processing speeds will depend on your local hardware RAM.',
    },
  ];

  return (
    <div className="container py-16 max-w-5xl mx-auto space-y-16 animate-in fade-in duration-500">
      
      {/* Hero Section */}
      <section className="text-center space-y-6 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest">
          <Sparkles className="h-3 w-3" />
          <span>Privacy First Suite</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-none text-foreground/90">
          Free Online Image Editor
        </h1>
        <p className="text-muted-foreground text-md sm:text-lg max-w-xl mx-auto leading-relaxed">
          Crop, resize, filter, and edit any image right in your browser. All processing runs 100% client-side with zero file uploads.
        </p>
        <div className="pt-4">
          <Link href="/dashboard/image-editor">
            <Button size="lg" className="h-12 px-8 text-md font-bold gap-2">
              Launch Image Editor <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-primary/10 pt-16">
        <div className="space-y-4">
          <h2 className="text-2xl font-black tracking-tight text-foreground/95 flex items-center gap-2">
            <Crop className="h-5 w-5 text-primary" /> What can you do with the Image Editor?
          </h2>
          <div className="space-y-4 text-sm text-muted-foreground/90 leading-relaxed">
            <p>
              <strong className="text-foreground">Essential Adjustments:</strong> Crop, rotate, flip, and resize images with pixel-perfect accuracy. It is perfect for preparing banners, resizing photo formats, or preparing graphics for social media channels.
            </p>
            <p>
              <strong className="text-foreground">Filters & Color Grading:</strong> Adjust sliders for brightness, contrast, exposure, and saturation, or use advanced color grading curves to bring out details in your photos.
            </p>
            <p>
              <strong className="text-foreground">Layers & Text Overlays:</strong> Write custom text overlays, insert watermark templates, add solid borders/frames, or layer graphics on top of your main canvas.
            </p>
            <p>
              <strong className="text-foreground">AI Background Removal:</strong> Run local, on-device AI algorithms to instantly separate foreground subjects from backgrounds or erase blemishes.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-black tracking-tight text-foreground/95 flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" /> Perfect For Many Use Cases
          </h2>
          <div className="space-y-4 text-sm text-muted-foreground/90 leading-relaxed">
            <p>
              <strong className="text-foreground">E-commerce Merchants:</strong> Fast background cutouts, product photo alignment, compression, and exporting as high-quality JPEGs or transparent PNGs.
            </p>
            <p>
              <strong className="text-foreground">Social Media Creators:</strong> Custom templates for banners, cropping posts to square, and applying visual color presets.
            </p>
            <p>
              <strong className="text-foreground">Privacy-Conscious Individuals:</strong> Edit sensitive photos (like ID photos, documents, or personal images) without uploading them to remote cloud servers.
            </p>
          </div>
        </div>
      </section>

      {/* Workflows / How to Use */}
      <section className="space-y-8 border-t border-primary/10 pt-16 text-left">
        <h2 className="text-2xl font-black text-center tracking-tight text-foreground/90">Common Editing Workflows</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="p-6 rounded-2xl border border-primary/5 bg-card/30 backdrop-blur-sm space-y-3">
            <h3 className="font-bold text-md text-foreground">To Crop & Rotate:</h3>
            <ol className="list-decimal pl-4 text-xs text-muted-foreground/85 space-y-2">
              <li>Click "Launch Editor" and import your image.</li>
              <li>Select the "Crop" tool in the side toolbar.</li>
              <li>Adjust the crop box handles over the image area.</li>
              <li>Use the rotation buttons to adjust alignment.</li>
              <li>Click "Apply Crop" to save the modifications.</li>
            </ol>
          </div>

          <div className="p-6 rounded-2xl border border-primary/5 bg-card/30 backdrop-blur-sm space-y-3">
            <h3 className="font-bold text-md text-foreground">To Add Text & Stamps:</h3>
            <ol className="list-decimal pl-4 text-xs text-muted-foreground/85 space-y-2">
              <li>Open your image inside the workspace.</li>
              <li>Select the "Watermark" or "Add Text" tool.</li>
              <li>Type your message and choose the font properties.</li>
              <li>Drag the text layer directly to the canvas position.</li>
              <li>Set transparency and apply to render.</li>
            </ol>
          </div>

          <div className="p-6 rounded-2xl border border-primary/5 bg-card/30 backdrop-blur-sm space-y-3">
            <h3 className="font-bold text-md text-foreground">To Compress & Export:</h3>
            <ol className="list-decimal pl-4 text-xs text-muted-foreground/85 space-y-2">
              <li>Open the "Utilities" tab on the editing panel.</li>
              <li>Select the output file format (PNG, JPEG, WebP).</li>
              <li>Adjust the compression quality slider to optimize file size.</li>
              <li>Preview the estimated size differences.</li>
              <li>Click "Download" to save the file locally.</li>
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
