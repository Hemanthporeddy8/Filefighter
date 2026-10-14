import { FILTERS } from "../data/presets";
import type { Clip, Track, Asset } from "../types";
import { clamp, ease, hexToRgb, lerp } from "../utils/time";
import type { MediaPool } from "./media";

let grainCanvas: HTMLCanvasElement | null = null;
const offscreen = document.createElement("canvas");
const fxCanvas = document.createElement("canvas");

function getGrain(): HTMLCanvasElement {
  if (grainCanvas) return grainCanvas;
  const c = document.createElement("canvas");
  c.width = 160;
  c.height = 160;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  grainCanvas = c;
  return c;
}

export function isActive(clip: Clip, time: number): boolean {
  return time >= clip.start - 0.0001 && time < clip.start + clip.duration - 0.00001;
}

export function localTime(clip: Clip, time: number): number {
  return time - clip.start;
}

export function sourceTime(clip: Clip, time: number): number {
  const lt = localTime(clip, time);
  const span = Math.max(0.01, clip.outPoint - clip.inPoint);
  const t = clip.reverse ? clip.outPoint - (lt * clip.speed) % span : clip.inPoint + lt * clip.speed;
  return clamp(t, clip.inPoint, Math.max(clip.inPoint, clip.outPoint - 0.001));
}

function interpKey(clip: Clip, prop: "x" | "y" | "scale" | "rotation" | "opacity", fallback: number, lt: number): number {
  const keys = clip.keyframes.filter((k) => k.property === prop).sort((a, b) => a.time - b.time);
  if (keys.length === 0) return fallback;
  if (lt <= keys[0].time) return keys[0].value;
  if (lt >= keys[keys.length - 1].time) return keys[keys.length - 1].value;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (lt >= a.time && lt <= b.time) {
      const p = ease((lt - a.time) / Math.max(0.0001, b.time - a.time), b.easing);
      return lerp(a.value, b.value, p);
    }
  }
  return fallback;
}

function animState(clip: Clip, lt: number) {
  const dIn = clip.animDur || 0.4;
  const dOut = clip.animDur || 0.4;
  let opacity = 1;
  let tx = 0;
  let ty = 0;
  let scale = 1;
  let rot = 0;
  const a = clip.animationIn;
  if (a !== "none" && lt < dIn) {
    const p = clamp(lt / dIn, 0, 1);
    const e = ease(p, "ease-out");
    if (a === "fade" || a === "typewriter") opacity *= e;
    if (a === "slide-up") {
      ty += (1 - e) * 80;
      opacity *= e;
    }
    if (a === "slide-down") {
      ty -= (1 - e) * 80;
      opacity *= e;
    }
    if (a === "slide-left") {
      tx += (1 - e) * 120;
      opacity *= e;
    }
    if (a === "slide-right") {
      tx -= (1 - e) * 120;
      opacity *= e;
    }
    if (a === "pop") {
      scale *= 0.4 + 0.6 * e;
      opacity *= e;
    }
    if (a === "bounce") {
      const b = Math.sin(p * Math.PI);
      scale *= 0.6 + 0.5 * b;
      opacity *= Math.min(1, p * 2);
    }
    if (a === "zoom") {
      scale *= 0.2 + 0.8 * e;
      opacity *= e;
    }
    if (a === "rotate-in") {
      rot -= (1 - e) * 40;
      scale *= 0.7 + 0.3 * e;
      opacity *= e;
    }
  }
  const outStart = clip.duration - dOut;
  const o = clip.animationOut;
  if (o !== "none" && lt > outStart && outStart > 0) {
    const p = clamp((lt - outStart) / dOut, 0, 1);
    const e = ease(p, "ease-in");
    if (o === "fade") opacity *= 1 - e;
    if (o === "slide-up") {
      ty -= e * 80;
      opacity *= 1 - e;
    }
    if (o === "slide-down") {
      ty += e * 80;
      opacity *= 1 - e;
    }
    if (o === "pop") {
      scale *= 1 - 0.5 * e;
      opacity *= 1 - e;
    }
    if (o === "zoom") {
      scale *= 1 + e * 0.6;
      opacity *= 1 - e;
    }
  }
  const fadeIn = clip.fadeIn || 0;
  const fadeOut = clip.fadeOut || 0;
  if (fadeIn > 0 && lt < fadeIn) opacity *= lt / fadeIn;
  if (fadeOut > 0 && lt > clip.duration - fadeOut) opacity *= clamp((clip.duration - lt) / fadeOut, 0, 1);
  return { opacity, tx, ty, scale, rot };
}

