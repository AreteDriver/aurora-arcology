/**
 * Graph analysis layer over the nodes + connections tables.
 * Lifted in spirit from Dossier/dossier/core/graph_analysis.py — same metrics,
 * graphology + graphology-metrics in place of NetworkX.
 *
 * Produces centrality rankings the curator can use to find structurally
 * important nodes they may have missed.
 */
import Graph from "graphology";
import { degreeCentrality } from "graphology-metrics/centrality/degree";
import betweennessCentrality from "graphology-metrics/centrality/betweenness";
import { connectedComponents } from "graphology-components";
import type { Node, Connection } from "@db/schema";

export interface CentralityRow {
  nodeId: string;
  name: string;
  type: string;
  score: number;
  rank: number;
}

export interface GraphStats {
  nodes: number;
  edges: number;
  components: number;
  largestComponent: number;
  isolates: number;
}

export interface AnalysisResult {
  stats: GraphStats;
  degree: CentralityRow[];
  betweenness: CentralityRow[];
  /** Top N counts for each centrality table */
  topN: number;
}

function buildGraph(nodes: Node[], connections: Connection[]): Graph {
  const g = new Graph({ multi: false, type: "undirected" });
  for (const n of nodes) g.addNode(n.id, { name: n.name, type: n.type });
  for (const c of connections) {
    if (!g.hasNode(c.srcNodeId) || !g.hasNode(c.tgtNodeId)) continue;
    if (c.srcNodeId === c.tgtNodeId) continue; // skip self-loops
    if (g.hasEdge(c.srcNodeId, c.tgtNodeId)) continue; // already added (multi=false)
    g.addUndirectedEdge(c.srcNodeId, c.tgtNodeId, {
      relationType: c.relationType,
      confidence: c.confidence,
    });
  }
  return g;
}

function rankFromScores(
  scores: Record<string, number>,
  nodes: Node[],
  topN: number,
): CentralityRow[] {
  const nameById = new Map(nodes.map((n) => [n.id, n]));
  return Object.entries(scores)
    .map(([nodeId, score]) => {
      const n = nameById.get(nodeId);
      return {
        nodeId,
        name: n?.name ?? nodeId,
        type: n?.type ?? "unknown",
        score,
        rank: 0, // filled below
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export function analyze(
  nodes: Node[],
  connections: Connection[],
  topN = 20,
): AnalysisResult {
  const g = buildGraph(nodes, connections);

  const components = connectedComponents(g) as string[][];
  const componentSizes = components.map((c: string[]) => c.length).sort((a: number, b: number) => b - a);

  const stats: GraphStats = {
    nodes: g.order,
    edges: g.size,
    components: components.length,
    largestComponent: componentSizes[0] ?? 0,
    isolates: components.filter((c: string[]) => c.length === 1).length,
  };

  // Degree centrality (graphology-metrics returns object keyed by node id)
  const degreeScores = degreeCentrality(g) as Record<string, number>;
  // Betweenness — slower but informative; OK at 152 nodes
  const betweennessScores = betweennessCentrality(g) as Record<string, number>;

  return {
    stats,
    degree: rankFromScores(degreeScores, nodes, topN),
    betweenness: rankFromScores(betweennessScores, nodes, topN),
    topN,
  };
}
