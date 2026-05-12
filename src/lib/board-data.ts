import { and, eq, inArray } from "drizzle-orm";
import type { Board, Connection, Node, Source } from "@db/schema";
import { db, schema } from "@/lib/db";

export interface BoardData {
  board: Board;
  nodeIds: string[];
  nodes: Node[];
  connections: Connection[];
  citationsByNode: Record<string, Source[]>;
}

interface BoardDataOptions {
  includeConnections?: boolean;
  includeCitations?: boolean;
}

export function listBoardIdsWithNodes(): string[] {
  return db
    .selectDistinct({ id: schema.boardNodes.boardId })
    .from(schema.boardNodes)
    .all()
    .map((row) => row.id);
}

export function loadConnectionsForNodeIds(nodeIds: string[]): Connection[] {
  if (nodeIds.length === 0) return [];
  return db
    .select()
    .from(schema.connections)
    .where(
      and(
        inArray(schema.connections.srcNodeId, nodeIds),
        inArray(schema.connections.tgtNodeId, nodeIds),
      ),
    )
    .all();
}

export function loadBoardData(
  boardId: string,
  options: BoardDataOptions = {},
): BoardData | null {
  const { includeConnections = false, includeCitations = false } = options;

  const board = db.select().from(schema.boards).where(eq(schema.boards.id, boardId)).get();
  if (!board) return null;

  const nodeIds = db
    .select({ nodeId: schema.boardNodes.nodeId })
    .from(schema.boardNodes)
    .where(eq(schema.boardNodes.boardId, boardId))
    .all()
    .map((row) => row.nodeId);

  const nodes =
    nodeIds.length > 0
      ? db.select().from(schema.nodes).where(inArray(schema.nodes.id, nodeIds)).all()
      : [];

  const connections = includeConnections ? loadConnectionsForNodeIds(nodeIds) : [];

  const citationsByNode: Record<string, Source[]> = {};
  if (includeCitations && nodeIds.length > 0) {
    const nodeSourceRows = db
      .select()
      .from(schema.nodeSources)
      .where(inArray(schema.nodeSources.nodeId, nodeIds))
      .all();
    const sourceIds = Array.from(new Set(nodeSourceRows.map((row) => row.sourceId)));
    const sources =
      sourceIds.length > 0
        ? db.select().from(schema.sources).where(inArray(schema.sources.id, sourceIds)).all()
        : [];
    const sourceById = new Map(sources.map((s) => [s.id, s]));

    for (const row of nodeSourceRows) {
      const source = sourceById.get(row.sourceId);
      if (!source) continue;
      (citationsByNode[row.nodeId] ??= []).push(source);
    }

    for (const list of Object.values(citationsByNode)) {
      list.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    }
  }

  return {
    board,
    nodeIds,
    nodes,
    connections,
    citationsByNode,
  };
}
