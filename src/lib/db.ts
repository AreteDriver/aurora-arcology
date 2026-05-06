import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@db/schema";
import fs from "node:fs";
import path from "node:path";

/**
 * DB resolution strategy:
 *   1. DATABASE_URL env var — explicit override (CI / curator config)
 *   2. data/aurora.db relative to cwd — local dev (next dev) and the
 *      build-time scripts (migrate, seed, ner:extract)
 *   3. Embedded blob → /tmp/aurora.db — Vercel serverless functions where
 *      the source path doesn't exist at runtime
 */
function resolveDbPath(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const local = path.join(process.cwd(), "data/aurora.db");
  if (fs.existsSync(local)) return local;

  // Serverless fallback: decode embedded blob, write to /tmp once.
  const tmp = "/tmp/aurora.db";
  if (!fs.existsSync(tmp)) {
    // dynamic require so the blob module is only loaded when needed (the
    // file may not exist in pure-CLI contexts that import this module
    // before scripts/embed-db.ts has run).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DB_BLOB_BASE64 } = require("./db-blob") as { DB_BLOB_BASE64: string };
    fs.writeFileSync(tmp, Buffer.from(DB_BLOB_BASE64, "base64"));
  }
  return tmp;
}

const sqlite = new Database(resolveDbPath());
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { schema };
