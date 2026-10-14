import { useCallback, useEffect, useRef, useState } from "react";
import type { Doc, ImageLayer, Layer, PathLayer } from "@/lib/editor/types";
import { baseLayer } from "@/lib/editor/types";
import { makePath } from "./pathFactory";

export type Tool =
  | "select"
  | "crop"
  | "straighten"
  | "erase"
  | "clone"
  | "heal"
  | "blur"
  | "sharpen"
  | "dodge"
  | "burn"
  | "draw"
  | "line"
  | "arrow"
  | "pen"
  | "eyedropper";

export const TOOL_INFO: { id: Tool; label: string; icon: string; hint: string; needsImage: boolean }[] = [
  { id: "select", label: "Select", icon: "⬚", hint: "Click a layer to select, drag to move, use handles to resize/rotate.", needsImage: false },
  { id: "crop", label: "Crop", icon: "✂", hint: "Drag a rectangle over the canvas, then press Apply crop.", needsImage: false },
  { id: "straighten", label: "Rotate", icon: "⟳", hint: "Rotate every layer around the canvas centre.", needsImage: false },
  { id: "erase", label: "Erase", icon: "🧽", hint: "Paint on an image to erase pixels (soft brush).", needsImage: true },
  { id: "clone", label: "Clone", icon: "🩹", hint: "Alt+click to set the source, then paint to clone it.", needsImage: true },
  { id: "heal", label: "Heal", icon: "✚", hint: "Paint over blemishes to blend them away.", needsImage: true },
  { id: "blur", label: "Blur", icon: "〰", hint: "Paint to blur areas of the image.", needsImage: true },
  { id: "sharpen", label: "Sharpen", icon: "✦", hint: "Paint to sharpen areas of the image.", needsImage: true },
  { id: "dodge", label: "Dodge", icon: "☀", hint: "Paint to lighten areas.", needsImage: true },
  { id: "burn", label: "Burn", icon: "☾", hint: "Paint to darken areas.", needsImage: true },
  { id: "draw", label: "Draw", icon: "✎", hint: "Freehand brush — creates an editable path layer.", needsImage: false },
  { id: "line", label: "Line", icon: "╱", hint: "Drag to draw a straight line.", needsImage: false },
  { id: "arrow", label: "Arrow", icon: "➤", hint: "Drag to draw an arrow.", needsImage: false },
  { id: "pen", label: "Pen", icon: "✒", hint: "Click to add points, press Enter or double-click to finish.", needsImage: false },
  { id: "eyedropper", label: "Pick", icon: "💧", hint: "Click the canvas to sample a colour.", needsImage: false },
];

export const BRUSH_TOOLS: Tool[] = ["erase", "clone", "heal", "blur", "sharpen", "dodge", "burn"];

export type Preview = {
  stroke: { x: number; y: number }[] | null;
  line: [{ x: number; y: number }, { x: number; y: number }] | null;
  pen: { x: number; y: number }[] | null;
  crop: { x: number; y: number; w: number; h: number } | null;
  cursor: { x: number; y: number } | null;
  cloneSource: { x: number; y: number } | null;
};

type Deps = {
  doc: Doc;
  selected: Layer | null;
  onSelect: (id: string | null) => void;
  onChangeLayer: (id: string, patch: Partial<Layer>, commit?: boolean) => void;
  onAddLayer: (l: Layer) => void;
  onReplaceDoc: (d: Doc) => void;
  onCommit: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  flatten: () => Promise<HTMLCanvasElement>;
};

