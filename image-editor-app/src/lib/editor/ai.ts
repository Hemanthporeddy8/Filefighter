/* ── Client-side AI image operations (Browser Canvas) ── */

export type RGBA = { data: Uint8ClampedArray; width: number; height: number };

export function decodeImage(src: string): Promise<RGBA | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, w, h);
        resolve({ data: d.data, width: w, height: h });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function encodePNG(img: RGBA): Promise<string> {
  try {
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d");
    if (!ctx) return Promise.resolve("");
    const id = ctx.createImageData(img.width, img.height);
    id.data.set(img.data);
    ctx.putImageData(id, 0, 0);
    return Promise.resolve(c.toDataURL("image/png"));
  } catch {
    return Promise.resolve("");
  }
}

/** Sobel edge magnitude map, normalized 0..1 */
export function edgeMap(img: RGBA): Float32Array {
  const { data, width: w, height: h } = img;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) / 255;
  }
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -gray[i - w - 1] - 2 * gray[i - 1] - gray[i + w - 1] + gray[i - w + 1] + 2 * gray[i + 1] + gray[i + w + 1];
      const gy =
        -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1] + gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
      out[i] = Math.min(1, Math.hypot(gx, gy) * 1.4);
    }
  }
  return out;
}

/**
 * AI background removal: flood fill from the borders over background-like
 * colors, then edge-aware refinement. Returns alpha mask 0..1.
 */
export function autoMask(img: RGBA, opts: { edge?: number } = {}): Uint8ClampedArray {
  const { data, width: w, height: h } = img;
  const n = w * h;
  const mask = new Uint8ClampedArray(n).fill(255);
  const visited = new Uint8Array(n);

  // sample border colors
  const borderCols: number[][] = [];
  const sample = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    borderCols.push([data[i], data[i + 1], data[i + 2]]);
  };
  for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 60))) {
    sample(x, 0);
    sample(x, h - 1);
  }
  for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 60))) {
    sample(0, y);
    sample(w - 1, y);
  }
  const mean = [0, 1, 2].map(
    (c) => borderCols.reduce((s, col) => s + col[c], 0) / Math.max(1, borderCols.length),
  );
  const std = [0, 1, 2].map((c) => {
    const v = borderCols.reduce((s, col) => s + (col[c] - mean[c]) ** 2, 0) / Math.max(1, borderCols.length);
    return Math.sqrt(v) + 12;
  });

  const isBg = (i: number) => {
    const d0 = (data[i] - mean[0]) / std[0];
    const d1 = (data[i + 1] - mean[1]) / std[1];
    const d2 = (data[i + 2] - mean[2]) / std[2];
    return d0 * d0 + d1 * d1 + d2 * d2 < 6.5;
  };

  const stack: number[] = [];
  for (let x = 0; x < w; x++) {
    stack.push(x, (h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    stack.push(y * w, y * w + w - 1);
  }
  while (stack.length) {
    const p = stack.pop()!;
    if (visited[p]) continue;
    visited[p] = 1;
    if (!isBg(p * 4)) continue;
    mask[p] = 0;
    const x = p % w;
    const y = (p / w) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }

  // edge refinement: shrink mask where edges are strong (keeps hair/fur edges)
  const em = edgeMap(img);
  const refine = opts.edge ?? 0.35;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (mask[p] === 0 && em[p] > refine) mask[p] = 128;
    }
  }
  // expand: any transparent pixel adjacent to opaque becomes semi (soft edge)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (mask[p] === 0) {
        if (mask[p - 1] === 255 || mask[p + 1] === 255 || mask[p - w] === 255 || mask[p + w] === 255) mask[p] = 128;
      }
    }
  }
  return mask;
}

export function applyMask(img: RGBA, mask: Uint8ClampedArray): RGBA {
  const out = new Uint8ClampedArray(img.data);
  for (let i = 0; i < mask.length; i++) out[i * 4 + 3] = Math.round((mask[i] / 255) * out[i * 4 + 3]);
  return { data: out, width: img.width, height: img.height };
}

/** Composite subject (via mask) onto a new background color/image */
export function replaceBackground(
  img: RGBA,
  mask: Uint8ClampedArray,
  bg: { type: "color"; color: string } | { type: "image"; img: RGBA },
): RGBA {
  const { width: w, height: h } = img;
  const out = new Uint8ClampedArray(w * h * 4);
  const bgc = (() => {
    if (bg.type === "color") {
      const m = /^#?([0-9a-f]{6})$/i.exec(bg.color);
      return m ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)] : [255, 255, 255];
    }
    return null;
  })();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = mask[y * w + x] / 255;
      let br = 255, bgc2 = 255, bb = 255;
      if (bg.type === "image") {
        const sy = Math.min(bg.img.height - 1, Math.floor((y / h) * bg.img.height));
        const sx = Math.min(bg.img.width - 1, Math.floor((x / w) * bg.img.width));
        const bi = (sy * bg.img.width + sx) * 4;
        br = bg.img.data[bi];
        bgc2 = bg.img.data[bi + 1];
        bb = bg.img.data[bi + 2];
      } else if (bgc) {
        br = bgc[0];
        bgc2 = bgc[1];
        bb = bgc[2];
      }
      out[i] = Math.round(img.data[i] * a + br * (1 - a));
      out[i + 1] = Math.round(img.data[i + 1] * a + bgc2 * (1 - a));
      out[i + 2] = Math.round(img.data[i + 2] * a + bb * (1 - a));
      out[i + 3] = 255;
    }
  }
  return { data: out, width: w, height: h };
}

