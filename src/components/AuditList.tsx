"use client";

import { useMemo, useState } from "react";

interface Row {
  id: number;
  entityType: string;
  entityId: string;
  action: string;
  changedBy: string;
  changedAt: string;
  payload: string | null;
}

interface Props {
  rows: Row[];
  typeCounts: Record<string, number>;
  actionCounts: Record<string, number>;
}

const PAGE_SIZE = 50;

const ACTION_COLOR: Record<string, string> = {
  create: "text-green-400",
  update: "text-yellow-400",
  delete: "text-red-400",
};

const ENTITY_COLOR: Record<string, string> = {
  node: "text-node-person",
  source: "text-node-place",
  connection: "text-node-org",
  board: "text-node-event",
};

export default function AuditList({ rows, typeCounts, actionCounts }: Props) {
  const [entity, setEntity] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (entity && r.entityType !== entity) return false;
      if (action && r.action !== action) return false;
      return true;
    });
  }, [rows, entity, action]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const setFilter = (kind: "entity" | "action", value: string | null) => {
    if (kind === "entity") setEntity(value);
    else setAction(value);
    setPage(1);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs font-mono border border-zinc-800 p-2">
        <span className="text-zinc-500">entity:</span>
        <button
          onClick={() => setFilter("entity", null)}
          className={`px-1.5 py-0.5 ${entity === null ? "bg-zinc-100 text-black" : "bg-zinc-800 hover:bg-zinc-700"}`}
        >
          all ({rows.length})
        </button>
        {Object.entries(typeCounts).map(([t, n]) => (
          <button
            key={t}
            onClick={() => setFilter("entity", t)}
            className={`px-1.5 py-0.5 ${entity === t ? "bg-zinc-100 text-black" : "bg-zinc-800 hover:bg-zinc-700"}`}
          >
            {t} ({n})
          </button>
        ))}
        <span className="ml-4 text-zinc-500">action:</span>
        <button
          onClick={() => setFilter("action", null)}
          className={`px-1.5 py-0.5 ${action === null ? "bg-zinc-100 text-black" : "bg-zinc-800 hover:bg-zinc-700"}`}
        >
          all
        </button>
        {Object.entries(actionCounts).map(([a, n]) => (
          <button
            key={a}
            onClick={() => setFilter("action", a)}
            className={`px-1.5 py-0.5 ${action === a ? "bg-zinc-100 text-black" : "bg-zinc-800 hover:bg-zinc-700"}`}
          >
            {a} ({n})
          </button>
        ))}
      </div>

      <ul className="border border-zinc-800 divide-y divide-zinc-800">
        {visible.map((r) => (
          <li key={r.id}>
            <button
              onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
              className="w-full text-left p-2 flex items-center gap-2 hover:bg-zinc-900 font-mono text-xs"
            >
              <span className="text-zinc-500 w-44 shrink-0">{r.changedAt.slice(0, 19).replace("T", " ")}</span>
              <span className={`${ACTION_COLOR[r.action] ?? "text-zinc-400"} w-14`}>{r.action}</span>
              <span className={`${ENTITY_COLOR[r.entityType] ?? "text-zinc-400"} w-20`}>{r.entityType}</span>
              <span className="text-zinc-300 truncate flex-1">{r.entityId}</span>
              <span className="text-zinc-600 w-24 text-right">{r.changedBy}</span>
              <span className="text-zinc-600 ml-2">{expandedId === r.id ? "▾" : "▸"}</span>
            </button>
            {expandedId === r.id && r.payload && (
              <pre className="bg-zinc-950 border-t border-zinc-800 p-2 text-xs text-zinc-300 overflow-x-auto">
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(r.payload), null, 2);
                  } catch {
                    return r.payload;
                  }
                })()}
              </pre>
            )}
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <div className="flex justify-between items-center text-xs font-mono text-zinc-500">
          <span>
            page {page} of {totalPages} · {total.toLocaleString()} entries
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30"
            >
              ← prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30"
            >
              next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
