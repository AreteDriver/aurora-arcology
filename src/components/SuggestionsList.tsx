"use client";

import { useMemo, useState } from "react";

interface SuggestionItem {
  id: number;
  sourceId: string;
  sourceTitle: string | null;
  sourceUrl: string | null;
  sourceDate: string | null;
  sourcePublisher: string | null;
}

interface SuggestionGroup {
  key: string;
  matchedText: string;
  candidateType: string;
  existingNodeId: string | null;
  rationale: string | null;
  count: number;
  items: SuggestionItem[];
}

interface Props {
  groups: SuggestionGroup[];
}

const RATIONALE_COLOR: Record<string, string> = {
  "gazetteer-existing-node": "text-green-400",
  "gazetteer-new-entity": "text-yellow-400",
  "regex-yc-date": "text-blue-400",
  "regex-system-name": "text-blue-400",
  "regex-polity": "text-blue-400",
  "heuristic-multi-word": "text-zinc-500",
};
const rationaleClass = (r: string | null) => {
  if (!r) return "text-zinc-500";
  return RATIONALE_COLOR[r] ?? (r.startsWith("tf-frequency") ? "text-purple-400" : "text-zinc-500");
};

export default function SuggestionsList({ groups }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [rationaleFilter, setRationaleFilter] = useState<string | null>(null);

  // Group rationales for filter pills
  const rationaleCounts = useMemo(
    () =>
      groups.reduce<Record<string, number>>((acc, g) => {
        const key = g.rationale ?? "unknown";
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {}),
    [groups],
  );

  const visibleGroups = rationaleFilter
    ? groups.filter((g) => g.rationale === rationaleFilter)
    : groups;

  if (groups.length === 0) {
    return (
      <p className="text-zinc-500 font-mono text-sm">
        No pending suggestions. Run <code className="text-zinc-300">pnpm ner:extract</code> to
        populate.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-3 text-xs font-mono">
        <span className="text-zinc-500">rationale:</span>
        <button
          onClick={() => setRationaleFilter(null)}
          className={`px-1.5 py-0.5 ${rationaleFilter === null ? "bg-zinc-100 text-black" : "bg-zinc-800 hover:bg-zinc-700"}`}
        >
          all ({groups.length})
        </button>
        {Object.entries(rationaleCounts).map(([r, n]) => (
          <button
            key={r}
            onClick={() => setRationaleFilter(r)}
            className={`px-1.5 py-0.5 ${rationaleFilter === r ? "bg-zinc-100 text-black" : "bg-zinc-800 hover:bg-zinc-700"} ${rationaleClass(r)}`}
          >
            {r} ({n})
          </button>
        ))}
      </div>
    <ul className="space-y-2">
      {visibleGroups.map((g) => (
        <li key={g.key} className="border border-zinc-800">
          <button
            onClick={() => setOpen(open === g.key ? null : g.key)}
            className="w-full text-left p-3 flex items-center gap-2 hover:bg-zinc-900"
          >
            <span className="font-bold text-sm">{g.matchedText}</span>
            <span className="text-xs font-mono text-zinc-500">{g.candidateType}</span>
            <span className={`text-xs font-mono ${rationaleClass(g.rationale)}`}>
              {g.rationale}
            </span>
            {g.existingNodeId ? (
              <span className="text-xs font-mono text-green-400">
                → {g.existingNodeId}
              </span>
            ) : (
              <span className="text-xs font-mono text-yellow-400">new entity</span>
            )}
            <span className="ml-auto text-xs font-mono text-zinc-500">
              {g.count} source{g.count === 1 ? "" : "s"}
            </span>
            <span className="font-mono text-zinc-500">{open === g.key ? "▾" : "▸"}</span>
          </button>

          {open === g.key && (
            <ul className="border-t border-zinc-800 divide-y divide-zinc-800">
              {g.items.map((item) => (
                <li key={item.id} className="p-3 text-xs flex items-start gap-3">
                  <div className="flex-1">
                    <div className="font-mono text-zinc-500 mb-0.5">
                      {item.sourceDate ?? "—"} · {item.sourcePublisher ?? ""} · #{item.id}
                    </div>
                    {item.sourceUrl ? (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-400"
                      >
                        {item.sourceTitle ?? item.sourceId} ↗
                      </a>
                    ) : (
                      <span>{item.sourceTitle ?? item.sourceId}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
    </>
  );
}
