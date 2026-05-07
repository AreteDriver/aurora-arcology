import { db, schema } from "@/lib/db";
import { inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import { LENSES, lensById } from "@/data/lenses";
import { buildSynthesis, renderMarkdown } from "@/lib/synthesis";
import SynthesisView from "@/components/SynthesisView";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  return LENSES.map((l) => ({ id: l.id }));
}

export default async function LensSynthesisPage({ params }: Props) {
  const { id } = await params;
  const lens = lensById(id);
  if (!lens) return notFound();

  const nodes = lens.nodeIds.length
    ? db.select().from(schema.nodes).where(inArray(schema.nodes.id, lens.nodeIds)).all()
    : [];
  const idSet = new Set(lens.nodeIds);
  const connections = db
    .select()
    .from(schema.connections)
    .all()
    .filter((c) => idSet.has(c.srcNodeId) && idSet.has(c.tgtNodeId));

  // Sources per node — same shape as the inspector's "Cited in" panel
  const nodeSourceRows = lens.nodeIds.length
    ? db
        .select()
        .from(schema.nodeSources)
        .where(inArray(schema.nodeSources.nodeId, lens.nodeIds))
        .all()
    : [];
  const sourceIds = Array.from(new Set(nodeSourceRows.map((r) => r.sourceId)));
  const sources = sourceIds.length
    ? db.select().from(schema.sources).where(inArray(schema.sources.id, sourceIds)).all()
    : [];
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const citationsByNode: Record<string, typeof sources> = {};
  for (const r of nodeSourceRows) {
    const s = sourceById.get(r.sourceId);
    if (!s) continue;
    (citationsByNode[r.nodeId] ??= []).push(s);
  }
  for (const list of Object.values(citationsByNode)) {
    list.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  }

  const doc = buildSynthesis({
    lensId: lens.id,
    lensTitle: lens.title,
    lensDescription: lens.description,
    nodes,
    citationsByNode,
    connections,
  });
  const markdown = renderMarkdown(doc);

  // Read polished LLM-rendered prose if the curator has run
  // `pnpm synthesize:polish` and committed the output. File is
  // committed under data/syntheses/<lens-id>.md.
  const polishedPath = path.join(process.cwd(), "data/syntheses", `${id}.md`);
  let polishedMarkdown: string | null = null;
  if (fs.existsSync(polishedPath)) {
    polishedMarkdown = fs.readFileSync(polishedPath, "utf-8");
  }

  return <SynthesisView doc={doc} markdown={markdown} polishedMarkdown={polishedMarkdown} />;
}
