/**
 * /market — EVE Online market analysis dashboard.
 *
 * Companion to the headless market-intel synthesis pipeline at
 * `~/projects/notes/scripts/eve-market-*.py`. The cron there writes
 * CSVs daily; `pnpm market:load` bakes the latest into a JSON
 * snapshot at `data/market/snapshot.json` which this route reads.
 *
 * The dashboard is intentionally a single-page summary, not an
 * exploratory tool — the analyst voice lives in the headless outlook
 * log; the page surfaces the signals the headline reader needs.
 */

import { MPIChart } from "@/components/market/MPIChart";
import { PriceTable } from "@/components/market/PriceTable";
import { ConflictTable } from "@/components/market/ConflictTable";
import {
  formatPct,
  groupByCategory,
  loadSnapshot,
  mpiDelta,
  mpiPeriodChange,
  topConflictRegions,
} from "@/lib/market";

export const metadata = {
  title: "Market — Aurora",
  description:
    "EVE Online economic analysis: Mineral Price Index trend, Jita IV-4 snapshots, conflict hotspots.",
};

const CATEGORY_ORDER = [
  "minerals",
  "ice_products",
  "fuel_blocks",
  "moon_raw",
  "currency",
  "ammo_charges",
  "ships_t1_sub",
  "ships_navy_pirate",
  "ships_t3c",
  "ships_caps",
];

export default function MarketPage() {
  const snap = loadSnapshot();
  const byCat = groupByCategory(snap.prices);
  const delta = mpiDelta(snap.mpi);
  const weekChange = mpiPeriodChange(snap.mpi, 7);
  const monthChange = mpiPeriodChange(snap.mpi, 30);
  const topRegions = topConflictRegions(snap.conflict, 12);

  const orderedCategories = [
    ...CATEGORY_ORDER.filter((c) => byCat[c]?.length),
    ...Object.keys(byCat).filter((c) => !CATEGORY_ORDER.includes(c)),
  ];

  const hasData = snap.prices.length > 0 || snap.mpi.length > 0;

  return (
    <div className="max-w-6xl space-y-8">
      <header className="space-y-2">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-bold">Market</h1>
          <div className="text-xs font-mono text-zinc-500">
            snapshot: {snap.snapshot_date || "(none)"} · source:{" "}
            <span
              className={
                snap.source === "live" ? "text-emerald-500" : "text-amber-500"
              }
            >
              {snap.source}
            </span>
            {snap.generated_at && (
              <>
                {" "}· baked: {new Date(snap.generated_at).toISOString().slice(0, 16).replace("T", " ")}
              </>
            )}
          </div>
        </div>
        <p className="text-sm text-zinc-400 max-w-3xl">
          EVE Online economic analysis. Daily Mineral Price Index reconstructed
          from per-region market history, Jita IV-4 buy/sell snapshot across the
          watchlist, and the last-3-month conflict-volume ranking. Synthesis
          notes live in the headless outlook log; this page is the
          glance-and-go signal display.
        </p>
      </header>

      {!hasData && (
        <div className="border border-zinc-800 p-4 text-xs font-mono text-zinc-400">
          No market data has been baked into the page yet. From a checkout where
          the cron pipeline runs:
          <pre className="mt-2 text-zinc-500">
            {"pnpm market:load\npnpm dev    # or pnpm build"}
          </pre>
          Optional override:{" "}
          <code className="text-zinc-300">MARKET_DATA_DIR=/path</code> if your
          data lives outside the default
          <code className="text-zinc-300"> ~/projects/notes/data/raw/eve</code>.
        </div>
      )}

      {snap.mpi.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <h2 className="text-lg font-bold">Mineral Price Index</h2>
            <div className="font-mono text-xs flex gap-4 text-zinc-400">
              {delta && (
                <span>
                  d/d:{" "}
                  <span
                    className={
                      delta.pct_change >= 0 ? "text-emerald-500" : "text-rose-500"
                    }
                  >
                    {formatPct(delta.pct_change)}
                  </span>
                </span>
              )}
              {weekChange !== null && (
                <span>
                  7d:{" "}
                  <span
                    className={
                      weekChange >= 0 ? "text-emerald-500" : "text-rose-500"
                    }
                  >
                    {formatPct(weekChange)}
                  </span>
                </span>
              )}
              {monthChange !== null && (
                <span>
                  30d:{" "}
                  <span
                    className={
                      monthChange >= 0 ? "text-emerald-500" : "text-rose-500"
                    }
                  >
                    {formatPct(monthChange)}
                  </span>
                </span>
              )}
              <span className="text-zinc-600">{snap.mpi.length} days</span>
            </div>
          </div>
          <div className="border border-zinc-800 p-4 bg-zinc-950">
            <MPIChart rows={snap.mpi} />
          </div>
          <p className="text-xs text-zinc-500">
            Index is reconstructed from per-region ESI market history across the 8
            primary minerals, split low-end / high-end like the official Monthly
            Economic Report. Anchor day = first observation = 1.0.
          </p>
        </section>
      )}

      {snap.conflict.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Conflict hotspots</h2>
          <ConflictTable rows={topRegions} />
          <p className="text-xs text-zinc-500">
            zKillboard regional rollup. Sorted by ISK destroyed in the trailing
            3 months. Top doctrines column is the alltime ship-group ranking
            (zKill doesn&apos;t publish 3-month doctrine breakdowns).
          </p>
        </section>
      )}

      {snap.prices.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Jita IV-4 snapshot</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {orderedCategories.map((cat) => (
              <PriceTable key={cat} category={cat} rows={byCat[cat]} />
            ))}
          </div>
          <p className="text-xs text-zinc-500">
            Best buy / best sell at Jita IV-4 station. Spread % flagged amber
            above 20% (wide-spread illiquidity signal). Volumes are aggregate
            station-side order ISK.
          </p>
        </section>
      )}

      <footer className="text-xs text-zinc-600 pt-6 border-t border-zinc-900">
        Pipeline:{" "}
        <code className="text-zinc-400">
          ~/projects/notes/scripts/eve-market-*.py
        </code>{" "}
        (cron, headless). Data: ESI · Fuzzwork · zKillboard · MER. Dashboard is
        a thin shell over a JSON snapshot — see{" "}
        <code className="text-zinc-400">scripts/load-market-data.ts</code>.
      </footer>
    </div>
  );
}
