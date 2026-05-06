#!/usr/bin/env tsx
/**
 * Pre-compute the search manifest used by /sources at runtime in the static
 * export. Reads the source corpus (warpath board + news archive) and emits a
 * compact JSON file the client can fuzzy-match in-memory.
 *
 * Title + publisher + date + url + type only — body / excerpt are not
 * included. Manifest stays under 1 MB at the current corpus size (~2.3K
 * sources). Larger corpora can swap to a flexsearch / lunr index when the
 * naive substring scan stops being interactive.
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
}

const rows = db
  .prepare<[], ManifestRow>(
    "SELECT id, title, publisher, date, url, type FROM sources ORDER BY date DESC, id",
  )
  .all();

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(rows));

const sizeKb = (fs.statSync(OUT_PATH).size / 1024).toFixed(1);
console.log(`manifest → ${path.relative(process.cwd(), OUT_PATH)}  (${rows.length} rows, ${sizeKb} kB)`);

db.close();
