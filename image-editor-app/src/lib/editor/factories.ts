import { baseLayer, type Doc, type ImageLayer, type ShapeKind, type ShapeLayer, type TextLayer } from "./types";

export function makeText(partial: Partial<TextLayer> = {}): TextLayer {
  return {
    ...baseLayer({ name: "Text", width: 400, height: 80 }),
    type: "text",
    text: "Your text here",
    fontFamily: "Inter",
    fontSize: 64,
    fontWeight: 700,
    italic: false,
    color: "#111111",
    align: "center",
    lineHeight: 1.2,
    letterSpacing: 0,
    stroke: { enabled: false, color: "#000000", width: 2 },
    gradient: { enabled: false, from: "#8b5cf6", to: "#ec4899", angle: 45 },
    uppercase: false,
    ...partial,
  };
}

export function makeShape(shape: ShapeKind, partial: Partial<ShapeLayer> = {}): ShapeLayer {
  return {
    ...baseLayer({ name: shape[0].toUpperCase() + shape.slice(1), width: 300, height: shape === "line" ? 20 : 300 }),
    type: "shape",
    shape,
    fill: "#8b5cf6",
    gradient: { enabled: false, from: "#8b5cf6", to: "#ec4899", angle: 45 },
    stroke: { enabled: false, color: "#ffffff", width: 4 },
    ...partial,
  };
}

export function makeImage(src: string, w: number, h: number, partial: Partial<ImageLayer> = {}): ImageLayer {
  return {
    ...baseLayer({ name: "Image", width: w, height: h }),
    type: "image",
    src,
    crop: null,
    ...partial,
  };
}

export function emptyDoc(width = 1080, height = 1080, name = "Untitled design"): Doc {
  return { id: null, name, width, height, background: "#ffffff", layers: [] };
}

export type Template = { name: string; category: string; build: () => Doc };

