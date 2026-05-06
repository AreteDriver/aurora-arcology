"use client";

import { useMemo, useState } from "react";
import type { Node } from "@db/schema";
import { displayDate, normalizeDate } from "@/lib/dates";

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
  boardId: string;
  nodes: Node[];
}

export default function TimelineView({ boardId, nodes }: Props) {
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());

  const allTypes = useMemo(
    () => Array.from(new Set(nodes.map((n) => n.type))).sort(),
    [nodes],
  );

  const dated = useMemo(() => {
    return nodes
      .filter((n) => !!n.date && !hiddenTypes.has(n.type))
      .map((n) => ({ node: n, sortKey: normalizeDate(n.date) }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [nodes, hiddenTypes]);

  const undated = useMemo(
    () => nodes.filter((n) => !n.date && !hiddenTypes.has(n.type)),
    [nodes, hiddenTypes],
  );

  // Group entries by year (taking the first 4 chars of the sort key)
  const groups = useMemo(() => {
    const out: { year: string; items: typeof dated }[] = [];
    for (const entry of dated) {
      const year = entry.sortKey.slice(0, 4) || "—";
      const last = out[out.length - 1];
      if (last && last.year === year) {
        last.items.push(entry);
      } else {
        out.push({ year, items: [entry] });
      }
    }
    return out;
  }, [dated]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-xs font-mono border border-zinc-800 p-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {allTypes.map((t) => {
            const hidden = hiddenTypes.has(t);
            return (
              <button
                key={t}
                onClick={() => {
                  const next = new Set(hiddenTypes);
                  hidden ? next.delete(t) : next.add(t);
                  setHiddenTypes(next);
                }}
                className={`${TYPE_COLOR[t] ?? "bg-zinc-700"} text-black px-1.5 py-0.5`}
                style={{ opacity: hidden ? 0.3 : 1 }}
              >
                {t}
              </button>
            );
          })}
        </div>
        <div className="ml-auto text-zinc-500">
          {dated.length} dated · {undated.length} undated
        </div>
      </div>

      <div className="relative pl-12">
        {/* Vertical rail */}
        <div className="absolute left-[5.5rem] top-0 bottom-0 w-px bg-zinc-800" aria-hidden />

        {groups.map((g) => (
          <section key={g.year} className="mb-6">
            <h2 className="font-mono text-xs text-zinc-500 uppercase tracking-wide -ml-12 mb-2">
              {g.year}
            </h2>
            <ul className="space-y-2">
              {g.items.map(({ node }) => (
                <li key={node.id} className="flex items-start gap-3 relative">
                  <span className="font-mono text-xs text-zinc-500 w-20 shrink-0 pt-0.5 -ml-12 text-right">
                    {displayDate(node.date)}
                  </span>
                  <span
                    className="absolute left-[5.4rem] top-2 w-2 h-2 rounded-full ring-2 ring-zinc-950"
                    style={{
                      background:
                        TYPE_COLOR[node.type]?.replace("bg-node-", "var(--color-node-") ?? "#888",
                    }}
                    aria-hidden
                  />
                  <span
                    className={`${TYPE_COLOR[node.type] ?? "bg-zinc-700"} text-black px-1.5 py-0.5 text-xs font-mono shrink-0 ml-3`}
                  >
                    {node.type}
                  </span>
                  <div className="flex-1">
                    <a
                      href={`/boards/${boardId}#${node.id}`}
                      className="font-bold text-sm hover:text-blue-400"
                    >
                      {node.name}
                    </a>
                    {node.brief && (
                      <div className="text-zinc-400 text-xs mt-0.5">{node.brief}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {undated.length > 0 && (
        <details className="mt-8 border-t border-zinc-800 pt-4">
          <summary className="font-mono text-xs text-zinc-500 cursor-pointer">
            Undated ({undated.length}) — entities without a date field
          </summary>
          <ul className="mt-2 space-y-1 pl-4">
            {undated.map((n) => (
              <li key={n.id} className="text-xs">
                <span
                  className={`${TYPE_COLOR[n.type] ?? "bg-zinc-700"} text-black px-1.5 py-0.5 font-mono mr-2`}
                >
                  {n.type}
                </span>
                <a
                  href={`/boards/${boardId}#${n.id}`}
                  className="hover:text-blue-400"
                >
                  {n.name}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
