import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@db/schema";
import fs from "node:fs";
import path from "node:path";
// Static import so Next.js / webpack bundle the blob into every server
// function. CLI/dev contexts use the placeholder (empty string); the
// resolver below only consults the blob if neither DATABASE_URL nor the
// on-disk file are available.
import { DB_BLOB_BASE64 } from "./db-blob";

/**
 * DB resolution strategy:
 *   1. DATABASE_URL env var — explicit override (CI / curator config)
 *   2. data/aurora.db relative to cwd — local dev (next dev) and the
 *      build-time scripts (migrate, seed, ner:extract)
 *   3. Embedded blob → /tmp/aurora.db — Vercel serverless functions where
 *      the source path doesn't exist at runtime
 */
export function resolveDbPath(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const local = path.join(process.cwd(), "data/aurora.db");
  if (fs.existsSync(local)) return local;

  const tmp = "/tmp/aurora.db";
  if (!fs.existsSync(tmp)) {
    if (!DB_BLOB_BASE64) {
      throw new Error(
        "Aurora DB unavailable: no DATABASE_URL, no data/aurora.db on disk, and no embedded blob. " +
          "Run `pnpm db:reset` locally or `pnpm vercel:build` for deployment.",
      );
    }
    fs.writeFileSync(tmp, Buffer.from(DB_BLOB_BASE64, "base64"));
  }
  return tmp;
}

const sqlite = new Database(resolveDbPath());
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { schema };
