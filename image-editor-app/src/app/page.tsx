import Link from "next/link";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { desc } from "drizzle-orm";
import { CANVAS_SIZES } from "@/lib/editor/types";
import ProjectCard from "@/components/ProjectCard";

export const dynamic = "force-dynamic";

const FEATURES = [
  ["🎨", "Layer-based editing", "Images, text and vector shapes with blend modes, opacity, shadows and lock/hide."],
  ["🎚️", "Pro adjustments", "Brightness, contrast, saturation, hue, blur, sepia, grayscale, invert + 12 one-tap presets."],
  ["🪄", "Pixel effects", "Sharpen, film grain, vignette, pixelate, posterize, emboss and white background removal."],
  ["✍️", "Advanced typography", "12 fonts, weights, gradients, outlines, letter spacing, line height & live resizing."],
  ["📐", "Smart canvas", "Snap-to-center guides, rotation, flips, alignment tools, crop and 10 social presets."],
  ["⬇️", "Export anywhere", "PNG, JPG, WebP at up to 4× resolution with transparent backgrounds. Autosaves to cloud."],
];

export default async function HomePage() {
  const rows = await db
    .select({ id: projects.id, name: projects.name, width: projects.width, height: projects.height, thumbnail: projects.thumbnail, updatedAt: projects.updatedAt })
    .from(projects)
    .orderBy(desc(projects.updatedAt));

  return (
    <main className="min-h-screen bg-[#0b0b0f] text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-white/5 bg-[#0b0b0f]/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2 text-lg font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">L</span>
            <span className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">Lumina Studio</span>
          </div>
          <Link href="/editor" className="rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold shadow-lg shadow-violet-500/25 hover:brightness-110">
            + New design
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-violet-600/30 blur-[140px]" />
        <div className="pointer-events-none absolute -right-40 top-20 h-[500px] w-[500px] rounded-full bg-fuchsia-600/20 blur-[140px]" />
        <div className="relative mx-auto max-w-7xl px-6 pb-16 pt-20 text-center">
          <p className="mb-4 inline-block rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-300">
            Premium browser-based image editor
          </p>
          <h1 className="mx-auto max-w-3xl text-5xl font-extrabold leading-[1.05] tracking-tight md:text-7xl">
            Design faster than <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-orange-300 bg-clip-text text-transparent">Canva</span>.
            <br />
            Edit deeper than <span className="bg-gradient-to-r from-cyan-300 to-violet-400 bg-clip-text text-transparent">Photoshop</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-zinc-400">
            Layers, pro color grading, pixel-level effects, advanced typography and 4K export — all free, in your browser, with cloud-saved projects.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/editor" className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-3 font-semibold shadow-xl shadow-violet-500/25 hover:brightness-110">
              Start creating — it&apos;s free
            </Link>
            <a href="#projects" className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 font-semibold hover:bg-white/10">
              My projects
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">Start with a size</h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {CANVAS_SIZES.map((s) => (
            <Link
              key={s.name}
              href={`/editor?w=${s.w}&h=${s.h}&name=${encodeURIComponent(s.name)}`}
              className="group flex w-36 shrink-0 flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-violet-500/50 hover:bg-white/[0.06]"
            >
              <div
                className="rounded border border-violet-400/40 bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 group-hover:from-violet-500/50"
                style={{ width: 56 * Math.min(1, s.w / s.h), height: 56 * Math.min(1, s.h / s.w) }}
              />
              <div className="text-center">
                <div className="text-xs font-medium">{s.name}</div>
                <div className="text-[10px] text-zinc-500">
                  {s.w}×{s.h}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section id="projects" className="mx-auto max-w-7xl px-6 pb-16">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Recent designs ({rows.length})</h2>
        </div>
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-sm text-zinc-500">
            No designs yet.{" "}
            <Link href="/editor" className="text-violet-300 underline">
              Create your first one
            </Link>
            .
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
            {rows.map((p) => (
              <ProjectCard key={p.id} project={{ ...p, updatedAt: p.updatedAt.toISOString() }} />
            ))}
          </div>
        )}
      </section>

      <section className="border-t border-white/5 bg-[#0e0e13]">
        <div className="mx-auto grid max-w-7xl gap-6 px-6 py-16 md:grid-cols-3">
          {FEATURES.map(([icon, title, desc]) => (
            <div key={title} className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
              <div className="mb-3 text-2xl">{icon}</div>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-zinc-400">{desc}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="border-t border-white/5 py-6 text-center text-xs text-zinc-600">Lumina Studio · Built with Next.js, Canvas 2D & PostgreSQL</footer>
    </main>
  );
}
