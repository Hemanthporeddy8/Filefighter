// src/app/(main)/image-editor/page.tsx
import Link from 'next/link';
import { ArrowRight, Image as ImageIcon, Sparkles, Crop, Layers, Zap, Shield, Download, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Free Online Image Editor — No Signup, No Watermark | Editroy',
  description: 'Edit images online for free. Crop, resize, add text, apply filters, remove backgrounds — all in your browser. No signup required. No watermark. Works on any device.',
  alternates: {
    canonical: 'https://www.editroy.com/image-editor',
  },
};

export default function ImageEditorLanding() {
  const faqs = [
    {
      q: 'Is the image editor completely free?',
      a: 'Yes, Editroy\'s image editor is 100% free with no registration, daily limits, or hidden subscriptions. You can edit as many photos as you want without watermarks.',
    },
    {
      q: 'Does editing my image reduce its quality?',
      a: 'No. The editor performs all adjustments and manipulations on the original resolution of your image. Quality changes only happen if you choose to compress the file when saving.',
    },
    {
      q: 'Where are my images processed — are they uploaded to a server?',
      a: 'All processing happens locally on your computer using browser WebGL and WebAssembly capabilities. Your images are never uploaded to any external server, ensuring absolute privacy. This is one of Editroy\'s core principles — your files stay on your device at all times.',
    },
    {
      q: 'Can I undo edits if I make a mistake?',
      a: 'Yes. The workspace provides a comprehensive multi-step undo and redo history tracking system, allowing you to easily roll back edits step-by-step. You can undo all the way back to the original image.',
    },
    {
      q: 'Is there a limit to the image size I can import?',
      a: 'Since calculations run entirely in your local browser sandbox, there are no file size limits imposed by our servers. Processing speeds will depend on your local hardware RAM. Most modern computers handle images up to 50MP+ without any issues.',
    },
    {
      q: 'What image formats are supported for import and export?',
      a: 'You can import JPG, JPEG, PNG, WebP, BMP, GIF, SVG, and TIFF files. For export, you can save your edited image as PNG, JPEG, or WebP with a custom quality setting to balance file size and image fidelity.',
    },
    {
      q: 'Does the image editor work on mobile phones and tablets?',
      a: 'Yes. Editroy\'s image editor is fully responsive and works on Android, iPhone, and iPad browsers. For the best experience on mobile, use Chrome or Safari and enable hardware acceleration in your browser settings.',
    },
    {
      q: 'How does the AI background removal work?',
      a: 'The AI background remover uses a local machine learning model (ONNX format) that runs entirely inside your browser. It detects the foreground subject and separates it from the background using advanced image segmentation algorithms. No cloud GPU is needed — your device handles everything privately.',
    },
    {
      q: 'Can I batch edit multiple images at once?',
      a: 'The editor currently supports editing one image at a time per canvas session. For batch operations like compression or format conversion, you can open multiple browser tabs with Editroy and process images in parallel.',
    },
    {
      q: 'Is there a difference between Editroy and Photoshop for basic edits?',
      a: 'Photoshop is a professional desktop application costing $20+/month, while Editroy is completely free and browser-based. For common tasks like cropping, brightness adjustments, background removal, text overlays, and format conversion, Editroy handles everything without needing to install any software.',
    },
  ];

  const features = [
    { icon: Crop, title: 'Crop & Resize', desc: 'Crop with free-form or fixed aspect ratios. Resize to exact pixel dimensions for any platform — social media, print, web, or email.' },
    { icon: Sparkles, title: 'AI Background Removal', desc: 'Remove image backgrounds with AI in one click. Works on portraits, products, pets, and complex scenes. Outputs clean transparent PNG.' },
    { icon: Layers, title: 'Filters & Color Grading', desc: 'Apply brightness, contrast, saturation, hue, exposure, and color balance adjustments with intuitive sliders for professional-quality results.' },
    { icon: ImageIcon, title: 'Text & Watermarks', desc: 'Add custom text overlays, watermarks, and labels in any font, color, and size. Position freely anywhere on your canvas.' },
    { icon: Zap, title: 'Flip & Rotate', desc: 'Rotate images 90°, 180°, 270°, or by any custom angle. Mirror horizontally or vertically instantly.' },
    { icon: Download, title: 'Format Conversion', desc: 'Convert images between JPG, PNG, WebP, and BMP formats. Control export quality to perfectly balance file size and visual clarity.' },
    { icon: Shield, title: '100% Private & Secure', desc: 'No file uploads. No server processing. Your images never leave your device — everything runs inside your browser using WebAssembly.' },
    { icon: Star, title: 'No Watermark Ever', desc: 'Download your edited images in full original resolution with zero watermarks or branding added, completely free of charge.' },
  ];

  return (
    <div className="container py-16 max-w-5xl mx-auto space-y-20 animate-in fade-in duration-500">
      
      {/* Hero Section */}
      <section className="text-center space-y-6 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest">
          <Sparkles className="h-3 w-3" />
          <span>Privacy-First • No Signup • 100% Free</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-none text-foreground/90">
          Free Online Image Editor
        </h1>
        <p className="text-muted-foreground text-md sm:text-lg max-w-xl mx-auto leading-relaxed">
          Crop, resize, filter, remove backgrounds, and add text to any image right in your browser. All processing runs 100% client-side — your files never leave your device. No watermarks, no signup, completely free.
        </p>
        <div className="pt-4">
          <Link href="/dashboard/image-editor">
            <Button size="lg" className="h-12 px-8 text-md font-bold gap-2">
              Launch Image Editor <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* What is it section */}
      <section className="space-y-6 border-t border-primary/10 pt-16">
        <h2 className="text-2xl font-black tracking-tight text-foreground/90">What is Editroy Image Editor?</h2>
        <div className="space-y-4 text-sm text-muted-foreground/90 leading-relaxed max-w-4xl">
          <p>
            Editroy is a <strong className="text-foreground">free, browser-based image editing tool</strong> that gives you professional editing capabilities without installing any software. Unlike traditional desktop editors like Adobe Photoshop or GIMP, Editroy runs entirely inside your web browser using modern web technologies including WebAssembly, WebGL, and local AI models.
          </p>
          <p>
            The most important advantage of Editroy is <strong className="text-foreground">privacy</strong>. When you open an image in Editroy, it is loaded directly into your browser's memory — it is never transmitted to any server, never stored in any cloud, and never seen by anyone other than you. This makes Editroy the ideal choice for editing sensitive photos such as identity documents, medical images, personal photographs, and confidential business graphics.
          </p>
          <p>
            Whether you are a photographer, content creator, e-commerce seller, student, or just someone who needs to quickly crop and resize a photo, Editroy gives you all the tools you need in a clean, fast, and easy-to-use interface.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="space-y-8 border-t border-primary/10 pt-16">
        <h2 className="text-2xl font-black tracking-tight text-foreground/90 text-center">All Image Editing Features</h2>
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

      {/* Use Cases */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-primary/10 pt-16">
        <div className="space-y-4">
          <h2 className="text-2xl font-black tracking-tight text-foreground/95 flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" /> Who uses Editroy Image Editor?
          </h2>
          <div className="space-y-4 text-sm text-muted-foreground/90 leading-relaxed">
            <p>
              <strong className="text-foreground">E-commerce Sellers:</strong> Fast background cutouts, product photo alignment, compression, and exporting as high-quality JPEGs or transparent PNGs for Amazon, Shopify, and Etsy listings. Save hours of time without needing a professional photographer.
            </p>
            <p>
              <strong className="text-foreground">Social Media Creators:</strong> Custom templates for Instagram, Twitter, YouTube thumbnails, and TikTok covers. Crop posts to exact square or widescreen dimensions, apply trendy color presets, and add branded text overlays.
            </p>
            <p>
              <strong className="text-foreground">Students & Teachers:</strong> Quickly edit images for presentations, reports, and educational materials. Resize diagrams, add labels and annotations, crop screenshots, and compress large images without worrying about expensive software licenses.
            </p>
            <p>
              <strong className="text-foreground">Privacy-Conscious Individuals:</strong> Edit sensitive photos like ID photos, documents, or personal images without uploading them to remote cloud servers. Everything stays on your device.
            </p>
            <p>
              <strong className="text-foreground">Small Business Owners:</strong> Create branded marketing materials, flyers, promotional graphics, email banners, and product mockups without hiring a designer or subscribing to expensive creative suites.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-black tracking-tight text-foreground/95 flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Why choose Editroy over other editors?
          </h2>
          <div className="space-y-4 text-sm text-muted-foreground/90 leading-relaxed">
            <p>
              <strong className="text-foreground">Compared to Canva:</strong> Canva is great for design templates, but it uploads every image you edit to their cloud servers. Editroy keeps everything private and local. Editroy also offers AI background removal without any monthly subscription.
            </p>
            <p>
              <strong className="text-foreground">Compared to Adobe Express:</strong> Adobe requires a paid Creative Cloud subscription for most professional features. Editroy provides crop, resize, filter, background removal, and format conversion tools completely free.
            </p>
            <p>
              <strong className="text-foreground">Compared to Photoshop:</strong> Photoshop is a desktop application with a steep learning curve. Editroy runs in your browser, requires no installation, and is easy enough for complete beginners while still offering powerful features for advanced users.
            </p>
            <p>
              <strong className="text-foreground">Compared to Online Compress Tools:</strong> Most online image compression websites upload your files to their servers and process them remotely. Editroy compresses and converts images 100% locally in your browser with zero data transfers.
            </p>
          </div>
        </div>
      </section>

      {/* How to Use Workflows */}
      <section className="space-y-8 border-t border-primary/10 pt-16 text-left">
        <h2 className="text-2xl font-black text-center tracking-tight text-foreground/90">Step-by-Step Editing Guides</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="p-6 rounded-2xl border border-primary/5 bg-card/30 backdrop-blur-sm space-y-3">
            <h3 className="font-bold text-md text-foreground">How to Crop & Rotate an Image:</h3>
            <ol className="list-decimal pl-4 text-xs text-muted-foreground/85 space-y-2">
              <li>Click "Launch Editor" and import your image using drag-and-drop or the file browser.</li>
              <li>Select the "Crop" tool in the side toolbar panel.</li>
              <li>Choose a preset aspect ratio (1:1, 16:9, 4:3) or use free-form mode.</li>
              <li>Adjust the crop box handles to frame the area you want to keep.</li>
              <li>Use the rotation buttons to align the horizon or correct camera tilt.</li>
              <li>Click "Apply Crop" to finalize the changes and download your result.</li>
            </ol>
          </div>

          <div className="p-6 rounded-2xl border border-primary/5 bg-card/30 backdrop-blur-sm space-y-3">
            <h3 className="font-bold text-md text-foreground">How to Remove an Image Background:</h3>
            <ol className="list-decimal pl-4 text-xs text-muted-foreground/85 space-y-2">
              <li>Open your image in the Editroy workspace.</li>
              <li>Click the "AI Background Removal" button in the tools panel.</li>
              <li>Wait a few seconds while the local AI model analyzes your image.</li>
              <li>The background is removed and replaced with a transparent layer automatically.</li>
              <li>Fine-tune the edges using the manual erase brush if needed.</li>
              <li>Download the result as a PNG file to preserve the transparent background.</li>
            </ol>
          </div>

          <div className="p-6 rounded-2xl border border-primary/5 bg-card/30 backdrop-blur-sm space-y-3">
            <h3 className="font-bold text-md text-foreground">How to Compress & Convert Image Format:</h3>
            <ol className="list-decimal pl-4 text-xs text-muted-foreground/85 space-y-2">
              <li>Open the "Export" or "Save" panel in the editing toolbar.</li>
              <li>Select the output file format: PNG, JPEG, or WebP.</li>
              <li>Adjust the compression quality slider (80-90% is recommended for web use).</li>
              <li>View the estimated output file size in real-time as you adjust the slider.</li>
              <li>Click "Download" to save the compressed image directly to your device.</li>
              <li>No server upload needed — the compression runs fully inside your browser.</li>
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

      {/* Final CTA */}
      <section className="text-center space-y-4 border-t border-primary/10 pt-16">
        <h2 className="text-2xl font-black tracking-tight text-foreground/90">Start Editing Your Images for Free</h2>
        <p className="text-sm text-muted-foreground/80 max-w-lg mx-auto">
          No download, no account, no watermark. Open the editor and start editing immediately — your images stay private on your device.
        </p>
        <Link href="/dashboard/image-editor">
          <Button size="lg" className="h-12 px-8 text-md font-bold gap-2 mt-4">
            Open Image Editor <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </section>

    </div>
  );
}
