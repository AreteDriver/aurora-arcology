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
sqlite.close();
