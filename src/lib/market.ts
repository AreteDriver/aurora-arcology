/**
 * market.ts — server-side reader for the baked market snapshot.
 *
 * Reads data/market/snapshot.json at build/request time. Returns an
 * empty snapshot if the file is missing rather than throwing — keeps
 * the /market route renderable in the cold-start case (e.g. a fresh
 * clone before the loader has run).
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface PriceRow {
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

export interface MPIRow {
  date: string;
  mpi: number;
  mpi_low_end: number;
  mpi_high_end: number;
}

export interface ConflictRow {
  region: string;
  isk_destroyed_last3mo_t: number;
  ships_destroyed_last3mo: number;
  top_ship_groups_by_isk_alltime: string;
}

export interface MarketSnapshot {
  generated_at: string;
  snapshot_date: string;
  prices: PriceRow[];
  mpi: MPIRow[];
  conflict: ConflictRow[];
  source: "live" | "committed-sample";
  data_dir: string | null;
}

const SNAPSHOT_PATH = join(process.cwd(), "data", "market", "snapshot.json");

const EMPTY: MarketSnapshot = {
  generated_at: "",
  snapshot_date: "",
  prices: [],
  mpi: [],
  conflict: [],
  source: "committed-sample",
  data_dir: null,
};

export function loadSnapshot(): MarketSnapshot {
  if (!existsSync(SNAPSHOT_PATH)) return EMPTY;
  try {
    return JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8")) as MarketSnapshot;
  } catch {
    return EMPTY;
  }
}

export function groupByCategory(prices: PriceRow[]): Record<string, PriceRow[]> {
  return prices.reduce<Record<string, PriceRow[]>>((acc, p) => {
    acc[p.category] = acc[p.category] ?? [];
    acc[p.category].push(p);
    return acc;
  }, {});
}

export function topConflictRegions(rows: ConflictRow[], n = 8): ConflictRow[] {
  return [...rows]
    .sort((a, b) => b.isk_destroyed_last3mo_t - a.isk_destroyed_last3mo_t)
    .slice(0, n);
}

export function mpiDelta(rows: MPIRow[]): {
  current: number;
  previous: number;
  pct_change: number;
} | null {
  if (rows.length < 2) return null;
  const current = rows[rows.length - 1].mpi;
  const previous = rows[rows.length - 2].mpi;
  return {
    current,
    previous,
    pct_change: previous === 0 ? 0 : ((current - previous) / previous) * 100,
  };
}

export function mpiPeriodChange(rows: MPIRow[], days: number): number | null {
  if (rows.length < days + 1) return null;
  const cur = rows[rows.length - 1].mpi;
  const past = rows[rows.length - 1 - days].mpi;
  return past === 0 ? 0 : ((cur - past) / past) * 100;
}

export function formatIsk(value: number): string {
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(2);
}

export function formatPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}
