import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ handle: string }>;
}

export async function generateStaticParams() {
  const nodeAuthors = db
    .selectDistinct({ h: schema.nodes.createdBy })
    .from(schema.nodes)
    .all();
  return nodeAuthors.map((r) => ({ handle: encodeURIComponent(r.h) }));
}

export default async function CuratorDetailPage({ params }: Props) {
  const { handle } = await params;
  const decoded = decodeURIComponent(handle);

  const nodes = db
    .select()
    .from(schema.nodes)
    .where(eq(schema.nodes.createdBy, decoded))
    .all();
  if (nodes.length === 0) return notFound();

  const connections = db
    .select()
    .from(schema.connections)
    .where(eq(schema.connections.curator, decoded))
    .all();

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
        <p className="text-xs font-mono text-zinc-500 uppercase tracking-wide">curator</p>
        <h1 className="text-2xl font-bold font-mono mt-1">{decoded}</h1>
        <p className="text-xs font-mono text-zinc-500 mt-2">
          {nodes.length} nodes · {connections.length} connections drawn
        </p>
      </header>

      <nav className="text-xs font-mono mb-6">
        <a href="/curators" className="text-zinc-400 hover:text-zinc-100">
          ← back to curators
        </a>
      </nav>

      <div className="space-y-6">
        {Object.entries(byType)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([type, list]) => (
            <section key={type}>
              <h2 className="text-sm font-mono text-zinc-400 uppercase tracking-wide mb-2 border-b border-zinc-800 pb-1">
                {type}s ({list.length})
              </h2>
              <ul className="space-y-1 text-sm">
                {list.map((n) => (
                  <li key={n.id} className="flex items-baseline gap-2">
                    <a
                      href={`/boards/warpath_yc128#${n.id}`}
                      className="hover:text-blue-400"
                    >
                      {n.name}
                    </a>
                    <span className="text-xs font-mono text-zinc-600">{n.id}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
      </div>
    </div>
  );
}
