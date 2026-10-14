import { useCallback, useEffect, useRef, useState } from "react";
import { ExportModal } from "./components/ExportModal";
import { Inspector } from "./components/Inspector";
import { Preview } from "./components/Preview";
import { ShortcutsModal } from "./components/ShortcutsModal";
import { Sidebar } from "./components/Sidebar";
import { Timeline } from "./components/Timeline";
import { TopBar } from "./components/TopBar";
import { useEditor } from "./editor/useEditor";

export default function App() {
  const editor = useEditor();
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [tlH, setTlH] = useState(268);
  const [draggingTl, setDraggingTl] = useState(false);

  const openImport = useCallback(() => fileRef.current?.click(), []);
  const show = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2200);
  }, []);

  const assetKey = editor.state.assets.map((a) => a.id).join(",");
  useEffect(() => {
    let cancelled = false;
    const assets = editor.state.assets;
    void (async () => {
      for (const a of assets) {
        if (a.type === "audio" || a.type === "video") await editor.pool.decodeAsset(a);
      }
      if (!cancelled) editor.setState((s) => ({ ...s }));
    })();
    return () => {
      cancelled = true;
    };
  }, [assetKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ed = editorRef.current;
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;
      if (e.key === "?" && !typing) {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }
      if (typing) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (e.code === "Space") {
        e.preventDefault();
        ed.togglePlay();
      } else if (e.key === "s" && !ctrl) {
        e.preventDefault();
        ed.splitAtPlayhead();
        show("Split");
      } else if (e.key === "c" && !ctrl) {
        ed.setTool("razor");
      } else if (e.key === "v" && !ctrl) {
        ed.setTool("select");
      } else if ((e.key === "Delete" || e.key === "Backspace") && ed.state.selectedIds.length) {
        e.preventDefault();
        ed.deleteSelected();
      } else if (ctrl && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        ed.undo();
      } else if (ctrl && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        ed.redo();
      } else if (ctrl && e.key.toLowerCase() === "c") {
        e.preventDefault();
        ed.copySelected();
        show("Copied");
      } else if (ctrl && e.key.toLowerCase() === "x") {
        e.preventDefault();
        ed.cutSelected();
      } else if (ctrl && e.key.toLowerCase() === "v") {
        e.preventDefault();
        ed.pasteClips();
      } else if (ctrl && e.key.toLowerCase() === "d") {
        e.preventDefault();
        ed.duplicateSelected();
      } else if (ctrl && e.key.toLowerCase() === "a") {
        e.preventDefault();
        ed.select(ed.state.clips.map((c) => c.id));
      } else if (ctrl && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setExportOpen(true);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const d = e.shiftKey ? 1 : 1 / ed.state.project.fps;
        ed.setTime(ed.timeRef.current - d);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const d = e.shiftKey ? 1 : 1 / ed.state.project.fps;
        ed.setTime(ed.timeRef.current + d);
      } else if (e.key === "Home") {
        ed.setTime(0);
      } else if (e.key === "End") {
        ed.setTime(ed.duration);
      } else if (e.key === "=" || e.key === "+") {
        ed.setState((s) => ({ ...s, pixelsPerSecond: Math.min(260, s.pixelsPerSecond * 1.25) }));
      } else if (e.key === "-" || e.key === "_") {
        ed.setState((s) => ({ ...s, pixelsPerSecond: Math.max(20, s.pixelsPerSecond / 1.25) }));
      } else if (e.key === "m") {
        ed.setState((s) => ({ ...s, muted: !s.muted }));
      } else if (e.key === "l") {
        ed.setState((s) => ({ ...s, loop: !s.loop }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show]);

  useEffect(() => {
    if (!draggingTl) return;
    const move = (e: PointerEvent) => {
      const h = Math.min(480, Math.max(180, window.innerHeight - e.clientY));
      setTlH(h);
    };
    const up = () => setDraggingTl(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [draggingTl]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) void editor.importFiles(e.dataTransfer.files);
  };

  return (
    <div
      className="flex h-full flex-col bg-[#070709] text-zinc-100"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <input
        ref={fileRef}
        type="file"
        accept="video/*,audio/*,image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void editor.importFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <TopBar editor={editor} onExport={() => setExportOpen(true)} onOpen={openImport} onHelp={() => setHelpOpen(true)} />
      <div className="flex min-h-0 flex-1">
        <Sidebar editor={editor} onImport={openImport} />
        <Preview editor={editor} canvasRef={canvasRef} />
        <Inspector editor={editor} />
      </div>
      <div
        onPointerDown={() => setDraggingTl(true)}
        className="h-1.5 shrink-0 cursor-row-resize bg-zinc-900 hover:bg-emerald-400/40"
      />
      <div style={{ height: tlH }} className="shrink-0">
        <Timeline editor={editor} />
      </div>
      {exportOpen && <ExportModal editor={editor} canvasRef={canvasRef} onClose={() => setExportOpen(false)} />}
      {helpOpen && <ShortcutsModal onClose={() => setHelpOpen(false)} />}
      {toast && (
        <div className="nx-toast pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-zinc-800 px-4 py-2 text-xs text-white shadow-xl ring-1 ring-zinc-700">
          {toast}
        </div>
      )}
    </div>
  );
}
