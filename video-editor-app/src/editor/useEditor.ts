import { useCallback, useMemo, useRef, useState } from "react";
import { FILTERS, type TextPreset } from "../data/presets";
import { applySnapshot, takeSnapshot, type Snapshot } from "../engine/history";
import { MediaPool, importFile } from "../engine/media";
import {
  ASPECTS,
  defaultClip,
  initialState,
  timelineDuration,
  uid,
  type AnimIn,
  type Asset,
  type Clip,
  type ClipKind,
  type EditorState,
  type ShapeType,
  type SidebarTab,
  type Tool,
  type TrackType,
  type TransitionType,
} from "../types";

function trackForKind(kind: ClipKind, tracks: EditorState["tracks"]): string {
  if (kind === "audio") return tracks.find((t) => t.type === "audio")?.id || tracks[0].id;
  if (kind === "text" || kind === "sticker") return tracks.find((t) => t.type === "text")?.id || tracks[0].id;
  if (kind === "video") return tracks.find((t) => t.type === "video")?.id || tracks[0].id;
  return tracks.find((t) => t.type === "overlay")?.id || tracks[0].id;
}

function snapTime(t: number, clips: Clip[], ignore: Set<string>, enabled: boolean, fps: number): number {
  if (!enabled) return Math.max(0, t);
  const pts = [0];
  clips.forEach((c) => {
    if (ignore.has(c.id)) return;
    pts.push(c.start, c.start + c.duration);
  });
  let best = t;
  let dist = 8 / 80;
  for (const p of pts) {
    const d = Math.abs(p - t);
    if (d < dist) {
      dist = d;
      best = p;
    }
  }
  const frame = 1 / fps;
  return Math.max(0, Math.round(best / frame) * frame);
}

