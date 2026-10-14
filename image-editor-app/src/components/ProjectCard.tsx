"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ProjectCard({
  project,
}: {
  project: { id: number; name: string; width: number; height: number; thumbnail: string | null; updatedAt: string };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const remove = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm(`Delete "${project.name}"?`)) return;
    setBusy(true);
    await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    router.refresh();
  };
  return (
    <Link
      href={`/editor/${project.id}`}
      className={`group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition hover:border-violet-500/50 ${busy ? "opacity-40" : ""}`}
    >
      <div className="grid aspect-square place-items-center overflow-hidden bg-[#1a1a20]">
        {project.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={project.thumbnail} alt={project.name} className="max-h-full max-w-full object-contain transition group-hover:scale-105" />
        ) : (
          <span className="text-3xl opacity-40">🖼</span>
        )}
      </div>
      <div className="p-3">
        <div className="truncate text-sm font-medium">{project.name}</div>
        <div className="text-[11px] text-zinc-500">
          {project.width}×{project.height} · {new Date(project.updatedAt).toLocaleDateString()}
        </div>
      </div>
      <button
        onClick={remove}
        className="absolute right-2 top-2 hidden h-7 w-7 place-items-center rounded-md bg-black/60 text-xs text-red-300 hover:bg-red-500/30 group-hover:grid"
        title="Delete"
      >
        ✕
      </button>
    </Link>
  );
}
