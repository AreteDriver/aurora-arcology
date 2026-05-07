import { db, schema } from "@/lib/db";
import { sql } from "drizzle-orm";

export default async function SourcebookPage() {
  // Citation count per source — joins node_sources to get the wired total
  const counts = db
    .select({
      sourceId: schema.nodeSources.sourceId,
      n: sql<number>`COUNT(*)`.as("n"),
    })
    .from(schema.nodeSources)
    .groupBy(schema.nodeSources.sourceId)
    .all();
  const countMap = new Map(counts.map((r) => [r.sourceId, r.n]));

  // All sources with citation count attached
  const sources = db
    .select()
    .from(schema.sources)
    .all()
    .map((s) => ({ ...s, citations: countMap.get(s.id) ?? 0 }));

  // Group by type, then sort within each group by citation count desc
  const grouped: Record<string, typeof sources> = {};
  for (const s of sources) {
    (grouped[s.type] ??= []).push(s);
  }
  for (const list of Object.values(grouped)) {
    list.sort((a, b) => b.citations - a.citations || a.title.localeCompare(b.title));
  }

  // Sort type groups by total citations
  const typeGroups = Object.entries(grouped).sort(([, a], [, b]) => {
    const aTot = a.reduce((s, x) => s + x.citations, 0);
    const bTot = b.reduce((s, x) => s + x.citations, 0);
    return bTot - aTot;
  });

  const totalCitations = counts.reduce((s, r) => s + r.n, 0);

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-2">Sourcebook</h1>
      <p className="text-sm text-zinc-400 mb-1">
        Sources organized by type and citation count. Click any cited source to see
        the nodes that anchor to it.
      </p>
      <p className="text-xs text-zinc-500 font-mono mb-6">
        {sources.length.toLocaleString()} sources · {totalCitations.toLocaleString()} citations · spec §6 view #3
      </p>

      <div className="space-y-8">
        {typeGroups.map(([type, list]) => {
          const cited = list.filter((s) => s.citations > 0);
          const uncited = list.filter((s) => s.citations === 0);
          const typeTotal = cited.reduce((s, x) => s + x.citations, 0);
          return (
            <section key={type}>
              <header className="flex items-baseline gap-3 mb-2 border-b border-zinc-800 pb-1">
                <h2 className="text-base font-bold">{type}</h2>
                <span className="text-xs font-mono text-zinc-500">
                  {list.length} total · {cited.length} cited · {typeTotal} citations
                </span>
              </header>

              {cited.length > 0 ? (
                <ul className="space-y-1">
                  {cited.slice(0, 50).map((s) => (
                    <li key={s.id} className="flex items-baseline gap-2 text-sm">
                      <span className="font-mono text-xs text-zinc-500 w-12 text-right shrink-0">
                        {s.citations}×
                      </span>
                      <span className="font-mono text-xs text-zinc-600 w-24 shrink-0">
                        {s.date ?? "—"}
                      </span>
                      <a
                        href={`/sources/${encodeURIComponent(s.id)}`}
                        className="hover:text-blue-400 truncate"
                      >
                        {s.title}
                      </a>
                    </li>
                  ))}
                  {cited.length > 50 && (
                    <li className="text-xs text-zinc-500 font-mono pl-14 mt-1">
                      … and {cited.length - 50} more cited {type.toLowerCase()}s
                    </li>
                  )}
                </ul>
              ) : (
                <p className="text-xs text-zinc-500 font-mono">
                  No citations wired yet.
                </p>
              )}

              {uncited.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs font-mono text-zinc-500 cursor-pointer hover:text-zinc-300">
                    Uncited ({uncited.length}) — sources awaiting curator wiring
                  </summary>
                  <ul className="text-xs text-zinc-600 mt-1 pl-4 max-h-40 overflow-y-auto">
                    {uncited.slice(0, 50).map((s) => (
                      <li key={s.id}>
                        <span className="font-mono mr-2">{s.date ?? "—"}</span>
                        {s.title}
                      </li>
                    ))}
                    {uncited.length > 50 && (
                      <li className="italic">… and {uncited.length - 50} more</li>
                    )}
                  </ul>
                </details>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
