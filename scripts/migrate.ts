// Apply Drizzle migrations + run schema bootstrap.
// Usage: pnpm db:migrate
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import fs from "node:fs";

const DB_PATH = path.resolve("data/aurora.db");
const MIGRATIONS_DIR = path.resolve("db/migrations");

// Ensure data/ exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const db = drizzle(sqlite);

if (!fs.existsSync(MIGRATIONS_DIR) || fs.readdirSync(MIGRATIONS_DIR).length === 0) {
  console.error("No migrations found. Run `pnpm db:generate` first to emit Drizzle migrations.");
  process.exit(1);
}

migrate(db, { migrationsFolder: MIGRATIONS_DIR });
console.log(`Migrated ${DB_PATH}`);

// ---------------------------------------------------------------------------
// FTS5 virtual table + triggers — Drizzle's schema can't express virtual
// tables, so we manage them imperatively. Idempotent: CREATE IF NOT EXISTS.
// Pattern lifted from Dossier/dossier/db/database.py.
// ---------------------------------------------------------------------------
sqlite.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS sources_fts USING fts5(
    id UNINDEXED,
    title,
    publisher,
    excerpt,
    content='sources',
    content_rowid='rowid',
    tokenize='porter unicode61'
  );

  CREATE TRIGGER IF NOT EXISTS sources_ai AFTER INSERT ON sources BEGIN
    INSERT INTO sources_fts(rowid, id, title, publisher, excerpt)
    VALUES (new.rowid, new.id, new.title, new.publisher, COALESCE(new.excerpt, ''));
  END;

  CREATE TRIGGER IF NOT EXISTS sources_ad AFTER DELETE ON sources BEGIN
    INSERT INTO sources_fts(sources_fts, rowid, id, title, publisher, excerpt)
    VALUES ('delete', old.rowid, old.id, old.title, old.publisher, COALESCE(old.excerpt, ''));
  END;

  CREATE TRIGGER IF NOT EXISTS sources_au AFTER UPDATE ON sources BEGIN
    INSERT INTO sources_fts(sources_fts, rowid, id, title, publisher, excerpt)
    VALUES ('delete', old.rowid, old.id, old.title, old.publisher, COALESCE(old.excerpt, ''));
    INSERT INTO sources_fts(rowid, id, title, publisher, excerpt)
    VALUES (new.rowid, new.id, new.title, new.publisher, COALESCE(new.excerpt, ''));
  END;
`);

// Backfill if the FTS index is empty (first run after migration)
const ftsCount = (sqlite.prepare("SELECT COUNT(*) AS n FROM sources_fts").get() as { n: number }).n;
const srcCount = (sqlite.prepare("SELECT COUNT(*) AS n FROM sources").get() as { n: number }).n;
if (srcCount > 0 && ftsCount === 0) {
  sqlite.exec(`
    INSERT INTO sources_fts(rowid, id, title, publisher, excerpt)
    SELECT rowid, id, title, publisher, COALESCE(excerpt, '') FROM sources;
  `);
  console.log(`Backfilled sources_fts with ${srcCount} rows`);
} else {
  console.log(`FTS5: ${ftsCount} indexed / ${srcCount} sources`);
}

sqlite.close();
