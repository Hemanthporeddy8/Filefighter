import { loadImage } from "./render";

export type BrushEffect = "erase" | "blur" | "sharpen" | "dodge" | "burn" | "heal" | "clone";

export type BrushStroke = {
  /** polyline of stamp centres in source-image pixel coords */
  points: { x: number; y: number }[];
  effect: BrushEffect;
  size: number;
  strength: number;
  /** clone source offset (destination - source) in image pixels */
  cloneOffset?: { x: number; y: number };
};

/** Apply a single brush stroke to an ImageData buffer in place. */
export function stampImage(img: ImageData, s: BrushStroke, src: ImageData) {
  const d = img.data;
  const sd = src.data;
  const w = img.width;
  const h = img.height;
  const r = Math.max(1, s.size);
  const r2 = r * r;
  const hard = 0.55 + 0.45 * s.strength; // falloff profile

  const applyAt = (cx: number, cy: number) => {
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(h - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist2 = dx * dx + dy * dy;
        if (dist2 > r2) continue;
        const fall = Math.pow(1 - Math.sqrt(dist2) / r, hard);
        const amt = fall * s.strength;
        const i = (y * w + x) * 4;

        if (s.effect === "erase") {
          d[i + 3] = Math.round(d[i + 3] * (1 - amt));
          continue;
        }

        if (s.effect === "dodge" || s.effect === "burn") {
          const k = 70 * amt * (s.effect === "dodge" ? 1 : -1);
          d[i] = Math.max(0, Math.min(255, d[i] + k));
          d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + k));
          d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + k));
          continue;
        }

        if (s.effect === "clone" && s.cloneOffset) {
          const ox = x - s.cloneOffset.x;
          const oy = y - s.cloneOffset.y;
          if (ox < 0 || oy < 0 || ox >= w || oy >= h) continue;
          const si = (oy * w + ox) * 4;
          d[i] = Math.round(d[i] * (1 - amt) + sd[si] * amt);
          d[i + 1] = Math.round(d[i + 1] * (1 - amt) + sd[si + 1] * amt);
          d[i + 2] = Math.round(d[i + 2] * (1 - amt) + sd[si + 2] * amt);
          d[i + 3] = Math.round(d[i + 3] * (1 - amt) + sd[si + 3] * amt);
          continue;
        }

        // local average for blur / heal / sharpen
        let sr = 0, sg = 0, sb = 0, n = 0;
        const rad = s.effect === "blur" ? 3 : 2;
        for (let ky = -rad; ky <= rad; ky++) {
          for (let kx = -rad; kx <= rad; kx++) {
            const qx = x + kx;
            const qy = y + ky;
            if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
            const qi = (qy * w + qx) * 4;
            sr += d[qi];
            sg += d[qi + 1];
            sb += d[qi + 2];
            n++;
          }
        }
        if (!n) continue;
        const br = sr / n, bg = sg / n, bb = sb / n;
        if (s.effect === "sharpen") {
          const k = amt * 2.2;
          d[i] = Math.max(0, Math.min(255, d[i] + (d[i] - br) * k));
          d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + (d[i + 1] - bg) * k));
          d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + (d[i + 2] - bb) * k));
        } else {
          const k = (s.effect === "blur" ? 0.85 : 0.5) * amt;
          d[i] = Math.round(d[i] * (1 - k) + br * k);
          d[i + 1] = Math.round(d[i + 1] * (1 - k) + bg * k);
          d[i + 2] = Math.round(d[i + 2] * (1 - k) + bb * k);
        }
      }
    }
  };

  for (let i = 0; i < s.points.length; i++) {
    const p = s.points[i];
    if (i === 0) {
      applyAt(p.x, p.y);
      continue;
    }
    const prev = s.points[i - 1];
    // interpolate so fast strokes stay continuous
    const dist = Math.hypot(p.x - prev.x, p.y - prev.y);
    const steps = Math.max(1, Math.ceil(dist / Math.max(1, r * 0.4)));
    for (let k = 1; k <= steps; k++) {
      applyAt(prev.x + ((p.x - prev.x) * k) / steps, prev.y + ((p.y - prev.y) * k) / steps);
    }
  }
}

/**
 * Bake brush strokes into an image source and return a new data URL.
 * Coordinates in `strokes` are in the source image's own pixel space.
 */
export async function bakeBrushStrokes(
  src: string,
  strokes: BrushStroke[],
): Promise<{ src: string; width: number; height: number }> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const original = new Uint8ClampedArray(imgData.data);
  for (const s of strokes) {
    // clone reads from the ORIGINAL pixels so overlapping strokes don't smear
    stampImage(imgData, s, new ImageData(original, canvas.width, canvas.height));
  }
  ctx.putImageData(imgData, 0, 0);
  return { src: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
}
