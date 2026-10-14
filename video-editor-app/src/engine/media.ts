import type { Asset } from "../types";
import { uid } from "../types";

export function sniffType(file: File): "video" | "audio" | "image" | null {
  const t = file.type;
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "audio";
  if (t.startsWith("image/")) return "image";
  const n = file.name.toLowerCase();
  if (/\.(mp4|webm|mov|mkv|avi|m4v|ogv)$/.test(n)) return "video";
  if (/\.(mp3|wav|aac|ogg|m4a|flac|wma)$/.test(n)) return "audio";
  if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(n)) return "image";
  return null;
}

function loadVideoMeta(url: string): Promise<{ duration: number; width: number; height: number; thumbnail: string }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;
    v.src = url;
    const fail = () => reject(new Error("Could not read video"));
    v.onerror = fail;
    v.onloadedmetadata = () => {
      const duration = isFinite(v.duration) ? v.duration : 5;
      const width = v.videoWidth || 1920;
      const height = v.videoHeight || 1080;
      const capture = () => {
        const c = document.createElement("canvas");
        const tw = 320;
        const th = Math.max(1, Math.round((height / width) * tw));
        c.width = tw;
        c.height = th;
        const ctx = c.getContext("2d");
        if (ctx) {
          try {
            ctx.drawImage(v, 0, 0, tw, th);
          } catch {
            /* empty */
          }
        }
        resolve({ duration, width, height, thumbnail: c.toDataURL("image/jpeg", 0.7) });
        v.src = "";
      };
      const t = Math.min(Math.max(0.15, duration * 0.12), Math.max(0, duration - 0.05));
      v.onseeked = capture;
      try {
        v.currentTime = t;
      } catch {
        capture();
      }
      setTimeout(() => {
        if (v.readyState >= 2) capture();
      }, 1200);
    };
  });
}

function loadAudioMeta(url: string): Promise<{ duration: number }> {
  return new Promise((resolve, reject) => {
    const a = document.createElement("audio");
    a.preload = "metadata";
    a.src = url;
    a.onerror = () => reject(new Error("Could not read audio"));
    a.onloadedmetadata = () => {
      resolve({ duration: isFinite(a.duration) ? a.duration : 5 });
    };
  });
}

function loadImageMeta(url: string): Promise<{ width: number; height: number; thumbnail: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      const tw = 320;
      const th = Math.max(1, Math.round((img.height / img.width) * tw));
      c.width = tw;
      c.height = th;
      c.getContext("2d")?.drawImage(img, 0, 0, tw, th);
      resolve({ width: img.naturalWidth, height: img.naturalHeight, thumbnail: c.toDataURL("image/jpeg", 0.75) });
    };
    img.onerror = () => reject(new Error("Could not read image"));
    img.src = url;
  });
}

export async function importFile(file: File): Promise<Asset> {
  const type = sniffType(file);
  if (!type) throw new Error(`Unsupported file: ${file.name}`);
  const url = URL.createObjectURL(file);
  const id = uid("asset");
  if (type === "video") {
    const meta = await loadVideoMeta(url);
    return { id, name: file.name, type, url, file, size: file.size, ...meta };
  }
  if (type === "audio") {
    const meta = await loadAudioMeta(url);
    return {
      id,
      name: file.name,
      type,
      url,
      file,
      size: file.size,
      duration: meta.duration,
      width: 0,
      height: 0,
      thumbnail: "",
    };
  }
  const meta = await loadImageMeta(url);
  return { id, name: file.name, type, url, file, size: file.size, duration: 5, ...meta };
}

export class MediaPool {
  videos = new Map<string, HTMLVideoElement>();
  images = new Map<string, HTMLImageElement>();
  audios = new Map<string, HTMLAudioElement>();
  buffers = new Map<string, AudioBuffer>();
  waveforms = new Map<string, number[]>();
  private actx: AudioContext | null = null;

  audioContext(): AudioContext {
    if (!this.actx) this.actx = new AudioContext();
    return this.actx;
  }

  getVideo(clipId: string, url: string): HTMLVideoElement {
    let v = this.videos.get(clipId);
    if (!v) {
      v = document.createElement("video");
      v.preload = "auto";
      v.muted = true;
      v.playsInline = true;
      v.crossOrigin = "anonymous";
      v.src = url;
      this.videos.set(clipId, v);
    } else if (v.src !== url && !v.src.endsWith(url) && v.getAttribute("data-url") !== url) {
      v.src = url;
    }
    v.setAttribute("data-url", url);
    return v;
  }

  getImage(assetId: string, url: string): HTMLImageElement {
    let img = this.images.get(assetId);
    if (!img) {
      img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      this.images.set(assetId, img);
    }
    return img;
  }

  getAudio(clipId: string, url: string): HTMLAudioElement {
    let a = this.audios.get(clipId);
    if (!a) {
      a = document.createElement("audio");
      a.preload = "auto";
      a.crossOrigin = "anonymous";
      a.src = url;
      this.audios.set(clipId, a);
    }
    return a;
  }

  async decodeAsset(asset: Asset): Promise<AudioBuffer | null> {
    if (this.buffers.has(asset.id)) return this.buffers.get(asset.id)!;
    if (asset.type === "image") return null;
    try {
      const buf = await (asset.file ? asset.file.arrayBuffer() : fetch(asset.url).then((r) => r.arrayBuffer()));
      const audio = await this.audioContext().decodeAudioData(buf.slice(0));
      this.buffers.set(asset.id, audio);
      this.waveforms.set(asset.id, buildWaveform(audio, 240));
      return audio;
    } catch {
      return null;
    }
  }

  disposeClip(clipId: string) {
    const v = this.videos.get(clipId);
    if (v) {
      v.pause();
      v.removeAttribute("src");
      v.load();
      this.videos.delete(clipId);
    }
    const a = this.audios.get(clipId);
    if (a) {
      a.pause();
      a.removeAttribute("src");
      a.load();
      this.audios.delete(clipId);
    }
  }

  pauseAll() {
    this.videos.forEach((v) => v.pause());
    this.audios.forEach((a) => a.pause());
  }
}

export function buildWaveform(buffer: AudioBuffer, buckets: number): number[] {
  const ch = buffer.getChannelData(0);
  const size = Math.floor(ch.length / buckets);
  const out: number[] = [];
  for (let i = 0; i < buckets; i++) {
    let peak = 0;
    const start = i * size;
    for (let j = 0; j < size; j++) {
      const v = Math.abs(ch[start + j] || 0);
      if (v > peak) peak = v;
    }
    out.push(peak);
  }
  return out;
}

export function seekMedia(el: HTMLMediaElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    if (!isFinite(time)) {
      resolve();
      return;
    }
    const t = Math.max(0, Math.min(time, isFinite(el.duration) ? el.duration - 0.001 : time));
    if (Math.abs(el.currentTime - t) < 0.03) {
      resolve();
      return;
    }
    let cleanupTimeout: any = null;
    const done = () => {
      el.removeEventListener("seeked", done);
      if (cleanupTimeout) clearTimeout(cleanupTimeout);
      resolve();
    };
    el.addEventListener("seeked", done, { once: true });
    try {
      el.currentTime = t;
    } catch {
      el.removeEventListener("seeked", done);
      resolve();
      return;
    }
    cleanupTimeout = setTimeout(() => {
      el.removeEventListener("seeked", done);
      resolve();
    }, 150);
  });
}
