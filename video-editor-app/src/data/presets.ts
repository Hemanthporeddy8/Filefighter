import type { AnimIn, TransitionType } from "../types";

export interface FilterPreset {
  id: string;
  name: string;
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  temperature: number;
  vignette: number;
  grain: number;
  tint: number;
}

export const FILTERS: FilterPreset[] = [
  { id: "none", name: "Original", brightness: 100, contrast: 100, saturation: 100, hue: 0, temperature: 0, vignette: 0, grain: 0, tint: 0 },
  { id: "cinematic", name: "Cinematic", brightness: 96, contrast: 118, saturation: 88, hue: 0, temperature: -8, vignette: 0.35, grain: 0.12, tint: 4 },
  { id: "teal-orange", name: "Teal & Orange", brightness: 102, contrast: 114, saturation: 120, hue: -6, temperature: 10, vignette: 0.22, grain: 0.08, tint: -8 },
  { id: "vintage", name: "Vintage", brightness: 108, contrast: 92, saturation: 72, hue: 12, temperature: 22, vignette: 0.4, grain: 0.28, tint: 10 },
  { id: "noir", name: "Noir", brightness: 94, contrast: 130, saturation: 0, hue: 0, temperature: 0, vignette: 0.5, grain: 0.22, tint: 0 },
  { id: "vibrant", name: "Vibrant", brightness: 104, contrast: 112, saturation: 145, hue: 0, temperature: 6, vignette: 0.08, grain: 0, tint: 0 },
  { id: "cool", name: "Cool", brightness: 100, contrast: 105, saturation: 95, hue: -12, temperature: -24, vignette: 0.12, grain: 0, tint: -10 },
  { id: "warm", name: "Warm", brightness: 106, contrast: 104, saturation: 110, hue: 8, temperature: 28, vignette: 0.1, grain: 0.04, tint: 8 },
  { id: "fade", name: "Fade", brightness: 112, contrast: 86, saturation: 78, hue: 0, temperature: 6, vignette: 0.18, grain: 0.1, tint: 0 },
  { id: "dramatic", name: "Dramatic", brightness: 88, contrast: 140, saturation: 90, hue: 0, temperature: -4, vignette: 0.48, grain: 0.1, tint: 0 },
  { id: "pastel", name: "Pastel", brightness: 114, contrast: 88, saturation: 70, hue: 8, temperature: 8, vignette: 0, grain: 0, tint: 6 },
  { id: "neon", name: "Neon", brightness: 98, contrast: 122, saturation: 170, hue: 20, temperature: -10, vignette: 0.28, grain: 0.06, tint: -6 },
  { id: "moonlight", name: "Moonlight", brightness: 90, contrast: 110, saturation: 60, hue: -20, temperature: -30, vignette: 0.32, grain: 0.08, tint: -12 },
  { id: "golden", name: "Golden Hour", brightness: 110, contrast: 108, saturation: 118, hue: 10, temperature: 36, vignette: 0.16, grain: 0.06, tint: 12 },
  { id: "bleach", name: "Bleach", brightness: 118, contrast: 124, saturation: 40, hue: 0, temperature: 4, vignette: 0.1, grain: 0.14, tint: 0 },
  { id: "polaroid", name: "Polaroid", brightness: 112, contrast: 96, saturation: 85, hue: 6, temperature: 16, vignette: 0.2, grain: 0.18, tint: 8 },
  { id: "cyberpunk", name: "Cyberpunk", brightness: 96, contrast: 128, saturation: 160, hue: 28, temperature: -16, vignette: 0.3, grain: 0.1, tint: -16 },
  { id: "film", name: "Film Stock", brightness: 100, contrast: 112, saturation: 92, hue: 4, temperature: 8, vignette: 0.24, grain: 0.32, tint: 4 },
];

export const TRANSITIONS: { id: TransitionType; name: string }[] = [
  { id: "none", name: "None" },
  { id: "fade", name: "Fade" },
  { id: "dissolve", name: "Dissolve" },
  { id: "wipe-left", name: "Wipe Left" },
  { id: "wipe-right", name: "Wipe Right" },
  { id: "wipe-up", name: "Wipe Up" },
  { id: "wipe-down", name: "Wipe Down" },
  { id: "slide-left", name: "Slide Left" },
  { id: "slide-right", name: "Slide Right" },
  { id: "zoom", name: "Zoom" },
  { id: "flash", name: "Flash" },
  { id: "black", name: "Dip to Black" },
  { id: "circle", name: "Circle Wipe" },
];

