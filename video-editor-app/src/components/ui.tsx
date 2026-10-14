import type { ReactNode } from "react";
import { cn } from "../utils/cn";

export function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix = "",
  decimals,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  suffix?: string;
  decimals?: number;
}) {
  const shown =
    decimals !== undefined ? value.toFixed(decimals) : Number.isInteger(step) ? String(Math.round(value)) : value.toFixed(2);
  return (
    <label className="flex items-center gap-2 py-0.5">
      <span className="w-[78px] shrink-0 text-[11px] text-zinc-400">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1"
      />
      <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-zinc-300">
        {shown}
        {suffix}
      </span>
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg bg-zinc-900 p-0.5 ring-1 ring-zinc-800">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition",
            value === o.id ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function IconBtn({
  title,
  onClick,
  active,
  danger,
  children,
  disabled,
}: {
  title: string;
  onClick?: () => void;
  active?: boolean;
  danger?: boolean;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-300 transition hover:bg-zinc-800 hover:text-white disabled:opacity-30",
        active && "bg-emerald-400/15 text-emerald-300",
        danger && "hover:bg-rose-500/15 hover:text-rose-400",
      )}
    >
      {children}
    </button>
  );
}

export function PanelTitle({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{children}</h3>
      {extra}
    </div>
  );
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 py-1">
      <span className="text-[11px] text-zinc-400">{label}</span>
      <span className="flex items-center gap-2">
        <input type="color" value={value.slice(0, 7)} onChange={(e) => onChange(e.target.value)} className="h-6 w-8" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 rounded-md bg-zinc-900 px-2 py-1 text-[11px] text-zinc-200 ring-1 ring-zinc-800"
        />
      </span>
    </label>
  );
}

export function Accordion({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="border-b border-zinc-800/80">
      <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-200">
        {title}
      </summary>
      <div className="px-3 pb-3">{children}</div>
    </details>
  );
}
