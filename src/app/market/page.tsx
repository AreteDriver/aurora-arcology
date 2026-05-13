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
  const hottest = topRegions[0] ?? null;
  const wideSpreads = snap.prices.filter((p) => p.jita_spread_pct > 20).length;
  const totalBuyVol = snap.prices.reduce((sum, p) => sum + p.jita_buy_vol, 0);
  const totalSellVol = snap.prices.reduce((sum, p) => sum + p.jita_sell_vol, 0);

  const orderedCategories = [
    ...CATEGORY_ORDER.filter((c) => byCat[c]?.length),
    ...Object.keys(byCat).filter((c) => !CATEGORY_ORDER.includes(c)),
  ];

  const hasData = snap.prices.length > 0 || snap.mpi.length > 0;

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-10">
      <header className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-gradient-to-br from-zinc-950 via-zinc-950 to-sky-950/20 p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-44 w-44 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-900/60 bg-sky-900/20 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-sky-300">
                New Eden Macro Pulse
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
                Market Brief
              </h1>
              <p className="max-w-3xl text-sm leading-relaxed text-zinc-300 sm:text-[15px]">
                Daily Mineral Price Index trend, Jita IV-4 watchlist spreads,
                and conflict-driven destruction pressure in one glance-first
                surface for market ritual review.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800/90 bg-zinc-950/70 px-4 py-3 text-[11px] font-mono uppercase tracking-wide text-zinc-400">
              <div>
                snapshot:{" "}
                <span className="text-zinc-200">{snap.snapshot_date || "(none)"}</span>
              </div>
              <div className="mt-1">
                source:{" "}
                <span
                  className={
                    snap.source === "live" ? "text-emerald-400" : "text-amber-400"
                  }
                >
                  {snap.source}
                </span>
              </div>
              {snap.generated_at && (
                <div className="mt-1">
                  baked:{" "}
                  <span className="text-zinc-300">
                    {new Date(snap.generated_at)
                      .toISOString()
                      .slice(0, 16)
                      .replace("T", " ")}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3">
              <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                MPI d/d
              </div>
              <div
                className={`mt-1 text-xl font-semibold ${
                  !delta
                    ? "text-zinc-400"
                    : delta.pct_change >= 0
                      ? "text-emerald-400"
                      : "text-rose-400"
                }`}
              >
                {delta ? formatPct(delta.pct_change) : "—"}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3">
              <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                7d / 30d
              </div>
              <div className="mt-1 flex items-baseline gap-3">
                <span
                  className={`text-lg font-semibold ${
                    weekChange === null
                      ? "text-zinc-400"
                      : weekChange >= 0
                        ? "text-emerald-400"
                        : "text-rose-400"
                  }`}
                >
                  {weekChange === null ? "—" : formatPct(weekChange)}
                </span>
                <span
                  className={`text-sm font-medium ${
                    monthChange === null
                      ? "text-zinc-500"
                      : monthChange >= 0
                        ? "text-emerald-300"
                        : "text-rose-300"
                  }`}
                >
                  {monthChange === null ? "—" : formatPct(monthChange)}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3">
              <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                Watchlist pressure
              </div>
              <div className="mt-1 text-lg font-semibold text-zinc-100">
                {wideSpreads} wide spreads
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {snap.prices.length} tracked items
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3">
              <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                Conflict leader
              </div>
              <div className="mt-1 truncate text-lg font-semibold text-zinc-100">
                {hottest ? hottest.region : "—"}
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {hottest ? `${hottest.isk_destroyed_last3mo_t.toFixed(1)}T destroyed` : "no conflict snapshot"}
              </div>
            </div>
          </div>
        </div>
      </header>

      {!hasData && (
        <div className="rounded-xl border border-amber-900/70 bg-amber-950/20 p-4 text-xs font-mono text-zinc-300">
          No market data has been baked into this build yet. From a checkout
          where the cron pipeline runs:
          <pre className="mt-2 rounded border border-zinc-800 bg-zinc-950/80 p-3 text-zinc-400">
            {"pnpm market:load\npnpm dev    # or pnpm build"}
          </pre>
          Optional override:{" "}
          <code className="text-zinc-100">MARKET_DATA_DIR=/path</code> if your
          data lives outside the default{" "}
          <code className="text-zinc-100">~/projects/notes/data/raw/eve</code>.
        </div>
      )}

      {snap.mpi.length > 0 && (
        <section className="space-y-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/70 p-4 sm:p-5">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">Mineral Price Index</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Anchor day normalized to 1.0 · combined + low-end + high-end tracks
              </p>
            </div>
            <div className="font-mono text-xs flex gap-4 text-zinc-400">
              {delta && (
                <span>
                  d/d:{" "}
                  <span
                    className={
                      delta.pct_change >= 0 ? "text-emerald-400" : "text-rose-400"
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
                      weekChange >= 0 ? "text-emerald-400" : "text-rose-400"
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
                      monthChange >= 0 ? "text-emerald-400" : "text-rose-400"
                    }
                  >
                    {formatPct(monthChange)}
                  </span>
                </span>
              )}
              <span className="text-zinc-600">{snap.mpi.length} days</span>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800/90 bg-zinc-950/90 p-4">
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
        <section className="space-y-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/70 p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-100">Conflict Hotspots</h2>
            <div className="text-xs font-mono text-zinc-500">
              top {topRegions.length} regions by trailing 3-mo destruction
            </div>
          </div>
          <ConflictTable rows={topRegions} />
          <p className="text-xs text-zinc-500">
            zKillboard regional rollup. Sorted by ISK destroyed in the trailing
            3 months. Top doctrines column is the alltime ship-group ranking
            (zKill doesn&apos;t publish 3-month doctrine breakdowns).
          </p>
        </section>
      )}

      {snap.prices.length > 0 && (
        <section className="space-y-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/70 p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-100">Jita IV-4 Snapshot</h2>
            <div className="text-xs font-mono text-zinc-500">
              buy vol:{" "}
              <span className="text-zinc-300">
                {(totalBuyVol / 1e12).toFixed(2)}T
              </span>{" "}
              · sell vol:{" "}
              <span className="text-zinc-300">
                {(totalSellVol / 1e12).toFixed(2)}T
              </span>
            </div>
          </div>
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

      <footer className="rounded-xl border border-zinc-900 bg-zinc-950/60 px-4 py-3 text-xs text-zinc-600 space-y-1">
        <div>
          Pipeline:{" "}
          <code className="text-zinc-400">
            ~/projects/notes/scripts/eve-market-*.py
          </code>{" "}
          (cron, headless). Data: ESI · Fuzzwork · zKillboard · MER.
        </div>
        <div>
          Dashboard is a thin shell over a JSON snapshot. Refresh via{" "}
          <code className="text-zinc-400">bash scripts/refresh-market.sh</code>{" "}
          (loader + commit + push when changed). Configure source dir with{" "}
          <code className="text-zinc-400">MARKET_DATA_DIR=/path</code> if not at
          the convenience default.
        </div>
      </footer>
    </div>
  );
}
