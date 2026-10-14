export type ClipKind = "video" | "audio" | "image" | "text" | "sticker" | "shape" | "solid";
export type TrackType = "video" | "overlay" | "text" | "audio";
export type Tool = "select" | "razor" | "hand";
export type SidebarTab =
  | "media"
  | "audio"
  | "text"
  | "stickers"
  | "effects"
  | "transitions"
  | "filters"
  | "captions";
export type FitMode = "contain" | "cover" | "stretch";
export type BlendMode = "source-over" | "multiply" | "screen" | "overlay" | "lighten" | "darken" | "plus-lighter";
export type Ease = "linear" | "ease-in" | "ease-out" | "ease-in-out";
export type AnimIn =
  | "none"
  | "fade"
  | "slide-up"
  | "slide-down"
  | "slide-left"
  | "slide-right"
  | "pop"
  | "bounce"
  | "typewriter"
  | "zoom"
  | "rotate-in";
export type AnimOut = "none" | "fade" | "slide-up" | "slide-down" | "pop" | "zoom";
export type TransitionType =
  | "none"
  | "fade"
  | "dissolve"
  | "wipe-left"
  | "wipe-right"
  | "wipe-up"
  | "wipe-down"
  | "slide-left"
  | "slide-right"
  | "zoom"
  | "flash"
  | "black"
  | "circle";
export type ShapeType = "rect" | "roundrect" | "ellipse" | "triangle" | "star" | "arrow" | "line" | "heart";
export type MaskType = "none" | "rect" | "ellipse";
export type KeyProp = "x" | "y" | "scale" | "rotation" | "opacity";

export interface Keyframe {
  time: number;
  property: KeyProp;
  value: number;
  easing: Ease;
}

export interface Asset {
  id: string;
  name: string;
  type: "video" | "audio" | "image";
  url: string;
  duration: number;
  width: number;
  height: number;
  thumbnail: string;
  file?: File;
  size: number;
}

export interface Track {
  id: string;
  name: string;
  type: TrackType;
  locked: boolean;
  muted: boolean;
  hidden: boolean;
  volume: number;
}

export interface Clip {
  id: string;
  trackId: string;
  assetId: string | null;
  kind: ClipKind;
  name: string;
  start: number;
  duration: number;
  inPoint: number;
  outPoint: number;
  speed: number;
  reverse: boolean;
  x: number;
  y: number;
  scale: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  fit: FitMode;
  flipH: boolean;
  flipV: boolean;
  blend: BlendMode;
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  temperature: number;
  tint: number;
  highlights: number;
  shadows: number;
  blur: number;
  vignette: number;
  grain: number;
  sharpen: number;
  filterId: string;
  chromaKey: boolean;
  chromaColor: string;
  chromaSim: number;
  chromaSmooth: number;
  pixelate: number;
  invert: boolean;
  duotone: boolean;
  duotoneA: string;
  duotoneB: string;
  mask: MaskType;
  glow: number;
  lightLeak: number;
  mirror: boolean;
  transitionIn: TransitionType;
  transitionOut: TransitionType;
  transitionDur: number;
  animationIn: AnimIn;
  animationOut: AnimOut;
  animDur: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  backgroundColor: string;
  strokeColor: string;
  strokeWidth: number;
  align: "left" | "center" | "right";
  letterSpacing: number;
  lineHeight: number;
  italic: boolean;
  underline: boolean;
  shadow: boolean;
  shadowColor: string;
  shadowBlur: number;
  padX: number;
  padY: number;
  radius: number;
  sticker: string;
  shape: ShapeType;
  fill: string;
  stroke: string;
  shapeStroke: number;
  keyframes: Keyframe[];
}

export interface Project {
  name: string;
  width: number;
  height: number;
  fps: number;
  background: string;
  aspect: string;
}

export interface EditorState {
  project: Project;
  tracks: Track[];
  clips: Clip[];
  assets: Asset[];
  selectedIds: string[];
  currentTime: number;
  playing: boolean;
  loop: boolean;
  tool: Tool;
  snap: boolean;
  ripple: boolean;
  pixelsPerSecond: number;
  sidebarTab: SidebarTab;
  volume: number;
  muted: boolean;
  showSafeArea: boolean;
  showGrid: boolean;
}

export interface ExportOptions {
  width: number;
  height: number;
  fps: number;
  quality: "draft" | "high" | "ultra";
  includeAudio: boolean;
}

