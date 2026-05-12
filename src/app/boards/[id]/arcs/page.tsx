import { notFound } from "next/navigation";
import Link from "next/link";
import ArcsView from "@/components/ArcsView";
import { LENSES } from "@/data/lenses";
import { listBoardIdsWithNodes, loadBoardData } from "@/lib/board-data";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  return listBoardIdsWithNodes().map((id) => ({ id }));
}

export default async function BoardArcsPage({ params }: Props) {
  const { id } = await params;
  const boardData = loadBoardData(id);
  if (!boardData) return notFound();
  const { board, nodes: boardNodes } = boardData;

  // Keep arcs board-scoped: only render stations for board member nodes that
  // are referenced by at least one narrative lens.
  const lensedIds = new Set(LENSES.flatMap((l) => l.nodeIds));
  const nodes = boardNodes.filter((n) => lensedIds.has(n.id));

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
          <Link href={`/boards/${id}`} className="text-zinc-400 hover:text-zinc-100">
            board ↗
          </Link>
          <Link href={`/boards/${id}/timeline`} className="text-zinc-400 hover:text-zinc-100">
            timeline ↗
          </Link>
          <Link href={`/boards/${id}/matrix`} className="text-zinc-400 hover:text-zinc-100">
            matrix ↗
          </Link>
          <span className="text-zinc-100">arcs</span>
        </nav>
      </header>

      <ArcsView boardId={id} nodes={nodes} />
    </div>
  );
}
