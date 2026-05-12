import { notFound } from "next/navigation";
import Link from "next/link";
import BoardView from "@/components/BoardView";
import { listBoardIdsWithNodes, loadBoardData } from "@/lib/board-data";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  return listBoardIdsWithNodes().map((id) => ({ id }));
}

export default async function BoardPage({ params }: Props) {
  const { id } = await params;
  const boardData = loadBoardData(id, { includeConnections: true, includeCitations: true });
  if (!boardData) return notFound();
  const { board, nodes, connections, citationsByNode } = boardData;

  const summary = {
    nodes: nodes.length,
    connections: connections.length,
    high_confidence: connections.filter((c) => c.confidence >= 0.8).length,
    tinfoil: connections.filter((c) => c.confidence < 0.5).length,
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
          <Link href={`/boards/${id}/timeline`} className="text-zinc-400 hover:text-zinc-100">
            timeline ↗
          </Link>
          <Link href={`/boards/${id}/matrix`} className="text-zinc-400 hover:text-zinc-100">
            matrix ↗
          </Link>
          <Link href={`/boards/${id}/arcs`} className="text-zinc-400 hover:text-zinc-100">
            arcs ↗
          </Link>
        </nav>
      </header>

      <BoardView
        nodes={nodes}
        connections={connections}
        citationsByNode={citationsByNode}
      />
    </div>
  );
}
