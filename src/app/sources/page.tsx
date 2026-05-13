"use client";

import { useEffect, useMemo, useState } from "react";

interface ManifestRow {
  id: string;
  title: string;
  publisher: string;
  date: string | null;
  url: string | null;
  type: string;
  excerpt?: string;
}

// Render a short excerpt with the matched query tokens highlighted, windowed
// around the first hit so a long excerpt shows the relevant bit.
function ExcerptSnippet({ text, tokens }: { text: string; tokens: string[] }) {
  const lower = text.toLowerCase();
  let firstHit = -1;
  for (const t of tokens) {
    const i = lower.indexOf(t);
    if (i !== -1 && (firstHit === -1 || i < firstHit)) firstHit = i;
  }
  let shown = text;
  if (firstHit > 90) {
    shown = "…" + text.slice(Math.max(0, firstHit - 60));
  }
  // highlight pass
  const parts: (string | { hl: string })[] = [shown];
  for (const t of tokens) {
    if (!t) continue;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (typeof p !== "string") continue;
      const idx = p.toLowerCase().indexOf(t);
      if (idx === -1) continue;
      parts.splice(i, 1, p.slice(0, idx), { hl: p.slice(idx, idx + t.length) }, p.slice(idx + t.length));
    }
  }
  return (
    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
      {parts.map((p, i) =>
        typeof p === "string" ? (
          <span key={i}>{p}</span>
        ) : (
          <mark key={i} className="bg-amber-500/30 text-amber-200 rounded-sm px-0.5">
            {p.hl}
          </mark>
        ),
      )}
    </p>
  );
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

  const tokens = useMemo(
    () => q.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [q],
  );

  const results = useMemo(() => {
    if (!manifest) return [];
    if (q.trim().length < 2) return [];
    const hits: { row: ManifestRow; score: number }[] = [];
    for (const row of manifest) {
      const title = row.title.toLowerCase();
      const meta = `${row.publisher} ${row.id} ${row.type}`.toLowerCase();
      const excerpt = (row.excerpt ?? "").toLowerCase();
      let score = 0;
      let matchAll = true;
      for (const t of tokens) {
        const inTitle = title.indexOf(t);
        const inMeta = meta.indexOf(t);
        const inExcerpt = excerpt.indexOf(t);
        if (inTitle === -1 && inMeta === -1 && inExcerpt === -1) {
          matchAll = false;
          break;
        }
        // weight: title > meta > excerpt; earlier-in-field scores a touch higher
        if (inTitle !== -1) score += 150 + Math.max(0, 60 - inTitle);
        else if (inMeta !== -1) score += 60 + Math.max(0, 30 - inMeta);
        else score += 30 + Math.max(0, 20 - Math.floor(inExcerpt / 10));
      }
      if (matchAll) hits.push({ row, score });
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, 50);
  }, [manifest, q, tokens]);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">Sources</h1>
      <p className="text-sm text-zinc-400 mb-4">
        Full-text search across the source corpus — title, publisher, and a short
        excerpt of each source are indexed client-side, so you can find a source by
        what it&apos;s about, not just its headline. Full article bodies aren&apos;t
        stored — click through to the canonical URL for the complete text.
      </p>

      <input
        type="search"
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="search… (try: Tanu, Silphy, Drifter, Kahah, &ldquo;Triglavian invasion&rdquo;)"
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
            {r.excerpt && <ExcerptSnippet text={r.excerpt} tokens={tokens} />}
            <div className="text-xs font-mono text-zinc-600 mt-1">{r.id}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
