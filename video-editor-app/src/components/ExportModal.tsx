import { Loader2, X } from "lucide-react";
import { useState } from "react";
import type { EditorApi } from "../editor/useEditor";
import { exportVideo } from "../engine/exporter";
import { downloadBlob } from "../utils/time";
import type { ExportOptions } from "../types";

export function ExportModal({
  editor,
  canvasRef,
  onClose,
}: {
  editor: EditorApi;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onClose: () => void;
}) {
  const { state } = editor;
  const [res, setRes] = useState<"720" | "1080" | "source">("1080");
  const [fps, setFps] = useState(state.project.fps);
  const [quality, setQuality] = useState<ExportOptions["quality"]>("high");
  const [includeAudio, setIncludeAudio] = useState(true);
  const [progress, setProgress] = useState<null | { p: number; stage: string }>(null);
  const [error, setError] = useState("");
  const abort = { aborted: false };

  const run = async () => {
    setError("");
    const ar = state.project.width / state.project.height;
    let width = state.project.width;
    let height = state.project.height;
    if (res === "1080") {
      if (ar >= 1) {
        height = 1080;
        width = Math.round(1080 * ar) & ~1;
      } else {
        width = 1080;
        height = Math.round(1080 / ar) & ~1;
      }
    } else if (res === "720") {
      if (ar >= 1) {
        height = 720;
        width = Math.round(720 * ar) & ~1;
      } else {
        width = 720;
        height = Math.round(720 / ar) & ~1;
      }
    }
    width = width - (width % 2);
    height = height - (height % 2);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    abort.aborted = false;
    setProgress({ p: 0, stage: "Starting…" });
    try {
      editor.pool.pauseAll();
      editor.setState((s) => ({ ...s, playing: false }));
      const { blob, ext } = await exportVideo(
        canvas,
        ctx,
        state.project,
        state.clips,
        state.tracks,
        state.assets,
        editor.pool,
        { width, height, fps, quality, includeAudio },
        (p) => setProgress({ p: p.progress, stage: p.stage }),
        abort,
      );
      const safe = state.project.name.replace(/[^\w\- ]+/g, "").trim() || "editroy_video";
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'start-export-ad', fileName: `${safe}.${ext}` }, '*');
        }
      } catch (e) {}
      downloadBlob(blob, `${safe}.${ext}`);
      onClose();
    } catch (e) {
      if ((e as Error).message === "cancelled") return;
      setError((e as Error).message || "Export failed. Try 720p or another browser (Chrome/Edge recommended).");
    } finally {
      setProgress(null);
      void canvasRef;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-[#16161c] p-5 shadow-2xl ring-1 ring-zinc-700">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Export MP4</h2>
          <button
            type="button"
            onClick={() => {
              abort.aborted = true;
              onClose();
            }}
            className="text-zinc-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-4 text-[11px] leading-relaxed text-zinc-500">
          Encodes locally with WebCodecs — no uploads, no watermark. Chrome or Edge recommended for H.264 MP4.
        </p>
        <label className="mb-3 block text-[11px] text-zinc-400">
          Resolution
          <select
            value={res}
            onChange={(e) => setRes(e.target.value as typeof res)}
            className="mt-1 w-full rounded-md bg-zinc-900 px-2 py-2 text-sm text-zinc-100 ring-1 ring-zinc-700"
          >
            <option value="720">HD 720p</option>
            <option value="1080">Full HD 1080p</option>
            <option value="source">Project ({state.project.width}×{state.project.height})</option>
          </select>
        </label>
        <label className="mb-3 block text-[11px] text-zinc-400">
          Frame rate
          <select
            value={fps}
            onChange={(e) => setFps(Number(e.target.value))}
            className="mt-1 w-full rounded-md bg-zinc-900 px-2 py-2 text-sm text-zinc-100 ring-1 ring-zinc-700"
          >
            {[24, 25, 30, 60].map((f) => (
              <option key={f} value={f}>
                {f} fps
              </option>
            ))}
          </select>
        </label>
        <label className="mb-3 block text-[11px] text-zinc-400">
          Quality
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value as typeof quality)}
            className="mt-1 w-full rounded-md bg-zinc-900 px-2 py-2 text-sm text-zinc-100 ring-1 ring-zinc-700"
          >
            <option value="draft">Draft — faster</option>
            <option value="high">High</option>
            <option value="ultra">Ultra</option>
          </select>
        </label>
        <label className="mb-4 flex items-center gap-2 text-xs text-zinc-300">
          <input type="checkbox" checked={includeAudio} onChange={(e) => setIncludeAudio(e.target.checked)} />
          Include audio
        </label>
        {progress && (
          <div className="mb-4">
            <div className="mb-1 flex justify-between text-[11px] text-zinc-400">
              <span>{progress.stage}</span>
              <span>{Math.round(progress.p * 100)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400" style={{ width: `${progress.p * 100}%` }} />
            </div>
          </div>
        )}
        {error && <div className="mb-3 rounded-md bg-rose-500/10 p-2 text-[11px] text-rose-300">{error}</div>}
        <button
          type="button"
          disabled={!!progress || state.clips.length === 0}
          onClick={() => void run()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-400 to-cyan-400 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-40"
        >
          {progress ? <Loader2 className="h-4 w-4 nx-spin" /> : null}
          {progress ? "Exporting…" : "Export MP4"}
        </button>
      </div>
    </div>
  );
}
