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
  const [collapsedYears, setCollapsedYears] = useState<Set<string>>(new Set());

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

  // Density-based sort for the year strip — peaks bubble first when "by density" toggled
  const yearList = groups.map((g) => ({ year: g.year, count: g.items.length }));
  const maxCount = Math.max(1, ...yearList.map((y) => y.count));

  const toggleYear = (year: string) => {
    const next = new Set(collapsedYears);
    next.has(year) ? next.delete(year) : next.add(year);
    setCollapsedYears(next);
  };

  const allCollapsed = groups.every((g) => collapsedYears.has(g.year));
  const collapseAll = () => setCollapsedYears(new Set(groups.map((g) => g.year)));
  const expandAll = () => setCollapsedYears(new Set());

  return (
    <div className="space-y-4">
      {/* Type filter + counts */}
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
        <button
          onClick={allCollapsed ? expandAll : collapseAll}
          className="border border-zinc-700 text-zinc-300 hover:border-zinc-500 px-1.5 py-0.5"
        >
          {allCollapsed ? "expand all" : "collapse all"}
        </button>
        <div className="ml-auto text-zinc-500">
          {dated.length} dated · {undated.length} undated · {groups.length} years
        </div>
      </div>

      {/* Year-jump strip — bar widths proportional to density */}
      <div className="border border-zinc-800 p-2 overflow-x-auto">
        <div className="flex items-end gap-px text-xs font-mono">
          {yearList.map(({ year, count }) => (
            <a
              key={year}
              href={`#year-${year}`}
              className="flex flex-col items-center justify-end min-w-[2rem] hover:bg-zinc-900"
              title={`${year} — ${count} entries`}
            >
              <div
                className="w-full bg-blue-500/40"
                style={{ height: `${Math.max(2, (count / maxCount) * 36)}px` }}
              />
              <div className="text-[0.6rem] text-zinc-500 mt-0.5 tabular-nums">
                {year.replace(/^YC0+/, "YC").replace(/^YC$/, "YC0")}
              </div>
              <div className="text-[0.55rem] text-zinc-600 tabular-nums">{count}</div>
            </a>
          ))}
        </div>
      </div>

      {/* Timeline body */}
      <div className="relative pl-12">
        <div className="absolute left-[5.5rem] top-0 bottom-0 w-px bg-zinc-800" aria-hidden />

        {groups.map((g) => {
          const isCollapsed = collapsedYears.has(g.year);
          return (
            <section key={g.year} id={`year-${g.year}`} className="mb-6 scroll-mt-4">
              <button
                onClick={() => toggleYear(g.year)}
                className="font-mono text-xs text-zinc-400 uppercase tracking-wide -ml-12 mb-2 hover:text-zinc-100 flex items-center gap-2"
              >
                <span className="inline-block w-3 text-zinc-600">{isCollapsed ? "▸" : "▾"}</span>
                <span>{g.year}</span>
                <span className="text-zinc-600 normal-case">({g.items.length})</span>
              </button>
              {!isCollapsed && (
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
                            TYPE_COLOR[node.type]?.replace("bg-node-", "var(--color-node-") ??
                            "#888",
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
              )}
            </section>
          );
        })}
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
                <a href={`/boards/${boardId}#${n.id}`} className="hover:text-blue-400">
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
