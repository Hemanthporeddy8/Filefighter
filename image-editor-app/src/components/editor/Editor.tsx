"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Doc, Layer, ShapeKind, TextLayer } from "@/lib/editor/types";
import { uid, FONTS } from "@/lib/editor/types";
import { TEMPLATES, emptyDoc, makeImage, makeShape, makeText } from "@/lib/editor/factories";
import { exportDoc, loadImage, measureText, thumbnailOf, totalAnimDuration } from "@/lib/editor/render";
import CanvasStage from "./CanvasStage";
import { LayersPanel, LeftPanel, PropertiesPanel, type Tab } from "./Panels";
import ToolsPanel from "./ToolsPanel";
import AiPanel from "./AiPanel";
import Timeline from "./Timeline";
import { useTools, type Tool } from "./tools";
import { Btn, IconBtn, Slider, Toggle, Select } from "./ui";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "templates", label: "Templates", icon: "▦" },
  { id: "uploads", label: "Uploads", icon: "⬆" },
  { id: "text", label: "Text", icon: "T" },
  { id: "shapes", label: "Shapes", icon: "◆" },
  { id: "canvas", label: "Canvas", icon: "⬜" },
];

const RIGHT_PANELS = [
  { id: "properties", label: "Properties", icon: "🎚" },
  { id: "tools", label: "Tools", icon: "🖌" },
  { id: "ai", label: "AI", icon: "✨" },
  { id: "layers", label: "Layers", icon: "☰" },
] as const;

type RightPanel = (typeof RIGHT_PANELS)[number]["id"];

