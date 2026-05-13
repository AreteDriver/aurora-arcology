#!/usr/bin/env tsx
/**
 * Pre-compute the search manifest used by /sources at runtime in the static
 * export. Reads the source corpus (warpath board + news archive) and emits a
 * compact JSON file the client can fuzzy-match in-memory.
 *
 * Title + publisher + date + url + type + a truncated excerpt (≤240 chars).
 * Full bodies are still not stored (IP discipline — click through for the
 * canonical text); the excerpt is what lets search find a source by *what
 * it's about*, not just its headline. ~1.5 MB at the current corpus size
 * (~4.7K sources). Larger corpora can swap to a flexsearch / lunr index when
 * the naive substring scan stops being interactive.
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DB_PATH = path.resolve("data/aurora.db");
const OUT_PATH = path.resolve("public/sources-manifest.json");

if (!fs.existsSync(DB_PATH)) {
  console.error(`No DB at ${DB_PATH}. Run pnpm db:reset && pnpm news:load first.`);
  process.exit(1);
}

const db = new Database(DB_PATH, { readonly: true });

interface ManifestRow {
  id: string;
  title: string;
  publisher: string;
  date: string | null;
  url: string | null;
  type: string;
  excerpt?: string;
}

const EXCERPT_MAX = 240;

const raw = db
  .prepare<[], ManifestRow & { excerpt: string | null }>(
    "SELECT id, title, publisher, date, url, type, excerpt FROM sources ORDER BY date DESC, id",
  )
  .all();

const rows: ManifestRow[] = raw.map((r) => {
  const ex = (r.excerpt ?? "").replace(/\s+/g, " ").trim();
  const row: ManifestRow = {
    id: r.id,
    title: r.title,
    publisher: r.publisher,
    date: r.date,
    url: r.url,
    type: r.type,
  };
  if (ex) row.excerpt = ex.length > EXCERPT_MAX ? ex.slice(0, EXCERPT_MAX - 1).trimEnd() + "…" : ex;
  return row;
});

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(rows));

const sizeKb = (fs.statSync(OUT_PATH).size / 1024).toFixed(1);
console.log(`manifest → ${path.relative(process.cwd(), OUT_PATH)}  (${rows.length} rows, ${sizeKb} kB)`);

db.close();
