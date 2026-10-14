import { ANIMATIONS, FONTS, SPEED_PRESETS } from "../data/presets";
import type { EditorApi } from "../editor/useEditor";
import type { BlendMode, FitMode } from "../types";
import { Accordion, ColorField, Segmented, SliderRow } from "./ui";

export function Inspector({ editor }: { editor: EditorApi }) {
  const { primary, state } = editor;
  if (!primary) {
    return (
      <aside className="flex w-[300px] shrink-0 flex-col border-l border-zinc-800/80 bg-[#101014]">
        <div className="border-b border-zinc-800 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Project
        </div>
        <div className="space-y-3 p-3">
          <ColorField
            label="Background"
            value={state.project.background}
            onChange={(v) => editor.setState((s) => ({ ...s, project: { ...s.project, background: v } }))}
          />
          <div className="text-[11px] text-zinc-500">
            {state.project.width}×{state.project.height} · {state.project.fps} fps · {state.clips.length} clips ·{" "}
            {state.assets.length} assets
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-500">
            Select a clip on the timeline to edit transform, color, audio, animation, and effects. All processing happens
            in your browser.
          </p>
        </div>
      </aside>
    );
  }

  const set = (p: Parameters<typeof editor.updateSelected>[0]) => {
    editor.setState((s) => ({
      ...s,
      clips: s.clips.map((c) => (s.selectedIds.includes(c.id) ? { ...c, ...p } : c)),
    }));
  };

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-l border-zinc-800/80 bg-[#101014]">
      <div className="border-b border-zinc-800 px-3 py-2">
        <div className="truncate text-xs font-medium text-zinc-200">{primary.name}</div>
        <div className="text-[10px] uppercase tracking-wider text-zinc-500">{primary.kind}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto nx-scroll">
        {(primary.kind === "video" || primary.kind === "image" || primary.kind === "sticker" || primary.kind === "shape" || primary.kind === "text") && (
          <Accordion title="Transform">
            <SliderRow label="Position X" value={primary.x} min={-900} max={900} step={1} onChange={(x) => set({ x })} />
            <SliderRow label="Position Y" value={primary.y} min={-900} max={900} step={1} onChange={(y) => set({ y })} />
            <SliderRow label="Scale" value={primary.scale} min={0.05} max={4} step={0.01} onChange={(scale) => set({ scale })} decimals={2} />
            <SliderRow label="Rotate" value={primary.rotation} min={-180} max={180} step={1} onChange={(rotation) => set({ rotation })} suffix="°" />
            <SliderRow label="Opacity" value={primary.opacity} min={0} max={1} step={0.01} onChange={(opacity) => set({ opacity })} decimals={2} />
            <div className="mt-2 flex gap-1">
              <button type="button" className="flex-1 rounded-md bg-zinc-900 py-1 text-[10px] ring-1 ring-zinc-800" onClick={() => set({ flipH: !primary.flipH })}>
                Flip H
              </button>
              <button type="button" className="flex-1 rounded-md bg-zinc-900 py-1 text-[10px] ring-1 ring-zinc-800" onClick={() => set({ flipV: !primary.flipV })}>
                Flip V
              </button>
              <button type="button" className="flex-1 rounded-md bg-zinc-900 py-1 text-[10px] ring-1 ring-zinc-800" onClick={() => set({ x: 0, y: 0, scale: 1, rotation: 0 })}>
                Reset
              </button>
            </div>
            {(primary.kind === "video" || primary.kind === "image") && (
              <div className="mt-2">
                <Segmented
                  value={primary.fit}
                  options={[
                    { id: "contain" as FitMode, label: "Fit" },
                    { id: "cover" as FitMode, label: "Fill" },
                    { id: "stretch" as FitMode, label: "Stretch" },
                  ]}
                  onChange={(fit) => set({ fit })}
                />
              </div>
            )}
            <div className="mt-2 flex gap-1">
              {(["x", "y", "scale", "rotation", "opacity"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => editor.addKeyframe(p)}
                  className="flex-1 rounded bg-zinc-900 py-1 text-[9px] uppercase text-zinc-400 ring-1 ring-zinc-800 hover:text-emerald-300"
                >
                  {p} ◆
                </button>
              ))}
            </div>
          </Accordion>
        )}

        {primary.kind === "text" && (
          <Accordion title="Text">
            <textarea
              value={primary.text}
              onChange={(e) => set({ text: e.target.value })}
              rows={3}
              className="mb-2 w-full rounded-md bg-zinc-900 p-2 text-xs text-zinc-100 ring-1 ring-zinc-800 outline-none"
            />
            <select
              value={primary.fontFamily}
              onChange={(e) => set({ fontFamily: e.target.value })}
              className="mb-2 w-full rounded-md bg-zinc-900 px-2 py-1 text-xs ring-1 ring-zinc-800"
            >
              {FONTS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
            <SliderRow label="Size" value={primary.fontSize} min={12} max={220} step={1} onChange={(fontSize) => set({ fontSize })} />
            <SliderRow label="Weight" value={primary.fontWeight} min={300} max={900} step={100} onChange={(fontWeight) => set({ fontWeight })} />
            <SliderRow label="Stroke" value={primary.strokeWidth} min={0} max={16} step={1} onChange={(strokeWidth) => set({ strokeWidth })} />
            <ColorField label="Fill" value={primary.color} onChange={(color) => set({ color })} />
            <ColorField label="Stroke" value={primary.strokeColor} onChange={(strokeColor) => set({ strokeColor })} />
            <ColorField label="Box" value={primary.backgroundColor.slice(0, 7)} onChange={(backgroundColor) => set({ backgroundColor })} />
            <div className="mt-1 flex gap-1">
              {(["left", "center", "right"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => set({ align: a })}
                  className={`flex-1 rounded py-1 text-[10px] ${primary.align === a ? "bg-emerald-400/20 text-emerald-300" : "bg-zinc-900 text-zinc-400"}`}
                >
                  {a}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-1">
              <button type="button" onClick={() => set({ italic: !primary.italic })} className="flex-1 rounded bg-zinc-900 py-1 text-[10px] ring-1 ring-zinc-800">
                Italic
              </button>
              <button type="button" onClick={() => set({ underline: !primary.underline })} className="flex-1 rounded bg-zinc-900 py-1 text-[10px] ring-1 ring-zinc-800">
                Underline
              </button>
              <button type="button" onClick={() => set({ shadow: !primary.shadow })} className="flex-1 rounded bg-zinc-900 py-1 text-[10px] ring-1 ring-zinc-800">
                Shadow
              </button>
            </div>
          </Accordion>
        )}

        {primary.kind === "shape" && (
          <Accordion title="Shape">
            <ColorField label="Fill" value={primary.fill} onChange={(fill) => set({ fill })} />
            <ColorField label="Stroke" value={primary.stroke} onChange={(stroke) => set({ stroke })} />
            <SliderRow label="Stroke W" value={primary.shapeStroke} min={0} max={20} step={1} onChange={(shapeStroke) => set({ shapeStroke })} />
          </Accordion>
        )}

        {(primary.kind === "video" || primary.kind === "image") && (
          <Accordion title="Color">
            <SliderRow label="Bright" value={primary.brightness} min={20} max={200} step={1} onChange={(brightness) => set({ brightness })} />
            <SliderRow label="Contrast" value={primary.contrast} min={20} max={200} step={1} onChange={(contrast) => set({ contrast })} />
            <SliderRow label="Saturate" value={primary.saturation} min={0} max={250} step={1} onChange={(saturation) => set({ saturation })} />
            <SliderRow label="Hue" value={primary.hue} min={-180} max={180} step={1} onChange={(hue) => set({ hue })} />
            <SliderRow label="Temp" value={primary.temperature} min={-50} max={50} step={1} onChange={(temperature) => set({ temperature })} />
            <SliderRow label="Tint" value={primary.tint} min={-50} max={50} step={1} onChange={(tint) => set({ tint })} />
            <SliderRow label="Vignette" value={primary.vignette} min={0} max={1} step={0.01} onChange={(vignette) => set({ vignette })} decimals={2} />
            <SliderRow label="Grain" value={primary.grain} min={0} max={1} step={0.01} onChange={(grain) => set({ grain })} decimals={2} />
          </Accordion>
        )}

        {(primary.kind === "video" || primary.kind === "image") && (
          <Accordion title="Effects" defaultOpen={false}>
            <SliderRow label="Blur" value={primary.blur} min={0} max={24} step={0.5} onChange={(blur) => set({ blur })} />
            <SliderRow label="Sharpen" value={primary.sharpen} min={0} max={80} step={1} onChange={(sharpen) => set({ sharpen })} />
            <SliderRow label="Glow" value={primary.glow} min={0} max={1} step={0.01} onChange={(glow) => set({ glow })} decimals={2} />
            <SliderRow label="Pixelate" value={primary.pixelate} min={0} max={40} step={1} onChange={(pixelate) => set({ pixelate })} />
            <SliderRow label="Leak" value={primary.lightLeak} min={0} max={1} step={0.01} onChange={(lightLeak) => set({ lightLeak })} decimals={2} />
            <div className="mt-2 flex flex-wrap gap-1">
              <Toggle on={primary.chromaKey} label="Chroma" onClick={() => set({ chromaKey: !primary.chromaKey })} />
              <Toggle on={primary.duotone} label="Duotone" onClick={() => set({ duotone: !primary.duotone })} />
              <Toggle on={primary.invert} label="Invert" onClick={() => set({ invert: !primary.invert })} />
              <Toggle on={primary.mirror} label="Mirror" onClick={() => set({ mirror: !primary.mirror })} />
            </div>
            {primary.chromaKey && (
              <>
                <ColorField label="Key" value={primary.chromaColor} onChange={(chromaColor) => set({ chromaColor })} />
                <SliderRow label="Similar" value={primary.chromaSim} min={0.05} max={0.8} step={0.01} onChange={(chromaSim) => set({ chromaSim })} decimals={2} />
              </>
            )}
            <div className="mt-2">
              <div className="mb-1 text-[11px] text-zinc-400">Mask</div>
              <Segmented
                value={primary.mask}
                options={[
                  { id: "none", label: "None" },
                  { id: "rect", label: "Rect" },
                  { id: "ellipse", label: "Oval" },
                ]}
                onChange={(mask) => set({ mask })}
              />
            </div>
            <div className="mt-2">
              <div className="mb-1 text-[11px] text-zinc-400">Blend</div>
              <select
                value={primary.blend}
                onChange={(e) => set({ blend: e.target.value as BlendMode })}
                className="w-full rounded-md bg-zinc-900 px-2 py-1 text-xs ring-1 ring-zinc-800"
              >
                {["source-over", "multiply", "screen", "overlay", "lighten", "darken", "plus-lighter"].map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </div>
          </Accordion>
        )}

        {(primary.kind === "video" || primary.kind === "audio") && (
          <Accordion title="Audio">
            <SliderRow label="Volume" value={primary.volume} min={0} max={2} step={0.01} onChange={(volume) => set({ volume })} decimals={2} />
            <SliderRow label="Fade in" value={primary.fadeIn} min={0} max={3} step={0.05} onChange={(fadeIn) => set({ fadeIn })} decimals={2} suffix="s" />
            <SliderRow label="Fade out" value={primary.fadeOut} min={0} max={3} step={0.05} onChange={(fadeOut) => set({ fadeOut })} decimals={2} suffix="s" />
            {primary.kind === "video" && (
              <button type="button" onClick={editor.extractAudio} className="mt-2 w-full rounded-md bg-zinc-900 py-1.5 text-[11px] text-zinc-300 ring-1 ring-zinc-800">
                Extract audio to track
              </button>
            )}
          </Accordion>
        )}

        {(primary.kind === "video" || primary.kind === "audio" || primary.kind === "image") && (
          <Accordion title="Speed" defaultOpen={false}>
            <div className="mb-2 flex flex-wrap gap-1">
              {SPEED_PRESETS.map((sp) => (
                <button
                  key={sp}
                  type="button"
                  onClick={() => editor.setSpeed(sp)}
                  className={`rounded px-2 py-1 text-[10px] ${primary.speed === sp ? "bg-emerald-400/20 text-emerald-300" : "bg-zinc-900 text-zinc-400"}`}
                >
                  {sp}x
                </button>
              ))}
            </div>
            <SliderRow label="Speed" value={primary.speed} min={0.1} max={4} step={0.05} onChange={(speed) => editor.setSpeed(speed)} decimals={2} suffix="x" />
            <Toggle on={primary.reverse} label="Reverse" onClick={() => set({ reverse: !primary.reverse })} />
          </Accordion>
        )}

        <Accordion title="Animation" defaultOpen={false}>
          <div className="mb-1 text-[11px] text-zinc-400">In</div>
          <div className="mb-2 flex flex-wrap gap-1">
            {ANIMATIONS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => set({ animationIn: a.id })}
                className={`rounded px-2 py-1 text-[10px] ${primary.animationIn === a.id ? "bg-emerald-400/20 text-emerald-300" : "bg-zinc-900 text-zinc-400"}`}
              >
                {a.name}
              </button>
            ))}
          </div>
          <SliderRow label="Anim dur" value={primary.animDur} min={0.1} max={2} step={0.05} onChange={(animDur) => set({ animDur })} decimals={2} suffix="s" />
          <div className="mt-2 mb-1 text-[11px] text-zinc-400">Out</div>
          <div className="flex flex-wrap gap-1">
            {["none", "fade", "slide-up", "pop", "zoom"].map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => set({ animationOut: a as typeof primary.animationOut })}
                className={`rounded px-2 py-1 text-[10px] ${primary.animationOut === a ? "bg-emerald-400/20 text-emerald-300" : "bg-zinc-900 text-zinc-400"}`}
              >
                {a}
              </button>
            ))}
          </div>
        </Accordion>
      </div>
    </aside>
  );
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-[10px] ring-1 ${on ? "bg-emerald-400/20 text-emerald-300 ring-emerald-400/30" : "bg-zinc-900 text-zinc-400 ring-zinc-800"}`}
    >
      {label}
    </button>
  );
}