/** Content-aware fill: sample nearest non-erased pixels via BFS from hole boundary */
export function contentAwareFill(img: RGBA, hole: Uint8Array): RGBA {
  const { data, width: w, height: h } = img;
  const out = new Uint8ClampedArray(data);
  const filled = new Uint8Array(w * h);
  const queue: number[] = [];
  for (let p = 0; p < w * h; p++) if (hole[p]) queue.push(p);
  // BFS outward from hole boundary copying nearest known pixel
  while (queue.length) {
    const p = queue.shift()!;
    if (filled[p]) continue;
    filled[p] = 1;
    const x = p % w;
    const y = (p / w) | 0;
    let best = -1;
    let bestD = Infinity;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const np = ny * w + nx;
      if (hole[np]) continue;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = np;
      }
    }
    if (best >= 0) {
      for (let c = 0; c < 4; c++) out[p * 4 + c] = data[best * 4 + c];
    }
  }
  return { data: out, width: w, height: h };
}

/** Bilateral-ish upscale preserving edges: 2x nearest-then-blend */
export function upscale(img: RGBA, factor = 2): RGBA {
  const { data, width: w, height: h } = img;
  const nw = w * factor;
  const nh = h * factor;
  const out = new Uint8ClampedArray(nw * nh * 4);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const sx = x / factor;
      const sy = y / factor;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;
      const x1 = Math.min(w - 1, x0 + 1);
      const y1 = Math.min(h - 1, y0 + 1);
      const i00 = (y0 * w + x0) * 4;
      const i10 = (y0 * w + x1) * 4;
      const i01 = (y1 * w + x0) * 4;
      const i11 = (y1 * w + x1) * 4;
      const o = (y * nw + x) * 4;
      for (let c = 0; c < 3; c++) {
        const v =
          data[i00 + c] * (1 - fx) * (1 - fy) +
          data[i10 + c] * fx * (1 - fy) +
          data[i01 + c] * (1 - fx) * fy +
          data[i11 + c] * fx * fy;
        out[o + c] = v;
      }
      out[o + 3] = 255;
    }
  }
  return { data: out, width: nw, height: nh };
}

/** Auto enhance: white balance (gray world), contrast S-curve, unsharp mask */
export function autoEnhance(img: RGBA, strength = 1): RGBA {
  const { data, width: w, height: h } = img;
  const out = new Uint8ClampedArray(data);
  let sr = 0, sg = 0, sb = 0;
  const n = w * h;
  for (let i = 0; i < n; i++) {
    sr += out[i * 4];
    sg += out[i * 4 + 1];
    sb += out[i * 4 + 2];
  }
  const mr = sr / n, mg = sg / n, mb = sb / n;
  const m = (mr + mg + mb) / 3;
  const kr = m / Math.max(1, mr), kg = m / Math.max(1, mg), kb = m / Math.max(1, mb);
  for (let i = 0; i < n; i++) {
    out[i * 4] = Math.min(255, out[i * 4] * (1 + (kr - 1) * strength));
    out[i * 4 + 1] = Math.min(255, out[i * 4 + 1] * (1 + (kg - 1) * strength));
    out[i * 4 + 2] = Math.min(255, out[i * 4 + 2] * (1 + (kb - 1) * strength));
  }
  // contrast S-curve
  const c = 0.25 * strength;
  for (let i = 0; i < n; i++) {
    for (let ch = 0; ch < 3; ch++) {
      const v = out[i * 4 + ch] / 255;
      out[i * 4 + ch] = Math.max(0, Math.min(255, Math.round((v * (1 + c) - c / 2 + 0.5 * (v - 0.5) * c) * 255)));
    }
  }
  // unsharp mask
  const blurred = new Float32Array(n);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let s = 0;
      for (let ky = -1; ky <= 1; ky++) for (let kx = -1; kx <= 1; kx++) s += out[((y + ky) * w + (x + kx)) * 4] * 0.299 + out[((y + ky) * w + (x + kx)) * 4 + 1] * 0.587 + out[((y + ky) * w + (x + kx)) * 4 + 2] * 0.114;
      blurred[y * w + x] = s / 9;
    }
  }
  const amt = 0.6 * strength;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      const sharp = out[p * 4] * 0.299 + out[p * 4 + 1] * 0.587 + out[p * 4 + 2] * 0.114;
      const diff = sharp - blurred[p];
      for (let c = 0; c < 3; c++) {
        out[p * 4 + c] = Math.max(0, Math.min(255, out[p * 4 + c] + diff * amt));
      }
    }
  }
  return { data: out, width: w, height: h };
}

