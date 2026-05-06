"use client";

import { useEffect, useMemo, useState } from "react";

interface ManifestRow {
  id: string;
  title: string;
  publisher: string;
  date: string | null;
  url: string | null;
  type: string;
}

export default function SourcesPage() {
  const [manifest, setManifest] = useState<ManifestRow[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/sources-manifest.json")
      .then((r) => r.json())
      .then(setManifest)
      .catch(() => setManifest([]));
  }, []);

  const results = useMemo(() => {
    if (!manifest) return [];
    if (q.trim().length < 2) return [];
    const needle = q.trim().toLowerCase();
    const tokens = needle.split(/\s+/);
    const hits: { row: ManifestRow; score: number }[] = [];
    for (const row of manifest) {
      const hay = `${row.title} ${row.publisher} ${row.id}`.toLowerCase();
      let score = 0;
      let matchAll = true;
      for (const t of tokens) {
        const i = hay.indexOf(t);
        if (i === -1) {
          matchAll = false;
          break;
        }
        // earlier match in title scores higher
        score += Math.max(0, 100 - i) + (row.title.toLowerCase().includes(t) ? 50 : 0);
      }
      if (matchAll) hits.push({ row, score });
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, 50);
  }, [manifest, q]);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">Sources</h1>
      <p className="text-sm text-zinc-400 mb-4">
        Full-text search across the source corpus. Title + publisher are indexed
        client-side. Article bodies are not stored — click through to the canonical
        URL for the full text.
      </p>

      <input
        type="search"
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="search… (try: Tanu, Silphy, Drifter, Kahah)"
        className="w-full bg-zinc-900 border border-zinc-700 px-3 py-2 font-mono text-sm focus:outline-none focus:border-zinc-500"
        disabled={!manifest}
      />

      <div className="text-xs text-zinc-500 font-mono mt-2 mb-4">
        {!manifest && "loading manifest…"}
        {manifest && q.trim().length < 2 && (
          <span>{manifest.length.toLocaleString()} sources indexed</span>
        )}
        {manifest && q.trim().length >= 2 && (
          <span>
            {results.length} match{results.length === 1 ? "" : "es"}
            {results.length === 50 && " (showing first 50)"}
          </span>
        )}
      </div>

      <ul className="space-y-2">
        {results.map(({ row: r }) => (
          <li key={r.id} className="border border-zinc-800 p-3 hover:border-zinc-600">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xs font-mono text-zinc-500">{r.date ?? "—"}</span>
              <span className="text-xs font-mono text-zinc-600">{r.type}</span>
              <span className="text-xs font-mono text-zinc-600 ml-auto">{r.publisher}</span>
            </div>
            <div className="text-sm">
              {r.url ? (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-400"
                >
                  {r.title} ↗
                </a>
              ) : (
                r.title
              )}
            </div>
            <div className="text-xs font-mono text-zinc-600 mt-1">{r.id}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
