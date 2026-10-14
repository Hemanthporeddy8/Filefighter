import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  QUALITY_LOW,
  QUALITY_MEDIUM,
} from "mediabunny";
import type { Asset, Clip, ExportOptions, Project, Track } from "../types";
import { timelineDuration } from "../types";
import { mixAudio } from "./audio";
import { prepareFrame, renderComposition } from "./compositor";
import type { MediaPool } from "./media";

export interface ExportProgress {
  progress: number;
  stage: string;
}

export async function exportMp4(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  project: Project,
  clips: Clip[],
  tracks: Track[],
  assets: Asset[],
  pool: MediaPool,
  options: ExportOptions,
  onProgress: (p: ExportProgress) => void,
  signal: { aborted: boolean },
): Promise<Blob> {
  const width = options.width;
  const height = options.height;
  const fps = options.fps;
  const duration = Math.max(0.2, timelineDuration(clips) - 1.5);
  const frames = Math.max(1, Math.ceil(duration * fps));
  canvas.width = width;
  canvas.height = height;

  pool.pauseAll();

  const bitrate =
    options.quality === "ultra" ? QUALITY_HIGH : options.quality === "draft" ? QUALITY_LOW : QUALITY_MEDIUM;

  onProgress({ progress: 0.02, stage: "Mixing audio…" });
  let mixed: AudioBuffer | null = null;
  if (options.includeAudio) {
    try {
      mixed = await mixAudio(clips, tracks, assets, pool, duration, 1);
    } catch {
      mixed = null;
    }
  }
  if (signal.aborted) throw new Error("cancelled");

  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target,
  });

  const videoSource = new CanvasSource(canvas, {
    codec: "avc",
    bitrate,
  });
  output.addVideoTrack(videoSource, { frameRate: fps });

  let audioSource: AudioBufferSource | null = null;
  if (mixed && mixed.duration > 0) {
    try {
      audioSource = new AudioBufferSource({
        codec: "aac",
        bitrate: QUALITY_HIGH,
      });
      output.addAudioTrack(audioSource);
    } catch {
      audioSource = null;
    }
  }

  await output.start();

  if (audioSource && mixed) {
    try {
      onProgress({ progress: 0.08, stage: "Encoding audio…" });
      await audioSource.add(mixed);
    } catch {
      /* video-only if AAC isn't available */
    }
  }

  const dt = 1 / fps;
  for (let i = 0; i < frames; i++) {
    if (signal.aborted) {
      try {
        await output.cancel();
      } catch {
        /* ignore */
      }
      throw new Error("cancelled");
    }
    const time = i * dt;
    await prepareFrame({
      width,
      height,
      time,
      clips,
      tracks,
      assets,
      pool,
      background: project.background,
    });
    renderComposition(ctx, {
      width,
      height,
      time,
      clips,
      tracks,
      assets,
      pool,
      background: project.background,
    });
    await videoSource.add(time, dt);
    if (i % 3 === 0) {
      onProgress({
        progress: 0.1 + (i / frames) * 0.85,
        stage: `Rendering frame ${i + 1} / ${frames}`,
      });
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  onProgress({ progress: 0.96, stage: "Muxing MP4…" });
  await output.finalize();
  const buffer = target.buffer;
  if (!buffer) throw new Error("Export produced an empty file");
  onProgress({ progress: 1, stage: "Done" });
  return new Blob([buffer], { type: "video/mp4" });
}

export async function exportViaRecorder(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  project: Project,
  clips: Clip[],
  tracks: Track[],
  assets: Asset[],
  pool: MediaPool,
  options: ExportOptions,
  onProgress: (p: ExportProgress) => void,
  signal: { aborted: boolean },
): Promise<Blob> {
  const width = options.width;
  const height = options.height;
  const fps = Math.min(30, options.fps);
  canvas.width = width;
  canvas.height = height;
  const duration = Math.max(0.2, timelineDuration(clips) - 1.5);
  const stream = canvas.captureStream(fps);

  let mixed: AudioBuffer | null = null;
  try {
    mixed = await mixAudio(clips, tracks, assets, pool, duration, 1);
  } catch {
    mixed = null;
  }
  if (mixed) {
    const actx = new AudioContext();
    const dest = actx.createMediaStreamDestination();
    const src = actx.createBufferSource();
    src.buffer = mixed;
    src.connect(dest);
    src.connect(actx.destination);
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    src.start();
  }

  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<void>((resolve) => {
    rec.onstop = () => resolve();
  });
  rec.start(200);

  const frames = Math.ceil(duration * fps);
  const dt = 1 / fps;
  for (let i = 0; i < frames; i++) {
    if (signal.aborted) {
      rec.stop();
      throw new Error("cancelled");
    }
    const time = i * dt;
    await prepareFrame({ width, height, time, clips, tracks, assets, pool, background: project.background });
    renderComposition(ctx, { width, height, time, clips, tracks, assets, pool, background: project.background });
    if (i % 4 === 0) {
      onProgress({ progress: i / frames, stage: `Recording ${i + 1}/${frames}` });
      await new Promise((r) => setTimeout(r, 1000 / fps));
    } else {
      await new Promise((r) => setTimeout(r, 1000 / fps));
    }
  }
  rec.stop();
  await stopped;
  const type = rec.mimeType || mime || "video/mp4";
  return new Blob(chunks, { type });
}

function pickMime(): string {
  const types = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm",
  ];
  return types.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) || "";
}

export async function exportVideo(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  project: Project,
  clips: Clip[],
  tracks: Track[],
  assets: Asset[],
  pool: MediaPool,
  options: ExportOptions,
  onProgress: (p: ExportProgress) => void,
  signal: { aborted: boolean },
): Promise<{ blob: Blob; ext: string }> {
  try {
    const blob = await exportMp4(canvas, ctx, project, clips, tracks, assets, pool, options, onProgress, signal);
    return { blob, ext: "mp4" };
  } catch (e) {
    if (signal.aborted) throw e;
    onProgress({ progress: 0.05, stage: "Falling back to recorder…" });
    const blob = await exportViaRecorder(canvas, ctx, project, clips, tracks, assets, pool, options, onProgress, signal);
    const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("webm") ? "webm" : "mp4";
    return { blob, ext };
  }
}