export function useTools(deps: Deps) {
  const { doc, selected, onSelect, onChangeLayer, onAddLayer, onReplaceDoc, onCommit, canvasRef } = deps;
  const [tool, setToolState] = useState<Tool>("select");
  const [brushSize, setBrushSize] = useState(40);
  const [brushStrength, setBrushStrength] = useState(0.8);
  const [strokeColor, setStrokeColor] = useState("#8b5cf6");
  const [strokeWidth, setStrokeWidth] = useState(8);
  const [smooth, setSmooth] = useState(true);
  const [sampledColor, setSampledColor] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview>({ stroke: null, line: null, pen: null, crop: null, cursor: null, cloneSource: null });
  const [busy, setBusy] = useState<string | null>(null);

  // transient drag state (not rendered directly)
  const drag = useRef<
    | { mode: "brush"; pts: { x: number; y: number }[]; effect: string; cloneOffset?: { x: number; y: number } }
    | { mode: "draw"; pts: { x: number; y: number }[] }
    | { mode: "line"; from: { x: number; y: number }; pathType: "line" | "arrow" }
    | { mode: "crop"; from: { x: number; y: number } }
    | null
  >(null);
  const penRef = useRef<{ x: number; y: number }[] | null>(null);
  const cloneSrcRef = useRef<{ x: number; y: number } | null>(null);
  const targetRef = useRef<ImageLayer | null>(null);

  const setTool = useCallback((t: Tool) => {
    setToolState(t);
    penRef.current = null;
    cloneSrcRef.current = null;
    drag.current = null;
    setPreview({ stroke: null, line: null, pen: null, crop: null, cursor: null, cloneSource: null });
  }, []);

  const toDoc = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const c = canvasRef.current;
      if (!c) return { x: 0, y: 0 };
      const r = c.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * doc.width, y: ((e.clientY - r.top) / r.height) * doc.height };
    },
    [canvasRef, doc.width, doc.height],
  );

  const cancelPen = useCallback(() => {
    penRef.current = null;
    setPreview((p) => ({ ...p, pen: null }));
  }, []);

  /* ── pointer flow ─────────────────────────────────────────── */

  const onPointerDown = (e: React.PointerEvent, hitLayerAt: (x: number, y: number) => Layer | null) => {
    const p = toDoc(e);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    if (tool === "eyedropper") {
      sampleColor(p.x, p.y);
      return;
    }

    if (tool === "pen") {
      const cur = penRef.current;
      if (!cur) {
        penRef.current = [p];
      } else if (e.detail === 2 || (cur.length > 2 && Math.hypot(p.x - cur[0].x, p.y - cur[0].y) < 12)) {
        commitPen(cur, true);
        return;
      } else {
        cur.push(p);
      }
      setPreview((prev) => ({ ...prev, pen: penRef.current ? [...penRef.current] : null }));
      return;
    }

    if (tool === "crop") {
      drag.current = { mode: "crop", from: p };
      setPreview((prev) => ({ ...prev, crop: { x: p.x, y: p.y, w: 0, h: 0 } }));
      return;
    }

    if (tool === "draw") {
      drag.current = { mode: "draw", pts: [p] };
      setPreview((prev) => ({ ...prev, stroke: [p] }));
      return;
    }

    if (tool === "line" || tool === "arrow") {
      drag.current = { mode: "line", from: p, pathType: tool };
      setPreview((prev) => ({ ...prev, line: [p, p] }));
      return;
    }

    if (BRUSH_TOOLS.includes(tool)) {
      const img = selected?.type === "image" ? (selected as ImageLayer) : null;
      if (!img) {
        alert("Select an image layer first — brush tools work on images.");
        return;
      }
      targetRef.current = img;

      if (tool === "clone") {
        if (e.altKey) {
          cloneSrcRef.current = p;
          setPreview((prev) => ({ ...prev, cloneSource: p }));
          return;
        }
        if (!cloneSrcRef.current) {
          alert("Set the clone source first: hold Alt and click the area you want to copy from.");
          return;
        }
      }
      const offset = cloneSrcRef.current ? { x: p.x - cloneSrcRef.current.x, y: p.y - cloneSrcRef.current.y } : undefined;
      drag.current = { mode: "brush", pts: [p], effect: tool, cloneOffset: offset };
      setPreview((prev) => ({ ...prev, stroke: [p] }));
      return;
    }

    // select tool: fall through to canvas selection
    const l = hitLayerAt(p.x, p.y);
    onSelect(l ? l.id : null);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = toDoc(e);
    const d = drag.current;
    if (!d) {
      setPreview((prev) => ({ ...prev, cursor: p }));
      return;
    }
    setPreview((prev) => (prev.cursor ? { ...prev, cursor: p } : prev));

    if (d.mode === "brush") {
      d.pts.push(p);
      setPreview((prev) => ({ ...prev, stroke: [...d.pts] }));
      return;
    }
    if (d.mode === "draw") {
      d.pts.push(p);
      setPreview((prev) => ({ ...prev, stroke: [...d.pts] }));
      return;
    }
    if (d.mode === "line") {
      setPreview((prev) => ({ ...prev, line: [d.from, p] }));
      return;
    }
    if (d.mode === "crop") {
      setPreview((prev) => ({
        ...prev,
        crop: { x: Math.min(d.from.x, p.x), y: Math.min(d.from.y, p.y), w: Math.abs(p.x - d.from.x), h: Math.abs(p.y - d.from.y) },
      }));
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;

    if (d.mode === "brush") {
      const target = targetRef.current;
      if (target && d.pts.length) {
        void bakeBrush(target, d.pts, d.effect as never, d.cloneOffset);
      }
      setPreview((prev) => ({ ...prev, stroke: null }));
      return;
    }
    if (d.mode === "draw" && d.pts.length > 1) {
      const layer = makePath({
        pathType: "freehand",
        points: d.pts,
        stroke: { enabled: true, color: strokeColor, width: strokeWidth },
        filled: false,
        closed: false,
        smooth,
        name: "Brush stroke",
      });
      onAddLayer(layer);
      setPreview((prev) => ({ ...prev, stroke: null }));
      return;
    }
    if (d.mode === "draw") {
      setPreview((prev) => ({ ...prev, stroke: null }));
      return;
    }
    if (d.mode === "line") {
      const end = preview.line?.[1] ?? d.from;
      if (Math.hypot(end.x - d.from.x, end.y - d.from.y) < 2) {
        setPreview((prev) => ({ ...prev, line: null }));
        return;
      }
      onAddLayer(
        makePath({
          pathType: d.pathType,
          points: [d.from, end],
          stroke: { enabled: true, color: strokeColor, width: strokeWidth },
          filled: false,
          closed: false,
          smooth: false,
          name: d.pathType === "arrow" ? "Arrow" : "Line",
        }),
      );
      setPreview((prev) => ({ ...prev, line: null }));
      return;
    }
    if (d.mode === "crop") {
      // keep the crop rect visible until the user applies it
      return;
    }
  };

  const onDoubleClick = () => {
    if (tool === "pen" && penRef.current && penRef.current.length > 1) commitPen(penRef.current, false);
  };

  /* ── actions ──────────────────────────────────────────────── */

  const commitPen = (pts: { x: number; y: number }[], closed: boolean) => {
    const layer = makePath({
      pathType: "polygon",
      points: pts,
      stroke: { enabled: true, color: strokeColor, width: strokeWidth },
      fill: strokeColor,
      filled: closed,
      closed,
      smooth: false,
      name: "Vector path",
    });
    onAddLayer(layer);
    penRef.current = null;
    setPreview((prev) => ({ ...prev, pen: null }));
  };

  const finishPen = () => {
    if (penRef.current && penRef.current.length > 1) commitPen(penRef.current, true);
    else cancelPen();
  };

  const sampleColor = (x: number, y: number) => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    try {
      const d = ctx.getImageData(Math.max(0, Math.min(c.width - 1, Math.round(x))), Math.max(0, Math.min(c.height - 1, Math.round(y))), 1, 1).data;
      setSampledColor("#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join(""));
    } catch {
      alert("Cannot sample this pixel (cross-origin image). Upload the image to sample it.");
    }
  };

  /** Convert doc-space points to image-source pixel space and bake. */
  const bakeBrush = async (layer: ImageLayer, pts: { x: number; y: number }[], effect: string, cloneOffset?: { x: number; y: number }) => {
    setBusy("Brush");
    try {
      const { bakeBrushStrokes } = await import("@/lib/editor/paint");
      // Resolve the source image's natural resolution so brush strokes land on
      // the correct pixels regardless of how the layer is scaled on canvas.
      const natural = await new Promise<{ w: number; h: number }>((res) => {
        const i = new Image();
        i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight });
        i.onerror = () => res({ w: layer.width, h: layer.height });
        i.src = layer.src;
      });
      const sx = natural.w / layer.width;
      const sy = natural.h / layer.height;
      const scale = (sx + sy) / 2;

      // doc-space points -> source-image pixel space
      const mapped = pts.map((p) => ({
        x: (p.x - layer.x) * sx,
        y: (p.y - layer.y) * sy,
      }));

      // brushSize is a diameter in doc pixels; paint.ts expects a radius in image pixels
      const out = await bakeBrushStrokes(layer.src, [
        {
          points: mapped,
          effect: effect as "erase" | "blur" | "sharpen" | "dodge" | "burn" | "heal" | "clone",
          size: Math.max(1, (brushSize / 2) * scale),
          strength: brushStrength,
          cloneOffset: cloneOffset ? { x: cloneOffset.x * sx, y: cloneOffset.y * sy } : undefined,
        },
      ]);
      onChangeLayer(layer.id, { src: out.src } as Partial<ImageLayer>, true);
      onCommit();
    } catch (err) {
      alert("Brush failed: " + String(err));
    } finally {
      setBusy(null);
    }
  };

  const applyCrop = async () => {
    const rect = preview.crop;
    if (!rect || rect.w < 8 || rect.h < 8) {
      alert("Drag a crop rectangle on the canvas first.");
      return;
    }
    setBusy("Cropping");
    try {
      const canvas = await deps.flatten();
      const nx = Math.max(1, Math.round(rect.w));
      const ny = Math.max(1, Math.round(rect.h));
      const out = document.createElement("canvas");
      out.width = nx;
      out.height = ny;
      const octx = out.getContext("2d")!;
      octx.drawImage(canvas, Math.round(rect.x), Math.round(rect.y), nx, ny, 0, 0, nx, ny);
      const src = out.toDataURL("image/png");
      const layer: ImageLayer = {
        ...baseLayer({ name: "Cropped image", width: nx, height: ny, x: 0, y: 0 }),
        type: "image",
        src,
        crop: null,
      };
      onReplaceDoc({ ...doc, width: nx, height: ny, layers: [layer] });
      setPreview((p) => ({ ...p, crop: null }));
      setToolState("select");
    } catch (err) {
      alert("Crop failed: " + String(err));
    } finally {
      setBusy(null);
    }
  };

  const rotateAll = (deg: number) => {
    const cx = doc.width / 2;
    const cy = doc.height / 2;
    const rad = (deg * Math.PI) / 180;
    onReplaceDoc({
      ...doc,
      layers: doc.layers.map((l) => {
        // rotate the layer centre around the canvas centre
        const lx = l.x + l.width / 2 - cx;
        const ly = l.y + l.height / 2 - cy;
        const nx = cx + lx * Math.cos(rad) - ly * Math.sin(rad) - l.width / 2;
        const ny = cy + lx * Math.sin(rad) + ly * Math.cos(rad) - l.height / 2;
        return { ...l, x: nx, y: ny, rotation: (((l.rotation + deg) % 360) + 360) % 360 } as Layer;
      }),
    });
  };

  // crop aspect presets dispatched by the tools panel
  useEffect(() => {
    const onPreset = (e: Event) => {
      const d = (e as CustomEvent).detail as { x: number; y: number; w: number; h: number };
      setPreview((p) => ({ ...p, crop: d }));
    };
    window.addEventListener("lumina:crop-preset", onPreset);
    return () => window.removeEventListener("lumina:crop-preset", onPreset);
  }, []);

  // finish pen with Enter
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName);
      if (typing) return;
      if (e.key === "Enter" && tool === "pen") {
        e.preventDefault();
        finishPen();
      }
      if (e.key === "Escape" && tool === "pen") cancelPen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, preview.pen]);

  return {
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
    preview,
    busy,
    toDoc,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onDoubleClick,
    applyCrop,
    rotateAll,
    cancelPen,
    finishPen,
  };
}
