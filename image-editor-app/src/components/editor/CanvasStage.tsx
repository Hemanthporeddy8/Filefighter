"use client";
import { useEffect, useRef, useCallback } from "react";
import type { Doc, Layer } from "@/lib/editor/types";
import { renderDoc, hitTest, rotatePoint, loadImage } from "@/lib/editor/render";
import type { useTools } from "./tools";

type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "rot";

type Props = {
  doc: Doc;
  selectedId: string | null;
  zoom: number;
  onSelect: (id: string | null) => void;
  onChangeLayer: (id: string, patch: Partial<Layer>, commit?: boolean) => void;
  onCommit: () => void;
  onDoubleClickText: (id: string) => void;
  onDropFiles: (files: FileList) => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  showGuides: boolean;
  showGrid: boolean;
  snap: boolean;
  animT: number | undefined;
  tools: ReturnType<typeof useTools>;
};

const HANDLE_SIZE = 10;

export default function CanvasStage({
  doc,
  selectedId,
  zoom,
  onSelect,
  onChangeLayer,
  onCommit,
  onDoubleClickText,
  onDropFiles,
  canvasRef,
  showGuides,
  showGrid,
  snap,
  animT,
  tools,
}: Props) {
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{
    mode: "move" | "resize" | "rotate";
    handle?: Handle;
    startX: number;
    startY: number;
    orig: Layer;
    moved: boolean;
  } | null>(null);

  const selected = doc.layers.find((l) => l.id === selectedId) ?? null;
  const toolIsSelect = tools.tool === "select";

  /* ── main canvas paint ─────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let cancelled = false;
    const paint = () => {
      if (!cancelled) renderDoc(ctx, doc, { animT });
    };
    paint();
    doc.layers
      .filter((l) => l.type === "image")
      .forEach((l) => {
        if (l.type === "image") void loadImage(l.src).then(paint).catch(() => null);
      });
    return () => {
      cancelled = true;
    };
  }, [doc, canvasRef, animT]);

  /* ── overlay: selection + tool previews ────────────── */
  useEffect(() => {
    const canvas = overlayRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 1.5;

    // selection box
    if (selected && toolIsSelect) {
      const l = selected;
      const cx = (l.x + l.width / 2) * zoom;
      const cy = (l.y + l.height / 2) * zoom;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((l.rotation * Math.PI) / 180);
      const w = l.width * zoom;
      const h = l.height * zoom;
      ctx.strokeStyle = "#8b5cf6";
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      if (!l.locked) {
        const pts: [number, number][] = [
          [-w / 2, -h / 2], [0, -h / 2], [w / 2, -h / 2], [w / 2, 0],
          [w / 2, h / 2], [0, h / 2], [-w / 2, h / 2], [-w / 2, 0],
        ];
        ctx.fillStyle = "#fff";
        pts.forEach(([x, y]) => {
          ctx.beginPath();
          ctx.rect(x - HANDLE_SIZE / 2, y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
          ctx.fill();
          ctx.stroke();
        });
        ctx.beginPath();
        ctx.moveTo(0, -h / 2);
        ctx.lineTo(0, -h / 2 - 24);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -h / 2 - 30, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    const p = tools.preview;

    // crop overlay
    if (p.crop && p.crop.w > 1 && p.crop.h > 1) {
      const x = p.crop.x * zoom;
      const y = p.crop.y * zoom;
      const w = p.crop.w * zoom;
      const h = p.crop.h * zoom;
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.rect(x + w, y, -w, h);
      ctx.fill("evenodd");
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x + (w / 3) * i, y);
        ctx.lineTo(x + (w / 3) * i, y + h);
        ctx.moveTo(x, y + (h / 3) * i);
        ctx.lineTo(x + w, y + (h / 3) * i);
        ctx.stroke();
      }
      ctx.fillStyle = "#fff";
      ctx.fillRect(x - 4, y - 4, 8, 8);
      ctx.fillRect(x + w - 4, y - 4, 8, 8);
      ctx.fillRect(x - 4, y + h - 4, 8, 8);
      ctx.fillRect(x + w - 4, y + h - 4, 8, 8);
      ctx.restore();
    }

    // freehand / brush stroke preview
    if (p.stroke && p.stroke.length > 1) {
      ctx.save();
      ctx.strokeStyle = "rgba(139,92,246,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      p.stroke.forEach((pt, i) => {
        const X = pt.x * zoom;
        const Y = pt.y * zoom;
        if (i === 0) ctx.moveTo(X, Y);
        else ctx.lineTo(X, Y);
      });
      ctx.stroke();
      ctx.restore();
    }

    // line / arrow preview
    if (p.line) {
      const [a, b] = p.line;
      ctx.save();
      ctx.strokeStyle = tools.strokeColor;
      ctx.lineWidth = tools.strokeWidth * zoom;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a.x * zoom, a.y * zoom);
      ctx.lineTo(b.x * zoom, b.y * zoom);
      ctx.stroke();
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const head = Math.max(12, tools.strokeWidth * zoom * 2.6);
      ctx.fillStyle = tools.strokeColor;
      ctx.beginPath();
      ctx.moveTo(b.x * zoom, b.y * zoom);
      ctx.lineTo(b.x * zoom - head * Math.cos(ang - Math.PI / 7), b.y * zoom - head * Math.sin(ang - Math.PI / 7));
      ctx.lineTo(b.x * zoom - head * Math.cos(ang + Math.PI / 7), b.y * zoom - head * Math.sin(ang + Math.PI / 7));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // pen preview
    if (p.pen && p.pen.length) {
      ctx.save();
      ctx.strokeStyle = tools.strokeColor;
      ctx.lineWidth = tools.strokeWidth * zoom;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      p.pen.forEach((pt, i) => {
        const X = pt.x * zoom;
        const Y = pt.y * zoom;
        if (i === 0) ctx.moveTo(X, Y);
        else ctx.lineTo(X, Y);
      });
      ctx.stroke();
      ctx.fillStyle = "#8b5cf6";
      p.pen.forEach((pt) => {
        ctx.beginPath();
        ctx.arc(pt.x * zoom, pt.y * zoom, 4, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    // clone source marker
    if (p.cloneSource) {
      ctx.save();
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.cloneSource.x * zoom, p.cloneSource.y * zoom, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }, [selected, zoom, doc, tools.preview, tools.strokeColor, tools.strokeWidth, toolIsSelect]);

  /* ── coordinate + hit helpers ──────────────────────── */
  const toDoc = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const rect = overlayRef.current!.getBoundingClientRect();
      return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
    },
    [zoom],
  );

  const hitLayerAt = useCallback(
    (x: number, y: number) => {
      for (let i = doc.layers.length - 1; i >= 0; i--) {
        const l = doc.layers[i];
        if (l.visible && hitTest(l, x, y)) return l;
      }
      return null;
    },
    [doc.layers],
  );

  const handleAt = (l: Layer, px: number, py: number): Handle | null => {
    const cx = l.x + l.width / 2;
    const cy = l.y + l.height / 2;
    const p = rotatePoint(px, py, cx, cy, -l.rotation);
    const tol = (HANDLE_SIZE / zoom) * 0.9;
    const near = (x: number, y: number) => Math.abs(p.x - x) <= tol && Math.abs(p.y - y) <= tol;
    const { x, y, width: w, height: h } = l;
    if (near(cx, y - 30 / zoom)) return "rot";
    if (near(x, y)) return "nw";
    if (near(cx, y)) return "n";
    if (near(x + w, y)) return "ne";
    if (near(x + w, cy)) return "e";
    if (near(x + w, y + h)) return "se";
    if (near(cx, y + h)) return "s";
    if (near(x, y + h)) return "sw";
    if (near(x, cy)) return "w";
    return null;
  };

  /* ── pointer events: tools take priority ───────────── */
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p = toDoc(e);

    if (!toolIsSelect) {
      tools.onPointerDown(e, hitLayerAt);
      return;
    }

    if (selected && !selected.locked) {
      const h = handleAt(selected, p.x, p.y);
      if (h) {
        drag.current = { mode: h === "rot" ? "rotate" : "resize", handle: h, startX: p.x, startY: p.y, orig: selected, moved: false };
        return;
      }
    }
    const l = hitLayerAt(p.x, p.y);
    onSelect(l ? l.id : null);
    if (l && !l.locked) drag.current = { mode: "move", startX: p.x, startY: p.y, orig: l, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = toDoc(e);

    if (!toolIsSelect) {
      tools.onPointerMove(e);
      return;
    }

    const d = drag.current;
    if (!d) {
      const el = overlayRef.current!;
      if (selected && !selected.locked) {
        const h = handleAt(selected, p.x, p.y);
        if (h === "rot") el.style.cursor = "grab";
        else if (h)
          el.style.cursor =
            h.length === 2
              ? h === "nw" || h === "se"
                ? "nwse-resize"
                : "nesw-resize"
              : h === "n" || h === "s"
                ? "ns-resize"
                : "ew-resize";
        else el.style.cursor = hitLayerAt(p.x, p.y) ? "move" : "default";
      } else el.style.cursor = hitLayerAt(p.x, p.y) ? "move" : "default";
      return;
    }

    d.moved = true;
    const o = d.orig;
    const dx = p.x - d.startX;
    const dy = p.y - d.startY;

    if (d.mode === "move") {
      let nx = o.x + dx;
      let ny = o.y + dy;
      if (snap) {
        const t = 6 / zoom;
        const cxDoc = doc.width / 2;
        const cyDoc = doc.height / 2;
        if (Math.abs(nx + o.width / 2 - cxDoc) < t) nx = cxDoc - o.width / 2;
        if (Math.abs(ny + o.height / 2 - cyDoc) < t) ny = cyDoc - o.height / 2;
        if (Math.abs(nx) < t) nx = 0;
        if (Math.abs(ny) < t) ny = 0;
        if (Math.abs(nx + o.width - doc.width) < t) nx = doc.width - o.width;
        if (Math.abs(ny + o.height - doc.height) < t) ny = doc.height - o.height;
      }
      onChangeLayer(o.id, { x: nx, y: ny });
    } else if (d.mode === "rotate") {
      const cx = o.x + o.width / 2;
      const cy = o.y + o.height / 2;
      const ang = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90;
      let rot = Math.round(ang);
      if (e.shiftKey) rot = Math.round(rot / 15) * 15;
      onChangeLayer(o.id, { rotation: ((rot % 360) + 360) % 360 });
    } else if (d.mode === "resize" && d.handle) {
      const cx = o.x + o.width / 2;
      const cy = o.y + o.height / 2;
      const lp = rotatePoint(p.x, p.y, cx, cy, -o.rotation);
      const ls = rotatePoint(d.startX, d.startY, cx, cy, -o.rotation);
      const ldx = lp.x - ls.x;
      const ldy = lp.y - ls.y;
      let { x, y, width: w, height: h } = o;
      const hnd = d.handle;
      const keepRatio = o.type === "image" || o.type === "text" || e.shiftKey;
      const ratio = o.width / o.height;
      if (hnd.includes("e")) w = Math.max(10, o.width + ldx);
      if (hnd.includes("w")) {
        w = Math.max(10, o.width - ldx);
        x = o.x + (o.width - w);
      }
      if (hnd.includes("s")) h = Math.max(10, o.height + ldy);
      if (hnd.includes("n")) {
        h = Math.max(10, o.height - ldy);
        y = o.y + (o.height - h);
      }
      if (keepRatio && hnd.length === 2) {
        if (Math.abs(ldx) > Math.abs(ldy)) h = w / ratio;
        else w = h * ratio;
        if (hnd.includes("w")) x = o.x + o.width - w;
        if (hnd.includes("n")) y = o.y + o.height - h;
      }
      const nc = rotatePoint(x + w / 2, y + h / 2, cx, cy, o.rotation);
      const patch: Partial<Layer> = { x: nc.x - w / 2, y: nc.y - h / 2, width: w, height: h };
      if (o.type === "text" && keepRatio) {
        const scale = w / o.width;
        (patch as Partial<Extract<Layer, { type: "text" }>>).fontSize = Math.max(4, o.fontSize * scale);
      }
      onChangeLayer(o.id, patch);
    }
  };

  const onPointerUp = () => {
    if (!toolIsSelect) {
      tools.onPointerUp();
      return;
    }
    if (drag.current?.moved) onCommit();
    drag.current = null;
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (!toolIsSelect) {
      tools.onDoubleClick();
      return;
    }
    const p = toDoc(e);
    for (let i = doc.layers.length - 1; i >= 0; i--) {
      const l = doc.layers[i];
      if (l.visible && l.type === "text" && hitTest(l, p.x, p.y)) {
        onDoubleClickText(l.id);
        return;
      }
    }
  };

  // brush cursor ring
  const brushCursor = (() => {
    if (!["erase", "clone", "heal", "blur", "sharpen", "dodge", "burn", "draw"].includes(tools.tool)) return null;
    if (!tools.preview.cursor) return null;
    return { x: tools.preview.cursor.x * zoom, y: tools.preview.cursor.y * zoom, r: (tools.brushSize / 2) * zoom };
  })();

  return (
    <div
      className="relative shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
      style={{ width: doc.width * zoom, height: doc.height * zoom }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files?.length) onDropFiles(e.dataTransfer.files);
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(45deg,#2a2a2e 25%,transparent 25%),linear-gradient(-45deg,#2a2a2e 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#2a2a2e 75%),linear-gradient(-45deg,transparent 75%,#2a2a2e 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
          backgroundColor: "#1c1c20",
        }}
      />
      <canvas
        ref={canvasRef}
        width={doc.width}
        height={doc.height}
        className="absolute inset-0"
        style={{ width: doc.width * zoom, height: doc.height * zoom }}
      />
      {showGrid && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px),linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          }}
        />
      )}
      {showGuides && (
        <svg className="pointer-events-none absolute inset-0" style={{ width: "100%", height: "100%" }}>
          <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#8b5cf6" strokeWidth="1" strokeDasharray="4 4" opacity="0.35" />
          <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#8b5cf6" strokeWidth="1" strokeDasharray="4 4" opacity="0.35" />
          <line x1="0" y1="33.3%" x2="100%" y2="33.3%" stroke="#8b5cf6" strokeWidth="1" strokeDasharray="2 6" opacity="0.18" />
          <line x1="0" y1="66.6%" x2="100%" y2="66.6%" stroke="#8b5cf6" strokeWidth="1" strokeDasharray="2 6" opacity="0.18" />
        </svg>
      )}
      <canvas
        ref={overlayRef}
        width={doc.width * zoom}
        height={doc.height * zoom}
        className="absolute inset-0 touch-none"
        style={{
          width: doc.width * zoom,
          height: doc.height * zoom,
          cursor: toolIsSelect ? undefined : brushCursor ? "none" : "crosshair",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      />
      {brushCursor && (
        <div
          className="pointer-events-none absolute rounded-full border border-white/80 mix-blend-difference"
          style={{ left: brushCursor.x - brushCursor.r, top: brushCursor.y - brushCursor.r, width: brushCursor.r * 2, height: brushCursor.r * 2 }}
        />
      )}
    </div>
  );
}
