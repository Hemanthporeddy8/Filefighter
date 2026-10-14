"use client";
import { useRef, useState } from "react";
import {
  BLENDS,
  CANVAS_SIZES,
  FONTS,
  PRESETS,
  defaultFilters,
  type Doc,
  type ImageLayer,
  type Layer,
  type PathLayer,
  type ShapeKind,
  type ShapeLayer,
  type TextLayer,
} from "@/lib/editor/types";
import { TEMPLATES } from "@/lib/editor/factories";
import { bakeImageEffect, measureText } from "@/lib/editor/render";
import { Btn, ColorInput, IconBtn, NumberInput, Section, Select, Slider, Toggle } from "./ui";

export type Tab = "templates" | "uploads" | "text" | "shapes" | "canvas";

const SHAPES: { kind: ShapeKind; label: string; icon: string }[] = [
  { kind: "rect", label: "Rectangle", icon: "▭" },
  { kind: "ellipse", label: "Circle", icon: "●" },
  { kind: "triangle", label: "Triangle", icon: "▲" },
  { kind: "star", label: "Star", icon: "★" },
  { kind: "heart", label: "Heart", icon: "♥" },
  { kind: "hexagon", label: "Hexagon", icon: "⬢" },
  { kind: "line", label: "Line", icon: "—" },
];

const STOCK = [
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1600",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1600",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1600",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1600",
  "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=1600",
  "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=1600",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=1600",
  "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=1600",
];

