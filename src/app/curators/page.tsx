import { db, schema } from "@/lib/db";
import { sql } from "drizzle-orm";

export default async function CuratorsPage() {
  // Aggregate contributions per curator across nodes / connections / sources
  const nodeCounts = db
    .select({ curator: schema.nodes.createdBy, n: sql<number>`COUNT(*)`.as("n") })
    .from(schema.nodes)
    .groupBy(schema.nodes.createdBy)
    .all();
  const connCounts = db
    .select({ curator: schema.connections.curator, n: sql<number>`COUNT(*)`.as("n") })
    .from(schema.connections)
    .groupBy(schema.connections.curator)
    .all();

  const handles = new Set([
    ...nodeCounts.map((r) => r.curator),
    ...connCounts.map((r) => r.curator),
  ]);

  const stats = Array.from(handles)
    .map((h) => ({
      handle: h,
      nodes: nodeCounts.find((r) => r.curator === h)?.n ?? 0,
      connections: connCounts.find((r) => r.curator === h)?.n ?? 0,
    }))
    .sort((a, b) => b.nodes + b.connections - (a.nodes + a.connections));

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">Curators</h1>
      <p className="text-sm text-zinc-400 mb-1">
        Contributors to the corpus. Each node, connection, and source carries an
        author handle on the audit log; this page aggregates per-handle.
      </p>
      <p className="text-xs text-zinc-500 font-mono mb-6">
        spec §9 Phase 2 — multi-curator support. API-key auth with read / write /
        admin scopes is live; per-curator boards land when more than one curator
        actually shows up.
      </p>

      <ul className="space-y-2">
        {stats.map((s) => (
          <li key={s.handle}>
            <a
              href={`/curators/${encodeURIComponent(s.handle)}`}
              className="block border border-zinc-800 p-4 hover:border-zinc-600"
            >
              <div className="font-bold font-mono">{s.handle}</div>
              <div className="text-xs text-zinc-500 mt-1 font-mono">
                {s.nodes} nodes · {s.connections} connections
              </div>
            </a>
          </li>
        ))}
      </ul>

      {stats.length === 1 && (
        <p className="text-xs text-zinc-600 mt-6 italic">
          Single-curator corpus right now. The schema (api_keys + scope ladder
          read/write/admin) is ready for additional curators — they create keys
          via <code className="text-zinc-400">pnpm admin keys create</code>, sign
          their seed contributions with their handle, and merge via PR.
        </p>
      )}
    </div>
  );
}
