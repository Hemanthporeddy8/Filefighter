export type Filters = {
  brightness: number; // 100 default
  contrast: number; // 100
  saturate: number; // 100
  hue: number; // 0
  blur: number; // 0 px
  grayscale: number; // 0
  sepia: number; // 0
  invert: number; // 0
};

export const defaultFilters: Filters = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  hue: 0,
  blur: 0,
  grayscale: 0,
  sepia: 0,
  invert: 0,
};

export type Shadow = { enabled: boolean; color: string; blur: number; x: number; y: number };

export type BaseLayer = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees
  opacity: number; // 0..1
  visible: boolean;
  locked: boolean;
  flipX: boolean;
  flipY: boolean;
  blend: GlobalCompositeOperation;
  filters: Filters;
  shadow: Shadow;
  cornerRadius: number;
  /** optional keyframe animation (used by the timeline) */
  anim?: Anim;
};

export type PathLayer = BaseLayer & {
  type: "path";
  pathType: "freehand" | "line" | "arrow" | "polygon";
  /** points in layer-local space (0,0 = layer top-left) */
  points: { x: number; y: number }[];
  stroke: { enabled: boolean; color: string; width: number };
  fill: string;
  filled: boolean;
  closed: boolean;
  smooth: boolean;
};

export type ImageLayer = BaseLayer & {
  type: "image";
  src: string;
  crop: { x: number; y: number; w: number; h: number } | null; // normalized 0..1
};

export type TextLayer = BaseLayer & {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  color: string;
  align: "left" | "center" | "right";
  lineHeight: number;
  letterSpacing: number;
  stroke: { enabled: boolean; color: string; width: number };
  gradient: { enabled: boolean; from: string; to: string; angle: number };
  uppercase: boolean;
};

export type AnimKind = "none" | "fade" | "slide" | "zoom" | "rotate" | "bounce";
export type Anim = { kind: AnimKind; duration: number; delay: number; easing: string };

export type ShapeKind = "rect" | "ellipse" | "triangle" | "star" | "line" | "heart" | "hexagon";

export type ShapeLayer = BaseLayer & {
  type: "shape";
  shape: ShapeKind;
  fill: string;
  gradient: { enabled: boolean; from: string; to: string; angle: number };
  stroke: { enabled: boolean; color: string; width: number };
};

export type Layer = ImageLayer | TextLayer | ShapeLayer | PathLayer;

export type Doc = {
  id: number | null;
  name: string;
  width: number;
  height: number;
  background: string;
  layers: Layer[];
};

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function baseLayer(partial: Partial<BaseLayer> = {}): BaseLayer {
  return {
    id: uid(),
    name: "Layer",
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    flipX: false,
    flipY: false,
    blend: "source-over",
    filters: { ...defaultFilters },
    shadow: { enabled: false, color: "rgba(0,0,0,0.5)", blur: 20, x: 0, y: 10 },
    cornerRadius: 0,
    ...partial,
  };
}

/** Fonts actually loaded from Google Fonts by the editor. */
export const FONTS = [
  "Inter",
  "Poppins",
  "Montserrat",
  "Roboto",
  "Open Sans",
  "Lato",
  "Oswald",
  "Bebas Neue",
  "Playfair Display",
  "Merriweather",
  "Raleway",
  "Nunito",
  "Pacifico",
  "Dancing Script",
  "Impact",
  "Georgia",
  "Courier New",
  "Verdana",
];

export const BLENDS: GlobalCompositeOperation[] = [
  "source-over",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
];

export const PRESETS: { name: string; filters: Partial<Filters> }[] = [
  { name: "Original", filters: {} },
  { name: "Vivid", filters: { saturate: 150, contrast: 110 } },
  { name: "Noir", filters: { grayscale: 100, contrast: 130, brightness: 95 } },
  { name: "Vintage", filters: { sepia: 60, contrast: 90, brightness: 105, saturate: 80 } },
  { name: "Cool", filters: { hue: 200, saturate: 110 } },
  { name: "Warm", filters: { sepia: 25, saturate: 130, brightness: 105 } },
  { name: "Dramatic", filters: { contrast: 150, brightness: 90, saturate: 90 } },
  { name: "Faded", filters: { contrast: 80, brightness: 110, saturate: 70 } },
  { name: "Dreamy", filters: { blur: 1.5, brightness: 110, saturate: 120 } },
  { name: "Invert", filters: { invert: 100 } },
  { name: "Pop", filters: { saturate: 200, contrast: 120, hue: 15 } },
  { name: "Mono Soft", filters: { grayscale: 100, contrast: 85, brightness: 110 } },
];

export const CANVAS_SIZES = [
  { name: "Instagram Post", w: 1080, h: 1080 },
  { name: "Instagram Story", w: 1080, h: 1920 },
  { name: "YouTube Thumbnail", w: 1280, h: 720 },
  { name: "Facebook Cover", w: 1640, h: 924 },
  { name: "Twitter / X Post", w: 1600, h: 900 },
  { name: "LinkedIn Banner", w: 1584, h: 396 },
  { name: "Presentation 16:9", w: 1920, h: 1080 },
  { name: "A4 Poster", w: 2480, h: 3508 },
  { name: "Business Card", w: 1050, h: 600 },
  { name: "Square HD", w: 2048, h: 2048 },
];
