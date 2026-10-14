import type { Anim, Doc, Filters, Layer, PathLayer, ShapeLayer, TextLayer } from "./types";

const imageCache = new Map<string, HTMLImageElement>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached && cached.complete) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

export function getCachedImage(src: string) {
  const img = imageCache.get(src);
  return img && img.complete ? img : null;
}

export function filterString(f: Filters) {
  const parts: string[] = [];
  if (f.brightness !== 100) parts.push(`brightness(${f.brightness}%)`);
  if (f.contrast !== 100) parts.push(`contrast(${f.contrast}%)`);
  if (f.saturate !== 100) parts.push(`saturate(${f.saturate}%)`);
  if (f.hue !== 0) parts.push(`hue-rotate(${f.hue}deg)`);
  if (f.blur !== 0) parts.push(`blur(${f.blur}px)`);
  if (f.grayscale !== 0) parts.push(`grayscale(${f.grayscale}%)`);
  if (f.sepia !== 0) parts.push(`sepia(${f.sepia}%)`);
  if (f.invert !== 0) parts.push(`invert(${f.invert}%)`);
  return parts.length ? parts.join(" ") : "none";
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function makeGradient(ctx: CanvasRenderingContext2D, w: number, h: number, from: string, to: string, angle: number) {
  const rad = (angle * Math.PI) / 180;
  const cx = w / 2;
  const cy = h / 2;
  const len = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
  const dx = (Math.cos(rad) * len) / 2;
  const dy = (Math.sin(rad) * len) / 2;
  const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  g.addColorStop(0, from);
  g.addColorStop(1, to);
  return g;
}

function shapePath(ctx: CanvasRenderingContext2D, l: ShapeLayer) {
  const w = l.width;
  const h = l.height;
  ctx.beginPath();
  switch (l.shape) {
    case "rect":
      roundRectPath(ctx, 0, 0, w, h, l.cornerRadius);
      break;
    case "ellipse":
      ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;
    case "triangle":
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      break;
    case "line":
      ctx.rect(0, h / 2 - Math.max(2, h / 10) / 2, w, Math.max(2, h / 10));
      break;
    case "hexagon": {
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const px = w / 2 + (w / 2) * Math.cos(a);
        const py = h / 2 + (h / 2) * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case "star": {
      const spikes = 5;
      const outerR = Math.min(w, h) / 2;
      const innerR = outerR * 0.45;
      const cx = w / 2;
      const cy = h / 2;
      let rot = -Math.PI / 2;
      const step = Math.PI / spikes;
      ctx.moveTo(cx, cy - outerR);
      for (let i = 0; i < spikes; i++) {
        ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
        rot += step;
        ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
        rot += step;
      }
      ctx.closePath();
      break;
    }
    case "heart": {
      const topCurveHeight = h * 0.3;
      ctx.moveTo(w / 2, h);
      ctx.bezierCurveTo(-w * 0.1, h * 0.55, 0, topCurveHeight * 0.1, w / 4, topCurveHeight * 0.1);
      ctx.bezierCurveTo(w * 0.4, topCurveHeight * 0.1, w / 2, h * 0.3, w / 2, h * 0.3);
      ctx.bezierCurveTo(w / 2, h * 0.3, w * 0.6, topCurveHeight * 0.1, w * 0.75, topCurveHeight * 0.1);
      ctx.bezierCurveTo(w, topCurveHeight * 0.1, w * 1.1, h * 0.55, w / 2, h);
      ctx.closePath();
      break;
    }
  }
}

export function textLines(l: TextLayer) {
  const raw = l.uppercase ? l.text.toUpperCase() : l.text;
  return raw.split("\n");
}

function drawText(ctx: CanvasRenderingContext2D, l: TextLayer) {
  const lines = textLines(l);
  ctx.font = `${l.italic ? "italic " : ""}${l.fontWeight} ${l.fontSize}px "${l.fontFamily}", sans-serif`;
  ctx.textBaseline = "top";
  ctx.textAlign = l.align;
  // letterSpacing supported in modern browsers
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ("letterSpacing" in c) c.letterSpacing = `${l.letterSpacing}px`;
  const lh = l.fontSize * l.lineHeight;
  const totalH = lines.length * lh;
  const startY = (l.height - totalH) / 2;
  const x = l.align === "left" ? 0 : l.align === "center" ? l.width / 2 : l.width;

  if (l.gradient.enabled) {
    ctx.fillStyle = makeGradient(ctx, l.width, l.height, l.gradient.from, l.gradient.to, l.gradient.angle);
  } else {
    ctx.fillStyle = l.color;
  }
  lines.forEach((line, i) => {
    const y = startY + i * lh;
    if (l.stroke.enabled && l.stroke.width > 0) {
      ctx.lineWidth = l.stroke.width;
      ctx.strokeStyle = l.stroke.color;
      ctx.lineJoin = "round";
      ctx.strokeText(line, x, y);
    }
    ctx.fillText(line, x, y);
  });
}

export function measureText(l: TextLayer): { width: number; height: number } {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = `${l.italic ? "italic " : ""}${l.fontWeight} ${l.fontSize}px "${l.fontFamily}", sans-serif`;
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ("letterSpacing" in c) c.letterSpacing = `${l.letterSpacing}px`;
  const lines = textLines(l);
  const width = Math.max(...lines.map((ln) => ctx.measureText(ln).width), 10) + 4;
  const height = lines.length * l.fontSize * l.lineHeight;
  return { width: Math.ceil(width), height: Math.ceil(height) };
}

function drawArrowHead(ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }, size: number) {
  const a = Math.atan2(to.y - from.y, to.x - from.x);
  const h = Math.max(size * 2.6, 8);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - h * Math.cos(a - Math.PI / 7), to.y - h * Math.sin(a - Math.PI / 7));
  ctx.lineTo(to.x - h * Math.cos(a + Math.PI / 7), to.y - h * Math.sin(a + Math.PI / 7));
  ctx.closePath();
  ctx.fill();
}

