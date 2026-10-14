import { X } from "lucide-react";

const ROWS: { keys: string; action: string }[] = [
  { keys: "Space", action: "Play / pause" },
  { keys: "S", action: "Split at playhead" },
  { keys: "C", action: "Razor tool" },
  { keys: "V", action: "Select tool" },
  { keys: "Delete", action: "Delete selected" },
  { keys: "Ctrl + Z", action: "Undo" },
  { keys: "Ctrl + Shift + Z", action: "Redo" },
  { keys: "Ctrl + C / X / V", action: "Copy / cut / paste" },
  { keys: "Ctrl + D", action: "Duplicate" },
  { keys: "Ctrl + A", action: "Select all" },
  { keys: "Ctrl + E", action: "Export" },
  { keys: "← →", action: "Step one frame" },
  { keys: "Shift + ← →", action: "Jump 1 second" },
  { keys: "Home / End", action: "Start / end" },
  { keys: "+ / −", action: "Timeline zoom" },
  { keys: "M", action: "Mute master" },
  { keys: "L", action: "Toggle loop" },
  { keys: "?", action: "This cheatsheet" },
];

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-[#16161c] p-5 shadow-2xl ring-1 ring-zinc-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Keyboard shortcuts</h2>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[60vh] space-y-1 overflow-y-auto nx-scroll">
          {ROWS.map((r) => (
            <div key={r.keys} className="flex items-center justify-between rounded-md px-1 py-1.5 text-xs">
              <span className="text-zinc-400">{r.action}</span>
              <kbd className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-[10px] text-zinc-200">{r.keys}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
