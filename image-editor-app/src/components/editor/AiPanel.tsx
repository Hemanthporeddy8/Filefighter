"use client";
import { useState } from "react";
import { Section, Btn, Slider, Select, ColorInput } from "./ui";

import { runAiOp } from "@/lib/editor/ai";

async function aiOp(op: string, body: Record<string, unknown>) {
  return runAiOp(op, body);
}

export default function AiPanel({
  selectedId,
  selectedSrc,
  onChangeLayer,
  onCommit,
}: {
  selectedId: string | null;
  selectedSrc: string | null;
  onChangeLayer: (id: string, patch: { src: string }, commit: boolean) => void;
  onCommit: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [bg, setBg] = useState("#1e1b4b");
  const [strength, setStrength] = useState(1);
  const [factor, setFactor] = useState(2);
  const [target, setTarget] = useState("1:1");
  const [palette, setPalette] = useState<string[]>([]);

  const needSrc = (): string | null => {
    if (!selectedId || !selectedSrc) {
      alert("Select an image layer first.");
      return null;
    }
    return selectedSrc;
  };

  const run = async (op: string, label: string, body: Record<string, unknown>) => {
    setBusy(label);
    try {
      return await aiOp(op, body);
    } catch (e) {
      alert("AI operation failed: " + (e as Error).message);
      return null;
    } finally {
      setBusy(null);
    }
  };

  const apply = (r: { src: string } | null) => {
    if (r && selectedId) {
      onChangeLayer(selectedId, { src: r.src }, true);
      onCommit();
    }
  };

  const ops = {
    removeBg: async () => {
      const src = needSrc();
      if (!src) return;
      apply(await run("removeBackground", "Removing background…", { src }));
    },
    replaceBg: async () => {
      const src = needSrc();
      if (!src) return;
      apply(await run("replaceBackground", "Replacing background…", { src, bg }));
    },
    enhance: async () => {
      const src = needSrc();
      if (!src) return;
      apply(await run("enhance", "Enhancing…", { src, strength }));
    },
    upscale: async () => {
      const src = needSrc();
      if (!src) return;
      apply(await run("upscale", "Upscaling…", { src, factor }));
    },
    smartCrop: async () => {
      const src = needSrc();
      if (!src) return;
      const [tw, th] = target.split(":").map(Number);
      apply(await run("smartCrop", "Smart cropping…", { src, targetW: tw * 100, targetH: th * 100 }));
    },
    palette: async () => {
      const src = needSrc();
      if (!src) return;
      const r = await run("palette", "Extracting palette…", { src, count: 6 });
      if (r) setPalette(r.colors);
    },
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <Section title="AI background">
        <p className="text-[11px] text-zinc-500">Applies to the selected image layer.</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Btn variant="primary" onClick={ops.removeBg} disabled={busy !== null}>
            {busy === "Removing background…" ? "…" : "✂ Remove BG"}
          </Btn>
          <Btn onClick={ops.replaceBg} disabled={busy !== null}>
            {busy === "Replacing background…" ? "…" : "🖼 Replace BG"}
          </Btn>
        </div>
        <ColorInput label="New background" value={bg} onChange={setBg} />
      </Section>

      <Section title="AI enhance">
        <Slider label="Strength" value={strength} min={0.2} max={2} step={0.1} onChange={setStrength} suffix="×" />
        <Btn variant="primary" className="w-full" onClick={ops.enhance} disabled={busy !== null}>
          {busy === "Enhancing…" ? "…" : "✨ Auto enhance"}
        </Btn>
      </Section>

      <Section title="AI upscale">
        <Select
          label="Factor"
          value={String(factor)}
          options={[
            { value: "2", label: "2×" },
            { value: "4", label: "4×" },
          ]}
          onChange={(v) => setFactor(Number(v))}
        />
        <Btn className="w-full" onClick={ops.upscale} disabled={busy !== null}>
          {busy === "Upscaling…" ? "…" : "🔍 Upscale"}
        </Btn>
      </Section>

      <Section title="Smart crop">
        <Select
          label="Aspect"
          value={target}
          options={["1:1", "4:5", "9:16", "16:9", "3:2", "2:3"].map((v) => ({ value: v, label: v }))}
          onChange={setTarget}
        />
        <Btn className="w-full" onClick={ops.smartCrop} disabled={busy !== null}>
          {busy === "Smart cropping…" ? "…" : "🎯 Smart crop"}
        </Btn>
      </Section>

      <Section title="Palette">
        <Btn className="w-full" onClick={ops.palette} disabled={busy !== null}>
          {busy === "Extracting palette…" ? "…" : "🎨 Extract colors"}
        </Btn>
        {palette.length > 0 && (
          <div className="flex gap-1 pt-1">
            {palette.map((c) => (
              <div key={c} className="flex-1">
                <div className="h-8 rounded border border-line" style={{ background: c }} />
                <div className="mt-0.5 text-center text-[9px] text-zinc-500">{c}</div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
