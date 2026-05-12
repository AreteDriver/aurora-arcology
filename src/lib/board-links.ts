import { inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export function boardIdsByNode(nodeIds: string[]): Map<string, string[]> {
  if (nodeIds.length === 0) return new Map();

  const rows = db
    .select({
      nodeId: schema.boardNodes.nodeId,
      boardId: schema.boardNodes.boardId,
    })
    .from(schema.boardNodes)
    .where(inArray(schema.boardNodes.nodeId, nodeIds))
    .all();

  const buckets = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!buckets.has(row.nodeId)) buckets.set(row.nodeId, new Set());
    buckets.get(row.nodeId)!.add(row.boardId);
  }

  return new Map(
    Array.from(buckets.entries()).map(([nodeId, boardIds]) => [
      nodeId,
      Array.from(boardIds).sort((a, b) => a.localeCompare(b)),
    ]),
  );
}
