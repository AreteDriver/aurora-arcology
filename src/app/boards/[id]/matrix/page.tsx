import { notFound } from "next/navigation";
import Link from "next/link";
import MatrixView from "@/components/MatrixView";
import { listBoardIdsWithNodes, loadBoardData } from "@/lib/board-data";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  return listBoardIdsWithNodes().map((id) => ({ id }));
}

export default async function BoardMatrixPage({ params }: Props) {
  const { id } = await params;
  const boardData = loadBoardData(id, { includeConnections: true });
  if (!boardData) return notFound();
  const { board, nodes, connections } = boardData;

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
          <Link href={`/boards/${id}`} className="text-zinc-400 hover:text-zinc-100">
            board ↗
          </Link>
          <Link href={`/boards/${id}/timeline`} className="text-zinc-400 hover:text-zinc-100">
            timeline ↗
          </Link>
          <span className="text-zinc-100">matrix</span>
          <Link href={`/boards/${id}/arcs`} className="text-zinc-400 hover:text-zinc-100">
            arcs ↗
          </Link>
        </nav>
      </header>

      <MatrixView nodes={nodes} connections={connections} />
    </div>
  );
}