export function useEditor() {
  const [state, setState] = useState<EditorState>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const timeRef = useRef(0);
  const poolRef = useRef(new MediaPool());
  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const clipboard = useRef<Clip[]>([]);

  const commit = useCallback((mutator: (s: EditorState) => EditorState) => {
    setState((prev) => {
      past.current.push(takeSnapshot(prev));
      if (past.current.length > 80) past.current.shift();
      future.current = [];
      return mutator(prev);
    });
  }, []);

  const patch = useCallback((mutator: (s: EditorState) => EditorState) => {
    setState(mutator);
  }, []);

  const undo = useCallback(() => {
    const snap = past.current.pop();
    if (!snap) return;
    setState((prev) => {
      future.current.push(takeSnapshot(prev));
      return applySnapshot(prev, snap);
    });
  }, []);

  const redo = useCallback(() => {
    const snap = future.current.pop();
    if (!snap) return;
    setState((prev) => {
      past.current.push(takeSnapshot(prev));
      return applySnapshot(prev, snap);
    });
  }, []);

  const duration = useMemo(() => timelineDuration(state.clips), [state.clips]);

  const selected = useMemo(
    () => state.clips.filter((c) => state.selectedIds.includes(c.id)),
    [state.clips, state.selectedIds],
  );

  const primary = selected[0] || null;

  const setTime = useCallback((t: number) => {
    const v = Math.max(0, t);
    timeRef.current = v;
    patch((s) => ({ ...s, currentTime: v, playing: false }));
  }, [patch]);

  const togglePlay = useCallback(() => {
    patch((s) => {
      const dur = timelineDuration(s.clips);
      let t = timeRef.current;
      if (!s.playing && t >= dur - 0.05) t = 0;
      timeRef.current = t;
      return { ...s, playing: !s.playing, currentTime: t };
    });
  }, [patch]);

  const importFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    const loaded: Asset[] = [];
    for (const f of list) {
      try {
        loaded.push(await importFile(f));
      } catch {
        /* skip */
      }
    }
    if (!loaded.length) return;
    commit((s) => {
      let next = { ...s, assets: [...s.assets, ...loaded] };
      const t0 = s.currentTime;
      loaded.forEach((asset, i) => {
        const kind: ClipKind = asset.type === "video" ? "video" : asset.type === "audio" ? "audio" : "image";
        const trackId = trackForKind(kind, next.tracks);
        const start = t0 + i * 0.01;
        const dur = kind === "image" ? 4 : Math.max(0.2, asset.duration);
        const clip = defaultClip({
          kind,
          trackId,
          name: asset.name,
          assetId: asset.id,
          start,
          duration: dur,
          inPoint: 0,
          outPoint: dur,
        });
        next = { ...next, clips: [...next.clips, clip], selectedIds: [clip.id] };
      });
      const firstVideo = loaded.find((a) => a.type === "video" || a.type === "image");
      if (firstVideo && s.clips.length === 0 && firstVideo.width && firstVideo.height) {
        const ar = firstVideo.width / firstVideo.height;
        const match = ASPECTS.reduce((best, a) => {
          const d = Math.abs(a.w / a.h - ar);
          return d < Math.abs(best.w / best.h - ar) ? a : best;
        }, ASPECTS[0]);
        next = {
          ...next,
          project: { ...next.project, width: match.w, height: match.h, aspect: match.id },
        };
      }
      return next;
    });
  }, [commit]);

  const addOverlay = useCallback(
    (kind: ClipKind, extra: Partial<Clip> = {}) => {
      commit((s) => {
        const trackId = extra.trackId || trackForKind(kind, s.tracks);
        const clip = defaultClip({
          kind,
          trackId,
          name: extra.name || kind,
          start: s.currentTime,
          duration: extra.duration ?? 3,
          ...extra,
        });
        return { ...s, clips: [...s.clips, clip], selectedIds: [clip.id] };
      });
    },
    [commit],
  );

  const addTextPreset = useCallback(
    (p: TextPreset) => {
      addOverlay("text", {
        name: p.name,
        text: p.text,
        fontFamily: p.fontFamily,
        fontSize: p.fontSize,
        fontWeight: p.fontWeight,
        color: p.color,
        backgroundColor: p.backgroundColor,
        strokeWidth: p.strokeWidth,
        strokeColor: p.strokeColor,
        animationIn: p.animationIn,
        shadow: p.shadow,
        y: p.y,
      });
    },
    [addOverlay],
  );

  const addSticker = useCallback(
    (emoji: string) => addOverlay("sticker", { sticker: emoji, name: emoji, duration: 3, scale: 1 }),
    [addOverlay],
  );

  const addShape = useCallback(
    (shape: ShapeType) => addOverlay("shape", { shape, name: shape, duration: 4 }),
    [addOverlay],
  );

  const addSolid = useCallback(
    (fill: string) => addOverlay("solid", { fill, name: "Color", duration: 3, trackId: "t_main" }),
    [addOverlay],
  );

  const updateClip = useCallback(
    (id: string, patchClip: Partial<Clip>) => {
      commit((s) => ({
        ...s,
        clips: s.clips.map((c) => (c.id === id ? { ...c, ...patchClip } : c)),
      }));
    },
    [commit],
  );

  const updateClipLive = useCallback((id: string, patchClip: Partial<Clip>) => {
    patch((s) => ({
      ...s,
      clips: s.clips.map((c) => (c.id === id ? { ...c, ...patchClip } : c)),
    }));
  }, [patch]);

  const updateSelected = useCallback(
    (patchClip: Partial<Clip>) => {
      commit((s) => ({
        ...s,
        clips: s.clips.map((c) => (s.selectedIds.includes(c.id) ? { ...c, ...patchClip } : c)),
      }));
    },
    [commit],
  );

  const deleteSelected = useCallback(() => {
    commit((s) => {
      const ids = new Set(s.selectedIds);
      s.selectedIds.forEach((id) => poolRef.current.disposeClip(id));
      let clips = s.clips.filter((c) => !ids.has(c.id));
      if (s.ripple) {
        const removed = s.clips.filter((c) => ids.has(c.id));
        removed.forEach((r) => {
          clips = clips.map((c) =>
            c.trackId === r.trackId && c.start >= r.start + r.duration
              ? { ...c, start: Math.max(0, c.start - r.duration) }
              : c,
          );
        });
      }
      return { ...s, clips, selectedIds: [] };
    });
  }, [commit]);

  const duplicateSelected = useCallback(() => {
    commit((s) => {
      const copies: Clip[] = [];
      s.clips.forEach((c) => {
        if (!s.selectedIds.includes(c.id)) return;
        copies.push({
          ...c,
          id: uid("clip"),
          start: c.start + c.duration,
          keyframes: c.keyframes.map((k) => ({ ...k })),
        });
      });
      return { ...s, clips: [...s.clips, ...copies], selectedIds: copies.map((c) => c.id) };
    });
  }, [commit]);

  const splitAtPlayhead = useCallback(() => {
    commit((s) => {
      const t = s.currentTime;
      const next: Clip[] = [];
      s.clips.forEach((c) => {
        const targets = s.selectedIds.length ? s.selectedIds.includes(c.id) : true;
        if (!targets || t <= c.start + 0.05 || t >= c.start + c.duration - 0.05) {
          next.push(c);
          return;
        }
        const local = t - c.start;
        const srcCut = c.inPoint + local * c.speed;
        next.push({ ...c, duration: local, outPoint: srcCut });
        next.push({
          ...c,
          id: uid("clip"),
          start: t,
          duration: c.duration - local,
          inPoint: srcCut,
          keyframes: c.keyframes.map((k) => ({ ...k, time: Math.max(0, k.time - local) })),
        });
      });
      return { ...s, clips: next };
    });
  }, [commit]);

  const copySelected = useCallback(() => {
    clipboard.current = stateRef.current.clips
      .filter((c) => stateRef.current.selectedIds.includes(c.id))
      .map((c) => ({ ...c, keyframes: c.keyframes.map((k) => ({ ...k })) }));
  }, []);

  const cutSelected = useCallback(() => {
    copySelected();
    deleteSelected();
  }, [copySelected, deleteSelected]);

  const pasteClips = useCallback(() => {
    if (!clipboard.current.length) return;
    commit((s) => {
      const minStart = Math.min(...clipboard.current.map((c) => c.start));
      const copies = clipboard.current.map((c) => ({
        ...c,
        id: uid("clip"),
        start: s.currentTime + (c.start - minStart),
        keyframes: c.keyframes.map((k) => ({ ...k })),
      }));
      return { ...s, clips: [...s.clips, ...copies], selectedIds: copies.map((c) => c.id) };
    });
  }, [commit]);

  const select = useCallback((ids: string[], additive = false) => {
    patch((s) => ({
      ...s,
      selectedIds: additive ? Array.from(new Set([...s.selectedIds, ...ids])) : ids,
    }));
  }, [patch]);

  const moveClips = useCallback(
    (ids: string[], deltaStart: number, newTrackId?: string) => {
      const s = stateRef.current;
      const ignore = new Set(ids);
      commit((prev) => ({
        ...prev,
        clips: prev.clips.map((c) => {
          if (!ids.includes(c.id)) return c;
          const start = snapTime(c.start + deltaStart, prev.clips, ignore, prev.snap, prev.project.fps);
          return { ...c, start, trackId: newTrackId || c.trackId };
        }),
      }));
      void s;
    },
    [commit],
  );

  const trimClip = useCallback(
    (id: string, edge: "in" | "out", time: number) => {
      commit((s) => ({
        ...s,
        clips: s.clips.map((c) => {
          if (c.id !== id) return c;
          if (edge === "in") {
            const end = c.start + c.duration;
            const start = Math.min(end - 0.1, Math.max(0, time));
            const delta = start - c.start;
            const inPoint = Math.max(0, c.inPoint + delta * c.speed);
            return { ...c, start, duration: end - start, inPoint };
          }
          const duration = Math.max(0.1, time - c.start);
          const outPoint = c.inPoint + duration * c.speed;
          return { ...c, duration, outPoint };
        }),
      }));
    },
    [commit],
  );

  const applyFilter = useCallback(
    (filterId: string) => {
      const f = FILTERS.find((x) => x.id === filterId);
      if (!f) return;
      updateSelected({
        filterId,
        brightness: f.brightness,
        contrast: f.contrast,
        saturation: f.saturation,
        hue: f.hue,
        temperature: f.temperature,
        vignette: f.vignette,
        grain: f.grain,
        tint: f.tint,
      });
    },
    [updateSelected],
  );

  const applyTransition = useCallback(
    (type: TransitionType) => {
      updateSelected({ transitionOut: type, transitionIn: type === "none" ? "none" : type, transitionDur: 0.45 });
    },
    [updateSelected],
  );

  const applyAnim = useCallback((animationIn: AnimIn) => updateSelected({ animationIn, animDur: 0.45 }), [updateSelected]);

  const setSpeed = useCallback(
    (speed: number) => {
      commit((s) => ({
        ...s,
        clips: s.clips.map((c) => {
          if (!s.selectedIds.includes(c.id)) return c;
          const src = Math.max(0.05, c.outPoint - c.inPoint);
          return { ...c, speed, duration: src / Math.max(0.1, speed) };
        }),
      }));
    },
    [commit],
  );

  const setAspect = useCallback((id: string) => {
    const a = ASPECTS.find((x) => x.id === id);
    if (!a) return;
    patch((s) => ({ ...s, project: { ...s.project, aspect: a.id, width: a.w, height: a.h } }));
  }, [patch]);

  const addTrack = useCallback((type: TrackType) => {
    commit((s) => {
      const track = {
        id: uid("trk"),
        name: `${type} ${s.tracks.filter((t) => t.type === type).length + 1}`,
        type,
        locked: false,
        muted: false,
        hidden: false,
        volume: 1,
      };
      const idx = type === "audio" ? s.tracks.length : 0;
      const tracks = [...s.tracks];
      tracks.splice(idx, 0, track);
      return { ...s, tracks };
    });
  }, [commit]);

  const updateTrack = useCallback((id: string, p: Partial<EditorState["tracks"][0]>) => {
    commit((s) => ({ ...s, tracks: s.tracks.map((t) => (t.id === id ? { ...t, ...p } : t)) }));
  }, [commit]);

  const beginGesture = useCallback(() => {
    past.current.push(takeSnapshot(stateRef.current));
    if (past.current.length > 80) past.current.shift();
    future.current = [];
  }, []);

  const setTool = useCallback((tool: Tool) => patch((s) => ({ ...s, tool })), [patch]);
  const setTab = useCallback((sidebarTab: SidebarTab) => patch((s) => ({ ...s, sidebarTab })), [patch]);
  const setProjectName = useCallback((name: string) => patch((s) => ({ ...s, project: { ...s.project, name } })), [patch]);

  const dropAssetOnTimeline = useCallback(
    (assetId: string, trackId: string, time: number) => {
      commit((s) => {
        const asset = s.assets.find((a) => a.id === assetId);
        if (!asset) return s;
        const kind: ClipKind = asset.type === "video" ? "video" : asset.type === "audio" ? "audio" : "image";
        const track = s.tracks.find((t) => t.id === trackId);
        if (track?.type === "audio" && kind !== "audio" && kind !== "video") return s;
        const dur = kind === "image" ? 4 : Math.max(0.2, asset.duration);
        const clip = defaultClip({
          kind: track?.type === "audio" ? "audio" : kind,
          trackId,
          name: asset.name,
          assetId: asset.id,
          start: Math.max(0, time),
          duration: dur,
          inPoint: 0,
          outPoint: dur,
          volume: kind === "audio" || (kind === "video" && track?.type === "audio") ? 1 : kind === "video" ? 1 : 0,
        });
        return { ...s, clips: [...s.clips, clip], selectedIds: [clip.id] };
      });
    },
    [commit],
  );

  const addKeyframe = useCallback(
    (prop: Clip["keyframes"][0]["property"]) => {
      const s = stateRef.current;
      const clip = s.clips.find((c) => c.id === s.selectedIds[0]);
      if (!clip) return;
      const lt = Math.max(0, s.currentTime - clip.start);
      const value = clip[prop];
      updateClip(clip.id, {
        keyframes: [...clip.keyframes.filter((k) => !(k.property === prop && Math.abs(k.time - lt) < 0.05)), { time: lt, property: prop, value, easing: "ease-in-out" }],
      });
    },
    [updateClip],
  );

  const extractAudio = useCallback(() => {
    const s = stateRef.current;
    const clip = s.clips.find((c) => c.id === s.selectedIds[0] && c.kind === "video");
    if (!clip || !clip.assetId) return;
    addOverlay("audio", {
      assetId: clip.assetId,
      name: `${clip.name} audio`,
      start: clip.start,
      duration: clip.duration,
      inPoint: clip.inPoint,
      outPoint: clip.outPoint,
      speed: clip.speed,
    });
  }, [addOverlay]);

  const bringDirection = useCallback((dir: "up" | "down") => {
    commit((s) => {
      const id = s.selectedIds[0];
      const clip = s.clips.find((c) => c.id === id);
      if (!clip) return s;
      const idx = s.tracks.findIndex((t) => t.id === clip.trackId);
      const next = dir === "up" ? idx - 1 : idx + 1;
      const track = s.tracks[next];
      if (!track || track.type === "audio") return s;
      return { ...s, clips: s.clips.map((c) => (c.id === id ? { ...c, trackId: track.id } : c)) };
    });
  }, [commit]);

  return {
    state,
    setState: patch,
    timeRef,
    pool: poolRef.current,
    duration,
    selected,
    primary,
    commit,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    setTime,
    togglePlay,
    importFiles,
    addOverlay,
    addTextPreset,
    addSticker,
    addShape,
    addSolid,
    updateClip,
    updateClipLive,
    updateSelected,
    deleteSelected,
    duplicateSelected,
    splitAtPlayhead,
    copySelected,
    cutSelected,
    pasteClips,
    select,
    moveClips,
    trimClip,
    applyFilter,
    applyTransition,
    applyAnim,
    setSpeed,
    setAspect,
    addTrack,
    updateTrack,
    setTool,
    setTab,
    setProjectName,
    dropAssetOnTimeline,
    addKeyframe,
    extractAudio,
    bringDirection,
    beginGesture,
  };
}

export type EditorApi = ReturnType<typeof useEditor>;
