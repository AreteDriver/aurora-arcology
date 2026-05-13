import { notFound } from "next/navigation";
import BoardShell from "@/components/BoardShell";
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
    <BoardShell
      boardId={id}
      boardTitle={board.title}
      curator={board.curator}
      activeView="board"
      subtitle="graph board"
      metrics={`${summary.nodes} nodes · ${summary.connections} edges · ${summary.high_confidence} >= 0.8 · ${summary.tinfoil} flagged tinfoil`}
    >
      <BoardView
        nodes={nodes}
        connections={connections}
        citationsByNode={citationsByNode}
      />
    </BoardShell>
  );
}
