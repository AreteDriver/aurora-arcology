/**
 * ConflictTable — top regions by ISK destroyed (last 3 months).
 *
 * Reads from the zKill snapshot. The top-ship-groups string is parsed
 * back into a short list so a reader can see the doctrine mix per
 * region without staring at semicolons.
 */

import { formatIsk, type ConflictRow } from "@/lib/market";

interface Props {
  rows: ConflictRow[];
}

function topShipShort(s: string, n = 3): string {
  return s
    .split(";")
    .slice(0, n)
    .map((p) => p.trim().split("=")[0])
    .filter(Boolean)
    .join(" · ");
}

export function ConflictTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="text-xs text-zinc-500 font-mono">
        no conflict data — run <code className="text-zinc-300">pnpm market:load</code>
      </div>
    );
  }

  const maxIsk = Math.max(...rows.map((r) => r.isk_destroyed_last3mo_t));

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-800/90 bg-zinc-950/70">
      <header className="border-b border-zinc-800/90 bg-zinc-900/60 px-3 py-2">
        <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-200">
          conflict hot regions <span className="text-zinc-500">(last 3 mo, ISK destroyed)</span>
        </h3>
      </header>
      <table className="w-full text-xs">
        <thead className="text-zinc-500 font-mono">
          <tr className="border-b border-zinc-800">
            <th className="px-3 py-1.5 text-left font-normal">region</th>
            <th className="px-3 py-1.5 text-right font-normal">ISK</th>
            <th className="px-3 py-1.5 text-right font-normal">ships</th>
            <th className="px-3 py-1.5 text-left font-normal hidden md:table-cell">
              top doctrines
            </th>
            <th className="px-3 py-1.5 text-left font-normal w-32">load</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {rows.map((r) => {
            const pct = maxIsk === 0 ? 0 : (r.isk_destroyed_last3mo_t / maxIsk) * 100;
            return (
              <tr
                key={r.region}
                className="border-b border-zinc-900/80 hover:bg-rose-950/20"
              >
                <td className="px-3 py-1.5 text-zinc-200">{r.region}</td>
                <td className="px-3 py-1.5 text-right text-zinc-200">
                  {r.isk_destroyed_last3mo_t.toFixed(1)}T
                </td>
                <td className="px-3 py-1.5 text-right text-zinc-400">
                  {formatIsk(r.ships_destroyed_last3mo)}
                </td>
                <td className="px-3 py-1.5 text-zinc-500 hidden md:table-cell">
                  {topShipShort(r.top_ship_groups_by_isk_alltime)}
                </td>
                <td className="px-3 py-1.5">
                  <div className="relative h-1.5 w-24 overflow-hidden rounded-full bg-zinc-900">
                    <div
                      className="h-1.5 rounded-full bg-gradient-to-r from-amber-500/60 to-rose-500/70"
                      style={{ width: `${pct.toFixed(1)}%` }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
