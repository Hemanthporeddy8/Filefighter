import type { Clip, EditorState, Track } from "../types";

export interface Snapshot {
  clips: Clip[];
  tracks: Track[];
  selectedIds: string[];
}

export function takeSnapshot(state: EditorState): Snapshot {
  return {
    clips: state.clips.map((c) => ({ ...c, keyframes: c.keyframes.map((k) => ({ ...k })) })),
    tracks: state.tracks.map((t) => ({ ...t })),
    selectedIds: [...state.selectedIds],
  };
}

export function applySnapshot(state: EditorState, snap: Snapshot): EditorState {
  return { ...state, clips: snap.clips, tracks: snap.tracks, selectedIds: snap.selectedIds };
}
