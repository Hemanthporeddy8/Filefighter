import Editor from "@/components/editor/Editor";
import { emptyDoc } from "@/lib/editor/factories";

export const dynamic = "force-dynamic";

export default async function NewEditorPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const w = Number(sp.w) || 1080;
  const h = Number(sp.h) || 1080;
  const name = sp.name ? `${sp.name} design` : "Untitled design";
  return <Editor initial={emptyDoc(w, h, name)} />;
}