export function LeftPanel({
  tab,
  doc,
  onClose,
  onAddText,
  onAddShape,
  onAddImageFiles,
  onAddImageUrl,
  onLoadTemplate,
  onUpdateDoc,
}: {
  tab: Tab;
  doc: Doc;
  onClose: () => void;
  onAddText: (preset: "heading" | "subheading" | "body") => void;
  onAddShape: (k: ShapeKind) => void;
  onAddImageFiles: (files: FileList) => void;
  onAddImageUrl: (url: string) => void;
  onLoadTemplate: (idx: number) => void;
  onUpdateDoc: (patch: Partial<Doc>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");

  const tabLabels: Record<Tab, string> = {
    templates: "Templates",
    uploads: "Uploads",
    text: "Text",
    shapes: "Shapes",
    canvas: "Canvas",
  };

  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-r border-line surface shadow-xl z-10 animate-in fade-in slide-in-from-left-2 duration-150">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-main">{tabLabels[tab]}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Close panel"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-[var(--hover)] hover:text-main transition"
        >
          ✕
        </button>
      </div>
      {tab === "templates" && (
        <Section title="Templates">
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATES.map((t, i) => (
              <button
                key={t.name}
                onClick={() => onLoadTemplate(i)}
                className="group rounded-lg border border-line field p-2 text-left transition hover:border-violet-500/50 hover:bg-zinc-800"
              >
                <div className="mb-1.5 flex h-16 items-center justify-center rounded bg-gradient-to-br from-violet-600/30 to-fuchsia-600/30 text-2xl">
                  {t.category === "Social" ? "📱" : t.category === "Video" ? "🎬" : t.category === "Print" ? "🖨️" : "📊"}
                </div>
                <div className="truncate text-xs font-medium text-main">{t.name}</div>
                <div className="text-[10px] text-zinc-500">{t.category}</div>
              </button>
            ))}
          </div>
        </Section>
      )}

      {tab === "uploads" && (
        <>
          <Section title="Upload">
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && onAddImageFiles(e.target.files)} />
            <Btn variant="primary" className="w-full py-2.5" onClick={() => fileRef.current?.click()}>
              ⬆ Upload images
            </Btn>
            <p className="text-[11px] text-zinc-500">PNG, JPG, WEBP, GIF, SVG. Or drag & drop onto the canvas.</p>
            <div className="flex gap-1">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste image URL…"
                className="flex-1 rounded border border-line field px-2 py-1.5 text-xs text-main"
              />
              <Btn
                onClick={() => {
                  if (url) onAddImageUrl(url);
                  setUrl("");
                }}
              >
                Add
              </Btn>
            </div>
          </Section>
          <Section title="Stock photos">
            <div className="grid grid-cols-2 gap-2">
              {STOCK.map((s) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={s}
                  src={s.replace("w=1600", "w=300")}
                  alt="stock"
                  onClick={() => onAddImageUrl(s)}
                  className="h-20 w-full cursor-pointer rounded-md object-cover transition hover:ring-2 hover:ring-violet-500"
                />
              ))}
            </div>
          </Section>
        </>
      )}

      {tab === "text" && (
        <Section title="Add text">
          <button onClick={() => onAddText("heading")} className="w-full rounded-lg border border-line field px-3 py-3 text-left text-2xl font-extrabold text-white hover:bg-zinc-800">
            Add a heading
          </button>
          <button onClick={() => onAddText("subheading")} className="w-full rounded-lg border border-line field px-3 py-2.5 text-left text-base font-semibold text-main hover:bg-zinc-800">
            Add a subheading
          </button>
          <button onClick={() => onAddText("body")} className="w-full rounded-lg border border-line field px-3 py-2 text-left text-sm text-muted hover:bg-zinc-800">
            Add a little bit of body text
          </button>
          <p className="pt-2 text-[11px] text-zinc-500">Tip: double-click text on the canvas to edit it quickly.</p>
        </Section>
      )}

      {tab === "shapes" && (
        <Section title="Shapes">
          <div className="grid grid-cols-3 gap-2">
            {SHAPES.map((s) => (
              <button
                key={s.kind}
                onClick={() => onAddShape(s.kind)}
                title={s.label}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-line field text-2xl text-violet-300 hover:bg-zinc-800"
              >
                {s.icon}
                <span className="text-[10px] text-zinc-500">{s.label}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {tab === "canvas" && (
        <>
          <Section title="Canvas size">
            <div className="grid grid-cols-2 gap-2">
              <NumberInput label="Width" value={doc.width} onChange={(v) => onUpdateDoc({ width: Math.max(16, Math.round(v)) })} />
              <NumberInput label="Height" value={doc.height} onChange={(v) => onUpdateDoc({ height: Math.max(16, Math.round(v)) })} />
            </div>
            <div className="space-y-1 pt-1">
              {CANVAS_SIZES.map((s) => (
                <button
                  key={s.name}
                  onClick={() => onUpdateDoc({ width: s.w, height: s.h })}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs text-muted hover:bg-[var(--hover)]"
                >
                  <span>{s.name}</span>
                  <span className="text-zinc-500">
                    {s.w}×{s.h}
                  </span>
                </button>
              ))}
            </div>
          </Section>
          <Section title="Background">
            <ColorInput label="Color" value={doc.background} onChange={(v) => onUpdateDoc({ background: v })} />
            <div className="grid grid-cols-6 gap-1.5 pt-1">
              {["#ffffff", "#000000", "#0f0f12", "#f8fafc", "#fef3c7", "#fce7f3", "#dbeafe", "#dcfce7", "#7c3aed", "#ec4899", "#f97316", "#06b6d4", "transparent"].map((c) => (
                <button
                  key={c}
                  onClick={() => onUpdateDoc({ background: c })}
                  className="h-7 w-full rounded border border-line"
                  title={c}
                  style={{
                    background:
                      c === "transparent"
                        ? "repeating-conic-gradient(#555 0% 25%, #222 0% 50%) 50% / 10px 10px"
                        : c,
                  }}
                />
              ))}
            </div>
          </Section>
        </>
      )}
    </aside>
  );
}

/* ───────────────────────────── Properties ───────────────────────────── */

export function PropertiesPanel({
  layer,
  doc,
  onChange,
  onCommit,
  onAction,
  textEditRef,
}: {
  layer: Layer | null;
  doc: Doc;
  onChange: (patch: Partial<Layer>) => void;
  onCommit: () => void;
  onAction: (a: "delete" | "duplicate" | "front" | "back" | "forward" | "backward" | "fitCanvas" | "centerH" | "centerV" | "alignL" | "alignR" | "alignT" | "alignB") => void;
  textEditRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  if (!layer) {
    return (
      <div className="p-6 text-center text-xs text-zinc-500">
        <div className="mb-2 text-3xl">✨</div>
        Select a layer on the canvas to edit its properties. Drag & drop images anywhere to add them.
      </div>
    );
  }
  const set = (p: Partial<Layer>) => {
    onChange(p);
  };
  const setCommit = (p: Partial<Layer>) => {
    onChange(p);
    onCommit();
  };

  const applyEffect = async (effect: Parameters<typeof bakeImageEffect>[1], amount = 1) => {
    if (layer.type !== "image") return;
    setBusy(effect);
    try {
      const src = await bakeImageEffect(layer.src, effect, amount);
      setCommit({ src } as Partial<ImageLayer>);
    } catch {
      alert("Could not process this image (cross-origin restriction). Try uploading it instead.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <Section
        title={layer.type === "image" ? "Image" : layer.type === "text" ? "Text" : layer.type === "path" ? "Path" : "Shape"}
        right={
          <div className="flex gap-0.5">
            <IconBtn title="Duplicate (Ctrl+D)" onClick={() => onAction("duplicate")}>⧉</IconBtn>
            <IconBtn title={layer.locked ? "Unlock" : "Lock"} active={layer.locked} onClick={() => setCommit({ locked: !layer.locked })}>
              {layer.locked ? "🔒" : "🔓"}
            </IconBtn>
            <IconBtn title="Delete" onClick={() => onAction("delete")} className="hover:!bg-red-500/20">
              🗑
            </IconBtn>
          </div>
        }
      >
        <input
          value={layer.name}
          onChange={(e) => set({ name: e.target.value })}
          onBlur={onCommit}
          className="w-full rounded border border-line field px-2 py-1 text-xs text-main"
        />
        {layer.type === "image" && (
          <div className="pt-1">
            <Btn variant="primary" className="w-full justify-center text-center py-1.5" onClick={() => onAction("fitCanvas")}>
              ⤢ Fit image to canvas (fill screen)
            </Btn>
          </div>
        )}
      </Section>

      {layer.type === "text" && (
        <Section title="Content">
          <textarea
            ref={textEditRef}
            value={layer.text}
            rows={3}
            onChange={(e) => {
              const t = { ...layer, text: e.target.value } as TextLayer;
              const m = measureText(t);
              set({ text: e.target.value, width: Math.max(m.width, 20), height: Math.max(m.height, 10) } as Partial<TextLayer>);
            }}
            onBlur={onCommit}
            className="w-full rounded border border-line field px-2 py-1.5 text-sm text-zinc-100"
          />
          <Select
            label="Font"
            value={layer.fontFamily}
            options={FONTS.map((f) => ({ value: f, label: f }))}
            onChange={(v) => {
              const t = { ...layer, fontFamily: v } as TextLayer;
              const m = measureText(t);
              setCommit({ fontFamily: v, width: m.width, height: m.height } as Partial<TextLayer>);
            }}
          />
          <Slider
            label="Size"
            value={layer.fontSize}
            min={8}
            max={400}
            onChange={(v) => {
              const t = { ...layer, fontSize: v } as TextLayer;
              const m = measureText(t);
              set({ fontSize: v, width: m.width, height: m.height } as Partial<TextLayer>);
            }}
            onCommit={onCommit}
          />
          <div className="flex items-center gap-1">
            <IconBtn active={layer.fontWeight >= 700} title="Bold" onClick={() => setCommit({ fontWeight: layer.fontWeight >= 700 ? 400 : 800 } as Partial<TextLayer>)}>
              <b>B</b>
            </IconBtn>
            <IconBtn active={layer.italic} title="Italic" onClick={() => setCommit({ italic: !layer.italic } as Partial<TextLayer>)}>
              <i>I</i>
            </IconBtn>
            <IconBtn active={layer.uppercase} title="Uppercase" onClick={() => setCommit({ uppercase: !layer.uppercase } as Partial<TextLayer>)}>
              AA
            </IconBtn>
            <span className="mx-1 h-5 w-px bg-white/10" />
            {(["left", "center", "right"] as const).map((a) => (
              <IconBtn key={a} active={layer.align === a} title={a} onClick={() => setCommit({ align: a } as Partial<TextLayer>)}>
                {a === "left" ? "⇤" : a === "center" ? "☰" : "⇥"}
              </IconBtn>
            ))}
          </div>
          <Slider label="Weight" value={layer.fontWeight} min={100} max={900} step={100} onChange={(v) => set({ fontWeight: v } as Partial<TextLayer>)} onCommit={onCommit} />
          <Slider label="Line height" value={layer.lineHeight} min={0.6} max={3} step={0.05} onChange={(v) => set({ lineHeight: v } as Partial<TextLayer>)} onCommit={onCommit} />
          <Slider label="Letter spacing" value={layer.letterSpacing} min={-10} max={60} onChange={(v) => set({ letterSpacing: v } as Partial<TextLayer>)} onCommit={onCommit} />
          <ColorInput label="Color" value={layer.color} onChange={(v) => setCommit({ color: v } as Partial<TextLayer>)} />
          <Toggle label="Gradient fill" value={layer.gradient.enabled} onChange={(v) => setCommit({ gradient: { ...layer.gradient, enabled: v } } as Partial<TextLayer>)} />
          {layer.gradient.enabled && (
            <>
              <ColorInput label="From" value={layer.gradient.from} onChange={(v) => setCommit({ gradient: { ...layer.gradient, from: v } } as Partial<TextLayer>)} />
              <ColorInput label="To" value={layer.gradient.to} onChange={(v) => setCommit({ gradient: { ...layer.gradient, to: v } } as Partial<TextLayer>)} />
              <Slider label="Angle" value={layer.gradient.angle} min={0} max={360} onChange={(v) => set({ gradient: { ...layer.gradient, angle: v } } as Partial<TextLayer>)} onCommit={onCommit} />
            </>
          )}
          <Toggle label="Outline" value={layer.stroke.enabled} onChange={(v) => setCommit({ stroke: { ...layer.stroke, enabled: v } } as Partial<TextLayer>)} />
          {layer.stroke.enabled && (
            <>
              <ColorInput label="Outline color" value={layer.stroke.color} onChange={(v) => setCommit({ stroke: { ...layer.stroke, color: v } } as Partial<TextLayer>)} />
              <Slider label="Outline width" value={layer.stroke.width} min={0} max={40} onChange={(v) => set({ stroke: { ...layer.stroke, width: v } } as Partial<TextLayer>)} onCommit={onCommit} />
            </>
          )}
        </Section>
      )}

      {layer.type === "shape" && (
        <Section title="Fill & stroke">
          <ColorInput label="Fill" value={layer.fill} onChange={(v) => setCommit({ fill: v } as Partial<ShapeLayer>)} />
          <Toggle label="Gradient fill" value={layer.gradient.enabled} onChange={(v) => setCommit({ gradient: { ...layer.gradient, enabled: v } } as Partial<ShapeLayer>)} />
          {layer.gradient.enabled && (
            <>
              <ColorInput label="From" value={layer.gradient.from} onChange={(v) => setCommit({ gradient: { ...layer.gradient, from: v } } as Partial<ShapeLayer>)} />
              <ColorInput label="To" value={layer.gradient.to} onChange={(v) => setCommit({ gradient: { ...layer.gradient, to: v } } as Partial<ShapeLayer>)} />
              <Slider label="Angle" value={layer.gradient.angle} min={0} max={360} onChange={(v) => set({ gradient: { ...layer.gradient, angle: v } } as Partial<ShapeLayer>)} onCommit={onCommit} />
            </>
          )}
          <Toggle label="Stroke" value={layer.stroke.enabled} onChange={(v) => setCommit({ stroke: { ...layer.stroke, enabled: v } } as Partial<ShapeLayer>)} />
          {layer.stroke.enabled && (
            <>
              <ColorInput label="Stroke color" value={layer.stroke.color} onChange={(v) => setCommit({ stroke: { ...layer.stroke, color: v } } as Partial<ShapeLayer>)} />
              <Slider label="Stroke width" value={layer.stroke.width} min={0} max={60} onChange={(v) => set({ stroke: { ...layer.stroke, width: v } } as Partial<ShapeLayer>)} onCommit={onCommit} />
            </>
          )}
          {layer.shape === "rect" && <Slider label="Corner radius" value={layer.cornerRadius} min={0} max={500} onChange={(v) => set({ cornerRadius: v })} onCommit={onCommit} />}
        </Section>
      )}

      {layer.type === "path" && (
        <Section title="Path">
          <Select
            label="Type"
            value={layer.pathType}
            options={[
              { value: "freehand", label: "Freehand" },
              { value: "line", label: "Line" },
              { value: "arrow", label: "Arrow" },
              { value: "polygon", label: "Polygon" },
            ]}
            onChange={(v) => setCommit({ pathType: v } as Partial<PathLayer>)}
          />
          <ColorInput label="Stroke" value={layer.stroke.color} onChange={(v) => setCommit({ stroke: { ...layer.stroke, color: v } } as Partial<PathLayer>)} />
          <Slider label="Stroke width" value={layer.stroke.width} min={1} max={120} onChange={(v) => set({ stroke: { ...layer.stroke, width: v } } as Partial<PathLayer>)} onCommit={onCommit} suffix="px" />
          <Toggle label="Show stroke" value={layer.stroke.enabled} onChange={(v) => setCommit({ stroke: { ...layer.stroke, enabled: v } } as Partial<PathLayer>)} />
          <Toggle label="Fill shape" value={layer.filled} onChange={(v) => setCommit({ filled: v } as Partial<PathLayer>)} />
          {layer.filled && <ColorInput label="Fill colour" value={layer.fill} onChange={(v) => setCommit({ fill: v } as Partial<PathLayer>)} />}
          <Toggle label="Close path" value={layer.closed} onChange={(v) => setCommit({ closed: v } as Partial<PathLayer>)} />
          <Toggle label="Smooth curve" value={layer.smooth} onChange={(v) => setCommit({ smooth: v } as Partial<PathLayer>)} />
          <p className="text-[10px] text-zinc-500">{layer.points.length} points</p>
        </Section>
      )}

      {layer.type === "image" && (
        <>
          <Section title="Filter presets">
            <div className="grid grid-cols-3 gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => setCommit({ filters: { ...defaultFilters, ...p.filters } })}
                  className="rounded-md border border-line field py-1.5 text-[11px] text-muted hover:border-violet-500/50"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </Section>
          <Section title="Crop" right={layer.crop && <Btn onClick={() => setCommit({ crop: null } as Partial<ImageLayer>)}>Reset</Btn>}>
            {(() => {
              const c = layer.crop ?? { x: 0, y: 0, w: 1, h: 1 };
              const upd = (p: Partial<typeof c>) => {
                const n = { ...c, ...p };
                n.w = Math.min(n.w, 1 - n.x);
                n.h = Math.min(n.h, 1 - n.y);
                set({ crop: n } as Partial<ImageLayer>);
              };
              return (
                <>
                  <Slider label="Left" value={c.x * 100} min={0} max={90} onChange={(v) => upd({ x: v / 100 })} onCommit={onCommit} suffix="%" />
                  <Slider label="Top" value={c.y * 100} min={0} max={90} onChange={(v) => upd({ y: v / 100 })} onCommit={onCommit} suffix="%" />
                  <Slider label="Width" value={c.w * 100} min={5} max={100} onChange={(v) => upd({ w: v / 100 })} onCommit={onCommit} suffix="%" />
                  <Slider label="Height" value={c.h * 100} min={5} max={100} onChange={(v) => upd({ h: v / 100 })} onCommit={onCommit} suffix="%" />
                  <Slider label="Corner radius" value={layer.cornerRadius} min={0} max={500} onChange={(v) => set({ cornerRadius: v })} onCommit={onCommit} />
                </>
              );
            })()}
          </Section>
          <Section title="Pro effects (destructive)">
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  ["sharpen", "Sharpen"],
                  ["vignette", "Vignette"],
                  ["noise", "Film grain"],
                  ["pixelate", "Pixelate"],
                  ["posterize", "Posterize"],
                  ["emboss", "Emboss"],
                  ["removeWhiteBg", "Remove white BG"],
                ] as const
              ).map(([k, label]) => (
                <Btn key={k} disabled={busy !== null} onClick={() => applyEffect(k)}>
                  {busy === k ? "Processing…" : label}
                </Btn>
              ))}
            </div>
          </Section>
        </>
      )}

      <Section title="Adjustments" right={<Btn onClick={() => setCommit({ filters: { ...defaultFilters } })}>Reset</Btn>}>
        <Slider label="Brightness" value={layer.filters.brightness} min={0} max={200} onChange={(v) => set({ filters: { ...layer.filters, brightness: v } })} onCommit={onCommit} suffix="%" />
        <Slider label="Contrast" value={layer.filters.contrast} min={0} max={200} onChange={(v) => set({ filters: { ...layer.filters, contrast: v } })} onCommit={onCommit} suffix="%" />
        <Slider label="Saturation" value={layer.filters.saturate} min={0} max={300} onChange={(v) => set({ filters: { ...layer.filters, saturate: v } })} onCommit={onCommit} suffix="%" />
        <Slider label="Hue" value={layer.filters.hue} min={0} max={360} onChange={(v) => set({ filters: { ...layer.filters, hue: v } })} onCommit={onCommit} suffix="°" />
        <Slider label="Blur" value={layer.filters.blur} min={0} max={50} step={0.5} onChange={(v) => set({ filters: { ...layer.filters, blur: v } })} onCommit={onCommit} suffix="px" />
        <Slider label="Grayscale" value={layer.filters.grayscale} min={0} max={100} onChange={(v) => set({ filters: { ...layer.filters, grayscale: v } })} onCommit={onCommit} suffix="%" />
        <Slider label="Sepia" value={layer.filters.sepia} min={0} max={100} onChange={(v) => set({ filters: { ...layer.filters, sepia: v } })} onCommit={onCommit} suffix="%" />
        <Slider label="Invert" value={layer.filters.invert} min={0} max={100} onChange={(v) => set({ filters: { ...layer.filters, invert: v } })} onCommit={onCommit} suffix="%" />
      </Section>

      <Section title="Shadow">
        <Toggle label="Drop shadow" value={layer.shadow.enabled} onChange={(v) => setCommit({ shadow: { ...layer.shadow, enabled: v } })} />
        {layer.shadow.enabled && (
          <>
            <ColorInput label="Color" value={layer.shadow.color} onChange={(v) => setCommit({ shadow: { ...layer.shadow, color: v } })} />
            <Slider label="Blur" value={layer.shadow.blur} min={0} max={200} onChange={(v) => set({ shadow: { ...layer.shadow, blur: v } })} onCommit={onCommit} />
            <Slider label="Offset X" value={layer.shadow.x} min={-200} max={200} onChange={(v) => set({ shadow: { ...layer.shadow, x: v } })} onCommit={onCommit} />
            <Slider label="Offset Y" value={layer.shadow.y} min={-200} max={200} onChange={(v) => set({ shadow: { ...layer.shadow, y: v } })} onCommit={onCommit} />
          </>
        )}
      </Section>

      <Section title="Transform">
        <div className="grid grid-cols-2 gap-2">
          <NumberInput label="X" value={layer.x} onChange={(v) => setCommit({ x: v })} />
          <NumberInput label="Y" value={layer.y} onChange={(v) => setCommit({ y: v })} />
          <NumberInput label="W" value={layer.width} onChange={(v) => setCommit({ width: Math.max(1, v) })} />
          <NumberInput label="H" value={layer.height} onChange={(v) => setCommit({ height: Math.max(1, v) })} />
        </div>
        <Slider label="Rotation" value={layer.rotation} min={0} max={360} onChange={(v) => set({ rotation: v })} onCommit={onCommit} suffix="°" />
        <Slider label="Opacity" value={Math.round(layer.opacity * 100)} min={0} max={100} onChange={(v) => set({ opacity: v / 100 })} onCommit={onCommit} suffix="%" />
        <Select label="Blend mode" value={layer.blend} options={BLENDS.map((b) => ({ value: b, label: b }))} onChange={(v) => setCommit({ blend: v })} />
        <div className="flex flex-wrap gap-1">
          <IconBtn title="Flip horizontal" active={layer.flipX} onClick={() => setCommit({ flipX: !layer.flipX })}>⇋</IconBtn>
          <IconBtn title="Flip vertical" active={layer.flipY} onClick={() => setCommit({ flipY: !layer.flipY })}>⇅</IconBtn>
          <IconBtn title="Rotate 90°" onClick={() => setCommit({ rotation: (layer.rotation + 90) % 360 })}>↻</IconBtn>
          <IconBtn title="Fit to canvas" onClick={() => onAction("fitCanvas")}>⤢</IconBtn>
        </div>
      </Section>

      <Section title="Align to canvas">
        <div className="flex flex-wrap gap-1">
          <IconBtn title="Align left" onClick={() => onAction("alignL")}>⇤</IconBtn>
          <IconBtn title="Center horizontally" onClick={() => onAction("centerH")}>↔</IconBtn>
          <IconBtn title="Align right" onClick={() => onAction("alignR")}>⇥</IconBtn>
          <IconBtn title="Align top" onClick={() => onAction("alignT")}>⤒</IconBtn>
          <IconBtn title="Center vertically" onClick={() => onAction("centerV")}>↕</IconBtn>
          <IconBtn title="Align bottom" onClick={() => onAction("alignB")}>⤓</IconBtn>
        </div>
        <div className="flex flex-wrap gap-1">
          <Btn onClick={() => onAction("front")}>To front</Btn>
          <Btn onClick={() => onAction("forward")}>Forward</Btn>
          <Btn onClick={() => onAction("backward")}>Backward</Btn>
          <Btn onClick={() => onAction("back")}>To back</Btn>
        </div>
        <p className="text-[10px] text-faint">
          Canvas {doc.width}×{doc.height}
        </p>
      </Section>
    </div>
  );
}

/* ───────────────────────────── Layers ───────────────────────────── */

export function LayersPanel({
  layers,
  selectedId,
  onSelect,
  onChange,
  onReorder,
}: {
  layers: Layer[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<Layer>) => void;
  onReorder: (from: number, to: number) => void;
}) {
  const dragIdx = useRef<number | null>(null);
  const reversed = [...layers].reverse();
  return (
    <div className="max-h-64 overflow-y-auto border-t border-line">
      <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Layers ({layers.length})</div>
      {layers.length === 0 && <p className="px-4 pb-3 text-xs text-faint">No layers yet.</p>}
      {reversed.map((l, ri) => {
        const idx = layers.length - 1 - ri;
        return (
          <div
            key={l.id}
            draggable
            onDragStart={() => (dragIdx.current = idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIdx.current !== null && dragIdx.current !== idx) onReorder(dragIdx.current, idx);
              dragIdx.current = null;
            }}
            onClick={() => onSelect(l.id)}
            className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs ${
              selectedId === l.id ? "bg-violet-500/15 text-violet-200" : "text-muted hover:bg-[var(--hover)]"
            }`}
          >
            <span className="w-5 text-center text-sm">{l.type === "image" ? "🖼" : l.type === "text" ? "T" : l.type === "path" ? "✎" : "◆"}</span>
            <span className="flex-1 truncate">{l.type === "text" ? l.text.slice(0, 24) || "Text" : l.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChange(l.id, { visible: !l.visible });
              }}
              className="opacity-60 hover:opacity-100"
              title="Toggle visibility"
            >
              {l.visible ? "👁" : "◌"}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChange(l.id, { locked: !l.locked });
              }}
              className="opacity-60 hover:opacity-100"
              title="Toggle lock"
            >
              {l.locked ? "🔒" : "🔓"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