function drawPath(ctx: CanvasRenderingContext2D, l: PathLayer) {
  const pts = l.points;
  if (pts.length === 0) return;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (l.pathType === "line" || l.pathType === "arrow") {
    const [a, b] = pts;
    ctx.strokeStyle = l.stroke.color;
    ctx.lineWidth = l.stroke.width;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    if (l.pathType === "arrow") {
      ctx.fillStyle = l.stroke.color;
      drawArrowHead(ctx, a, b, l.stroke.width);
    }
    return;
  }
  ctx.beginPath();
  if (l.pathType === "freehand" && l.smooth) {
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y);
  } else {
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  }
  if (l.closed || l.pathType === "polygon") ctx.closePath();
  if (l.filled && l.stroke.color) {
    ctx.fillStyle = l.fill;
    ctx.fill();
  }
  if (l.stroke.enabled) {
    ctx.strokeStyle = l.stroke.color;
    ctx.lineWidth = l.stroke.width;
    ctx.stroke();
  }
}

/** Apply keyframe animation transform for playback progress t (0..1), eased. */
function animTransform(l: Layer, t: number) {
  const a = (l as { anim?: Anim }).anim;
  if (!a || a.kind === "none") return null;
  const p = Math.max(0, Math.min(1, t));
  switch (a.kind) {
    case "fade":
      return { opacity: p };
    case "slide":
      return { dx: -80 * (1 - p), dy: 0, opacity: Math.min(1, p * 2) };
    case "zoom":
      return { scale: 0.4 + 0.6 * p, opacity: Math.min(1, p * 2) };
    case "rotate":
      return { rotate: -180 * (1 - p), opacity: Math.min(1, p * 2) };
    case "bounce": {
      const y = p < 0.6 ? -60 * (1 - p / 0.6) : 12 * Math.sin((p - 0.6) * Math.PI * 2) * (1 - (p - 0.6));
      return { dy: y, opacity: Math.min(1, p * 3) };
    }
    default:
      return null;
  }
}

export function drawLayer(ctx: CanvasRenderingContext2D, l: Layer, animT?: number) {
  if (!l.visible) return;
  const anim = animT !== undefined ? animTransform(l, animT) : null;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, l.opacity * (anim?.opacity ?? 1)));
  ctx.globalCompositeOperation = l.blend;
  ctx.translate(l.x + l.width / 2, l.y + l.height / 2);
  if (anim?.dx || anim?.dy) ctx.translate(anim.dx ?? 0, anim.dy ?? 0);
  ctx.rotate(((l.rotation + (anim?.rotate ?? 0)) * Math.PI) / 180);
  if (anim?.scale !== undefined) ctx.scale(anim.scale, anim.scale);
  ctx.scale(l.flipX ? -1 : 1, l.flipY ? -1 : 1);
  ctx.translate(-l.width / 2, -l.height / 2);
  ctx.filter = filterString(l.filters);
  if (l.shadow.enabled) {
    ctx.shadowColor = l.shadow.color;
    ctx.shadowBlur = l.shadow.blur;
    ctx.shadowOffsetX = l.shadow.x;
    ctx.shadowOffsetY = l.shadow.y;
  }

  if (l.type === "image") {
    const img = getCachedImage(l.src);
    if (img) {
      if (l.cornerRadius > 0) {
        roundRectPath(ctx, 0, 0, l.width, l.height, l.cornerRadius);
        ctx.clip();
      }
      if (l.crop) {
        ctx.drawImage(
          img,
          l.crop.x * img.naturalWidth,
          l.crop.y * img.naturalHeight,
          l.crop.w * img.naturalWidth,
          l.crop.h * img.naturalHeight,
          0,
          0,
          l.width,
          l.height,
        );
      } else {
        ctx.drawImage(img, 0, 0, l.width, l.height);
      }
    } else {
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(0, 0, l.width, l.height);
    }
  } else if (l.type === "shape") {
    shapePath(ctx, l);
    ctx.fillStyle = l.gradient.enabled
      ? makeGradient(ctx, l.width, l.height, l.gradient.from, l.gradient.to, l.gradient.angle)
      : l.fill;
    ctx.fill();
    if (l.stroke.enabled && l.stroke.width > 0) {
      ctx.lineWidth = l.stroke.width;
      ctx.strokeStyle = l.stroke.color;
      ctx.stroke();
    }
  } else if (l.type === "text") {
    drawText(ctx, l);
  } else if (l.type === "path") {
    drawPath(ctx, l);
  }
  ctx.restore();
}