export default function Editor({ initial }: { initial: Doc }) {
  const [doc, setDoc] = useState<Doc>(initial);
  const [history, setHistory] = useState<{ past: Doc[]; future: Doc[] }>({ past: [], future: [] });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab | null>("templates");
  const [rightPanel, setRightPanel] = useState<RightPanel>("properties");
  const [zoom, setZoom] = useState(0.5);
  const [showGuides, setShowGuides] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [snap, setSnap] = useState(true);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [showExport, setShowExport] = useState(false);
  const [exp, setExp] = useState({ format: "png" as "png" | "jpeg" | "webp", quality: 0.92, scale: 1, transparent: false });
  const [exporting, setExporting] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [versions, setVersions] = useState<{ id: number; name: string; width: number; height: number; background: string; layers: Layer[]; updatedAt: string }[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  // Load Google fonts for crisp text rendering
  useEffect(() => {
    const fonts = ["Inter:wght@400;700;900", "Playfair+Display:wght@400;700", "Montserrat:wght@400;700", "Roboto:wght@400;700", "Open+Sans:wght@400;700", "Lato:wght@400;700", "Poppins:wght@400;700", "Oswald:wght@400;700", "Merriweather:wght@400;700", "Raleway:wght@400;700", "Nunito:wght@400;700", "Bebas+Neue", "Pacifico", "Dancing+Script:wght@400;700"];
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${fonts.join("&family=")}&display=swap`;
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  const docRef = useRef(doc);
  docRef.current = doc;
  const committedRef = useRef(doc);
  const stageWrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textEditRef = useRef<HTMLTextAreaElement>(null);

  const selectedId = selectedIds[0] ?? null;
  const selected = useMemo(() => doc.layers.find((l) => l.id === selectedId) ?? null, [doc, selectedId]);
  const selectedSrc = selected?.type === "image" ? selected.src : null;

  /* ---------- zoom fit ---------- */
  const fitZoom = useCallback(() => {
    const el = stageWrapRef.current;
    if (!el) return;
    const w = el.clientWidth || window.innerWidth - 450;
    const h = el.clientHeight || window.innerHeight - 100;
    const availableW = Math.max(100, w - 80);
    const availableH = Math.max(100, h - 80);
    const z = Math.min(availableW / docRef.current.width, availableH / docRef.current.height, 2);
    setZoom(Math.max(0.05, Math.round(z * 100) / 100));
  }, []);

  useEffect(() => {
    fitZoom();
    const t1 = setTimeout(fitZoom, 50);
    const t2 = setTimeout(fitZoom, 200);
    window.addEventListener("resize", fitZoom);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", fitZoom);
    };
  }, [fitZoom, doc.width, doc.height, tab]);

  /* ---------- history ---------- */
  const commit = useCallback(() => {
    const prev = committedRef.current;
    const next = docRef.current;
    if (prev === next) return;
    setHistory((h) => ({ past: [...h.past.slice(-80), prev], future: [] }));
    committedRef.current = next;
  }, []);

  const update = useCallback(
    (fn: (d: Doc) => Doc, doCommit = true) => {
      const next = fn(docRef.current);
      docRef.current = next;
      setDoc(next);
      if (doCommit) commit();
    },
    [commit],
  );

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.past.length) return h;
      const prev = h.past[h.past.length - 1];
      const cur = docRef.current;
      docRef.current = prev;
      committedRef.current = prev;
      setDoc(prev);
      return { past: h.past.slice(0, -1), future: [cur, ...h.future] };
    });
  }, []);
  const redo = useCallback(() => {
    setHistory((h) => {
      if (!h.future.length) return h;
      const next = h.future[0];
      const cur = docRef.current;
      docRef.current = next;
      committedRef.current = next;
      setDoc(next);
      return { past: [...h.past, cur], future: h.future.slice(1) };
    });
  }, []);

  /* ---------- versions ---------- */
  const loadVersions = useCallback(async () => {
    const projId = doc.id || "default";
    try {
      const str = localStorage.getItem("editroy_image_versions_" + projId) || "[]";
      setVersions(JSON.parse(str));
    } catch {
      /* ignore */
    }
  }, [doc.id]);

  const saveVersion = useCallback(async () => {
    const projId = doc.id || "default";
    try {
      const str = localStorage.getItem("editroy_image_versions_" + projId) || "[]";
      const vers = JSON.parse(str);
      const v = {
        id: Date.now(),
        name: doc.name,
        width: doc.width,
        height: doc.height,
        background: doc.background,
        layers: doc.layers,
        updatedAt: new Date().toISOString(),
      };
      vers.unshift(v);
      localStorage.setItem("editroy_image_versions_" + projId, JSON.stringify(vers.slice(0, 20)));
      loadVersions();
    } catch {
      /* ignore */
    }
  }, [doc, loadVersions]);

  const restoreVersion = useCallback(
    (v: { id: number; name: string; width: number; height: number; background: string; layers: Layer[] }) => {
      update(() => ({ ...doc, ...v, id: doc.id }));
      setShowVersions(false);
    },
    [doc, update],
  );

  /* ---------- layer ops ---------- */
  const changeLayer = useCallback(
    (id: string, patch: Partial<Layer>, doCommit = false) => {
      update((d) => ({ ...d, layers: d.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l)) }), doCommit);
    },
    [update],
  );

  const addLayer = useCallback(
    (l: Layer) => {
      update((d) => ({ ...d, layers: [...d.layers, l] }));
      setSelectedIds([l.id]);
    },
    [update],
  );

  const addText = (preset: "heading" | "subheading" | "body") => {
    const cfg = {
      heading: { text: "Add a heading", fontSize: Math.round(doc.width / 10), fontWeight: 800 },
      subheading: { text: "Add a subheading", fontSize: Math.round(doc.width / 20), fontWeight: 600 },
      body: { text: "Add a little bit of body text", fontSize: Math.round(doc.width / 36), fontWeight: 400 },
    }[preset];
    const isDark =
      /^#([0-9a-f]{6})$/i.test(doc.background) &&
      parseInt(doc.background.slice(1, 3), 16) * 0.3 + parseInt(doc.background.slice(3, 5), 16) * 0.59 + parseInt(doc.background.slice(5, 7), 16) * 0.11 < 128;
    const t = makeText({ ...cfg, color: isDark ? "#ffffff" : "#111111" });
    const m = measureText(t);
    t.width = m.width;
    t.height = m.height;
    t.x = (doc.width - t.width) / 2;
    t.y = (doc.height - t.height) / 2;
    addLayer(t);
  };

  const addShape = (k: ShapeKind) => {
    const size = Math.round(Math.min(doc.width, doc.height) / 3);
    const s = makeShape(k, { width: size, height: k === "line" ? Math.max(8, size / 15) : size });
    s.x = (doc.width - s.width) / 2;
    s.y = (doc.height - s.height) / 2;
    addLayer(s);
  };

  const addImageUrl = async (src: string) => {
    try {
      const img = await loadImage(src);
      const isBlankDoc = docRef.current.layers.length === 0;
      if (isBlankDoc) {
        // First image added to blank canvas: auto-size canvas to match image aspect/resolution (up to 2048)
        let nw = img.naturalWidth;
        let nh = img.naturalHeight;
        const maxDim = 2048;
        if (nw > maxDim || nh > maxDim) {
          const s = Math.min(maxDim / nw, maxDim / nh);
          nw = Math.round(nw * s);
          nh = Math.round(nh * s);
        }
        const imgLayer = makeImage(src, nw, nh, { x: 0, y: 0 });
        update((d) => ({
          ...d,
          width: nw,
          height: nh,
          layers: [imgLayer],
        }));
        setSelectedIds([imgLayer.id]);
        return;
      }
      // Otherwise, add as layered image fitting canvas cleanly
      const scale = Math.min(doc.width / img.naturalWidth, doc.height / img.naturalHeight, 1);
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      addLayer(makeImage(src, w, h, { x: (doc.width - w) / 2, y: (doc.height - h) / 2 }));
    } catch {
      alert("Could not load that image.");
    }
  };

  const addImageFiles = (files: FileList) => {
    Array.from(files).forEach((f) => {
      if (!f.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => addImageUrl(reader.result as string);
      reader.readAsDataURL(f);
    });
  };

  const layerAction = (a: Parameters<React.ComponentProps<typeof PropertiesPanel>["onAction"]>[0]) => {
    if (!selected) return;
    const l = selected;
    const idx = doc.layers.findIndex((x) => x.id === l.id);
    const move = (to: number) =>
      update((d) => {
        const arr = [...d.layers];
        const [item] = arr.splice(idx, 1);
        arr.splice(Math.max(0, Math.min(arr.length, to)), 0, item);
        return { ...d, layers: arr };
      });
    switch (a) {
      case "delete":
        update((d) => ({ ...d, layers: d.layers.filter((x) => x.id !== l.id) }));
        setSelectedIds([]);
        break;
      case "duplicate": {
        const copy = { ...l, id: uid(), x: l.x + 30, y: l.y + 30, name: l.name + " copy" } as Layer;
        update((d) => ({ ...d, layers: [...d.layers.slice(0, idx + 1), copy, ...d.layers.slice(idx + 1)] }));
        setSelectedIds([copy.id]);
        break;
      }
      case "front": move(doc.layers.length); break;
      case "back": move(0); break;
      case "forward": move(idx + 1); break;
      case "backward": move(idx - 1); break;
      case "fitCanvas": {
        const r = l.width / l.height;
        let w = doc.width;
        let h = w / r;
        if (h < doc.height) { h = doc.height; w = h * r; }
        changeLayer(l.id, { width: w, height: h, x: (doc.width - w) / 2, y: (doc.height - h) / 2, rotation: 0 }, true);
        break;
      }
      case "centerH": changeLayer(l.id, { x: (doc.width - l.width) / 2 }, true); break;
      case "centerV": changeLayer(l.id, { y: (doc.height - l.height) / 2 }, true); break;
      case "alignL": changeLayer(l.id, { x: 0 }, true); break;
      case "alignR": changeLayer(l.id, { x: doc.width - l.width }, true); break;
      case "alignT": changeLayer(l.id, { y: 0 }, true); break;
      case "alignB": changeLayer(l.id, { y: doc.height - l.height }, true); break;
    }
  };

  /* ---------- animation playback ---------- */
  const [animT, setAnimT] = useState<number | undefined>(undefined);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) {
      setAnimT(undefined);
      return;
    }
    const total = totalAnimDuration(docRef.current);
    if (total <= 0) {
      setPlaying(false);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const elapsed = (performance.now() - start) / 1000;
      if (elapsed >= total + 0.3) {
        setAnimT(undefined);
        setPlaying(false);
        return;
      }
      setAnimT(elapsed);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  /* ---------- tools ---------- */
  const flatten = useCallback(async () => {
    const { preloadDoc, renderDoc } = await import("@/lib/editor/render");
    await preloadDoc(docRef.current);
    const canvas = document.createElement("canvas");
    canvas.width = docRef.current.width;
    canvas.height = docRef.current.height;
    renderDoc(canvas.getContext("2d")!, docRef.current);
    return canvas;
  }, []);

  const tools = useTools({
    doc,
    selected,
    onSelect: (id) => setSelectedIds(id ? [id] : []),
    onChangeLayer: changeLayer,
    onAddLayer: addLayer,
    onReplaceDoc: (d) => update(() => d),
    onCommit: commit,
    canvasRef,
    flatten,
  });

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }
      if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); save(); return; }
      if (typing) return;
      const sel = docRef.current.layers.find((l) => l.id === selectedId);
      if (e.key === "Delete" || e.key === "Backspace") {
        if (sel) {
          e.preventDefault();
          update((d) => ({ ...d, layers: d.layers.filter((x) => x.id !== sel.id) }));
          setSelectedIds([]);
        }
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (sel) {
          const copy = { ...sel, id: uid(), x: sel.x + 30, y: sel.y + 30 } as Layer;
          update((d) => ({ ...d, layers: [...d.layers, copy] }));
          setSelectedIds([copy.id]);
        }
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        if (sel) {
          const step = e.shiftKey ? 10 : 1;
          const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          changeLayer(sel.id, { x: sel.x + dx, y: sel.y + dy }, true);
        }
      } else if (e.key === "Escape") {
        setSelectedIds([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, undo, redo, update, changeLayer]);

  /* ---------- persistence ---------- */
  const save = async () => {
    setSaving("saving");
    try {
      const d = docRef.current;
      const thumbnail = await thumbnailOf(d).catch(() => null);
      const projId = d.id || ("proj_" + Date.now());
      const payload = {
        id: projId,
        name: d.name,
        width: d.width,
        height: d.height,
        background: d.background,
        layers: d.layers,
        thumbnail,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem("editroy_image_project_" + projId, JSON.stringify(payload));
      localStorage.setItem("editroy_image_last_project", JSON.stringify(payload));

      const existingStr = localStorage.getItem("editroy_image_projects_list") || "[]";
      let list = JSON.parse(existingStr);
      list = list.filter((p: any) => p.id !== projId);
      list.unshift({ id: projId, name: d.name, width: d.width, height: d.height, thumbnail, updatedAt: payload.updatedAt });
      localStorage.setItem("editroy_image_projects_list", JSON.stringify(list.slice(0, 30)));

      if (!d.id) {
        update((x) => ({ ...x, id: projId as any }), false);
      }
      setSaving("saved");
      setTimeout(() => setSaving("idle"), 2000);
    } catch {
      setSaving("error");
    }
  };

  const doExport = async () => {
    setExporting(true);
    try {
      window.parent.postMessage({ type: "start-export-ad" }, "*");
    } catch {}
    try {
      const url = await exportDoc(doc, exp.format, exp.quality, exp.scale, exp.transparent);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${doc.name.replace(/[^a-z0-9-_]+/gi, "_") || "design"}.${exp.format === "jpeg" ? "jpg" : exp.format}`;
      a.click();
      setShowExport(false);
    } catch {
      alert("Export failed. Some stock images may block cross-origin export — upload them instead.");
    } finally {
      setExporting(false);
    }
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${doc.name || "design"}.editroy.json`;
    a.click();
  };

  const duplicateProject = () => {
    const copy: Doc = { ...doc, id: null, name: doc.name + " copy", layers: doc.layers.map((l) => ({ ...l, id: uid() })) };
    update(() => copy, false);
    setSelectedIds([]);
    save();
  };

  return (
    <div data-theme={theme} className="lumina flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line surface px-4">
        <button
          onClick={() => {
            if (window.parent && window.parent !== window) {
              window.parent.location.href = "/dashboard";
            } else {
              window.location.href = "/dashboard";
            }
          }}
          className="flex items-center gap-2 text-sm font-bold text-left"
        >
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
            <div className="text-[10px] text-zinc-500">Professional image studio</div>
          </div>
        </button>
        <span className="h-6 w-px bg-white/10" />
        <input
          value={doc.name}
          onChange={(e) => update((d) => ({ ...d, name: e.target.value }), false)}
          onBlur={commit}
          className="w-48 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm hover:border-line focus:border-violet-500 focus:outline-none"
        />
        <div className="flex items-center gap-0.5">
          <IconBtn title="Undo (Ctrl+Z)" onClick={undo} disabled={!history.past.length}>↶</IconBtn>
          <IconBtn title="Redo (Ctrl+Y)" onClick={redo} disabled={!history.future.length}>↷</IconBtn>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-[var(--hover)] px-1">
            <IconBtn onClick={() => setZoom((z) => Math.max(0.05, Math.round((z - 0.1) * 100) / 100))} title="Zoom out">−</IconBtn>
            <button onClick={fitZoom} className="px-2 py-1 text-center text-xs font-semibold tabular-nums text-main hover:text-violet-300 transition" title="Click to Fit Screen">
              {Math.round(zoom * 100)}% (Fit)
            </button>
            <IconBtn onClick={() => setZoom((z) => Math.min(4, Math.round((z + 0.1) * 100) / 100))} title="Zoom in">+</IconBtn>
            <button onClick={() => setZoom(1)} className="hidden sm:inline-block px-1.5 py-1 text-[11px] text-faint hover:text-main transition" title="Actual 100% size">
              100%
            </button>
          </div>
          <span className="text-[11px] text-faint">
            {saving === "saving" ? "Saving…" : saving === "saved" ? "✓ Saved" : saving === "error" ? "⚠ Save failed" : ""}
          </span>
          <Btn onClick={exportJSON}>JSON</Btn>
          <Btn onClick={duplicateProject}>Duplicate</Btn>
          <Btn onClick={() => { saveVersion(); loadVersions(); setShowVersions(true); }}>History</Btn>
          <Btn onClick={() => setShowShortcuts(true)}>⌨</Btn>
          <Btn onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title="Toggle workspace theme">{theme === "dark" ? "☀" : "☾"}</Btn>
          <Btn onClick={save}>Save</Btn>
          <Btn variant="primary" onClick={() => setShowExport(true)}>⬇ Download</Btn>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Rail */}
        <nav className="flex w-[72px] shrink-0 flex-col items-center gap-1 border-r border-line surface-2 py-2 z-20">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(tab === t.id ? null : t.id)}
              title={tab === t.id ? `Close ${t.label}` : `Open ${t.label}`}
              className={`flex w-16 flex-col items-center gap-1 rounded-lg py-2 text-[10px] transition ${
                tab === t.id ? "bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40" : "text-muted hover:bg-[var(--hover)] hover:text-main"
              }`}
            >
              <span className="text-lg leading-none">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        {tab && (
          <LeftPanel
            tab={tab}
            doc={doc}
            onClose={() => setTab(null)}
            onAddText={addText}
            onAddShape={addShape}
            onAddImageFiles={addImageFiles}
            onAddImageUrl={addImageUrl}
            onLoadTemplate={(i) => {
              if (doc.layers.length && !confirm("Replace current design with this template?")) return;
              const t = TEMPLATES[i].build();
              update((d) => ({ ...t, id: d.id, name: d.id ? d.name : t.name }));
              setSelectedIds([]);
            }}
            onUpdateDoc={(p) => update((d) => ({ ...d, ...p }))}
          />
        )}

        {/* Stage */}
        <main
          ref={stageWrapRef}
          className="stage-bg relative flex min-w-0 flex-1 items-center justify-center overflow-auto"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, var(--stage-dot) 1px, transparent 0)", backgroundSize: "24px 24px" }}
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              setZoom((z) => Math.min(4, Math.max(0.05, z - e.deltaY * 0.001)));
            }
          }}
        >
          {/* Quick viewport floating controls */}
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1.5 rounded-xl border border-line surface-2/90 backdrop-blur px-2 py-1.5 shadow-xl">
            <button
              onClick={fitZoom}
              className="rounded-md px-2 py-1 text-xs font-medium text-main hover:bg-[var(--hover)] transition"
              title="Fit canvas to view"
            >
              ⤢ Fit Screen
            </button>
            <button
              onClick={() => setZoom(1)}
              className="rounded-md px-2 py-1 text-xs font-medium text-main hover:bg-[var(--hover)] transition"
              title="Zoom to 100%"
            >
              1:1 (100%)
            </button>
            <span className="h-4 w-px bg-line" />
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                showGrid ? "bg-violet-500/20 text-violet-300" : "text-muted hover:bg-[var(--hover)]"
              }`}
              title="Toggle pixel grid"
            >
              Grid
            </button>
            <button
              onClick={() => setShowGuides(!showGuides)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                showGuides ? "bg-violet-500/20 text-violet-300" : "text-muted hover:bg-[var(--hover)]"
              }`}
              title="Toggle alignment guides"
            >
              Guides
            </button>
            <button
              onClick={() => setSnap(!snap)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                snap ? "bg-violet-500/20 text-violet-300" : "text-muted hover:bg-[var(--hover)]"
              }`}
              title="Toggle snapping"
            >
              Snap
            </button>
          </div>

          <div className="m-auto p-10">
            <CanvasStage
              doc={doc}
              selectedId={selectedId}
              zoom={zoom}
              onSelect={(id) => setSelectedIds(id ? [id] : [])}
              onChangeLayer={changeLayer}
              onCommit={commit}
              onDoubleClickText={(id) => {
                setSelectedIds([id]);
                setTimeout(() => textEditRef.current?.focus(), 50);
              }}
              onDropFiles={addImageFiles}
              canvasRef={canvasRef}
              showGuides={showGuides}
              showGrid={showGrid}
              snap={snap}
              animT={animT}
              tools={tools}
            />
          </div>
          {doc.layers.length === 0 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-xs text-faint">
              Drop images here · Pick a template · Add text & shapes from the left
            </div>
          )}
        </main>

        {/* Right panel */}
        <aside className="flex w-80 shrink-0 flex-col border-l border-line surface">
          <div className="flex border-b border-line">
            {RIGHT_PANELS.map((p) => (
              <button
                key={p.id}
                onClick={() => setRightPanel(p.id)}
                className={`flex-1 py-2 text-[10px] transition ${
                  rightPanel === p.id ? "bg-violet-500/15 text-violet-300" : "text-muted hover:bg-[var(--hover)]"
                }`}
              >
                <div className="text-base">{p.icon}</div>
                {p.label}
              </button>
            ))}
          </div>
          {rightPanel === "properties" && !selected && (
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 text-center text-xs text-faint">
                <div className="mb-2 text-3xl">✨</div>
                Select a layer on the canvas to edit it.
                <div className="mt-4 space-y-1 text-left text-[11px] text-faint">
                  <p>• Double-click text to edit it</p>
                  <p>• Drag images straight onto the canvas</p>
                  <p>• Switch to the Tools tab for brushes &amp; crop</p>
                  <p>• Switch to the AI tab for background removal</p>
                </div>
              </div>
            </div>
          )}
          {rightPanel === "properties" && selected && (
            <PropertiesPanel
              layer={selected}
              doc={doc}
              onChange={(p) => changeLayer(selected.id, p)}
              onCommit={commit}
              onAction={layerAction}
              textEditRef={textEditRef}
            />
          )}
          {rightPanel === "tools" && (
            <ToolsPanel
              tool={tools.tool}
              setTool={tools.setTool}
              brushSize={tools.brushSize}
              setBrushSize={tools.setBrushSize}
              brushStrength={tools.brushStrength}
              setBrushStrength={tools.setBrushStrength}
              strokeColor={tools.strokeColor}
              setStrokeColor={tools.setStrokeColor}
              strokeWidth={tools.strokeWidth}
              setStrokeWidth={tools.setStrokeWidth}
              smooth={tools.smooth}
              setSmooth={tools.setSmooth}
              sampledColor={tools.sampledColor}
              cropRect={tools.preview.crop}
              onApplyCrop={tools.applyCrop}
              onRotate={tools.rotateAll}
              onFinishPen={tools.finishPen}
              onCancelPen={tools.cancelPen}
              penActive={!!tools.preview.pen}
              busy={tools.busy}
              doc={doc}
            />
          )}
          {rightPanel === "ai" && (
            <AiPanel
              selectedId={selectedId}
              selectedSrc={selectedSrc}
              onChangeLayer={(id, patch, c) => changeLayer(id, patch, c)}
              onCommit={commit}
            />
          )}
          {rightPanel === "layers" && (
            <LayersPanel
              layers={doc.layers}
              selectedId={selectedId}
              onSelect={(id) => setSelectedIds([id])}
              onChange={(id, p) => changeLayer(id, p, true)}
              onReorder={(from, to) =>
                update((d) => {
                  const arr = [...d.layers];
                  const [item] = arr.splice(from, 1);
                  arr.splice(to, 0, item);
                  return { ...d, layers: arr };
                })
              }
            />
          )}
          <Timeline
            layers={doc.layers}
            selectedId={selectedId}
            playing={playing}
            onPlay={() => setPlaying(true)}
            onStop={() => setPlaying(false)}
            onChangeLayer={changeLayer}
          />
        </aside>
      </div>

      {/* Versions modal */}
      {showVersions && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setShowVersions(false)}>
          <div className="w-full max-w-md rounded-2xl border border-line surface-3 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-base font-semibold">Version history</h2>
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {versions.length === 0 && <p className="text-sm text-faint">No saved versions yet. Click “History” to save one.</p>}
              {versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between rounded-lg border border-line bg-[var(--hover)] p-3">
                  <div>
                    <div className="text-sm">{v.name}</div>
                    <div className="text-[11px] text-faint">
                      {v.width}×{v.height} · {new Date(v.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  <Btn variant="primary" onClick={() => restoreVersion(v)}>Restore</Btn>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Btn onClick={() => setShowVersions(false)}>Close</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Shortcuts modal */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setShowShortcuts(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-line surface-3 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-base font-semibold">Keyboard shortcuts</h2>
            <div className="space-y-2 text-sm">
              {[
                ["Ctrl+Z", "Undo"],
                ["Ctrl+Y / Ctrl+Shift+Z", "Redo"],
                ["Ctrl+S", "Save"],
                ["Ctrl+D", "Duplicate layer"],
                ["Delete / Backspace", "Delete layer"],
                ["Arrow keys", "Nudge (Shift = 10px)"],
                ["Esc", "Deselect"],
                ["Ctrl+Scroll", "Zoom"],
              ].map(([k, d]) => (
                <div key={k} className="flex justify-between">
                  <kbd className="rounded bg-white/10 px-2 py-0.5 font-mono text-xs">{k}</kbd>
                  <span className="text-muted">{d}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Btn onClick={() => setShowShortcuts(false)}>Close</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Export modal */}
      {showExport && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setShowExport(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-line surface-3 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-base font-semibold">Download design</h2>
            <div className="space-y-3">
              <Select
                label="Format"
                value={exp.format}
                options={[
                  { value: "png", label: "PNG (lossless)" },
                  { value: "jpeg", label: "JPG (small)" },
                  { value: "webp", label: "WebP (modern)" },
                ]}
                onChange={(v) => setExp({ ...exp, format: v })}
              />
              {exp.format !== "png" && <Slider label="Quality" value={Math.round(exp.quality * 100)} min={10} max={100} onChange={(v) => setExp({ ...exp, quality: v / 100 })} suffix="%" />}
              <Slider label="Scale" value={exp.scale} min={0.25} max={4} step={0.25} onChange={(v) => setExp({ ...exp, scale: v })} suffix="×" />
              <p className="text-[11px] text-faint">
                Output: {Math.round(doc.width * exp.scale)} × {Math.round(doc.height * exp.scale)} px
              </p>
              {exp.format !== "jpeg" && <Toggle label="Transparent background" value={exp.transparent} onChange={(v) => setExp({ ...exp, transparent: v })} />}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Btn onClick={() => setShowExport(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={doExport} disabled={exporting}>
                {exporting ? "Rendering…" : "Download"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { emptyDoc };
export type { TextLayer };
export { FONTS };
