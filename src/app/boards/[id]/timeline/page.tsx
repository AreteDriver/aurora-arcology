import { notFound } from "next/navigation";
import Link from "next/link";
import TimelineView from "@/components/TimelineView";
import { listBoardIdsWithNodes, loadBoardData } from "@/lib/board-data";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  return listBoardIdsWithNodes().map((id) => ({ id }));
}

export default async function BoardTimelinePage({ params }: Props) {
  const { id } = await params;
  const boardData = loadBoardData(id);
  if (!boardData) return notFound();
  const { board, nodes } = boardData;

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
          <Link href={`/boards/${id}`} className="text-zinc-400 hover:text-zinc-100">
            board ↗
          </Link>
          <span className="text-zinc-100">timeline</span>
          <Link href={`/boards/${id}/matrix`} className="text-zinc-400 hover:text-zinc-100">
            matrix ↗
          </Link>
          <Link href={`/boards/${id}/arcs`} className="text-zinc-400 hover:text-zinc-100">
            arcs ↗
          </Link>
        </nav>
      </header>

      <TimelineView boardId={id} nodes={nodes} />
    </div>
  );
}
