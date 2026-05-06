"use client";

import { useState } from "react";

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
  page: number;
  totalPages: number;
  total: number;
  currentEntity: string | null;
  currentAction: string | null;
  typeCounts: Record<string, number>;
  actionCounts: Record<string, number>;
}

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

function buildHref(entity: string | null, action: string | null, page: number): string {
  const params = new URLSearchParams();
  if (entity) params.set("entity", entity);
  if (action) params.set("action", action);
  if (page > 1) params.set("page", String(page));
  const q = params.toString();
  return q ? `/audit?${q}` : "/audit";
}

export default function AuditList({
  rows,
  page,
  totalPages,
  total,
  currentEntity,
  currentAction,
  typeCounts,
  actionCounts,
}: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs font-mono border border-zinc-800 p-2">
        <span className="text-zinc-500">entity:</span>
        <a
          href={buildHref(null, currentAction, 1)}
          className={`px-1.5 py-0.5 ${currentEntity === null ? "bg-zinc-100 text-black" : "bg-zinc-800 hover:bg-zinc-700"}`}
        >
          all ({total})
        </a>
        {Object.entries(typeCounts).map(([t, n]) => (
          <a
            key={t}
            href={buildHref(t, currentAction, 1)}
            className={`px-1.5 py-0.5 ${currentEntity === t ? "bg-zinc-100 text-black" : "bg-zinc-800 hover:bg-zinc-700"}`}
          >
            {t} ({n})
          </a>
        ))}
        <span className="ml-4 text-zinc-500">action:</span>
        <a
          href={buildHref(currentEntity, null, 1)}
          className={`px-1.5 py-0.5 ${currentAction === null ? "bg-zinc-100 text-black" : "bg-zinc-800 hover:bg-zinc-700"}`}
        >
          all
        </a>
        {Object.entries(actionCounts).map(([a, n]) => (
          <a
            key={a}
            href={buildHref(currentEntity, a, 1)}
            className={`px-1.5 py-0.5 ${currentAction === a ? "bg-zinc-100 text-black" : "bg-zinc-800 hover:bg-zinc-700"}`}
          >
            {a} ({n})
          </a>
        ))}
      </div>

      <ul className="border border-zinc-800 divide-y divide-zinc-800">
        {rows.map((r) => (
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
            {page > 1 && (
              <a
                href={buildHref(currentEntity, currentAction, page - 1)}
                className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700"
              >
                ← prev
              </a>
            )}
            {page < totalPages && (
              <a
                href={buildHref(currentEntity, currentAction, page + 1)}
                className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700"
              >
                next →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