function transitionFactor(clip: Clip, lt: number): { inF: number; outF: number } {
  const d = clip.transitionDur || 0.4;
  let inF = 1;
  let outF = 0;
  if (clip.transitionIn !== "none" && lt < d) inF = clamp(lt / d, 0, 1);
  if (clip.transitionOut !== "none" && lt > clip.duration - d) outF = clamp((lt - (clip.duration - d)) / d, 0, 1);
  return { inF, outF };
}

function cssFilter(clip: Clip): string {
  const f = FILTERS.find((x) => x.id === clip.filterId);
  const brightness = ((clip.brightness || 100) * (f && f.id !== "none" ? f.brightness / 100 : 1)) / 100;
  const contrast = ((clip.contrast || 100) * (f && f.id !== "none" ? f.contrast / 100 : 1) + (clip.sharpen || 0) * 0.4) / 100;
  const saturation = ((clip.saturation || 100) * (f && f.id !== "none" ? f.saturation / 100 : 1)) / 100;
  const hue = (clip.hue || 0) + (f && f.id !== "none" ? f.hue : 0);
  const blur = clip.blur || 0;
  const parts = [
    `brightness(${brightness + (clip.highlights || 0) / 400})`,
    `contrast(${contrast + (clip.shadows || 0) / 400})`,
    `saturate(${saturation})`,
    `hue-rotate(${hue}deg)`,
  ];
  if (blur > 0) parts.push(`blur(${blur}px)`);
  if (clip.invert) parts.push("invert(1)");
  return parts.join(" ");
}