export function renderDoc(
  ctx: CanvasRenderingContext2D,
  doc: Doc,
  opts: { transparent?: boolean; animT?: number } = {},
) {
  ctx.clearRect(0, 0, doc.width, doc.height);
  if (!opts.transparent && doc.background !== "transparent") {
    ctx.fillStyle = doc.background;
    ctx.fillRect(0, 0, doc.width, doc.height);
  }
  const total = totalAnimDuration(doc);
  for (const l of doc.layers) {
    let t: number | undefined;
    if (opts.animT !== undefined && total > 0) {
      const a = (l as { anim?: Anim }).anim;
      if (a && a.kind !== "none") t = Math.max(0, Math.min(1, (opts.animT - a.delay) / Math.max(0.01, a.duration)));
    }
    drawLayer(ctx, l, t);
  }
}

export function totalAnimDuration(doc: Doc) {
  return doc.layers.reduce((m, l) => {
    const a = (l as { anim?: Anim }).anim;
    return a ? Math.max(m, a.delay + a.duration) : m;
  }, 0);
}

export async function preloadDoc(doc: Doc) {
  await Promise.all(
    doc.layers.filter((l): l is Extract<Layer, { type: "image" }> => l.type === "image").map((l) => loadImage(l.src).catch(() => null)),
  );
}

export async function exportDoc(
  doc: Doc,
  format: "png" | "jpeg" | "webp",
  quality = 0.92,
  scale = 1,
  transparent = false,
): Promise<string> {
  await preloadDoc(doc);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(doc.width * scale);
  canvas.height = Math.round(doc.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  renderDoc(ctx, doc, { transparent: transparent && format !== "jpeg" });
  return canvas.toDataURL(`image/${format}`, quality);
}

export async function thumbnailOf(doc: Doc, max = 320): Promise<string> {
  const scale = Math.min(max / doc.width, max / doc.height, 1);
  return exportDoc(doc, "jpeg", 0.7, scale);
}

/** Rotate a point around a center */
export function rotatePoint(px: number, py: number, cx: number, cy: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

export function hitTest(l: Layer, x: number, y: number) {
  const cx = l.x + l.width / 2;
  const cy = l.y + l.height / 2;
  const p = rotatePoint(x, y, cx, cy, -l.rotation);
  return p.x >= l.x && p.x <= l.x + l.width && p.y >= l.y && p.y <= l.y + l.height;
}

/** Pixel-level adjustments that CSS filters can't do: vignette, sharpen, noise, temperature */
export async function bakeImageEffect(
  src: string,
  effect: "sharpen" | "vignette" | "noise" | "pixelate" | "removeWhiteBg" | "emboss" | "posterize",
  amount = 1,
): Promise<string> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const w = canvas.width;
  const h = canvas.height;

  if (effect === "pixelate") {
    const size = Math.max(2, Math.round(Math.min(w, h) / (40 / amount)));
    const small = document.createElement("canvas");
    small.width = Math.max(1, Math.round(w / size));
    small.height = Math.max(1, Math.round(h / size));
    const sctx = small.getContext("2d")!;
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(img, 0, 0, small.width, small.height);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(small, 0, 0, small.width, small.height, 0, 0, w, h);
    return canvas.toDataURL("image/png");
  }

  if (effect === "vignette") {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${Math.min(1, 0.75 * amount)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    return canvas.toDataURL("image/png");
  }

  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  if (effect === "noise") {
    const strength = 40 * amount;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * strength;
      d[i] += n;
      d[i + 1] += n;
      d[i + 2] += n;
    }
  } else if (effect === "posterize") {
    const levels = Math.max(2, Math.round(8 / amount));
    const step = 255 / (levels - 1);
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.round(d[i] / step) * step;
      d[i + 1] = Math.round(d[i + 1] / step) * step;
      d[i + 2] = Math.round(d[i + 2] / step) * step;
    }
  } else if (effect === "removeWhiteBg") {
    const threshold = 255 - 40 * amount;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > threshold && d[i + 1] > threshold && d[i + 2] > threshold) d[i + 3] = 0;
    }
  } else if (effect === "sharpen" || effect === "emboss") {
    const src = new Uint8ClampedArray(d);
    const k =
      effect === "sharpen"
        ? [0, -amount, 0, -amount, 1 + 4 * amount, -amount, 0, -amount, 0]
        : [-2, -1, 0, -1, 1, 1, 0, 1, 2];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          let ki = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              sum += src[((y + ky) * w + (x + kx)) * 4 + c] * k[ki++];
            }
          }
          d[(y * w + x) * 4 + c] = sum;
        }
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL("image/png");
}
