import { db, schema } from "@/lib/db";
import { analyze } from "@/lib/graph-analysis";

export const dynamic = "force-dynamic";

const TYPE_COLOR: Record<string, string> = {
  Event: "bg-node-event",
  Person: "bg-node-person",
  Organization: "bg-node-org",
  Faction: "bg-node-faction",
  Place: "bg-node-place",
  Phenomenon: "bg-node-phenomenon",
  Concept: "bg-node-concept",
  Artifact: "bg-node-artifact",
};

export default async function AnalyticsPage() {
  // Default to the warpath board — analytics-on-corpus would need union view
  const boardId = "warpath_yc128";
  const memberRows = db
    .select()
    .from(schema.boardNodes)
    .all()
    .filter((r) => r.boardId === boardId);
  const nodeIds = new Set(memberRows.map((r) => r.nodeId));
  const nodes = db.select().from(schema.nodes).all().filter((n) => nodeIds.has(n.id));
  const connections = db
    .select()
    .from(schema.connections)
    .all()
    .filter((c) => nodeIds.has(c.srcNodeId) && nodeIds.has(c.tgtNodeId));

  const result = analyze(nodes, connections, 20);

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-2">Analytics</h1>
      <p className="text-sm text-zinc-400 mb-4">
        Network-structural metrics over the active board. Lifted from
        Dossier/dossier/core/graph_analysis.py — graphology in place of NetworkX.
      </p>

      <section className="border border-zinc-800 p-3 mb-6 font-mono text-xs">
        <h2 className="text-zinc-400 uppercase tracking-wide mb-2">Stats</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Stat label="nodes" value={result.stats.nodes} />
          <Stat label="edges" value={result.stats.edges} />
          <Stat label="components" value={result.stats.components} />
          <Stat label="largest" value={result.stats.largestComponent} />
          <Stat label="isolates" value={result.stats.isolates} />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Ranking
          title="Degree centrality"
          subtitle="how many neighbors does each node have"
          rows={result.degree}
        />
        <Ranking
          title="Betweenness centrality"
          subtitle="bridges — nodes that sit on many shortest paths"
          rows={result.betweenness}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-zinc-500 uppercase tracking-wide">{label}</div>
      <div className="text-zinc-100 text-base">{value.toLocaleString()}</div>
    </div>
  );
}

interface RankingProps {
  title: string;
  subtitle: string;
  rows: { nodeId: string; name: string; type: string; score: number; rank: number }[];
}

function Ranking({ title, subtitle, rows }: RankingProps) {
  return (
    <section>
      <h2 className="text-sm font-mono text-zinc-400 mb-1 uppercase tracking-wide">{title}</h2>
      <p className="text-xs text-zinc-500 mb-2">{subtitle}</p>
      <ol className="space-y-1 font-mono text-xs">
        {rows.map((r) => (
          <li key={r.nodeId} className="flex items-center gap-2">
            <span className="text-zinc-600 w-6 text-right">{r.rank}.</span>
            <span
              className={`${TYPE_COLOR[r.type] ?? "bg-zinc-700"} text-black px-1 py-0.5 text-[10px] shrink-0`}
            >
              {r.type}
            </span>
            <a
              href={`/boards/warpath_yc128#${r.nodeId}`}
              className="flex-1 text-zinc-200 hover:text-blue-400 truncate"
            >
              {r.name}
            </a>
            <span className="text-zinc-500">{r.score.toFixed(4)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
