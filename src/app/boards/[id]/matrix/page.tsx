import { notFound } from "next/navigation";
import BoardShell from "@/components/BoardShell";
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
    <BoardShell
      boardId={id}
      boardTitle={board.title}
      curator={board.curator}
      activeView="matrix"
      subtitle="adjacency-matrix lens"
      metrics={`${nodes.length} nodes · ${connections.length} edges`}
    >
      <MatrixView nodes={nodes} connections={connections} />
    </BoardShell>
  );
}
