import {
  Copy,
  Eye,
  EyeOff,
  Lock,
  Magnet,
  Plus,
  Scissors,
  Trash2,
  Unlock,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { EditorApi } from "../editor/useEditor";
import type { Clip, Track } from "../types";
import { cn } from "../utils/cn";
import { formatClock } from "../utils/time";
import { IconBtn } from "./ui";

const KIND_COLOR: Record<string, string> = {
  video: "from-blue-600 to-indigo-600",
  image: "from-sky-600 to-cyan-700",
  audio: "from-emerald-700 to-teal-700",
  text: "from-amber-600 to-orange-700",
  sticker: "from-fuchsia-600 to-purple-700",
  shape: "from-rose-600 to-pink-700",
  solid: "from-zinc-600 to-zinc-700",
};

export function Timeline({ editor }: { editor: EditorApi }) {
  const { state } = editor;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<null | {
    type: "move" | "in" | "out" | "playhead";
    id?: string;
    startX: number;
    origStart: number;
    origDur: number;
    origIn: number;
    origOut: number;
    origSpeed: number;
  }>(null);

  const pps = state.pixelsPerSecond;
  const duration = Math.max(editor.duration, 8);
  const width = Math.max(800, duration * pps + 120);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      const rect = scrollRef.current?.querySelector("[data-lanes]")?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft || 0);
      const t = Math.max(0, x / pps);
      if (drag.type === "playhead") {
        editor.timeRef.current = t;
        editor.setState((s) => ({ ...s, currentTime: t, playing: false }));
        return;
      }
      if (!drag.id) return;
      if (drag.type === "move") {
        const dt = (e.clientX - drag.startX) / pps;
        const y = e.clientY - rect.top;
        const idx = Math.max(0, Math.min(editor.state.tracks.length - 1, Math.floor(y / 56)));
        const track = editor.state.tracks[idx];
        const patch: Partial<Clip> = { start: Math.max(0, drag.origStart + dt) };
        if (track && !track.locked) patch.trackId = track.id;
        editor.updateClipLive(drag.id, patch);
      } else if (drag.type === "in") {
        const clip = editor.state.clips.find((c) => c.id === drag.id);
        if (!clip) return;
        const end = drag.origStart + drag.origDur;
        const start = Math.min(end - 0.1, Math.max(0, t));
        const delta = start - clip.start;
        editor.updateClipLive(drag.id, {
          start,
          duration: end - start,
          inPoint: Math.max(0, clip.inPoint + delta * clip.speed),
        });
      } else if (drag.type === "out") {
        const clip = editor.state.clips.find((c) => c.id === drag.id);
        if (!clip) return;
        const dur = Math.max(0.1, t - clip.start);
        editor.updateClipLive(drag.id, { duration: dur, outPoint: clip.inPoint + dur * clip.speed });
      }
    };
    const onUp = () => {
      if (drag && drag.type !== "playhead") {
        const c = editor.state.clips.find((x) => x.id === drag.id);
        if (c) editor.updateClip(c.id, { start: c.start, duration: c.duration, inPoint: c.inPoint, outPoint: c.outPoint });
      }
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, editor, pps]);

  const onLaneClick = (e: React.MouseEvent, track: Track) => {
    const lanes = (e.currentTarget as HTMLElement).closest("[data-lanes]") as HTMLElement | null;
    if (!lanes) return;
    const x = e.clientX - lanes.getBoundingClientRect().left + (scrollRef.current?.scrollLeft || 0);
    const t = Math.max(0, x / pps);
    if (state.tool === "razor") {
      editor.setTime(t);
      editor.splitAtPlayhead();
      return;
    }
    editor.setTime(t);
    if ((e.target as HTMLElement).dataset.lane) editor.select([]);
    void track;
  };

  const ticks: number[] = [];
  const step = pps > 140 ? 0.5 : pps > 70 ? 1 : pps > 40 ? 2 : 5;
  for (let t = 0; t <= duration + 0.01; t += step) ticks.push(t);

  return (
    <div className="flex h-full flex-col border-t border-zinc-800/80 bg-[#0c0c10]">
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-zinc-800/80 px-2">
        <IconBtn title="Select (V)" active={state.tool === "select"} onClick={() => editor.setTool("select")}>
          <span className="text-[10px] font-bold">V</span>
        </IconBtn>
        <IconBtn title="Razor (C)" active={state.tool === "razor"} onClick={() => editor.setTool("razor")}>
          <Scissors className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn title="Split at playhead (S)" onClick={editor.splitAtPlayhead}>
          <span className="text-[10px] font-bold">|</span>
        </IconBtn>
        <IconBtn title="Duplicate (Ctrl+D)" onClick={editor.duplicateSelected}>
          <Copy className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn title="Delete" danger onClick={editor.deleteSelected}>
          <Trash2 className="h-3.5 w-3.5" />
        </IconBtn>
        <div className="mx-1 h-4 w-px bg-zinc-800" />
        <IconBtn title="Snap" active={state.snap} onClick={() => editor.setState((s) => ({ ...s, snap: !s.snap }))}>
          <Magnet className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn
          title="Ripple edit"
          active={state.ripple}
          onClick={() => editor.setState((s) => ({ ...s, ripple: !s.ripple }))}
        >
          <span className="text-[9px] font-bold">RP</span>
        </IconBtn>
        <div className="mx-1 h-4 w-px bg-zinc-800" />
        <IconBtn title="Zoom out" onClick={() => editor.setState((s) => ({ ...s, pixelsPerSecond: Math.max(20, s.pixelsPerSecond / 1.25) }))}>
          <ZoomOut className="h-3.5 w-3.5" />
        </IconBtn>
        <input
          type="range"
          min={20}
          max={260}
          value={pps}
          onChange={(e) => editor.setState((s) => ({ ...s, pixelsPerSecond: Number(e.target.value) }))}
          className="w-24"
        />
        <IconBtn title="Zoom in" onClick={() => editor.setState((s) => ({ ...s, pixelsPerSecond: Math.min(260, s.pixelsPerSecond * 1.25) }))}>
          <ZoomIn className="h-3.5 w-3.5" />
        </IconBtn>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => editor.addTrack("overlay")}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] text-zinc-400 hover:bg-zinc-800"
          >
            <Plus className="h-3 w-3" /> Overlay
          </button>
          <button
            type="button"
            onClick={() => editor.addTrack("audio")}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] text-zinc-400 hover:bg-zinc-800"
          >
            <Plus className="h-3 w-3" /> Audio
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="w-[132px] shrink-0 border-r border-zinc-800/80">
          <div className="h-7 border-b border-zinc-800/80" />
          {state.tracks.map((tr) => (
            <TrackHead key={tr.id} track={tr} onChange={(p) => editor.updateTrack(tr.id, p)} />
          ))}
        </div>
        <div ref={scrollRef} className="relative min-w-0 flex-1 overflow-auto nx-scroll">
          <div style={{ width }} className="relative">
            <div
              className="relative h-7 border-b border-zinc-800/80 bg-[#0a0a0e]"
              onPointerDown={(e) => {
                const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft || 0);
                const t = Math.max(0, x / pps);
                editor.timeRef.current = t;
                editor.setState((s) => ({ ...s, currentTime: t, playing: false }));
                setDrag({ type: "playhead", startX: e.clientX, origStart: t, origDur: 0, origIn: 0, origOut: 0, origSpeed: 1 });
              }}
            >
              {ticks.map((t) => (
                <div key={t} className="absolute top-0 h-full" style={{ left: t * pps }}>
                  <div className="h-2 w-px bg-zinc-600" />
                  <div className="ruler-label pl-1 text-[9px] text-zinc-500">{formatClock(t)}</div>
                </div>
              ))}
            </div>
            <div data-lanes className="relative">
              {state.tracks.map((tr) => (
                <div
                  key={tr.id}
                  data-lane="1"
                  className={cn("relative h-14 border-b border-zinc-800/60", tr.type === "audio" ? "bg-[#0b1210]" : "bg-[#0c0c12]")}
                  onClick={(e) => onLaneClick(e, tr)}
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("asset");
                    if (!id) return;
                    const lanes = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                    const t = Math.max(0, (e.clientX - lanes.left + (scrollRef.current?.scrollLeft || 0)) / pps);
                    editor.dropAssetOnTimeline(id, tr.id, t);
                  }}
                >
                  {state.clips
                    .filter((c) => c.trackId === tr.id)
                    .map((c) => (
                      <ClipView
                        key={c.id}
                        clip={c}
                        pps={pps}
                        selected={state.selectedIds.includes(c.id)}
                        locked={tr.locked}
                        razor={state.tool === "razor"}
                        peaks={c.assetId ? editor.pool.waveforms.get(c.assetId) : undefined}
                        onSelect={(add) => editor.select([c.id], add)}
                        onDragStart={(type, ev) => {
                          if (tr.locked) return;
                          editor.beginGesture();
                          setDrag({
                            type,
                            id: c.id,
                            startX: ev.clientX,
                            origStart: c.start,
                            origDur: c.duration,
                            origIn: c.inPoint,
                            origOut: c.outPoint,
                            origSpeed: c.speed,
                          });
                        }}
                      />
                    ))}
                </div>
              ))}
              <Playhead pps={pps} time={state.currentTime} timeRef={editor.timeRef} playing={state.playing} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Playhead({
  pps,
  time,
  timeRef,
  playing,
}: {
  pps: number;
  time: number;
  timeRef: React.MutableRefObject<number>;
  playing: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (ref.current) {
        const t = playing ? timeRef.current : time;
        ref.current.style.transform = `translateX(${t * pps}px)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pps, playing, time, timeRef]);
  return (
    <div ref={ref} className="pointer-events-none absolute top-0 z-20 h-full" style={{ transform: `translateX(${time * pps}px)` }}>
      <div className="absolute -top-7 left-1/2 h-7 w-0">
        <div className="absolute -left-1.5 top-0 h-0 w-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-emerald-400" />
      </div>
      <div className="h-full w-px bg-emerald-400 shadow-[0_0_8px_#2ee6a6]" />
    </div>
  );
}

function TrackHead({ track, onChange }: { track: Track; onChange: (p: Partial<Track>) => void }) {
  return (
    <div className="flex h-14 items-center gap-1 border-b border-zinc-800/60 px-2">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-medium text-zinc-300">{track.name}</div>
        <div className="text-[9px] uppercase tracking-wider text-zinc-600">{track.type}</div>
      </div>
      <button type="button" onClick={() => onChange({ locked: !track.locked })} className="text-zinc-500 hover:text-zinc-200">
        {track.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
      </button>
      <button type="button" onClick={() => onChange({ hidden: !track.hidden })} className="text-zinc-500 hover:text-zinc-200">
        {track.hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </button>
      {track.type === "audio" || track.type === "video" ? (
        <button type="button" onClick={() => onChange({ muted: !track.muted })} className="text-zinc-500 hover:text-zinc-200">
          {track.muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
        </button>
      ) : null}
    </div>
  );
}

function ClipView({
  clip,
  pps,
  selected,
  locked,
  razor,
  peaks,
  onSelect,
  onDragStart,
}: {
  clip: Clip;
  pps: number;
  selected: boolean;
  locked: boolean;
  razor: boolean;
  peaks?: number[];
  onSelect: (add: boolean) => void;
  onDragStart: (type: "move" | "in" | "out", e: React.PointerEvent) => void;
}) {
  return (
    <div
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect(e.shiftKey);
        if (!razor && !locked) onDragStart("move", e);
      }}
      className={cn(
        "absolute top-1.5 h-11 overflow-hidden rounded-md bg-gradient-to-r text-[10px] text-white shadow-sm",
        KIND_COLOR[clip.kind] || KIND_COLOR.video,
        selected ? "ring-2 ring-white" : "ring-1 ring-black/30",
        razor ? "cursor-cell" : "cursor-grab",
        locked && "opacity-50",
      )}
      style={{ left: clip.start * pps, width: Math.max(8, clip.duration * pps) }}
    >
      <div
        className="clip-handle left-0"
        onPointerDown={(e) => {
          e.stopPropagation();
          if (!locked) onDragStart("in", e);
        }}
      />
      <div
        className="clip-handle right-0"
        onPointerDown={(e) => {
          e.stopPropagation();
          if (!locked) onDragStart("out", e);
        }}
      />
      {clip.kind === "audio" && peaks && (
        <svg className="absolute inset-0 h-full w-full opacity-70" preserveAspectRatio="none" viewBox={`0 0 ${peaks.length} 40`}>
          {peaks.map((p, i) => (
            <rect key={i} x={i} y={20 - p * 18} width={1} height={Math.max(1, p * 36)} fill="white" opacity={0.7} />
          ))}
        </svg>
      )}
      <div className="relative z-10 truncate px-2 pt-1 font-medium drop-shadow">
        {clip.kind === "sticker" ? clip.sticker : clip.name}
      </div>
      <div className="relative z-10 px-2 text-[9px] text-white/70">{clip.duration.toFixed(2)}s</div>
    </div>
  );
}