export const ANIMATIONS: { id: AnimIn; name: string }[] = [
  { id: "none", name: "None" },
  { id: "fade", name: "Fade" },
  { id: "slide-up", name: "Slide Up" },
  { id: "slide-down", name: "Slide Down" },
  { id: "slide-left", name: "Slide Left" },
  { id: "slide-right", name: "Slide Right" },
  { id: "pop", name: "Pop" },
  { id: "bounce", name: "Bounce" },
  { id: "typewriter", name: "Typewriter" },
  { id: "zoom", name: "Zoom" },
  { id: "rotate-in", name: "Rotate In" },
];

export const FONTS = [
  "Arial",
  "Arial Black",
  "Georgia",
  "Impact",
  "Times New Roman",
  "Courier New",
  "Trebuchet MS",
  "Verdana",
  "Tahoma",
  "Palatino Linotype",
  "Lucida Console",
  "Garamond",
  "Segoe UI",
  "Comic Sans MS",
  "Century Gothic",
];

export interface TextPreset {
  id: string;
  name: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  backgroundColor: string;
  strokeWidth: number;
  strokeColor: string;
  animationIn: AnimIn;
  shadow: boolean;
  y: number;
}

export const TEXT_PRESETS: TextPreset[] = [
  { id: "title", name: "Title", text: "TITLE", fontFamily: "Impact", fontSize: 96, fontWeight: 700, color: "#ffffff", backgroundColor: "#00000000", strokeWidth: 0, strokeColor: "#000", animationIn: "pop", shadow: true, y: 0 },
  { id: "subtitle", name: "Subtitle", text: "Subtitle goes here", fontFamily: "Georgia", fontSize: 42, fontWeight: 400, color: "#ffffff", backgroundColor: "#00000000", strokeWidth: 0, strokeColor: "#000", animationIn: "fade", shadow: true, y: 80 },
  { id: "lower", name: "Lower Third", text: "Name  ·  Role", fontFamily: "Segoe UI", fontSize: 36, fontWeight: 600, color: "#ffffff", backgroundColor: "#2ee6a6ee", strokeWidth: 0, strokeColor: "#000", animationIn: "slide-left", shadow: false, y: 360 },
  { id: "caption", name: "Caption", text: "Add a caption", fontFamily: "Arial", fontSize: 32, fontWeight: 600, color: "#ffffff", backgroundColor: "#000000cc", strokeWidth: 0, strokeColor: "#000", animationIn: "fade", shadow: false, y: 400 },
  { id: "hook", name: "Hook", text: "WAIT FOR IT", fontFamily: "Arial Black", fontSize: 72, fontWeight: 900, color: "#ffe566", backgroundColor: "#00000000", strokeWidth: 6, strokeColor: "#111111", animationIn: "bounce", shadow: true, y: -40 },
  { id: "outline", name: "Outline", text: "OUTLINE", fontFamily: "Impact", fontSize: 88, fontWeight: 700, color: "#00000000", backgroundColor: "#00000000", strokeWidth: 4, strokeColor: "#ffffff", animationIn: "zoom", shadow: false, y: 0 },
  { id: "minimal", name: "Minimal", text: "minimal.", fontFamily: "Trebuchet MS", fontSize: 48, fontWeight: 300, color: "#f4f4f5", backgroundColor: "#00000000", strokeWidth: 0, strokeColor: "#000", animationIn: "fade", shadow: false, y: 0 },
  { id: "neon", name: "Neon", text: "NEON", fontFamily: "Arial Black", fontSize: 80, fontWeight: 700, color: "#39ffb6", backgroundColor: "#00000000", strokeWidth: 0, strokeColor: "#000", animationIn: "pop", shadow: true, y: 0 },
  { id: "quote", name: "Quote", text: "“Great stories\nstart here.”", fontFamily: "Georgia", fontSize: 44, fontWeight: 400, color: "#fff7ed", backgroundColor: "#00000000", strokeWidth: 0, strokeColor: "#000", animationIn: "slide-up", shadow: true, y: 0 },
  { id: "location", name: "Location", text: "📍 LOS ANGELES, CA", fontFamily: "Segoe UI", fontSize: 28, fontWeight: 600, color: "#ffffff", backgroundColor: "#00000099", strokeWidth: 0, strokeColor: "#000", animationIn: "slide-up", shadow: false, y: 420 },
  { id: "type", name: "Typewriter", text: "Once upon a time…", fontFamily: "Courier New", fontSize: 36, fontWeight: 600, color: "#f5f5f4", backgroundColor: "#00000000", strokeWidth: 0, strokeColor: "#000", animationIn: "typewriter", shadow: true, y: 0 },
  { id: "big", name: "Poster", text: "NOW PLAYING", fontFamily: "Impact", fontSize: 108, fontWeight: 700, color: "#ff3b5c", backgroundColor: "#00000000", strokeWidth: 0, strokeColor: "#000", animationIn: "zoom", shadow: true, y: 0 },
];

