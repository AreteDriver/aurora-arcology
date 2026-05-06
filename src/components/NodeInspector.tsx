"use client";

import type { Node, Connection, Source } from "@db/schema";

interface Props {
  node: Node | null;
  nodeById: Map<string, Node>;
  connections: Connection[];
  citations?: Source[];
  onSelect: (id: string) => void;
  onClear: () => void;
}

export default function NodeInspector({
  node,
  nodeById,
  connections,
  citations = [],
  onSelect,
  onClear,
}: Props) {
  if (!node) {
    return (
      <aside className="border border-zinc-800 p-4 text-zinc-500 text-sm font-mono">
        Click a node to inspect. Drag to reposition. Scroll to zoom.
      </aside>
    );
  }

  const incident = connections.filter((c) => c.srcNodeId === node.id || c.tgtNodeId === node.id);
  const outgoing = incident.filter((c) => c.srcNodeId === node.id);
  const incoming = incident.filter((c) => c.tgtNodeId === node.id);

  return (
    <aside className="border border-zinc-800 p-4 text-sm space-y-3 overflow-y-auto">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-mono text-zinc-500 uppercase tracking-wide">{node.type}</div>
          <h2 className="font-bold text-base mt-0.5">{node.name}</h2>
        </div>
        <button
          onClick={onClear}
          className="text-zinc-500 hover:text-zinc-200 text-xs font-mono"
          aria-label="Close inspector"
        >
          [×]
        </button>
      </div>

      {node.brief && <p className="text-zinc-300 text-xs leading-relaxed">{node.brief}</p>}

      {node.masterSummary && (
        <section className="border-l-2 border-zinc-700 pl-3">
          <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wide mb-1">
            Synthesis
          </h3>
          <p className="text-zinc-300 text-xs leading-relaxed">{node.masterSummary}</p>
        </section>
      )}

      <div className="text-xs font-mono text-zinc-500 space-y-0.5">
        <div>id: {node.id}</div>
        <div>canonicity: {node.canonicity}</div>
      </div>

      {outgoing.length > 0 && (
        <section>
          <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wide mb-1">
            Outgoing ({outgoing.length})
          </h3>
          <ul className="space-y-1 font-mono text-xs">
            {outgoing
              .sort((a, b) => b.confidence - a.confidence)
              .map((c) => (
                <li key={c.id} className={c.confidence < 0.5 ? "opacity-50" : ""}>
                  <span className="text-zinc-500">— {c.relationType} →</span>{" "}
                  <button
                    onClick={() => onSelect(c.tgtNodeId)}
                    className="text-zinc-200 hover:text-blue-400 underline-offset-2 hover:underline"
                  >
                    {nodeById.get(c.tgtNodeId)?.name ?? c.tgtNodeId}
                  </button>{" "}
                  <span className="text-zinc-600">[{c.confidence.toFixed(2)}]</span>
                  {c.claim && <div className="text-zinc-500 ml-3 mt-0.5 normal-case">{c.claim}</div>}
                </li>
              ))}
          </ul>
        </section>
      )}

      {incoming.length > 0 && (
        <section>
          <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wide mb-1">
            Incoming ({incoming.length})
          </h3>
          <ul className="space-y-1 font-mono text-xs">
            {incoming
              .sort((a, b) => b.confidence - a.confidence)
              .map((c) => (
                <li key={c.id} className={c.confidence < 0.5 ? "opacity-50" : ""}>
                  <button
                    onClick={() => onSelect(c.srcNodeId)}
                    className="text-zinc-200 hover:text-blue-400 underline-offset-2 hover:underline"
                  >
                    {nodeById.get(c.srcNodeId)?.name ?? c.srcNodeId}
                  </button>{" "}
                  <span className="text-zinc-500">— {c.relationType} →</span>{" "}
                  <span className="text-zinc-600">[{c.confidence.toFixed(2)}]</span>
                  {c.claim && <div className="text-zinc-500 ml-3 mt-0.5 normal-case">{c.claim}</div>}
                </li>
              ))}
          </ul>
        </section>
      )}

      {citations.length > 0 && (
        <section>
          <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wide mb-1">
            Cited in ({citations.length})
          </h3>
          <ul className="space-y-1 font-mono text-xs">
            {citations.map((s) => (
              <li key={s.id} className="leading-tight">
                <span className="text-zinc-500">{s.date ?? "—"}</span>{" "}
                <span className="text-zinc-600">[{s.type}]</span>{" "}
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-200 hover:text-blue-400 normal-case"
                  >
                    {s.title} ↗
                  </a>
                ) : (
                  <span className="text-zinc-200 normal-case">{s.title}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