function applyPixelFx(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  clip: Clip,
) {
  if (!clip.chromaKey && !clip.duotone && clip.pixelate <= 0) return;
  if (w < 2 || h < 2) return;
  try {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    if (clip.chromaKey) {
      const [kr, kg, kb] = hexToRgb(clip.chromaColor || "#00ff00");
      const sim = clip.chromaSim ?? 0.32;
      const sm = clip.chromaSmooth ?? 0.12;
      for (let i = 0; i < d.length; i += 4) {
        const dist = Math.sqrt((d[i] - kr) ** 2 + (d[i + 1] - kg) ** 2 + (d[i + 2] - kb) ** 2) / 441;
        let a = 1;
        if (dist < sim) a = 0;
        else if (dist < sim + sm) a = (dist - sim) / sm;
        d[i + 3] = Math.round(d[i + 3] * a);
      }
    }
    if (clip.duotone) {
      const [ar, ag, ab] = hexToRgb(clip.duotoneA || "#002244");
      const [br, bg, bb] = hexToRgb(clip.duotoneB || "#ffcc88");
      for (let i = 0; i < d.length; i += 4) {
        const l = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
        d[i] = ar + (br - ar) * l;
        d[i + 1] = ag + (bg - ag) * l;
        d[i + 2] = ab + (bb - ab) * l;
      }
    }
    ctx.putImageData(img, 0, 0);
    if (clip.pixelate > 1) {
      const p = Math.max(2, clip.pixelate);
      fxCanvas.width = Math.max(1, Math.floor(w / p));
      fxCanvas.height = Math.max(1, Math.floor(h / p));
      const fctx = fxCanvas.getContext("2d")!;
      fctx.imageSmoothingEnabled = false;
      fctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
      fctx.drawImage(ctx.canvas, 0, 0, w, h, 0, 0, fxCanvas.width, fxCanvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(fxCanvas, 0, 0, fxCanvas.width, fxCanvas.height, 0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
    }
  } catch {
    /* tainted canvas */
  }
}

function drawMediaFitted(
  ctx: CanvasRenderingContext2D,
  el: CanvasImageSource,
  iw: number,
  ih: number,
  cw: number,
  ch: number,
  fit: Clip["fit"],
) {
  if (!iw || !ih) return;
  let dw = cw;
  let dh = ch;
  let dx = 0;
  let dy = 0;
  if (fit === "contain") {
    const s = Math.min(cw / iw, ch / ih);
    dw = iw * s;
    dh = ih * s;
    dx = (cw - dw) / 2;
    dy = (ch - dh) / 2;
  } else if (fit === "cover") {
    const s = Math.max(cw / iw, ch / ih);
    dw = iw * s;
    dh = ih * s;
    dx = (cw - dw) / 2;
    dy = (ch - dh) / 2;
  }
  ctx.drawImage(el, dx, dy, dw, dh);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.split("\n");
  const lines: string[] = [];
  for (const p of paragraphs) {
    const words = p.split(" ");
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    lines.push(line);
  }
  return lines;
}

function drawText(ctx: CanvasRenderingContext2D, clip: Clip, cw: number, ch: number, lt: number) {
  let content = clip.text || "";
  if (clip.animationIn === "typewriter") {
    const d = clip.animDur || 0.4;
    const p = clamp(lt / Math.max(d, content.length * 0.04), 0, 1);
    content = content.slice(0, Math.floor(content.length * p));
  }
  const size = clip.fontSize || 64;
  ctx.font = `${clip.italic ? "italic " : ""}${clip.fontWeight || 700} ${size}px ${clip.fontFamily || "Arial"}`;
  ctx.textAlign = clip.align || "center";
  ctx.textBaseline = "middle";
  ctx.letterSpacing = `${clip.letterSpacing || 0}px`;
  const maxW = cw * 0.86;
  const lines = wrapText(ctx, content, maxW);
  const lh = size * (clip.lineHeight || 1.2);
  const totalH = lines.length * lh;
  const widths = lines.map((l) => ctx.measureText(l).width);
  const blockW = Math.max(0, ...widths) + (clip.padX || 0) * 2;
  const blockH = totalH + (clip.padY || 0) * 2;
  const originX = cw / 2;
  const originY = ch / 2;
  const left = originX - blockW / 2;
  const top = originY - blockH / 2;
  const bg = clip.backgroundColor || "#00000000";
  if (bg && bg.length >= 7 && !bg.endsWith("00") && bg !== "#00000000") {
    ctx.fillStyle = bg;
    roundRect(ctx, left, top, blockW, blockH, clip.radius || 8);
    ctx.fill();
  }
  if (clip.shadow) {
    ctx.shadowColor = clip.shadowColor || "#000000aa";
    ctx.shadowBlur = clip.shadowBlur || 8;
    ctx.shadowOffsetY = 3;
  }
  lines.forEach((line, i) => {
    const y = originY - totalH / 2 + lh * i + lh / 2;
    const x = clip.align === "left" ? left + (clip.padX || 0) : clip.align === "right" ? left + blockW - (clip.padX || 0) : originX;
    if (clip.strokeWidth > 0) {
      ctx.strokeStyle = clip.strokeColor || "#000";
      ctx.lineWidth = clip.strokeWidth * 2;
      ctx.lineJoin = "round";
      ctx.strokeText(line, x, y);
    }
    ctx.fillStyle = clip.color || "#fff";
    ctx.fillText(line, x, y);
    if (clip.underline) {
      const w = ctx.measureText(line).width;
      const ux = clip.align === "left" ? x : clip.align === "right" ? x - w : x - w / 2;
      ctx.fillRect(ux, y + size * 0.45, w, Math.max(2, size * 0.05));
    }
  });
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawShape(ctx: CanvasRenderingContext2D, clip: Clip, cw: number, ch: number) {
  const w = 360 * (clip.scaleX || 1);
  const h = 220 * (clip.scaleY || 1);
  ctx.fillStyle = clip.fill || "#2ee6a6";
  ctx.strokeStyle = clip.stroke || "#fff";
  ctx.lineWidth = clip.shapeStroke || 0;
  ctx.translate(cw / 2, ch / 2);
  const s = clip.shape;
  ctx.beginPath();
  if (s === "ellipse") {
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else if (s === "roundrect") {
    roundRect(ctx, -w / 2, -h / 2, w, h, 28);
  } else if (s === "triangle") {
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(w / 2, h / 2);
    ctx.lineTo(-w / 2, h / 2);
    ctx.closePath();
  } else if (s === "star") {
    const spikes = 5;
    const outer = Math.min(w, h) / 2;
    const inner = outer * 0.45;
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (i * Math.PI) / spikes - Math.PI / 2;
      i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
  } else if (s === "arrow") {
    ctx.moveTo(-w / 2, -h * 0.18);
    ctx.lineTo(w * 0.15, -h * 0.18);
    ctx.lineTo(w * 0.15, -h / 2);
    ctx.lineTo(w / 2, 0);
    ctx.lineTo(w * 0.15, h / 2);
    ctx.lineTo(w * 0.15, h * 0.18);
    ctx.lineTo(-w / 2, h * 0.18);
    ctx.closePath();
  } else if (s === "line") {
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(w / 2, 0);
    ctx.lineWidth = Math.max(6, clip.shapeStroke || 8);
    ctx.strokeStyle = clip.fill || "#fff";
    ctx.stroke();
    return;
  } else if (s === "heart") {
    const k = Math.min(w, h) / 2;
    ctx.moveTo(0, k * 0.7);
    ctx.bezierCurveTo(-k * 1.2, -k * 0.2, -k * 0.5, -k * 1.1, 0, -k * 0.4);
    ctx.bezierCurveTo(k * 0.5, -k * 1.1, k * 1.2, -k * 0.2, 0, k * 0.7);
  } else {
    ctx.rect(-w / 2, -h / 2, w, h);
  }
  ctx.fill();
  if (clip.shapeStroke > 0) ctx.stroke();
}

function applyTransitionClip(ctx: CanvasRenderingContext2D, cw: number, ch: number, clip: Clip, lt: number) {
  const { inF, outF } = transitionFactor(clip, lt);
  const tin = clip.transitionIn;
  const tout = clip.transitionOut;
  if (tin !== "none" && inF < 1) {
    applyWipe(ctx, cw, ch, tin, inF, true);
  }
  if (tout !== "none" && outF > 0) {
    applyWipe(ctx, cw, ch, tout, outF, false);
  }
}

function applyWipe(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  type: Clip["transitionIn"],
  p: number,
  isIn: boolean,
) {
  const t = isIn ? p : 1 - p;
  if (type === "fade" || type === "dissolve" || type === "black") {
    ctx.save();
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = `rgba(0,0,0,${t})`;
    ctx.fillRect(0, 0, cw, ch);
    ctx.restore();
    if (type === "black" && !isIn) {
      ctx.fillStyle = `rgba(0,0,0,${p})`;
      ctx.fillRect(0, 0, cw, ch);
    }
    return;
  }
  if (type === "flash") {
    ctx.fillStyle = `rgba(255,255,255,${isIn ? 1 - p : p})`;
    ctx.fillRect(0, 0, cw, ch);
    return;
  }
  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  if (type === "wipe-left") ctx.rect(0, 0, cw * t, ch);
  else if (type === "wipe-right") ctx.rect(cw * (1 - t), 0, cw * t, ch);
  else if (type === "wipe-up") ctx.rect(0, 0, cw, ch * t);
  else if (type === "wipe-down") ctx.rect(0, ch * (1 - t), cw, ch * t);
  else if (type === "circle") {
    ctx.arc(cw / 2, ch / 2, Math.hypot(cw, ch) * 0.6 * t, 0, Math.PI * 2);
  } else if (type === "zoom") {
    const s = t;
    ctx.rect(cw * (1 - s) * 0.5, ch * (1 - s) * 0.5, cw * s, ch * s);
  } else if (type === "slide-left" || type === "slide-right") {
    ctx.rect(0, 0, cw, ch);
  } else ctx.rect(0, 0, cw, ch);
  ctx.fill();
  ctx.restore();
}

function drawOverlays(ctx: CanvasRenderingContext2D, clip: Clip, cw: number, ch: number) {
  const f = FILTERS.find((x) => x.id === clip.filterId);
  const vignette = (clip.vignette || 0) + (f && f.id !== "none" ? f.vignette : 0);
  const grain = (clip.grain || 0) + (f && f.id !== "none" ? f.grain : 0);
  const temp = (clip.temperature || 0) + (f && f.id !== "none" ? f.temperature : 0);
  const tint = (clip.tint || 0) + (f && f.id !== "none" ? f.tint : 0);
  if (temp !== 0) {
    ctx.save();
    ctx.globalCompositeOperation = temp > 0 ? "soft-light" : "multiply";
    ctx.fillStyle = temp > 0 ? `rgba(255,160,60,${Math.abs(temp) / 140})` : `rgba(60,120,255,${Math.abs(temp) / 180})`;
    ctx.fillRect(0, 0, cw, ch);
    ctx.restore();
  }
  if (tint !== 0) {
    ctx.save();
    ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = tint > 0 ? `rgba(255,80,160,${Math.abs(tint) / 160})` : `rgba(80,255,160,${Math.abs(tint) / 160})`;
    ctx.fillRect(0, 0, cw, ch);
    ctx.restore();
  }
  if (clip.lightLeak > 0) {
    const g = ctx.createRadialGradient(cw * 0.85, ch * 0.1, 10, cw * 0.7, ch * 0.2, cw * 0.6);
    g.addColorStop(0, `rgba(255,180,80,${0.55 * clip.lightLeak})`);
    g.addColorStop(1, "rgba(255,80,40,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);
  }
  if (vignette > 0) {
    const g = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.25, cw / 2, ch / 2, Math.max(cw, ch) * 0.7);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${clamp(vignette, 0, 1)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);
  }
  if (grain > 0) {
    ctx.save();
    ctx.globalAlpha = clamp(grain, 0, 1) * 0.28;
    ctx.globalCompositeOperation = "overlay";
    const g = getGrain();
    for (let y = 0; y < ch; y += g.height) {
      for (let x = 0; x < cw; x += g.width) ctx.drawImage(g, x, y);
    }
    ctx.restore();
  }
}

export interface RenderInput {
  width: number;
  height: number;
  time: number;
  clips: Clip[];
  tracks: Track[];
  assets: Asset[];
  pool: MediaPool;
  background: string;
  showGrid?: boolean;
  showSafeArea?: boolean;
}

export function renderComposition(ctx: CanvasRenderingContext2D, input: RenderInput) {
  const { width: cw, height: ch, time, clips, tracks, assets, pool, background } = input;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = background || "#000";
  ctx.fillRect(0, 0, cw, ch);

  const visual = tracks.filter((t) => t.type !== "audio");
  for (let i = visual.length - 1; i >= 0; i--) {
    const track = visual[i];
    if (track.hidden) continue;
    const tClips = clips.filter((c) => c.trackId === track.id && isActive(c, time));
    for (const clip of tClips) {
      drawClip(ctx, clip, assets, pool, time, cw, ch);
    }
  }

  if (input.showGrid) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cw / 3, 0);
    ctx.lineTo(cw / 3, ch);
    ctx.moveTo((cw * 2) / 3, 0);
    ctx.lineTo((cw * 2) / 3, ch);
    ctx.moveTo(0, ch / 3);
    ctx.lineTo(cw, ch / 3);
    ctx.moveTo(0, (ch * 2) / 3);
    ctx.lineTo(cw, (ch * 2) / 3);
    ctx.stroke();
    ctx.restore();
  }
  if (input.showSafeArea) {
    ctx.save();
    ctx.strokeStyle = "rgba(46,230,166,0.45)";
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(cw * 0.05, ch * 0.05, cw * 0.9, ch * 0.9);
    ctx.strokeStyle = "rgba(255,200,80,0.35)";
    ctx.strokeRect(cw * 0.1, ch * 0.1, cw * 0.8, ch * 0.8);
    ctx.restore();
  }
  ctx.restore();
}

function drawClip(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  assets: Asset[],
  pool: MediaPool,
  time: number,
  cw: number,
  ch: number,
) {
  const lt = localTime(clip, time);
  const anim = animState(clip, lt);
  const x = interpKey(clip, "x", clip.x, lt) + anim.tx;
  const y = interpKey(clip, "y", clip.y, lt) + anim.ty;
  const scale = interpKey(clip, "scale", clip.scale, lt) * anim.scale;
  const rotation = interpKey(clip, "rotation", clip.rotation, lt) + anim.rot;
  const opacity = interpKey(clip, "opacity", clip.opacity, lt) * anim.opacity;
  if (opacity <= 0.01) return;

  ctx.save();
  ctx.globalAlpha = clamp(opacity, 0, 1);
  const blend: GlobalCompositeOperation = clip.blend === "plus-lighter" ? "lighter" : (clip.blend as GlobalCompositeOperation);
  ctx.globalCompositeOperation = blend || "source-over";
  ctx.translate(cw / 2 + x, ch / 2 + y);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(scale * (clip.scaleX || 1) * (clip.flipH ? -1 : 1), scale * (clip.scaleY || 1) * (clip.flipV ? -1 : 1));
  ctx.translate(-cw / 2, -ch / 2);

  if (clip.mask === "ellipse") {
    ctx.beginPath();
    ctx.ellipse(cw / 2, ch / 2, cw * 0.42, ch * 0.42, 0, 0, Math.PI * 2);
    ctx.clip();
  } else if (clip.mask === "rect") {
    ctx.beginPath();
    ctx.rect(cw * 0.12, ch * 0.12, cw * 0.76, ch * 0.76);
    ctx.clip();
  }

  if (clip.kind === "text") {
    drawText(ctx, clip, cw, ch, lt);
    ctx.restore();
    return;
  }
  if (clip.kind === "sticker") {
    ctx.font = `${Math.round(140 * (clip.scale || 1))}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(clip.sticker || "🔥", cw / 2, ch / 2);
    ctx.restore();
    return;
  }
  if (clip.kind === "shape") {
    drawShape(ctx, clip, cw, ch);
    ctx.restore();
    return;
  }
  if (clip.kind === "solid") {
    ctx.fillStyle = clip.fill || "#111";
    ctx.fillRect(0, 0, cw, ch);
    applyTransitionClip(ctx, cw, ch, clip, lt);
    ctx.restore();
    return;
  }

  const asset = assets.find((a) => a.id === clip.assetId);
  ctx.filter = cssFilter(clip);

  const needFx = clip.chromaKey || clip.duotone || clip.pixelate > 0 || clip.glow > 0 || clip.mirror;
  if (needFx) {
    offscreen.width = cw;
    offscreen.height = ch;
  }
  const dctx = needFx ? offscreen.getContext("2d")! : ctx;
  if (needFx) {
    dctx.clearRect(0, 0, cw, ch);
    dctx.filter = cssFilter(clip);
  }

  if (clip.kind === "image" && asset) {
    const img = pool.getImage(asset.id, asset.url);
    if (img.complete && img.naturalWidth) {
      drawMediaFitted(dctx, img, img.naturalWidth, img.naturalHeight, cw, ch, clip.fit);
    }
  } else if (clip.kind === "video" && asset) {
    const v = pool.getVideo(clip.id, asset.url);
    if (v.readyState >= 2 && (v.videoWidth || asset.width)) {
      drawMediaFitted(dctx, v, v.videoWidth || asset.width, v.videoHeight || asset.height, cw, ch, clip.fit);
    }
  }

  if (needFx) {
    applyPixelFx(dctx, cw, ch, clip);
    if (clip.mirror) {
      dctx.save();
      dctx.drawImage(offscreen, cw / 2, 0, cw / 2, ch, 0, 0, cw / 2, ch);
      dctx.scale(-1, 1);
      dctx.drawImage(offscreen, 0, 0, cw / 2, ch, -cw, 0, cw / 2, ch);
      dctx.restore();
    }
    ctx.filter = clip.glow > 0 ? `blur(${clip.glow * 8}px)` : "none";
    if (clip.glow > 0) {
      ctx.globalAlpha = opacity * 0.55;
      ctx.drawImage(offscreen, 0, 0);
      ctx.globalAlpha = opacity;
    }
    ctx.filter = "none";
    ctx.drawImage(offscreen, 0, 0);
  }

  ctx.filter = "none";
  drawOverlays(ctx, clip, cw, ch);
  applyTransitionClip(ctx, cw, ch, clip, lt);
  ctx.restore();
}

export async function prepareFrame(input: RenderInput): Promise<void> {
  const { time, clips, tracks, assets, pool } = input;
  const waits: Promise<void>[] = [];
  for (const clip of clips) {
    const track = tracks.find((t) => t.id === clip.trackId);
    if (!track || track.hidden) continue;
    if (!isActive(clip, time)) continue;
    if (clip.kind !== "video" || !clip.assetId) continue;
    const asset = assets.find((a) => a.id === clip.assetId);
    if (!asset) continue;
    const v = pool.getVideo(clip.id, asset.url);
    waits.push(seekMediaSafe(v, sourceTime(clip, time)));
  }
  await Promise.all(waits);
}

function seekMediaSafe(el: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    if (el.readyState < 1) {
      const on = () => {
        el.removeEventListener("loadedmetadata", on);
        doSeek();
      };
      el.addEventListener("loadedmetadata", on);
      setTimeout(() => {
        el.removeEventListener("loadedmetadata", on);
        doSeek();
      }, 400);
      return;
    }
    doSeek();
    function doSeek() {
      const t = Math.max(0, time);
      if (Math.abs(el.currentTime - t) < 0.03 && el.readyState >= 2) {
        resolve();
        return;
      }
      const done = () => {
        el.removeEventListener("seeked", done);
        resolve();
      };
      el.addEventListener("seeked", done);
      try {
        el.currentTime = t;
      } catch {
        resolve();
      }
      setTimeout(() => {
        el.removeEventListener("seeked", done);
        resolve();
      }, 220);
    }
  });
}
