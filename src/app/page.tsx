import { db, schema } from "@/lib/db";
import Link from "next/link";

export default async function HomePage() {
  const allBoards = db.select().from(schema.boards).all();
  // Filter to boards that actually have nodes — source-only seeds (news /
  // chronicle archives) get inserted as boards by the seed loader but they
  // don't have any nodes, so navigating into them would render an empty
  // canvas. Their sources are searchable from /sources instead.
  const memberCounts = db.select().from(schema.boardNodes).all().reduce<Record<string, number>>(
    (acc, r) => {
      acc[r.boardId] = (acc[r.boardId] ?? 0) + 1;
      return acc;
    },
    {},
  );
  const boards = allBoards.filter((b) => (memberCounts[b.id] ?? 0) > 0);
  const archiveBoards = allBoards.filter((b) => (memberCounts[b.id] ?? 0) === 0);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">Boards</h1>
      <p className="text-sm text-zinc-400 mb-6">
        Investigation boards. Each board is a curated subset of the underlying graph —
        nodes, typed connections, source citations.
      </p>

      {boards.length === 0 ? (
        <p className="text-zinc-500 font-mono text-sm">
          No boards yet. Run <code className="text-zinc-300">pnpm db:reset</code> to
          load <code className="text-zinc-300">data/seeds/warpath_yc128.json</code>.
        </p>
      ) : (
        <ul className="space-y-2">
          {boards.map((b) => (
            <li key={b.id}>
              <a
                href={`/boards/${b.id}`}
                className="block border border-zinc-800 p-4 hover:border-zinc-600"
              >
                <div className="font-bold">{b.title}</div>
                <div className="text-xs text-zinc-500 mt-1 font-mono">
                  curator: {b.curator} · created {b.createdAt.slice(0, 10)} ·{" "}
                  {memberCounts[b.id]} nodes
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}

      {archiveBoards.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-mono text-zinc-400 uppercase tracking-wide mb-2">
            Source archives
          </h2>
          <p className="text-xs text-zinc-500 mb-3">
            Source-only seeds — bulk-ingested corpora not browsable as boards.
            Search across them from{" "}
            <Link href="/sources" className="hover:text-blue-400">
              /sources
            </Link>
            .
          </p>
          <ul className="space-y-1 text-xs font-mono text-zinc-500">
            {archiveBoards.map((b) => (
              <li key={b.id}>
                <span className="text-zinc-300">{b.title}</span> · {b.id}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
