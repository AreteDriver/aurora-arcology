"use client";

import { useState } from "react";

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

export default function SuggestionsList({ groups: initialGroups }: Props) {
  const [groups, setGroups] = useState(initialGroups);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  async function resolve(id: number, action: "accept" | "reject") {
    setBusy(id);
    try {
      const res = await fetch(`/api/suggestions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(await res.text());
      // remove from local state
      setGroups((gs) =>
        gs
          .map((g) => ({ ...g, items: g.items.filter((i) => i.id !== id), count: g.count - (g.items.find((i) => i.id === id) ? 1 : 0) }))
          .filter((g) => g.items.length > 0),
      );
    } finally {
      setBusy(null);
    }
  }

  if (groups.length === 0) {
    return (
      <p className="text-zinc-500 font-mono text-sm">
        No pending suggestions. Run <code className="text-zinc-300">pnpm ner:extract</code> to
        populate.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {groups.map((g) => (
        <li key={g.key} className="border border-zinc-800">
          <button
            onClick={() => setOpen(open === g.key ? null : g.key)}
            className="w-full text-left p-3 flex items-center gap-2 hover:bg-zinc-900"
          >
            <span className="font-bold text-sm">{g.matchedText}</span>
            <span className="text-xs font-mono text-zinc-500">{g.candidateType}</span>
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
                      {item.sourceDate ?? "—"} · {item.sourcePublisher ?? ""}
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
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => resolve(item.id, "accept")}
                      disabled={busy === item.id}
                      className="px-2 py-0.5 bg-green-900 hover:bg-green-800 text-green-100 font-mono text-xs disabled:opacity-50"
                    >
                      accept
                    </button>
                    <button
                      onClick={() => resolve(item.id, "reject")}
                      disabled={busy === item.id}
                      className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-xs disabled:opacity-50"
                    >
                      reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
