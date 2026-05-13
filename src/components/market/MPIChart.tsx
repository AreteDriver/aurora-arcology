/**
 * MPIChart — SVG line chart of the daily Mineral Price Index.
 *
 * Server-rendered. Pure SVG (no d3 runtime, no client JS) because the
 * data is bounded (~90 daily points) and a static SVG renders fine
 * inside a server component. Hover behavior is intentionally minimal
 * — this is a glance-and-go signal display, not an exploratory chart.
 */

import type { MPIRow } from "@/lib/market";

interface Props {
  rows: MPIRow[];
  width?: number;
  height?: number;
}

export function MPIChart({ rows, width = 720, height = 240 }: Props) {
  if (rows.length === 0) {
    return (
      <div className="text-xs text-zinc-500 font-mono">
        no MPI data — run <code className="text-zinc-300">pnpm market:load</code>
      </div>
    );
  }

  const pad = { top: 16, right: 16, bottom: 28, left: 40 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  const xs = rows.map((_, i) => i);
  const ys = rows.flatMap((r) => [r.mpi, r.mpi_low_end, r.mpi_high_end]);
  const yMin = Math.min(...ys) * 0.98;
  const yMax = Math.max(...ys) * 1.02;

  const xScale = (i: number) => (xs.length > 1 ? (i / (xs.length - 1)) * w : 0);
  const yScale = (v: number) => h - ((v - yMin) / (yMax - yMin)) * h;

  const path = (key: "mpi" | "mpi_low_end" | "mpi_high_end") =>
    rows
      .map((r, i) => `${i === 0 ? "M" : "L"}${xScale(i).toFixed(1)},${yScale(r[key]).toFixed(1)}`)
      .join(" ");

  // Y-axis tick values
  const yTicks = [yMin, (yMin + yMax) / 2, yMax].map((v) => ({
    value: v,
    y: yScale(v),
  }));

  // X-axis tick labels: first, middle, last
  const xTicks =
    rows.length >= 2
      ? [
          { label: rows[0].date, x: xScale(0) },
          { label: rows[Math.floor(rows.length / 2)].date, x: xScale(Math.floor(rows.length / 2)) },
          { label: rows[rows.length - 1].date, x: xScale(rows.length - 1) },
        ]
      : [];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      role="img"
      aria-label="Mineral Price Index over time"
    >
      <g transform={`translate(${pad.left},${pad.top})`}>
        {/* Y gridlines */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={0}
              x2={w}
              y1={t.y}
              y2={t.y}
              stroke="rgb(39 39 42)"
              strokeWidth={1}
              strokeDasharray="2,2"
            />
            <text
              x={-6}
              y={t.y + 3}
              textAnchor="end"
              className="fill-zinc-500 font-mono"
              fontSize="9"
            >
              {t.value.toFixed(2)}
            </text>
          </g>
        ))}

        {/* Low-end / high-end bands */}
        <path d={path("mpi_low_end")} stroke="rgb(63 63 70)" strokeWidth={1} fill="none" />
        <path d={path("mpi_high_end")} stroke="rgb(63 63 70)" strokeWidth={1} fill="none" />

        {/* Main MPI line */}
        <path d={path("mpi")} stroke="rgb(244 244 245)" strokeWidth={1.5} fill="none" />

        {/* X-axis labels */}
        {xTicks.map((t, i) => (
          <text
            key={i}
            x={t.x}
            y={h + 18}
            textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
            className="fill-zinc-500 font-mono"
            fontSize="9"
          >
            {t.label}
          </text>
        ))}
      </g>
    </svg>
  );
}
