import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

interface Props {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Props) {
  const { id } = await params;
  const body = await req.json();
  const action = body.action as "accept" | "reject";

  if (action !== "accept" && action !== "reject") {
    return NextResponse.json({ error: "action must be accept|reject" }, { status: 400 });
  }

  const status = action === "accept" ? "accepted" : "rejected";
  const numericId = parseInt(id, 10);
  const now = new Date().toISOString();

  const updated = db
    .update(schema.suggestions)
    .set({ status, resolvedAt: now })
    .where(eq(schema.suggestions.id, numericId))
    .run();

  if (updated.changes === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // If accepted and existingNodeId is set, write the citation
  if (action === "accept") {
    const sug = db
      .select()
      .from(schema.suggestions)
      .where(eq(schema.suggestions.id, numericId))
      .get();
    if (sug?.existingNodeId) {
      db.insert(schema.nodeSources)
        .values({ nodeId: sug.existingNodeId, sourceId: sug.sourceId })
        .onConflictDoNothing()
        .run();
    }
  }

  return NextResponse.json({ id: numericId, status });
}
