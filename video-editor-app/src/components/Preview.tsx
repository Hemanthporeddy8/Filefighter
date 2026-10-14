import {
  Grid3x3,
  Maximize2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Square,
  StepBack,
  StepForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useRef } from "react";
import type { EditorApi } from "../editor/useEditor";
import { syncPreviewAudio } from "../engine/audio";
import { isActive, renderComposition, sourceTime } from "../engine/compositor";
import { formatTimecode } from "../utils/time";
import { IconBtn } from "./ui";

export function Preview({ editor, canvasRef }: { editor: EditorApi; canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const { state, pool, duration } = editor;
  const stateRef = useRef(state);
  stateRef.current = state;
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const playingRef = useRef(false);
  playingRef.current = state.playing;
  const lastRef = useRef<number | null>(null);
  const lastUi = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    let raf = 0;

    const lastRenderTime = { current: -1 };
    let lastState = stateRef.current;

    const containerSize = {
      w: wrapRef.current?.clientWidth || 960,
      h: wrapRef.current?.clientHeight || 540,
    };
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && wrapRef.current) {
      ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            containerSize.w = entry.contentRect.width;
            containerSize.h = entry.contentRect.height;
            lastRenderTime.current = -1; // force re-render on resize
          }
        }
      });
      ro.observe(wrapRef.current);
    }

    const tick = (now: number) => {
      const ed = editorRef.current;
      const s = stateRef.current;
      const { project, clips, tracks, assets } = s;
      const isPlaying = playingRef.current;
      const currTime = ed.timeRef.current;

      const timeChanged = Math.abs(currTime - lastRenderTime.current) > 0.001;
      const stateChanged = s !== lastState;

      // When paused and idle, avoid any calculations or DOM operations
      if (!isPlaying && !timeChanged && !stateChanged) {
        raf = requestAnimationFrame(tick);
        return;
      }
      lastState = s;

      if (isPlaying) {
        if (lastRef.current == null) lastRef.current = now;
        const dt = Math.min(0.08, (now - lastRef.current) / 1000);
        lastRef.current = now;
        let t = ed.timeRef.current + dt;
        const dur = Math.max(0.2, duration);
        if (t >= dur) {
          if (s.loop) t = 0;
          else {
            t = dur;
            ed.timeRef.current = t;
            ed.setState((st) => ({ ...st, playing: false, currentTime: dur }));
            pool.pauseAll();
          }
        }
        ed.timeRef.current = t;
        // Throttle React state updates to 5 times per second to prevent timeline re-render stutter
        if (now - lastUi.current > 200) {
          lastUi.current = now;
          ed.setState((st) => ({ ...st, currentTime: t }));
        }
        for (const clip of clips) {
          if (clip.kind !== "video" || !clip.assetId) continue;
          const asset = assets.find((a) => a.id === clip.assetId);
          if (!asset) continue;
          const v = pool.getVideo(clip.id, asset.url);
          v.muted = true;
          if (isActive(clip, t) && !clip.reverse) {
            try {
              v.playbackRate = Math.max(0.25, Math.min(4, clip.speed));
            } catch {
              /* ignore */
            }
            if (v.paused) {
              v.currentTime = sourceTime(clip, t);
              v.play().catch(() => {});
            } else if (!v.seeking && Math.abs(v.currentTime - sourceTime(clip, t)) > 0.4) {
              // Only re-sync when drift is significant to avoid decoder stutter
              v.currentTime = sourceTime(clip, t);
            }
          } else if (!v.paused) v.pause();
        }
        syncPreviewAudio(t, true, clips, tracks, assets, pool, s.volume, s.muted);
      } else {
        lastRef.current = null;
        const t = ed.timeRef.current;
        for (const clip of clips) {
          if (clip.kind !== "video" || !clip.assetId) continue;
          const asset = assets.find((a) => a.id === clip.assetId);
          if (!asset) continue;
          const v = pool.getVideo(clip.id, asset.url);
          if (!v.paused) v.pause();
          if (isActive(clip, t)) {
            const st = sourceTime(clip, t);
            // Guard against flooding decoder while seeking
            if (!v.seeking && Math.abs(v.currentTime - st) > 0.04) {
              try {
                v.currentTime = st;
              } catch {
                /* ignore */
              }
            }
          }
        }
        syncPreviewAudio(t, false, clips, tracks, assets, pool, s.volume, s.muted);
      }

      const maxW = containerSize.w;
      const maxH = containerSize.h;
      const ar = project.width / project.height;
      let w = maxW;
      let h = w / ar;
      if (h > maxH) {
        h = maxH;
        w = h * ar;
      }
      
      // Adaptive resolution cap for smooth preview performance
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      const targetW = Math.min(960, Math.max(320, Math.round(w * dpr)));
      const targetH = Math.max(2, Math.round(targetW / ar));
      const rw = targetW - (targetW % 2);
      const rh = targetH - (targetH % 2);

      if (canvas.width !== rw) canvas.width = rw;
      if (canvas.height !== rh) canvas.height = rh;
      canvas.style.width = `${Math.round(w)}px`;
      canvas.style.height = `${Math.round(h)}px`;

      lastRenderTime.current = ed.timeRef.current;
      renderComposition(ctx, {
        width: rw,
        height: rh,
        time: ed.timeRef.current,
        clips,
        tracks,
        assets,
        pool,
        background: project.background,
        showGrid: s.showGrid,
        showSafeArea: s.showSafeArea,
      });

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
    };
  }, [canvasRef, duration, editor, pool]);

  const step = (frames: number) => {
    const fps = state.project.fps || 30;
    editor.setTime(Math.max(0, state.currentTime + frames / fps));
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-[#070709]">
      <div ref={wrapRef} className="relative flex min-h-0 flex-1 items-center justify-center p-4">
        <div className="checker relative overflow-hidden rounded-lg shadow-[0_0_0_1px_#27272f,0_20px_60px_rgba(0,0,0,0.45)]">
          <canvas ref={canvasRef} className="block bg-black" />
          {state.clips.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
              <div className="text-sm font-medium text-zinc-300">Drop media to start editing</div>
              <div className="text-[11px] text-zinc-500">Video, audio, and images · everything stays on this device</div>
            </div>
          )}
        </div>
      </div>

      <div className="flex h-12 shrink-0 items-center gap-1 border-t border-zinc-800/80 bg-[#0c0c10] px-3">
        <IconBtn title="Start" onClick={() => editor.setTime(0)}>
          <SkipBack className="h-4 w-4" />
        </IconBtn>
        <IconBtn title="Previous frame" onClick={() => step(-1)}>
          <StepBack className="h-4 w-4" />
        </IconBtn>
        <button
          type="button"
          onClick={editor.togglePlay}
          className="mx-1 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-zinc-950 hover:bg-emerald-300"
          title="Play / Pause (Space)"
        >
          {state.playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current pl-0.5" />}
        </button>
        <IconBtn title="Next frame" onClick={() => step(1)}>
          <StepForward className="h-4 w-4" />
        </IconBtn>
        <IconBtn title="End" onClick={() => editor.setTime(duration)}>
          <SkipForward className="h-4 w-4" />
        </IconBtn>
        <IconBtn title="Stop" onClick={() => { editor.setTime(0); editor.setState((s) => ({ ...s, playing: false })); }}>
          <Square className="h-3.5 w-3.5" />
        </IconBtn>

        <div className="ml-3 font-mono text-xs tabular-nums text-zinc-300">
          {formatTimecode(state.currentTime, state.project.fps)}
          <span className="text-zinc-600"> / </span>
          {formatTimecode(duration, state.project.fps)}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <IconBtn
            title="Loop"
            active={state.loop}
            onClick={() => editor.setState((s) => ({ ...s, loop: !s.loop }))}
          >
            <span className="text-[10px] font-bold">LP</span>
          </IconBtn>
          <IconBtn
            title="Grid"
            active={state.showGrid}
            onClick={() => editor.setState((s) => ({ ...s, showGrid: !s.showGrid }))}
          >
            <Grid3x3 className="h-4 w-4" />
          </IconBtn>
          <IconBtn
            title="Safe area"
            active={state.showSafeArea}
            onClick={() => editor.setState((s) => ({ ...s, showSafeArea: !s.showSafeArea }))}
          >
            <Maximize2 className="h-4 w-4" />
          </IconBtn>
          <IconBtn title={state.muted ? "Unmute" : "Mute"} onClick={() => editor.setState((s) => ({ ...s, muted: !s.muted }))}>
            {state.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </IconBtn>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={state.volume}
            onChange={(e) => editor.setState((s) => ({ ...s, volume: Number(e.target.value) }))}
            className="w-20"
          />
        </div>
      </div>
    </div>
  );
}
