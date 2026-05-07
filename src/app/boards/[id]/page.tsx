import { db, schema } from "@/lib/db";
import { eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import BoardView from "@/components/BoardView";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  // One static board for now; if more land, query the boards table here
  return [{ id: "warpath_yc128" }];
}

export default async function BoardPage({ params }: Props) {
  const { id } = await params;
  const board = db.select().from(schema.boards).where(eq(schema.boards.id, id)).get();
  if (!board) return notFound();

  const memberRows = db
    .select()
    .from(schema.boardNodes)
    .where(eq(schema.boardNodes.boardId, id))
    .all();
  const nodeIds = memberRows.map((r) => r.nodeId);
  const nodes = nodeIds.length
    ? db.select().from(schema.nodes).where(inArray(schema.nodes.id, nodeIds)).all()
    : [];
  const idSet = new Set(nodeIds);
  const allConnections = db.select().from(schema.connections).all();
  const visibleConns = allConnections.filter(
    (c) => idSet.has(c.srcNodeId) && idSet.has(c.tgtNodeId),
  );

  // Build a per-node citation list: nodeId → [{id, title, url, date, type, publisher}]
  const nodeSourceRows = nodeIds.length
    ? db
        .select()
        .from(schema.nodeSources)
        .where(inArray(schema.nodeSources.nodeId, nodeIds))
        .all()
    : [];
  const citedSourceIds = Array.from(new Set(nodeSourceRows.map((r) => r.sourceId)));
  const sourceRows = citedSourceIds.length
    ? db
        .select()
        .from(schema.sources)
        .where(inArray(schema.sources.id, citedSourceIds))
        .all()
    : [];
  const sourceById = new Map(sourceRows.map((s) => [s.id, s]));
  const citationsByNode: Record<string, typeof sourceRows> = {};
  for (const r of nodeSourceRows) {
    const src = sourceById.get(r.sourceId);
    if (!src) continue;
    (citationsByNode[r.nodeId] ??= []).push(src);
  }
  // Sort each node's citations by date descending
  for (const list of Object.values(citationsByNode)) {
    list.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  }

  const summary = {
    nodes: nodes.length,
    connections: visibleConns.length,
    high_confidence: visibleConns.filter((c) => c.confidence >= 0.8).length,
    tinfoil: visibleConns.filter((c) => c.confidence < 0.5).length,
  };

  return (
    <div>
      <header className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold">{board.title}</h1>
          <p className="text-xs text-zinc-500 font-mono mt-1">
            curator: {board.curator} · {summary.nodes} nodes · {summary.connections} edges
            {" · "}
            {summary.high_confidence} ≥ 0.8 · {summary.tinfoil} flagged tinfoil
          </p>
        </div>
        <nav className="flex gap-3 font-mono text-sm">
          <span className="text-zinc-100">board</span>
          <a href={`/boards/${id}/timeline`} className="text-zinc-400 hover:text-zinc-100">
            timeline ↗
          </a>
          <a href={`/boards/${id}/matrix`} className="text-zinc-400 hover:text-zinc-100">
            matrix ↗
          </a>
          <a href={`/boards/${id}/arcs`} className="text-zinc-400 hover:text-zinc-100">
            arcs ↗
          </a>
        </nav>
      </header>

      <BoardView
        nodes={nodes}
        connections={visibleConns}
        citationsByNode={citationsByNode}
      />
    </div>
  );
}
