import { db, schema } from "@/lib/db";
import { eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { boardIdsByNode } from "@/lib/board-links";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  // Only generate detail pages for sources that have at least one citation —
  // the news-archive scraper put 2,251 metadata-only sources in the DB and
  // 99% of them have no wired citations yet. Building 2,251 stub pages is
  // wasteful; the cited subset is the actual sourcebook.
  const cited = db
    .selectDistinct({ id: schema.nodeSources.sourceId })
    .from(schema.nodeSources)
    .all();
  return cited.map((c) => ({ slug: encodeURIComponent(c.id) }));
}

export default async function SourceDetailPage({ params }: Props) {
  const { slug } = await params;
  const id = decodeURIComponent(slug);

  const source = db.select().from(schema.sources).where(eq(schema.sources.id, id)).get();
  if (!source) return notFound();

  // Nodes that cite this source
  const nodeSourceRows = db
    .select()
    .from(schema.nodeSources)
    .where(eq(schema.nodeSources.sourceId, id))
    .all();
  const nodeIds = nodeSourceRows.map((r) => r.nodeId);
  const nodes = nodeIds.length
    ? db.select().from(schema.nodes).where(inArray(schema.nodes.id, nodeIds)).all()
    : [];
  const boardIdsByNodeId = boardIdsByNode(nodeIds);

  // Group nodes by type
  const byType: Record<string, typeof nodes> = {};
  for (const n of nodes) {
    (byType[n.type] ??= []).push(n);
  }
  for (const list of Object.values(byType)) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  return (
    <div className="max-w-4xl">
      <header className="mb-6">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-xs font-mono text-zinc-500 uppercase tracking-wide">
            {source.type}
          </span>
          <span className="text-xs font-mono text-zinc-500">
            · {source.date ?? "—"} · {source.publisher}
          </span>
          {source.licenseTier && (
            <span className="text-xs font-mono text-zinc-600 ml-auto">
              {source.licenseTier}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold mb-2">{source.title}</h1>
        {source.url && (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-400 hover:text-blue-300 break-all font-mono"
          >
            {source.url} ↗
          </a>
        )}
        {source.excerpt && (
          <p className="text-xs text-zinc-400 mt-3 leading-relaxed border-l-2 border-zinc-700 pl-3">
            {source.excerpt}
          </p>
        )}
        <p className="text-xs font-mono text-zinc-500 mt-3">
          {nodes.length} node{nodes.length === 1 ? "" : "s"} cite this source
        </p>
      </header>

      <nav className="text-xs font-mono mb-6">
        <Link href="/sourcebook" className="text-zinc-400 hover:text-zinc-100">
          ← back to sourcebook
        </Link>
      </nav>

      {nodes.length === 0 ? (
        <p className="text-zinc-500 font-mono text-sm">
          No nodes cite this source yet.
        </p>
      ) : (
        <div className="space-y-6">
          {Object.entries(byType)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([type, list]) => (
              <section key={type}>
                <h2 className="text-sm font-mono text-zinc-400 uppercase tracking-wide mb-2 border-b border-zinc-800 pb-1">
                  {type} ({list.length})
                </h2>
                <ul className="space-y-3">
                  {list.map((n) => (
                    <li key={n.id} className="border-l-2 border-zinc-800 pl-3">
                      {(() => {
                        const boardIds = boardIdsByNodeId.get(n.id) ?? [];
                        const boardId = boardIds[0];
                        return boardId ? (
                          <Link
                            href={`/boards/${boardId}#${n.id}`}
                            className="font-bold text-sm hover:text-blue-400"
                          >
                            {n.name}
                          </Link>
                        ) : (
                          <span className="font-bold text-sm text-zinc-300">{n.name}</span>
                        );
                      })()}
                      {(() => {
                        const boardIds = boardIdsByNodeId.get(n.id) ?? [];
                        if (boardIds.length <= 1) return null;
                        return (
                          <span className="ml-2 text-[11px] font-mono text-zinc-600">
                            on {boardIds.length} boards
                          </span>
                        );
                      })()}
                      {n.brief && (
                        <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{n.brief}</p>
                      )}
                      {n.masterSummary && (
                        <details className="mt-1">
                          <summary className="text-xs font-mono text-zinc-500 cursor-pointer hover:text-zinc-300">
                            synthesis
                          </summary>
                          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                            {n.masterSummary}
                          </p>
                        </details>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
