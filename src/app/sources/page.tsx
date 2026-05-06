"use client";

import { useEffect, useState } from "react";
import LiveFeed from "@/components/LiveFeed";

interface SearchResult {
  id: string;
  title: string;
  publisher: string;
  url: string | null;
  date: string | null;
  type: string;
  rank: number;
}

export default function SourcesPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      setTotal(0);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/sources/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (data.error) {
          setError(data.error);
          setResults([]);
        } else {
          setResults(data.results);
          setTotal(data.total);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">Sources</h1>
      <p className="text-sm text-zinc-400 mb-4">
        Full-text search across the source corpus. Title + publisher + curator-authored
        excerpt are indexed. Article bodies are not stored.
      </p>

      <div className="mb-4">
        <LiveFeed />
      </div>

      <input
        type="search"
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="search… (try: Tanu, Silphy, Drifter, Kahah)"
        className="w-full bg-zinc-900 border border-zinc-700 px-3 py-2 font-mono text-sm focus:outline-none focus:border-zinc-500"
      />

      <div className="text-xs text-zinc-500 font-mono mt-2 mb-4">
        {loading && "searching…"}
        {!loading && q.trim().length >= 2 && (
          <span>
            {total} match{total === 1 ? "" : "es"}
            {total > results.length && ` (showing first ${results.length})`}
          </span>
        )}
        {error && <span className="text-red-400">{error}</span>}
      </div>

      <ul className="space-y-2">
        {results.map((r) => (
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
