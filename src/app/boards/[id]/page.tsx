import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import BoardView from "@/components/BoardView";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BoardPage({ params }: Props) {
  const { id } = await params;
  const board = await db.select().from(schema.boards).where(eq(schema.boards.id, id)).get();
  if (!board) return notFound();

  const memberRows = await db
    .select()
    .from(schema.boardNodes)
    .where(eq(schema.boardNodes.boardId, id))
    .all();
  const nodeIds = memberRows.map((r) => r.nodeId);
  const nodes = nodeIds.length
    ? await db.select().from(schema.nodes).all().then((all) => all.filter((n) => nodeIds.includes(n.id)))
    : [];
  const connections = await db.select().from(schema.connections).all();
  const visibleConns = connections.filter(
    (c) => nodeIds.includes(c.srcNodeId) && nodeIds.includes(c.tgtNodeId),
  );

  const summary = {
    nodes: nodes.length,
    connections: visibleConns.length,
    high_confidence: visibleConns.filter((c) => c.confidence >= 0.8).length,
    tinfoil: visibleConns.filter((c) => c.confidence < 0.5).length,
  };

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl font-bold">{board.title}</h1>
        <p className="text-xs text-zinc-500 font-mono mt-1">
          curator: {board.curator} · {summary.nodes} nodes · {summary.connections} edges
          {" · "}
          {summary.high_confidence} ≥ 0.8 · {summary.tinfoil} flagged tinfoil
        </p>
      </header>

      <BoardView nodes={nodes} connections={visibleConns} />
    </div>
  );
}
