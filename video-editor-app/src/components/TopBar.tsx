import {
  Clapperboard,
  Download,
  FolderOpen,
  HelpCircle,
  Redo2,
  Undo2,
} from "lucide-react";
import type { EditorApi } from "../editor/useEditor";
import { ASPECTS } from "../types";
import { IconBtn } from "./ui";

export function TopBar({
  editor,
  onExport,
  onOpen,
  onHelp,
}: {
  editor: EditorApi;
  onExport: () => void;
  onOpen: () => void;
  onHelp: () => void;
}) {
  const { state } = editor;
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-zinc-800/80 bg-[#0c0c10] px-3">
      <div className="flex items-center gap-2 pr-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 p-1">
          <img src="/icons/icon-192.png" alt="Editroy Logo" className="h-6 w-6 object-contain" />
        </div>
        <div className="leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold tracking-tight text-white">Editroy</span>
            <span className="rounded bg-indigo-500/20 px-1.5 py-px text-[9px] font-bold tracking-wider text-indigo-400">
              STUDIO
            </span>
          </div>
          <div className="text-[10px] text-zinc-500">Offline video studio</div>
        </div>
      </div>

      <div className="h-6 w-px bg-zinc-800" />

      <input
        value={state.project.name}
        onChange={(e) => editor.setProjectName(e.target.value)}
        className="w-52 rounded-md bg-transparent px-2 py-1 text-sm text-zinc-200 outline-none ring-1 ring-transparent hover:ring-zinc-800 focus:bg-zinc-900 focus:ring-emerald-500/40"
      />

      <select
        value={state.project.aspect}
        onChange={(e) => editor.setAspect(e.target.value)}
        className="rounded-md bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300 ring-1 ring-zinc-800"
      >
        {ASPECTS.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
          </option>
        ))}
      </select>

      <select
        value={state.project.fps}
        onChange={(e) =>
          editor.setState((s) => ({ ...s, project: { ...s.project, fps: Number(e.target.value) } }))
        }
        className="rounded-md bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300 ring-1 ring-zinc-800"
      >
        {[24, 25, 30, 60].map((f) => (
          <option key={f} value={f}>
            {f} fps
          </option>
        ))}
      </select>

      <div className="flex items-center gap-0.5 pl-1">
        <IconBtn title="Undo (Ctrl+Z)" onClick={editor.undo}>
          <Undo2 className="h-4 w-4" />
        </IconBtn>
        <IconBtn title="Redo (Ctrl+Shift+Z)" onClick={editor.redo}>
          <Redo2 className="h-4 w-4" />
        </IconBtn>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-zinc-300 ring-1 ring-zinc-800 hover:bg-zinc-800"
        >
          <FolderOpen className="h-3.5 w-3.5" /> Import
        </button>
        <IconBtn title="Shortcuts" onClick={onHelp}>
          <HelpCircle className="h-4 w-4" />
        </IconBtn>
        <button
          type="button"
          onClick={onExport}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-400 to-cyan-400 px-3.5 py-1.5 text-xs font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 hover:brightness-110"
        >
          <Download className="h-3.5 w-3.5" /> Export MP4
        </button>
      </div>
    </header>
  );
}
