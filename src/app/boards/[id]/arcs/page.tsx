import { notFound } from "next/navigation";
import BoardShell from "@/components/BoardShell";
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
    <BoardShell
      boardId={id}
      boardTitle={board.title}
      curator={board.curator}
      activeView="arcs"
      subtitle="narrative-arc subway map"
      metrics={`${nodes.length} lensed nodes`}
    >
      <ArcsView boardId={id} nodes={nodes} />
    </BoardShell>
  );
}
