import { db, schema } from "@/lib/db";
import { eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import ArcsView from "@/components/ArcsView";
import { LENSES } from "@/data/lenses";

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

export default async function BoardArcsPage({ params }: Props) {
  const { id } = await params;
  const board = db.select().from(schema.boards).where(eq(schema.boards.id, id)).get();
  if (!board) return notFound();

  // Pull only nodes that appear in at least one lens — that's the corpus
  // the subway view operates on. The other ~50 nodes have no narrative
  // anchor; they live in the board view but don't get a station here.
  const lensedIds = Array.from(new Set(LENSES.flatMap((l) => l.nodeIds)));
  const nodes = lensedIds.length
    ? db.select().from(schema.nodes).where(inArray(schema.nodes.id, lensedIds)).all()
    : [];

  return (
    <div>
      <header className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold">{board.title}</h1>
          <p className="text-xs text-zinc-500 font-mono mt-1">
            curator: {board.curator} · narrative-arc / subway map
          </p>
        </div>
        <nav className="flex gap-3 font-mono text-sm">
          <a href={`/boards/${id}`} className="text-zinc-400 hover:text-zinc-100">
            board ↗
          </a>
          <a href={`/boards/${id}/timeline`} className="text-zinc-400 hover:text-zinc-100">
            timeline ↗
          </a>
          <a href={`/boards/${id}/matrix`} className="text-zinc-400 hover:text-zinc-100">
            matrix ↗
          </a>
          <span className="text-zinc-100">arcs</span>
        </nav>
      </header>

      <ArcsView boardId={id} nodes={nodes} />
    </div>
  );
}
