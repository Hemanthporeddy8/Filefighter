"use client";
import { TOOL_INFO, BRUSH_TOOLS, type Tool } from "./tools";
import { Section, Slider, ColorInput, Btn, Toggle } from "./ui";

const PRESET_ASPECTS: { label: string; w: number; h: number }[] = [
  { label: "1:1", w: 1, h: 1 },
  { label: "4:5", w: 4, h: 5 },
  { label: "9:16", w: 9, h: 16 },
  { label: "16:9", w: 16, h: 9 },
  { label: "3:2", w: 3, h: 2 },
];

export default function ToolsPanel({
  tool,
  setTool,
  brushSize,
  setBrushSize,
  brushStrength,
  setBrushStrength,
  strokeColor,
  setStrokeColor,
  strokeWidth,
  setStrokeWidth,
  smooth,
  setSmooth,
  sampledColor,
  cropRect,
  onApplyCrop,
  onRotate,
  onFinishPen,
  onCancelPen,
  penActive,
  busy,
  doc,
}: {
  tool: Tool;
  setTool: (t: Tool) => void;
  brushSize: number;
  setBrushSize: (v: number) => void;
  brushStrength: number;
  setBrushStrength: (v: number) => void;
  strokeColor: string;
  setStrokeColor: (v: string) => void;
  strokeWidth: number;
  setStrokeWidth: (v: number) => void;
  smooth: boolean;
  setSmooth: (v: boolean) => void;
  sampledColor: string | null;
  cropRect: { x: number; y: number; w: number; h: number } | null;
  onApplyCrop: () => void;
  onRotate: (deg: number) => void;
  onFinishPen: () => void;
  onCancelPen: () => void;
  penActive: boolean;
  busy: string | null;
  doc: { width: number; height: number };
}) {
  const info = TOOL_INFO.find((t) => t.id === tool);
  const isBrush = BRUSH_TOOLS.includes(tool);
  const isShapeTool = tool === "draw" || tool === "line" || tool === "arrow" || tool === "pen";

  return (
    <div className="flex-1 overflow-y-auto">
      <Section title="Tools">
        <div className="grid grid-cols-3 gap-1">
          {TOOL_INFO.map((t) => (
            <button
              key={t.id}
              title={t.hint}
              onClick={() => setTool(t.id)}
              className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border transition ${
                tool === t.id
                  ? "border-violet-500 bg-violet-500/20 text-violet-200"
                  : "border-line field/60 text-muted hover:bg-[var(--hover)]"
              }`}
            >
              <span className="text-base leading-none">{t.icon}</span>
              <span className="text-[9px] leading-none">{t.label}</span>
            </button>
          ))}
        </div>
        <p className="rounded-md bg-violet-500/10 px-2 py-1.5 text-[11px] leading-snug text-violet-200">{info?.hint}</p>
        {info?.needsImage && (
          <p className="text-[11px] text-amber-300/80">Requires a selected image layer.</p>
        )}
        {busy && <p className="text-[11px] text-fuchsia-300">⏳ {busy}…</p>}
      </Section>

      {(isBrush || tool === "draw") && (
        <Section title="Brush">
          <Slider label="Size" value={brushSize} min={4} max={400} onChange={setBrushSize} suffix="px" />
          {isBrush && <Slider label="Strength" value={Math.round(brushStrength * 100)} min={5} max={100} onChange={(v) => setBrushStrength(v / 100)} suffix="%" />}
          {tool === "draw" && (
            <>
              <ColorInput label="Colour" value={strokeColor} onChange={setStrokeColor} />
              <Slider label="Width" value={strokeWidth} min={1} max={120} onChange={setStrokeWidth} suffix="px" />
              <Toggle label="Smooth curve" value={smooth} onChange={setSmooth} />
            </>
          )}
        </Section>
      )}

      {isShapeTool && (
        <Section title="Stroke">
          <ColorInput label="Colour" value={strokeColor} onChange={setStrokeColor} />
          <Slider label="Width" value={strokeWidth} min={1} max={120} onChange={setStrokeWidth} suffix="px" />
          {tool === "draw" && <Toggle label="Smooth curve" value={smooth} onChange={setSmooth} />}
          {tool === "pen" && (
            <div className="flex gap-1.5 pt-1">
              <Btn variant="primary" className="flex-1" onClick={onFinishPen} disabled={!penActive}>
                Finish path
              </Btn>
              <Btn className="flex-1" onClick={onCancelPen} disabled={!penActive}>
                Cancel
              </Btn>
            </div>
          )}
        </Section>
      )}

      {tool === "crop" && (
        <Section title="Crop">
          <p className="text-[11px] text-zinc-500">Drag a rectangle on the canvas. Cropping flattens all layers into one image.</p>
          <Btn variant="primary" className="w-full py-2" onClick={onApplyCrop} disabled={!cropRect || cropRect.w < 8}>
            Apply crop
          </Btn>
          {cropRect && cropRect.w > 1 && (
            <p className="text-center text-[11px] text-zinc-400">
              {Math.round(cropRect.w)} × {Math.round(cropRect.h)} px
            </p>
          )}
          <div className="flex flex-wrap gap-1 pt-1">
            {PRESET_ASPECTS.map((a) => (
              <Btn
                key={a.label}
                onClick={() => {
                  const target = a.w / a.h;
                  const byWidth = doc.width / doc.height > target;
                  const w = byWidth ? doc.height * target : doc.width;
                  const h = byWidth ? doc.height : doc.width / target;
                  setTool("crop");
                  // store the preset rect via a custom event consumed by the hook
                  window.dispatchEvent(new CustomEvent("lumina:crop-preset", { detail: { x: (doc.width - w) / 2, y: (doc.height - h) / 2, w, h } }));
                }}
              >
                {a.label}
              </Btn>
            ))}
          </div>
        </Section>
      )}

      {tool === "straighten" && (
        <Section title="Rotate canvas">
          <p className="text-[11px] text-zinc-500">Rotates every layer around the canvas centre.</p>
          <div className="flex flex-wrap gap-1">
            {[-15, -5, -1, 1, 5, 15, 90, -90, 180].map((d) => (
              <Btn key={d} onClick={() => onRotate(d)}>
                {d}°
              </Btn>
            ))}
          </div>
        </Section>
      )}

      {tool === "eyedropper" && (
        <Section title="Eyedropper">
          <p className="text-[11px] text-zinc-500">Click the canvas to sample a colour.</p>
          {sampledColor ? (
            <div className="flex items-center gap-2">
              <span className="h-9 w-9 rounded border border-white/20" style={{ background: sampledColor }} />
              <div>
                <code className="text-xs text-main">{sampledColor}</code>
                <div className="text-[10px] text-zinc-500">Sampled colour</div>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-faint">No sample yet.</p>
          )}
        </Section>
      )}

      {tool === "clone" && (
        <Section title="Clone stamp">
          <p className="text-[11px] text-zinc-500">
            Hold <kbd className="rounded bg-white/10 px-1">Alt</kbd> and click to set the source point, then paint to clone.
          </p>
        </Section>
      )}
    </div>
  );
}