export const TEMPLATES: Template[] = [
  {
    name: "Bold Quote",
    category: "Social",
    build: () => ({
      ...emptyDoc(1080, 1080, "Bold Quote"),
      background: "#0f0f12",
      layers: [
        makeShape("ellipse", { x: -200, y: -200, width: 700, height: 700, fill: "#7c3aed", opacity: 0.6, filters: { brightness: 100, contrast: 100, saturate: 100, hue: 0, blur: 80, grayscale: 0, sepia: 0, invert: 0 } }),
        makeShape("ellipse", { x: 600, y: 600, width: 700, height: 700, fill: "#ec4899", opacity: 0.5, filters: { brightness: 100, contrast: 100, saturate: 100, hue: 0, blur: 80, grayscale: 0, sepia: 0, invert: 0 } }),
        makeText({ x: 90, y: 330, width: 900, height: 320, text: "DESIGN\nWITHOUT\nLIMITS", fontSize: 110, fontWeight: 900, color: "#ffffff", fontFamily: "Impact", lineHeight: 1 }),
        makeText({ x: 90, y: 700, width: 900, height: 50, text: "— LUMINA STUDIO", fontSize: 28, fontWeight: 500, color: "#a78bfa", letterSpacing: 8 }),
      ],
    }),
  },
  {
    name: "YouTube Thumbnail",
    category: "Video",
    build: () => ({
      ...emptyDoc(1280, 720, "YouTube Thumbnail"),
      background: "#111827",
      layers: [
        makeShape("rect", { x: 0, y: 0, width: 1280, height: 720, gradient: { enabled: true, from: "#1e3a8a", to: "#7c3aed", angle: 135 } }),
        makeShape("rect", { x: 60, y: 60, width: 1160, height: 600, fill: "#000000", opacity: 0.35, cornerRadius: 40 }),
        makeText({ x: 100, y: 180, width: 1080, height: 260, text: "10 SECRETS\nPROS NEVER TELL", fontSize: 108, fontWeight: 900, fontFamily: "Impact", color: "#facc15", stroke: { enabled: true, color: "#000000", width: 8 }, lineHeight: 1.05 }),
        makeShape("rect", { x: 440, y: 500, width: 400, height: 80, fill: "#ef4444", cornerRadius: 40 }),
        makeText({ x: 440, y: 500, width: 400, height: 80, text: "WATCH NOW", fontSize: 40, fontWeight: 800, color: "#ffffff" }),
      ],
    }),
  },
  {
    name: "Story Promo",
    category: "Social",
    build: () => ({
      ...emptyDoc(1080, 1920, "Story Promo"),
      background: "#fdf2f8",
      layers: [
        makeShape("rect", { x: 0, y: 0, width: 1080, height: 1920, gradient: { enabled: true, from: "#f97316", to: "#ec4899", angle: 160 } }),
        makeShape("rect", { x: 80, y: 280, width: 920, height: 1360, fill: "#ffffff", cornerRadius: 60, shadow: { enabled: true, color: "rgba(0,0,0,0.3)", blur: 60, x: 0, y: 30 } }),
        makeText({ x: 140, y: 400, width: 800, height: 60, text: "LIMITED TIME", fontSize: 32, fontWeight: 700, color: "#ec4899", letterSpacing: 10 }),
        makeText({ x: 140, y: 520, width: 800, height: 400, text: "50%\nOFF", fontSize: 220, fontWeight: 900, fontFamily: "Impact", gradient: { enabled: true, from: "#f97316", to: "#ec4899", angle: 90 }, lineHeight: 0.95 }),
        makeText({ x: 140, y: 1000, width: 800, height: 150, text: "Everything in store.\nThis weekend only.", fontSize: 44, fontWeight: 500, color: "#374151", lineHeight: 1.4 }),
        makeShape("rect", { x: 290, y: 1350, width: 500, height: 110, fill: "#111827", cornerRadius: 55 }),
        makeText({ x: 290, y: 1350, width: 500, height: 110, text: "SHOP NOW", fontSize: 40, fontWeight: 800, color: "#ffffff", letterSpacing: 4 }),
      ],
    }),
  },
  {
    name: "Minimal Business Card",
    category: "Print",
    build: () => ({
      ...emptyDoc(1050, 600, "Business Card"),
      background: "#0a0a0a",
      layers: [
        makeShape("rect", { x: 0, y: 0, width: 24, height: 600, gradient: { enabled: true, from: "#8b5cf6", to: "#06b6d4", angle: 90 } }),
        makeText({ x: 90, y: 150, width: 700, height: 80, text: "Alex Rivera", fontSize: 64, fontWeight: 700, color: "#ffffff", align: "left", fontFamily: "Georgia" }),
        makeText({ x: 90, y: 240, width: 700, height: 40, text: "CREATIVE DIRECTOR", fontSize: 22, fontWeight: 500, color: "#a78bfa", align: "left", letterSpacing: 6 }),
        makeText({ x: 90, y: 400, width: 800, height: 90, text: "alex@lumina.studio\n+1 (555) 010-2030", fontSize: 24, fontWeight: 400, color: "#9ca3af", align: "left", lineHeight: 1.6 }),
        makeShape("hexagon", { x: 820, y: 180, width: 160, height: 160, gradient: { enabled: true, from: "#8b5cf6", to: "#06b6d4", angle: 45 } }),
      ],
    }),
  },
  {
    name: "Event Poster",
    category: "Print",
    build: () => ({
      ...emptyDoc(1080, 1350, "Event Poster"),
      background: "#fef3c7",
      layers: [
        makeShape("ellipse", { x: 190, y: 120, width: 700, height: 700, fill: "#f59e0b" }),
        makeShape("rect", { x: 0, y: 760, width: 1080, height: 590, fill: "#111827" }),
        makeText({ x: 60, y: 820, width: 960, height: 240, text: "SUMMER\nSOUNDS FEST", fontSize: 108, fontWeight: 900, fontFamily: "Impact", color: "#fef3c7", lineHeight: 1 }),
        makeText({ x: 60, y: 1100, width: 960, height: 50, text: "AUG 14–16  •  RIVERSIDE PARK  •  TICKETS AT THE GATE", fontSize: 24, fontWeight: 600, color: "#f59e0b", letterSpacing: 3 }),
        makeShape("star", { x: 60, y: 60, width: 110, height: 110, fill: "#111827" }),
        makeShape("star", { x: 910, y: 60, width: 110, height: 110, fill: "#111827" }),
      ],
    }),
  },
  {
    name: "Tech Presentation",
    category: "Presentation",
    build: () => ({
      ...emptyDoc(1920, 1080, "Presentation"),
      background: "#030712",
      layers: [
        makeShape("rect", { x: 0, y: 0, width: 1920, height: 1080, gradient: { enabled: true, from: "#030712", to: "#1e1b4b", angle: 120 } }),
        makeShape("ellipse", { x: 1300, y: -200, width: 900, height: 900, fill: "#6366f1", opacity: 0.35, filters: { brightness: 100, contrast: 100, saturate: 100, hue: 0, blur: 120, grayscale: 0, sepia: 0, invert: 0 } }),
        makeText({ x: 140, y: 300, width: 1200, height: 100, text: "THE FUTURE OF CREATIVITY", fontSize: 28, fontWeight: 600, color: "#818cf8", align: "left", letterSpacing: 10 }),
        makeText({ x: 140, y: 400, width: 1400, height: 300, text: "Build visuals\nat the speed of thought", fontSize: 104, fontWeight: 800, color: "#ffffff", align: "left", lineHeight: 1.1 }),
        makeShape("line", { x: 140, y: 760, width: 300, height: 8, gradient: { enabled: true, from: "#8b5cf6", to: "#06b6d4", angle: 0 } }),
        makeText({ x: 140, y: 800, width: 1200, height: 60, text: "Lumina Studio  ·  2026 Keynote", fontSize: 30, fontWeight: 400, color: "#9ca3af", align: "left" }),
      ],
    }),
  },
];