/** Smart crop: find the highest-detail rectangle of the target aspect */
export function smartCropRect(img: RGBA, targetW: number, targetH: number): { x: number; y: number; w: number; h: number } {
  const em = edgeMap(img);
  const { width: w, height: h } = img;
  const ar = targetW / targetH;
  let cw = w;
  let ch = w / ar;
  if (ch > h) {
    ch = h;
    cw = h * ar;
  }
  // integral image of edge energy
  const ii = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += em[y * w + x];
      ii[(y + 1) * (w + 1) + x + 1] = ii[y * (w + 1) + x + 1] + row;
    }
  }
  const energy = (x: number, y: number, rw: number, rh: number) =>
    ii[(y + rh) * (w + 1) + x + rw] - ii[y * (w + 1) + x + rw] - ii[(y + rh) * (w + 1) + x] + ii[y * (w + 1) + x];
  let best = { x: Math.floor((w - cw) / 2), y: Math.floor((h - ch) / 2) };
  let bestE = -1;
  const step = Math.max(1, Math.floor(Math.min(cw, ch) / 40));
  for (let y = 0; y <= h - ch; y += step) {
    for (let x = 0; x <= w - cw; x += step) {
      const e = energy(x, y, Math.floor(cw), Math.floor(ch));
      if (e > bestE) {
        bestE = e;
        best = { x, y };
      }
    }
  }
  return { x: Math.round(best.x), y: Math.round(best.y), w: Math.floor(cw), h: Math.floor(ch) };
}

/** Extract a palette of N dominant colors via simple k-means */
export function extractPalette(img: RGBA, count = 6): string[] {
  const { data, width: w, height: h } = img;
  const pts: number[][] = [];
  for (let i = 0; i < w * h; i += Math.max(1, Math.floor((w * h) / 4000))) {
    pts.push([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]);
  }
  // k-means++
  const centers: number[][] = [pts[Math.floor(Math.random() * pts.length)]];
  while (centers.length < count) {
    let bestD = -1;
    let bestP = pts[0];
    for (const p of pts) {
      const d = Math.min(...centers.map((c) => (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2));
      if (d > bestD) {
        bestD = d;
        bestP = p;
      }
    }
    centers.push(bestP);
  }
  for (let iter = 0; iter < 8; iter++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (const p of pts) {
      let bi = 0;
      let bd = Infinity;
      centers.forEach((c, i) => {
        const d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2;
        if (d < bd) {
          bd = d;
          bi = i;
        }
      });
      sums[bi][0] += p[0];
      sums[bi][1] += p[1];
      sums[bi][2] += p[2];
      sums[bi][3]++;
    }
    sums.forEach((s, i) => {
      if (s[3] > 0) centers[i] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
    });
  }
  return centers.map((c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join(""));
}

export async function runAiOp(op: string, body: Record<string, any>): Promise<any> {
  const { src, bg, strength = 1, factor = 2, targetW, targetH, count = 6 } = body;
  if (!src) throw new Error("Source image required");
  const img = await decodeImage(src);
  if (!img) throw new Error("Could not decode image");

  switch (op) {
    case "removeBackground": {
      const mask = autoMask(img);
      return { src: await encodePNG(applyMask(img, mask)) };
    }
    case "replaceBackground": {
      if (!bg) throw new Error("Background color or image required");
      const mask = autoMask(img);
      let bgImg: RGBA | null = null;
      if (/^data:|^https?:/.test(bg)) bgImg = await decodeImage(bg);
      const out = replaceBackground(img, mask, bgImg ? { type: "image", img: bgImg } : { type: "color", color: bg });
      return { src: await encodePNG(out) };
    }
    case "enhance":
      return { src: await encodePNG(autoEnhance(img, strength)) };
    case "upscale":
      return { src: await encodePNG(upscale(img, factor)) };
    case "smartCrop": {
      if (!targetW || !targetH) throw new Error("targetW and targetH required");
      const r = smartCropRect(img, targetW, targetH);
      const out = new Uint8ClampedArray(r.w * r.h * 4);
      for (let y = 0; y < r.h; y++) {
        for (let x = 0; x < r.w; x++) {
          const si = ((r.y + y) * img.width + (r.x + x)) * 4;
          const di = (y * r.w + x) * 4;
          out[di] = img.data[si];
          out[di + 1] = img.data[si + 1];
          out[di + 2] = img.data[si + 2];
          out[di + 3] = img.data[si + 3];
        }
      }
      return { src: await encodePNG({ data: out, width: r.w, height: r.h }) };
    }
    case "palette":
      return { colors: extractPalette(img, count) };
    default:
      throw new Error("Unknown AI operation: " + op);
  }
}