export const ASPECTS: { id: string; label: string; w: number; h: number }[] = [
  { id: "16:9", label: "YouTube 16:9", w: 1920, h: 1080 },
  { id: "9:16", label: "TikTok / Reels 9:16", w: 1080, h: 1920 },
  { id: "1:1", label: "Square 1:1", w: 1080, h: 1080 },
  { id: "4:5", label: "Portrait 4:5", w: 1080, h: 1350 },
  { id: "4:3", label: "Classic 4:3", w: 1440, h: 1080 },
  { id: "21:9", label: "Cinematic 21:9", w: 2560, h: 1080 },
];

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

export function defaultClip(partial: Partial<Clip> & Pick<Clip, "kind" | "trackId" | "name">): Clip {
  return {
    id: uid("clip"),
    assetId: null,
    start: 0,
    duration: 3,
    inPoint: 0,
    outPoint: 3,
    speed: 1,
    reverse: false,
    x: 0,
    y: 0,
    scale: 1,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    opacity: 1,
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
    fit: "contain",
    flipH: false,
    flipV: false,
    blend: "source-over",
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hue: 0,
    temperature: 0,
    tint: 0,
    highlights: 0,
    shadows: 0,
    blur: 0,
    vignette: 0,
    grain: 0,
    sharpen: 0,
    filterId: "none",
    chromaKey: false,
    chromaColor: "#00ff00",
    chromaSim: 0.32,
    chromaSmooth: 0.12,
    pixelate: 0,
    invert: false,
    duotone: false,
    duotoneA: "#002244",
    duotoneB: "#ffcc88",
    mask: "none",
    glow: 0,
    lightLeak: 0,
    mirror: false,
    transitionIn: "none",
    transitionOut: "none",
    transitionDur: 0.4,
    animationIn: "none",
    animationOut: "none",
    animDur: 0.4,
    text: "Your text here",
    fontFamily: "Arial",
    fontSize: 64,
    fontWeight: 700,
    color: "#ffffff",
    backgroundColor: "#00000000",
    strokeColor: "#000000",
    strokeWidth: 0,
    align: "center",
    letterSpacing: 0,
    lineHeight: 1.2,
    italic: false,
    underline: false,
    shadow: true,
    shadowColor: "#000000aa",
    shadowBlur: 8,
    padX: 16,
    padY: 8,
    radius: 8,
    sticker: "🔥",
    shape: "roundrect",
    fill: "#2ee6a6",
    stroke: "#ffffff",
    shapeStroke: 0,
    keyframes: [],
    ...partial,
  };
}

export function defaultTracks(): Track[] {
  return [
    { id: "t_text2", name: "Text 2", type: "text", locked: false, muted: false, hidden: false, volume: 1 },
    { id: "t_text1", name: "Text 1", type: "text", locked: false, muted: false, hidden: false, volume: 1 },
    { id: "t_ov2", name: "Overlay 2", type: "overlay", locked: false, muted: false, hidden: false, volume: 1 },
    { id: "t_ov1", name: "Overlay 1", type: "overlay", locked: false, muted: false, hidden: false, volume: 1 },
    { id: "t_main", name: "Main", type: "video", locked: false, muted: false, hidden: false, volume: 1 },
    { id: "t_aud1", name: "Audio 1", type: "audio", locked: false, muted: false, hidden: false, volume: 1 },
    { id: "t_aud2", name: "Audio 2", type: "audio", locked: false, muted: false, hidden: false, volume: 1 },
  ];
}

export function initialState(): EditorState {
  return {
    project: {
      name: "Untitled Project",
      width: 1920,
      height: 1080,
      fps: 30,
      background: "#000000",
      aspect: "16:9",
    },
    tracks: defaultTracks(),
    clips: [],
    assets: [],
    selectedIds: [],
    currentTime: 0,
    playing: false,
    loop: false,
    tool: "select",
    snap: true,
    ripple: false,
    pixelsPerSecond: 80,
    sidebarTab: "media",
    volume: 1,
    muted: false,
    showSafeArea: false,
    showGrid: false,
  };
}

export function timelineDuration(clips: Clip[]): number {
  if (clips.length === 0) return 8;
  return Math.max(8, ...clips.map((c) => c.start + c.duration)) + 1.5;
}

export function clipSourceDuration(clip: Clip): number {
  return Math.max(0.05, clip.outPoint - clip.inPoint);
}
