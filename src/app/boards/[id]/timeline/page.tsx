import { notFound } from "next/navigation";
import BoardShell from "@/components/BoardShell";
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
    <BoardShell
      boardId={id}
      boardTitle={board.title}
      curator={board.curator}
      activeView="timeline"
      subtitle="timeline lens"
      metrics={`${nodes.length} nodes`}
    >
      <TimelineView boardId={id} nodes={nodes} />
    </BoardShell>
  );
}
