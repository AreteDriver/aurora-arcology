/**
 * PriceTable — sortable price snapshot per category, Jita IV-4 prices.
 *
 * Server-rendered table; no client JS. Each category section is its
 * own table so a reader can compare like-with-like (minerals vs ice
 * vs ammo vs ships).
 */

import { formatIsk, formatPct, type PriceRow } from "@/lib/market";

interface Props {
  category: string;
  rows: PriceRow[];
}

export function PriceTable({ category, rows }: Props) {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => b.jita_sell_min - a.jita_sell_min);

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-800/90 bg-zinc-950/70">
      <header className="flex items-center justify-between gap-2 border-b border-zinc-800/90 bg-zinc-900/60 px-3 py-2">
        <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-200">
          {category.replace(/_/g, " ")}{" "}
          <span className="text-zinc-500">({sorted.length})</span>
        </h3>
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
          jita iv-4
        </span>
      </header>
      <table className="w-full text-xs">
        <thead className="text-zinc-500 font-mono">
          <tr className="border-b border-zinc-800">
            <th className="px-3 py-1.5 text-left font-normal">type</th>
            <th className="px-3 py-1.5 text-right font-normal">buy</th>
            <th className="px-3 py-1.5 text-right font-normal">sell</th>
            <th className="px-3 py-1.5 text-right font-normal">spread</th>
            <th className="px-3 py-1.5 text-right font-normal hidden md:table-cell">
              buy vol
            </th>
            <th className="px-3 py-1.5 text-right font-normal hidden md:table-cell">
              sell vol
            </th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {sorted.map((r) => (
            <tr
              key={r.type_id}
              className="border-b border-zinc-900/80 hover:bg-sky-950/30"
            >
              <td className="px-3 py-1.5 text-zinc-200 max-w-[210px] truncate">
                {r.type_name}
              </td>
              <td className="px-3 py-1.5 text-right text-zinc-400">
                {formatIsk(r.jita_buy_max)}
              </td>
              <td className="px-3 py-1.5 text-right text-zinc-200">
                {formatIsk(r.jita_sell_min)}
              </td>
              <td
                className={`px-3 py-1.5 text-right ${
                  r.jita_spread_pct > 20
                    ? "text-amber-400"
                    : r.jita_spread_pct < 1
                      ? "text-zinc-600"
                      : "text-zinc-400"
                }`}
              >
                {formatPct(r.jita_spread_pct)}
              </td>
              <td className="px-3 py-1.5 text-right text-zinc-500 hidden md:table-cell">
                {formatIsk(r.jita_buy_vol)}
              </td>
              <td className="px-3 py-1.5 text-right text-zinc-500 hidden md:table-cell">
                {formatIsk(r.jita_sell_vol)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
