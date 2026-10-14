import type { Asset, Clip, Track } from "../types";
import { isActive, sourceTime } from "./compositor";
import type { MediaPool } from "./media";

export function reverseBuffer(buffer: AudioBuffer): AudioBuffer {
  const ctx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  const copy = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c);
    const dst = copy.getChannelData(c);
    for (let i = 0, n = src.length; i < n; i++) dst[i] = src[n - 1 - i];
  }
  return copy;
}

export async function mixAudio(
  clips: Clip[],
  tracks: Track[],
  assets: Asset[],
  pool: MediaPool,
  duration: number,
  masterVolume: number,
): Promise<AudioBuffer> {
  const sampleRate = 48000;
  const length = Math.max(1, Math.ceil(Math.max(0.1, duration) * sampleRate));
  const ctx = new OfflineAudioContext(2, length, sampleRate);

  for (const clip of clips) {
    if (clip.kind !== "audio" && clip.kind !== "video") continue;
    const track = tracks.find((t) => t.id === clip.trackId);
    if (!track || track.muted) continue;
    if ((clip.volume ?? 1) <= 0.001) continue;
    const asset = assets.find((a) => a.id === clip.assetId);
    if (!asset) continue;
    const raw = await pool.decodeAsset(asset);
    if (!raw) continue;
    const buffer = clip.reverse ? reverseBuffer(raw) : raw;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = Math.max(0.25, Math.min(4, clip.speed || 1));
    const gain = ctx.createGain();
    const vol = (clip.volume ?? 1) * (track.volume ?? 1) * masterVolume;
    const start = Math.max(0, clip.start);
    const fadeIn = clip.fadeIn || 0;
    const fadeOut = clip.fadeOut || 0;
    gain.gain.setValueAtTime(fadeIn > 0 ? 0 : vol, start);
    if (fadeIn > 0) gain.gain.linearRampToValueAtTime(vol, start + fadeIn);
    if (fadeOut > 0) {
      const fo = Math.max(start, start + clip.duration - fadeOut);
      gain.gain.setValueAtTime(vol, fo);
      gain.gain.linearRampToValueAtTime(0, start + clip.duration);
    }
    source.connect(gain);
    gain.connect(ctx.destination);
    const offset = Math.max(0, clip.inPoint);
    const dur = Math.max(0.01, clip.outPoint - clip.inPoint);
    try {
      source.start(start, offset, dur);
    } catch {
      /* ignore */
    }
  }

  return ctx.startRendering();
}

export function syncPreviewAudio(
  time: number,
  playing: boolean,
  clips: Clip[],
  tracks: Track[],
  assets: Asset[],
  pool: MediaPool,
  masterVolume: number,
  muted: boolean,
) {
  const active = new Set<string>();
  for (const clip of clips) {
    if (clip.kind !== "audio" && clip.kind !== "video") continue;
    const track = tracks.find((t) => t.id === clip.trackId);
    if (!track || track.muted) {
      const existing = pool.audios.get(clip.id);
      if (existing && !existing.paused) existing.pause();
      continue;
    }
    const asset = assets.find((a) => a.id === clip.assetId);
    if (!asset || (asset.type !== "audio" && asset.type !== "video")) continue;
    const el = pool.getAudio(clip.id, asset.url);
    if (!isActive(clip, time)) {
      if (!el.paused) el.pause();
      continue;
    }
    active.add(clip.id);
    const vol = muted ? 0 : (clip.volume ?? 1) * (track.volume ?? 1) * masterVolume;
    el.volume = Math.max(0, Math.min(1, vol));
    const st = sourceTime(clip, time);
    const rate = Math.max(0.25, Math.min(4, clip.speed || 1));
    try {
      el.playbackRate = rate;
    } catch {
      /* some rates unsupported */
    }
    if (playing) {
      if (Math.abs(el.currentTime - st) > 0.25) {
        try {
          el.currentTime = st;
        } catch {
          /* ignore */
        }
      }
      if (el.paused) {
        el.play().catch(() => {
          /* autoplay */
        });
      }
    } else if (!el.paused) {
      el.pause();
      try {
        el.currentTime = st;
      } catch {
        /* ignore */
      }
    }
  }
  pool.audios.forEach((el, id) => {
    if (!active.has(id) && !el.paused) el.pause();
  });
}
