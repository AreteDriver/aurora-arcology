/**
 * load-market-data.ts — pull a fresh market snapshot into data/market/snapshot.json.
 *
 * Reads CSVs from the EVE market-intel cron pipeline at the path given by
 * the MARKET_DATA_DIR environment variable, transforms them into a single
 * JSON artifact the /market page reads at build time.
 *
 * Resolution order for the data dir:
 *   1. $MARKET_DATA_DIR if set
 *   2. Vercel build env — skip (no source dir; preserve the committed snapshot)
 *   3. Local convenience fallback — ~/projects/notes/data/raw/eve IF it exists
 *      (this is the cron output path on ARETE's laptop; opportunistic, not
 *      load-bearing)
 *   4. No source — leave the committed snapshot.json in place and exit
 *
 * Usage:
 *   MARKET_DATA_DIR=/path/to/eve pnpm market:load
 *   pnpm market:load                   # convenience: tries ~/projects/notes/data/raw/eve
 *
 * Refresh ritual:
 *   bash scripts/refresh-market.sh     # one-shot loader + commit + push when changed
 */

import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_PATH = join(ROOT, "data", "market", "snapshot.json");

const LOCAL_CONVENIENCE_PATH = join(homedir(), "projects", "notes", "data", "raw", "eve");

function resolveSourceDir(): string | null {
  if (process.env.MARKET_DATA_DIR) {
    return process.env.MARKET_DATA_DIR;
  }
  // Skip the convenience fallback on Vercel / CI — those builds should
  // use the committed snapshot, not silently look at a path that won't
  // exist there.
  if (process.env.VERCEL || process.env.CI) {
    return null;
  }
  if (existsSync(LOCAL_CONVENIENCE_PATH)) {
    return LOCAL_CONVENIENCE_PATH;
  }
  return null;
}

const SOURCE_DIR = resolveSourceDir();

interface PriceRow {
  type_id: number;
  type_name: string;
  category: string;
  jita_buy_max: number;
  jita_sell_min: number;
  jita_spread_pct: number;
  jita_buy_vol: number;
  jita_sell_vol: number;
  esi_average: number | null;
}

interface MPIRow {
  date: string;
  mpi: number;
  mpi_low_end: number;
  mpi_high_end: number;
}

interface ConflictRow {
  region: string;
  isk_destroyed_last3mo_t: number;
  ships_destroyed_last3mo: number;
  top_ship_groups_by_isk_alltime: string;
}

interface MarketSnapshot {
  generated_at: string;
  snapshot_date: string;
  prices: PriceRow[];
  mpi: MPIRow[];
  conflict: ConflictRow[];
  source: "live" | "committed-sample";
  data_dir: string | null;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    // Field-aware CSV split: respect quoted fields (top_ship_groups contains ';')
    const fields: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === "," && !inQuotes) {
        fields.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
    fields.push(cur);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = fields[i] ?? "";
    });
    return row;
  });
}

function num(v: string | undefined): number {
  const n = Number(v ?? "");
  return Number.isFinite(n) ? n : 0;
}

function latestSnapshotFile(dir: string, prefix: string): string | null {
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".csv"))
    .sort();
  return files.length ? join(dir, files[files.length - 1]) : null;
}

function loadPrices(marketDir: string): PriceRow[] {
  const file = latestSnapshotFile(marketDir, "snapshot-");
  if (!file) return [];
  const rows = parseCSV(readFileSync(file, "utf8"));
  return rows.map((r) => ({
    type_id: num(r.type_id),
    type_name: r.type_name,
    category: r.category,
    jita_buy_max: num(r.jita_buy_max),
    jita_sell_min: num(r.jita_sell_min),
    jita_spread_pct: num(r.jita_spread_pct),
    jita_buy_vol: num(r.jita_buy_vol),
    jita_sell_vol: num(r.jita_sell_vol),
    esi_average: r.esi_average ? num(r.esi_average) : null,
  }));
}

function loadMPI(marketDir: string): MPIRow[] {
  const file = join(marketDir, "mpi-reconstructed.csv");
  if (!existsSync(file)) return [];
  const rows = parseCSV(readFileSync(file, "utf8"));
  return rows.map((r) => ({
    date: r.date,
    mpi: num(r.mpi),
    mpi_low_end: num(r.mpi_low_end),
    mpi_high_end: num(r.mpi_high_end),
  }));
}

function loadConflict(conflictDir: string): ConflictRow[] {
  const file = latestSnapshotFile(conflictDir, "zkill-regions-");
  if (!file) return [];
  const rows = parseCSV(readFileSync(file, "utf8"));
  return rows.map((r) => ({
    region: r.region,
    isk_destroyed_last3mo_t: num(r.isk_destroyed_last3mo_t),
    ships_destroyed_last3mo: num(r.ships_destroyed_last3mo),
    top_ship_groups_by_isk_alltime: r.top_ship_groups_by_isk_alltime,
  }));
}

function build(): MarketSnapshot | null {
  if (SOURCE_DIR === null) {
    return null; // signal to caller: preserve committed snapshot, exit clean
  }
  const marketDir = join(SOURCE_DIR, "market");
  const conflictDir = join(SOURCE_DIR, "conflict");
  const haveLive = existsSync(marketDir);

  if (!haveLive) {
    return null;
  }

  const prices = loadPrices(marketDir);
  const mpi = loadMPI(marketDir);
  const conflict = loadConflict(conflictDir);

  const snapshotDate =
    prices[0]?.type_id !== undefined
      ? (parseCSV(readFileSync(latestSnapshotFile(marketDir, "snapshot-")!, "utf8"))[0]
          ?.snapshot_date ?? "")
      : "";

  return {
    generated_at: new Date().toISOString(),
    snapshot_date: snapshotDate || new Date().toISOString().slice(0, 10),
    prices,
    mpi,
    conflict,
    source: "live",
    data_dir: SOURCE_DIR,
  };
}

const snapshot = build();
if (snapshot === null) {
  const reason = SOURCE_DIR
    ? `source dir ${SOURCE_DIR} exists but has no market/ subdir`
    : process.env.VERCEL || process.env.CI
      ? "build env (Vercel/CI) — using committed snapshot"
      : `no MARKET_DATA_DIR set and ${LOCAL_CONVENIENCE_PATH} not found`;
  console.log(`[market:load] preserving committed snapshot — ${reason}`);
  console.log(`[market:load] (set MARKET_DATA_DIR to refresh against live cron output)`);
  process.exit(0);
}
writeFileSync(OUT_PATH, JSON.stringify(snapshot, null, 2) + "\n");
console.log(
  `[market:load] live: ${snapshot.prices.length} prices, ` +
    `${snapshot.mpi.length} mpi rows, ${snapshot.conflict.length} regions ` +
    `from ${SOURCE_DIR} → ${OUT_PATH}`,
);
