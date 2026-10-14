"use client";
import { useMemo } from "react";
import type { AnimKind, Layer } from "@/lib/editor/types";
import { Btn, Slider, Select } from "./ui";

export type { AnimKind };

const EASINGS = [
  { value: "linear", label: "Linear" },
  { value: "ease-in", label: "Ease in" },
  { value: "ease-out", label: "Ease out" },
  { value: "ease-in-out", label: "Ease in out" },
  { value: "cubic-bezier(0.34,1.56,0.64,1)", label: "Overshoot" },
];

function animOf(l: Layer) {
  return (l as { anim?: { kind: AnimKind; duration: number; delay: number; easing: string } }).anim;
}

export default function Timeline({
  layers,
  selectedId,
  playing,
  onPlay,
  onStop,
  onChangeLayer,
}: {
  layers: Layer[];
  selectedId: string | null;
  playing: boolean;
  onPlay: () => void;
  onStop: () => void;
  onChangeLayer: (id: string, patch: Partial<Layer>, commit?: boolean) => void;
}) {
  const selected = layers.find((l) => l.id === selectedId);
  const anim = selected ? animOf(selected) : undefined;

  const setAnim = (patch: Partial<NonNullable<ReturnType<typeof animOf>>>) => {
    if (!selected) return;
    const next = { kind: "fade", duration: 1, delay: 0, easing: "ease-out", ...anim, ...patch };
    onChangeLayer(selected.id, { anim: next } as Partial<Layer>, true);
  };

  const total = useMemo(
    () => layers.reduce((m, l) => {
      const a = animOf(l);
      return a && a.kind !== "none" ? Math.max(m, a.delay + a.duration) : m;
    }, 0),
    [layers],
  );

  const animated = layers.filter((l) => {
    const a = animOf(l);
    return a && a.kind !== "none";
  });

  return (
    <div className="shrink-0 border-t border-line surface-2 px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Animation</h3>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] tabular-nums text-zinc-500">{total.toFixed(1)}s · {animated.length} layer{animated.length === 1 ? "" : "s"}</span>
          <Btn onClick={playing ? onStop : onPlay}>{playing ? "⏹ Stop" : "▶ Play"}</Btn>
        </div>
      </div>

      {selected ? (
        <div className="space-y-2">
          <Select
            label="Effect"
            value={anim?.kind ?? "none"}
            options={[
              { value: "none", label: "None" },
              { value: "fade", label: "Fade in" },
              { value: "slide", label: "Slide in" },
              { value: "zoom", label: "Zoom in" },
              { value: "rotate", label: "Spin in" },
              { value: "bounce", label: "Bounce in" },
            ]}
            onChange={(v) => setAnim({ kind: v as AnimKind })}
          />
          {anim && anim.kind !== "none" && (
            <>
              <Slider label="Duration" value={anim.duration} min={0.1} max={5} step={0.1} onChange={(v) => setAnim({ duration: v })} suffix="s" />
              <Slider label="Delay" value={anim.delay} min={0} max={10} step={0.1} onChange={(v) => setAnim({ delay: v })} suffix="s" />
              <Select label="Easing" value={anim.easing} options={EASINGS} onChange={(v) => setAnim({ easing: v })} />
            </>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-faint">Select a layer to animate it.</p>
      )}

      <div className="mt-2.5">
        <div className="relative h-7 overflow-hidden rounded bg-[var(--hover)]">
          {total > 0 &&
            animated.map((l) => {
              const a = animOf(l)!;
              return (
                <div
                  key={l.id}
                  className="absolute top-1 h-5 rounded bg-gradient-to-r from-violet-500 to-fuchsia-500 opacity-90"
                  style={{ left: `${(a.delay / total) * 100}%`, width: `${Math.max(1.5, (a.duration / total) * 100)}%` }}
                  title={`${l.name}: ${a.kind} ${a.duration}s`}
                />
              );
            })}
          {total === 0 && <div className="grid h-full place-items-center text-[10px] text-faint">No animated layers</div>}
        </div>
      </div>
    </div>
  );
}
