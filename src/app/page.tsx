import { db, schema } from "@/lib/db";

export default async function HomePage() {
  const boards = await db.select().from(schema.boards).all();

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
                  curator: {b.curator} · created {b.createdAt.slice(0, 10)}
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