export const EFFECTS: { id: string; name: string; desc: string; apply: Record<string, number | boolean | string> }[] = [
  { id: "blur", name: "Gaussian Blur", desc: "Soft defocus", apply: { blur: 8 } },
  { id: "vignette", name: "Vignette", desc: "Darken edges", apply: { vignette: 0.55 } },
  { id: "grain", name: "Film Grain", desc: "Organic texture", apply: { grain: 0.4 } },
  { id: "glow", name: "Glow", desc: "Soft light bloom", apply: { glow: 0.6 } },
  { id: "sharpen", name: "Sharpen", desc: "Crisp detail", apply: { sharpen: 40 } },
  { id: "pixel", name: "Pixelate", desc: "Mosaic blocks", apply: { pixelate: 12 } },
  { id: "mirror", name: "Mirror", desc: "Horizontal split", apply: { mirror: true } },
  { id: "invert", name: "Invert", desc: "Negative image", apply: { invert: true } },
  { id: "chroma", name: "Green Screen", desc: "Key out green", apply: { chromaKey: true } },
  { id: "duotone", name: "Duotone", desc: "Two-color grade", apply: { duotone: true } },
  { id: "leak", name: "Light Leak", desc: "Analog flare", apply: { lightLeak: 0.55 } },
  { id: "dream", name: "Dream", desc: "Hazy glow look", apply: { blur: 2, glow: 0.4, saturation: 120 } },
];

export const STICKERS: { cat: string; items: string[] }[] = [
  { cat: "Smileys", items: ["😀", "😂", "😍", "🥳", "😎", "🤩", "😭", "😱", "🤔", "😇", "😴", "🤯"] },
  { cat: "Gestures", items: ["👍", "👏", "🙌", "✌️", "🤝", "💪", "🙏", "👌", "🔥", "❤️", "💯", "✨"] },
  { cat: "Objects", items: ["🎬", "🎥", "🎤", "🎧", "🎮", "🏆", "💎", "⚡", "🌈", "⭐", "🎵", "📌"] },
  { cat: "Nature", items: ["🌸", "🍀", "🌞", "🌙", "⭐", "🌊", "❄️", "🍁", "🐶", "🐱", "🦊", "🐼"] },
  { cat: "Food", items: ["🍕", "🍔", "🍟", "🍩", "🍰", "☕", "🍷", "🥤", "🍓", "🥑", "🍿", "🍫"] },
  { cat: "Symbols", items: ["➡️", "⭐", "❗", "❓", "✅", "❌", "⭕", "🔴", "🟢", "🔵", "🖤", "🤍"] },
];

export const SHAPES: { id: "rect" | "roundrect" | "ellipse" | "triangle" | "star" | "arrow" | "line" | "heart"; name: string }[] = [
  { id: "rect", name: "Rectangle" },
  { id: "roundrect", name: "Rounded" },
  { id: "ellipse", name: "Ellipse" },
  { id: "triangle", name: "Triangle" },
  { id: "star", name: "Star" },
  { id: "arrow", name: "Arrow" },
  { id: "line", name: "Line" },
  { id: "heart", name: "Heart" },
];

export const SPEED_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
