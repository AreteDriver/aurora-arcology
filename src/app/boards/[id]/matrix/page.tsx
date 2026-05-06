import { db, schema } from "@/lib/db";
import { eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import MatrixView from "@/components/MatrixView";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  return [{ id: "warpath_yc128" }];
}

export default async function BoardMatrixPage({ params }: Props) {
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
  const connections = db
    .select()
    .from(schema.connections)
    .all()
    .filter((c) => idSet.has(c.srcNodeId) && idSet.has(c.tgtNodeId));

  return (
    <div>
      <header className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold">{board.title}</h1>
          <p className="text-xs text-zinc-500 font-mono mt-1">
            curator: {board.curator} · adjacency-matrix lens
          </p>
        </div>
        <nav className="flex gap-3 font-mono text-sm">
          <a href={`/boards/${id}`} className="text-zinc-400 hover:text-zinc-100">
            board ↗
          </a>
          <a href={`/boards/${id}/timeline`} className="text-zinc-400 hover:text-zinc-100">
            timeline ↗
          </a>
          <span className="text-zinc-100">matrix</span>
        </nav>
      </header>

      <MatrixView nodes={nodes} connections={connections} />
    </div>
  );
}
