import { db, schema } from "@/lib/db";
import { analyze } from "@/lib/graph-analysis";
import { and, inArray } from "drizzle-orm";
import Link from "next/link";
import { nodeTypeColor, nodeTypeTextColor } from "@/lib/palette";

interface BoardAnalysis {
  boardId: string;
  boardTitle: string;
  curator: string;
  result: ReturnType<typeof analyze>;
}

export default async function AnalyticsPage() {
  const boards = db.select().from(schema.boards).all();
  const memberRows = db.select().from(schema.boardNodes).all();
  const nodeIdsByBoard = new Map<string, Set<string>>();

  for (const row of memberRows) {
    if (!nodeIdsByBoard.has(row.boardId)) nodeIdsByBoard.set(row.boardId, new Set());
    nodeIdsByBoard.get(row.boardId)!.add(row.nodeId);
  }

  const boardAnalyses: BoardAnalysis[] = boards
    .map((board) => {
      const nodeIds = Array.from(nodeIdsByBoard.get(board.id) ?? []);
      if (nodeIds.length === 0) return null;

      const nodes = db.select().from(schema.nodes).where(inArray(schema.nodes.id, nodeIds)).all();
      const connections = db
        .select()
        .from(schema.connections)
        .where(
          and(
            inArray(schema.connections.srcNodeId, nodeIds),
            inArray(schema.connections.tgtNodeId, nodeIds),
          ),
        )
        .all();

      return {
        boardId: board.id,
        boardTitle: board.title,
        curator: board.curator,
        result: analyze(nodes, connections, 20),
      };
    })
    .filter((row): row is BoardAnalysis => row !== null)
    .sort((a, b) => a.boardTitle.localeCompare(b.boardTitle));

  if (boardAnalyses.length === 0) {
    return (
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold mb-2">Analytics</h1>
        <p className="text-sm text-zinc-400">
          No boards with nodes found yet. Seed a board and revisit analytics.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-2">Analytics</h1>
      <p className="text-sm text-zinc-400 mb-4">
        Network-structural metrics per board. Lifted from
        Dossier/dossier/core/graph_analysis.py — graphology in place of NetworkX.
      </p>
      <p className="text-xs text-zinc-500 font-mono mb-6">
        {boardAnalyses.length} board{boardAnalyses.length === 1 ? "" : "s"} analyzed
      </p>

      <div className="space-y-8">
        {boardAnalyses.map(({ boardId, boardTitle, curator, result }) => (
          <section key={boardId} className="border border-zinc-800 p-4">
            <header className="mb-4">
              <h2 className="text-lg font-bold">
                <Link href={`/boards/${boardId}`} className="hover:text-blue-400">
                  {boardTitle}
                </Link>
              </h2>
              <p className="text-xs font-mono text-zinc-500 mt-1">
                id: {boardId} · curator: {curator}
              </p>
            </header>

            <section className="border border-zinc-800 p-3 mb-6 font-mono text-xs">
              <h3 className="text-zinc-400 uppercase tracking-wide mb-2">Stats</h3>
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
                boardId={boardId}
                title="Degree centrality"
                subtitle="how many neighbors does each node have"
                rows={result.degree}
              />
              <Ranking
                boardId={boardId}
                title="Betweenness centrality"
                subtitle="bridges — nodes that sit on many shortest paths"
                rows={result.betweenness}
              />
            </div>
          </section>
        ))}
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
  boardId: string;
  title: string;
  subtitle: string;
  rows: { nodeId: string; name: string; type: string; score: number; rank: number }[];
}

function Ranking({ boardId, title, subtitle, rows }: RankingProps) {
  return (
    <section>
      <h3 className="text-sm font-mono text-zinc-400 mb-1 uppercase tracking-wide">{title}</h3>
      <p className="text-xs text-zinc-500 mb-2">{subtitle}</p>
      <ol className="space-y-1 font-mono text-xs">
        {rows.map((r) => (
          <li key={r.nodeId} className="flex items-center gap-2">
            <span className="text-zinc-600 w-6 text-right">{r.rank}.</span>
            <span
              className="px-1 py-0.5 text-[10px] shrink-0"
              style={{
                background: nodeTypeColor(r.type),
                color: nodeTypeTextColor(r.type),
              }}
            >
              {r.type}
            </span>
            <Link
              href={`/boards/${boardId}#${r.nodeId}`}
              className="flex-1 text-zinc-200 hover:text-blue-400 truncate"
            >
              {r.name}
            </Link>
            <span className="text-zinc-500">{r.score.toFixed(4)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
