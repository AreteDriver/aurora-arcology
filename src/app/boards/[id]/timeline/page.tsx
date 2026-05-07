import { db, schema } from "@/lib/db";
import { eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import TimelineView from "@/components/TimelineView";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  const boardsWithNodes = db
    .selectDistinct({ id: schema.boardNodes.boardId })
    .from(schema.boardNodes)
    .all();
  return boardsWithNodes.map((b) => ({ id: b.id }));
}

export default async function BoardTimelinePage({ params }: Props) {
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

  return (
    <div>
      <header className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold">{board.title}</h1>
          <p className="text-xs text-zinc-500 font-mono mt-1">
            curator: {board.curator} · timeline lens
          </p>
        </div>
        <nav className="flex gap-3 font-mono text-sm">
          <a href={`/boards/${id}`} className="text-zinc-400 hover:text-zinc-100">
            board ↗
          </a>
          <span className="text-zinc-100">timeline</span>
          <a href={`/boards/${id}/matrix`} className="text-zinc-400 hover:text-zinc-100">
            matrix ↗
          </a>
          <a href={`/boards/${id}/arcs`} className="text-zinc-400 hover:text-zinc-100">
            arcs ↗
          </a>
        </nav>
      </header>

      <TimelineView boardId={id} nodes={nodes} />
    </div>
  );
}
