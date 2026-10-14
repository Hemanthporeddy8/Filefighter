import {
  AudioLines,
  Captions,
  Image as ImageIcon,
  Music,
  Sparkles,
  Sticker,
  Type,
  Wand2,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  ANIMATIONS,
  EFFECTS,
  FILTERS,
  SHAPES,
  STICKERS,
  TEXT_PRESETS,
  TRANSITIONS,
} from "../data/presets";
import type { EditorApi } from "../editor/useEditor";
import type { SidebarTab } from "../types";
import { cn } from "../utils/cn";

const TABS: { id: SidebarTab; label: string; icon: typeof ImageIcon }[] = [
  { id: "media", label: "Media", icon: ImageIcon },
  { id: "audio", label: "Audio", icon: Music },
  { id: "text", label: "Text", icon: Type },
  { id: "stickers", label: "Stickers", icon: Sticker },
  { id: "effects", label: "Effects", icon: Wand2 },
  { id: "filters", label: "Filters", icon: Sparkles },
  { id: "transitions", label: "Transits", icon: AudioLines },
  { id: "captions", label: "Captions", icon: Captions },
];

export function Sidebar({ editor, onImport }: { editor: EditorApi; onImport: () => void }) {
  const { state } = editor;
  const tab = state.sidebarTab;
  const [q, setQ] = useState("");

  const media = useMemo(() => {
    const list = state.assets.filter((a) => (tab === "audio" ? a.type === "audio" : a.type !== "audio"));
    if (!q.trim()) return list;
    return list.filter((a) => a.name.toLowerCase().includes(q.toLowerCase()));
  }, [state.assets, tab, q]);

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-r border-zinc-800/80 bg-[#101014]">
      <div className="grid grid-cols-4 gap-0 border-b border-zinc-800/80">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => editor.setTab(t.id)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-[10px] text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200",
                tab === t.id && "text-emerald-300 tab-active bg-zinc-900/60",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto nx-scroll p-3">
        {(tab === "media" || tab === "audio") && (
          <div className="space-y-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search library…"
              className="w-full rounded-md bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 ring-1 ring-zinc-800 outline-none focus:ring-emerald-500/40"
            />
            <button
              type="button"
              onClick={onImport}
              className="flex w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-zinc-700 py-6 text-xs text-zinc-400 hover:border-emerald-400/50 hover:text-emerald-300"
            >
              <ImageIcon className="h-5 w-5" />
              Import {tab === "audio" ? "audio" : "media"}
              <span className="text-[10px] text-zinc-600">MP4, MOV, WebM, MP3, WAV, PNG, JPG</span>
            </button>
            {tab === "media" && (
              <div className="grid grid-cols-3 gap-1.5">
                {["#000000", "#111827", "#7c3aed", "#0ea5e9", "#f43f5e", "#f59e0b"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    title="Solid color clip"
                    onClick={() => editor.addSolid(c)}
                    className="h-10 rounded-md ring-1 ring-zinc-800"
                    style={{ background: c }}
                  />
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {media.map((a) => (
                <div
                  key={a.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("asset", a.id);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onDoubleClick={() => editor.dropAssetOnTimeline(a.id, editor.state.tracks.find((t) => t.type === (a.type === "audio" ? "audio" : "video"))?.id || editor.state.tracks[0].id, editor.state.currentTime)}
                  className="group cursor-grab overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-zinc-800 hover:ring-emerald-400/40"
                >
                  <div className="relative aspect-video bg-zinc-950">
                    {a.thumbnail ? (
                      <img src={a.thumbnail} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-zinc-600">
                        <Music className="h-6 w-6" />
                      </div>
                    )}
                    <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] tabular-nums text-white">
                      {a.duration.toFixed(1)}s
                    </span>
                  </div>
                  <div className="truncate px-1.5 py-1 text-[10px] text-zinc-400">{a.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "text" && (
          <div className="grid grid-cols-2 gap-2">
            {TEXT_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => editor.addTextPreset(p)}
                className="flex h-20 items-center justify-center overflow-hidden rounded-lg bg-zinc-900 px-2 text-center ring-1 ring-zinc-800 hover:ring-emerald-400/50"
              >
                <span
                  className="line-clamp-2 text-xs"
                  style={{
                    fontFamily: p.fontFamily,
                    color: p.color === "#00000000" ? "#fff" : p.color,
                    fontWeight: p.fontWeight,
                  }}
                >
                  {p.name}
                </span>
              </button>
            ))}
          </div>
        )}

        {tab === "stickers" && (
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Shapes</div>
              <div className="grid grid-cols-4 gap-1.5">
                {SHAPES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => editor.addShape(s.id)}
                    className="rounded-md bg-zinc-900 py-2 text-[10px] text-zinc-300 ring-1 ring-zinc-800 hover:ring-emerald-400/40"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
            {STICKERS.map((g) => (
              <div key={g.cat}>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{g.cat}</div>
                <div className="grid grid-cols-6 gap-1">
                  {g.items.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => editor.addSticker(e)}
                      className="rounded-md bg-zinc-900 py-1.5 text-lg hover:bg-zinc-800"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "effects" && (
          <div className="grid grid-cols-2 gap-2">
            {EFFECTS.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => editor.updateSelected(e.apply as Partial<import("../types").Clip>)}
                className="rounded-lg bg-zinc-900 p-2 text-left ring-1 ring-zinc-800 hover:ring-emerald-400/40"
              >
                <div className="text-xs font-medium text-zinc-200">{e.name}</div>
                <div className="text-[10px] text-zinc-500">{e.desc}</div>
              </button>
            ))}
            <div className="col-span-2 pt-2 text-[10px] text-zinc-500">Select a clip, then tap an effect.</div>
          </div>
        )}

        {tab === "filters" && (
          <div className="grid grid-cols-2 gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => editor.applyFilter(f.id)}
                className="overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-zinc-800 hover:ring-emerald-400/40"
              >
                <div
                  className="h-12"
                  style={{
                    background: `linear-gradient(135deg, hsl(${200 + f.hue}, ${f.saturation}%, ${Math.min(70, f.brightness / 2)}%), #1a1a22)`,
                    filter: `contrast(${f.contrast}%)`,
                  }}
                />
                <div className="px-2 py-1 text-[11px] text-zinc-300">{f.name}</div>
              </button>
            ))}
          </div>
        )}

        {tab === "transitions" && (
          <div className="grid grid-cols-2 gap-2">
            {TRANSITIONS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => editor.applyTransition(t.id)}
                className="rounded-lg bg-zinc-900 px-2 py-3 text-xs text-zinc-200 ring-1 ring-zinc-800 hover:ring-emerald-400/40"
              >
                {t.name}
              </button>
            ))}
          </div>
        )}

        {tab === "captions" && (
          <div className="space-y-3">
            <p className="text-[11px] leading-relaxed text-zinc-500">
              Add caption cards on the text track. Everything is generated locally — no cloud, no watermarks.
            </p>
            <button
              type="button"
              onClick={() =>
                editor.addTextPreset({
                  id: "cap",
                  name: "Caption",
                  text: "Type your caption",
                  fontFamily: "Arial",
                  fontSize: 36,
                  fontWeight: 700,
                  color: "#ffffff",
                  backgroundColor: "#000000cc",
                  strokeWidth: 0,
                  strokeColor: "#000",
                  animationIn: "fade",
                  shadow: false,
                  y: 420,
                })
              }
              className="w-full rounded-lg bg-emerald-400/15 py-2 text-xs font-medium text-emerald-300 ring-1 ring-emerald-400/30"
            >
              New caption at playhead
            </button>
            <div className="grid grid-cols-2 gap-2">
              {ANIMATIONS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => editor.applyAnim(a.id)}
                  className="rounded-md bg-zinc-900 py-2 text-[11px] text-zinc-300 ring-1 ring-zinc-800 hover:ring-emerald-400/40"
                >
                  {a.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
