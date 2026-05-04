
// src/types/video.ts

export interface FilterSettings {
  brightness: number;
  contrast: number;
  saturate: number;
  grayscale: number;
  temperature: number;
  tint: number;
}

export interface TrimSettings {
  start: number;
  end: number;
}

export interface TransformSettings {
  position: { x: number; y: number };
  scale: { x: number; y: number };
  rotation: number;
}

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

export interface AudioTrack {
  id: string;
  file: File;
  src: string;
  name: string;
  duration: number;
  start: number;
}

export interface TextLayer {
  id:string;
  content: string;
  font: string;
  size: number;
  color: string;
  transform: TransformSettings;
  blendMode: BlendMode;
  start: number;
  duration: number;
}
