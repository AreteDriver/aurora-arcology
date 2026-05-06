import { db, schema } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import SuggestionsList from "@/components/SuggestionsList";

export default async function SuggestionsPage() {
  // Pending suggestions joined with source + (optional) existing node
  const rows = db
    .select({
      id: schema.suggestions.id,
      matchedText: schema.suggestions.matchedText,
      candidateType: schema.suggestions.candidateType,
      existingNodeId: schema.suggestions.existingNodeId,
      rationale: schema.suggestions.rationale,
      sourceId: schema.suggestions.sourceId,
      sourceTitle: schema.sources.title,
      sourceUrl: schema.sources.url,
      sourceDate: schema.sources.date,
      sourcePublisher: schema.sources.publisher,
    })
    .from(schema.suggestions)
    .leftJoin(schema.sources, eq(schema.suggestions.sourceId, schema.sources.id))
    .where(eq(schema.suggestions.status, "pending"))
    .orderBy(desc(schema.sources.date))
    .all();

  // Group by matched_text so the curator sees one row per candidate, not 2,000
  const grouped = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = `${r.matchedText}|${r.existingNodeId ?? "new"}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }
  const groups = Array.from(grouped.entries())
    .map(([key, items]) => ({
      key,
      matchedText: items[0].matchedText,
      candidateType: items[0].candidateType,
      existingNodeId: items[0].existingNodeId,
      rationale: items[0].rationale,
      count: items.length,
      items,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">Suggestions</h1>
      <p className="text-sm text-zinc-400 mb-4">
        NER-extracted candidate citations awaiting curator review. Pattern: spec §9
        Phase 3 — auto-suggested, never auto-drawn.
      </p>
      <p className="text-xs text-zinc-500 mb-4 font-mono">
        Curator workflow (local only):{" "}
        <code className="text-zinc-300">pnpm admin suggestions accept-all</code> bulk-accepts
        the safe class (gazetteer hits to existing nodes).{" "}
        <code className="text-zinc-300">accept &lt;id&gt;</code> /{" "}
        <code className="text-zinc-300">reject &lt;id&gt;</code> for individual review.
      </p>
      <p className="text-xs text-zinc-500 font-mono mb-6">
        {rows.length} pending across {groups.length} distinct candidates
      </p>

      <SuggestionsList groups={groups} />
    </div>
  );
}
