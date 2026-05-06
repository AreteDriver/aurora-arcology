"use client";

// Phase 0 placeholder: list view with type-color chips and confidence-tagged edges.
// Phase 1 replaces this with a D3 force-directed graph and search-around-an-object
// interaction (spec §6 Board view).

import type { Node, Connection } from "@db/schema";

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

interface Props {
  nodes: Node[];
  connections: Connection[];
}

export default function BoardView({ nodes, connections }: Props) {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section>
        <h2 className="text-sm font-mono text-zinc-400 mb-2 uppercase tracking-wide">
          Nodes ({nodes.length})
        </h2>
        <ul className="space-y-1.5">
          {nodes.map((n) => (
            <li key={n.id} className="flex items-start gap-2 text-sm">
              <span
                className={`${TYPE_COLOR[n.type] ?? "bg-zinc-700"} text-black px-1.5 py-0.5 text-xs font-mono shrink-0`}
              >
                {n.type}
              </span>
              <div className="flex-1">
                <div className="font-bold">{n.name}</div>
                {n.brief && <div className="text-zinc-400 text-xs mt-0.5">{n.brief}</div>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-mono text-zinc-400 mb-2 uppercase tracking-wide">
          Connections ({connections.length})
        </h2>
        <ul className="space-y-1.5 font-mono text-xs">
          {connections
            .slice()
            .sort((a, b) => b.confidence - a.confidence)
            .map((c) => {
              const src = nodeById.get(c.srcNodeId)?.name ?? c.srcNodeId;
              const tgt = nodeById.get(c.tgtNodeId)?.name ?? c.tgtNodeId;
              const tinfoil = c.confidence < 0.5;
              return (
                <li key={c.id} className={tinfoil ? "opacity-50" : ""}>
                  <span className="text-zinc-200">{src}</span>{" "}
                  <span className="text-zinc-500">— {c.relationType} →</span>{" "}
                  <span className="text-zinc-200">{tgt}</span>{" "}
                  <span className="text-zinc-600">[{c.confidence.toFixed(2)}]</span>
                  {c.claim && <div className="text-zinc-500 ml-4 mt-0.5 normal-case">{c.claim}</div>}
                </li>
              );
            })}
        </ul>
      </section>
    </div>
  );
}
