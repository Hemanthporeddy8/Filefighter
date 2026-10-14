import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import Editor from "@/components/editor/Editor";
import type { Doc, Layer } from "@/lib/editor/types";

export const dynamic = "force-dynamic";

export default async function EditorByIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const num = Number(id);
  if (!Number.isFinite(num)) notFound();
  const [row] = await db.select().from(projects).where(eq(projects.id, num));
  if (!row) notFound();
  const doc: Doc = {
    id: row.id,
    name: row.name,
    width: row.width,
    height: row.height,
    background: row.background,
    layers: (row.layers as Layer[]) ?? [],
  };
  return <Editor key={row.id} initial={doc} />;
}
