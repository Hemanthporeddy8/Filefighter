"use client";
import type { ReactNode } from "react";

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="border-b border-line px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{title}</h3>
        {right}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix = "",
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
  onCommit?: () => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="tabular-nums text-zinc-500">
          {Math.round(value * 100) / 100}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-700 accent-violet-500"
      />
    </label>
  );
}

export function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const hex = /^#([0-9a-f]{6})$/i.test(value) ? value : "#000000";
  return (
    <label className="flex items-center justify-between text-xs text-muted">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 rounded border border-line field px-2 py-1 font-mono text-[11px] text-main"
        />
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-7 cursor-pointer rounded border border-line bg-transparent"
        />
      </span>
    </label>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between text-xs text-muted"
    >
      <span>{label}</span>
      <span className={`relative h-5 w-9 rounded-full transition ${value ? "bg-violet-500" : "bg-zinc-700"}`}>
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${value ? "left-[18px]" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-muted">
      <span className="shrink-0">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-36 rounded border border-line field px-2 py-1 text-xs text-main"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function NumberInput({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-zinc-500">
      {label}
      <input
        type="number"
        step={step}
        value={Math.round(value * 100) / 100}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded border border-line field px-2 py-1 text-xs normal-case tracking-normal text-main"
      />
    </label>
  );
}

export function IconBtn({
  children,
  onClick,
  title,
  active,
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm transition disabled:opacity-30 ${
        active ? "bg-violet-500/20 text-violet-300" : "text-muted hover:bg-[var(--hover)]"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Btn({
  children,
  onClick,
  variant = "ghost",
  className = "",
  disabled,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  className?: string;
  disabled?: boolean;
  title?: string;
}) {
  const styles = {
    primary: "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:brightness-110 shadow-lg shadow-violet-500/20",
    ghost: "bg-[var(--hover)] text-main hover:brightness-125 border border-line",
    danger: "bg-red-500/10 text-red-300 hover:bg-red-500/20 border border-red-500/20",
  }[variant];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}
