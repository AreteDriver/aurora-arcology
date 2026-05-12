"use client";

/**
 * Subway-map / narrative-arcs view.
 *
 * Each lens is a horizontal "line" on the map. Nodes within a lens are
 * stations laid out chronologically (left → right by date). A node that
 * appears in multiple lenses is an interchange station — rendered larger
 * with a white outer ring and connected vertically by a dashed line
 * across the lens-track rows it appears in.
 *
 * Inspired by EVE's New Eden region map style and classic transit-system
 * cartography. Hand-designed metro maps still beat any automatic layout
 * for legibility, but this gets surprisingly close at the corpus's
 * current scale (~80 lensed nodes, 13 lines).
 */
import { useCallback, useMemo, useState } from "react";
import type { Node } from "@db/schema";
import { LENSES } from "@/data/lenses";
import { normalizeDate } from "@/lib/dates";
import { nodeTypeColor } from "@/lib/palette";
import { arcLineColor } from "@/lib/graph-palette";

// Narrative-coherent track ordering — group lenses by topical proximity so
// vertical interchanges stay short. Hand-curated, not algorithmic; a real
// metro-map needs human judgment about which lines should be adjacent.
const TRACK_ORDER = [
  "old-wars",                  // deep Mimitar/Amarr history
  "amarr-royal-succession",    // Amarr throne lineage (adjacent to Old Wars)
  "drifter-arc",               // Drifter/Hyperspace (Amarr/Concord research thread)
  "pirate-factions",           // Cross-empire criminal layer
  "caldari-mega-corp-axis",    // Caldari political backbone
  "lai-dai-vs-ishukone",       // The axis itself
  "empyrean-age",              // Heth-era political event (Caldari subset)
  "sarpati-network",           // Sister/Serpentis/Syndicate triangle
  "intaki-religious-arc",      // Lost Adama / Ida faith
  "kahah-yc120",               // YC120 chemical attacks (Khanid + Intaki)
  "exordium",                  // Modern Concord/AIR initiative
  "warpath-current",           // YC128 current cycle
  "deathless-arc",             // Modern antagonist thread
];

interface Props {
  boardId: string;
  nodes: Node[];
}

const HEADER_W = 240;
const STATION_R = 7;
const HUB_R = 10;
const TRACK_H = 56;
const TOP_PAD = 60;
const BOTTOM_PAD = 40;
const RIGHT_PAD = 80;

export default function ArcsView({ boardId, nodes }: Props) {
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const [hoverLensId, setHoverLensId] = useState<string | null>(null);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  // Time scale: collect all dates across lensed nodes
  const { tMin, tMax, undatedX, totalW } = useMemo(() => {
    const keys = nodes
      .map((n) => normalizeDate(n.date ?? null))
      .filter((s) => /^\d{4}/.test(s) && s !== "9999-99-99")
      .map((s) => {
        const [y, m = "00", d = "00"] = s.split("-");
        return parseInt(y, 10) * 10000 + parseInt(m, 10) * 100 + parseInt(d, 10);
      });
    const min = keys.length ? Math.min(...keys) : 20000000;
    const max = keys.length ? Math.max(...keys) : 20300000;
    const totalW = Math.max(1400, (max - min) * 0.001 + 1200);
    return { tMin: min, tMax: max, undatedX: totalW - 60, totalW };
  }, [nodes]);

  const xFor = useCallback(
    (raw: string | null | undefined): number => {
      const n = normalizeDate(raw ?? null);
      if (!/^\d{4}/.test(n)) return undatedX;
      const [y, m = "00", d = "00"] = n.split("-");
      const k = parseInt(y, 10) * 10000 + parseInt(m, 10) * 100 + parseInt(d, 10);
      return (
        HEADER_W +
        30 +
        ((k - tMin) / Math.max(1, tMax - tMin)) * (totalW - HEADER_W - RIGHT_PAD - 30)
      );
    },
    [tMin, tMax, totalW, undatedX],
  );

  // For each lens: collect its dated nodes, ordered chronologically.
  // Track order is narrative-coherent (TRACK_ORDER above), not LENSES-array.
  const orderedLenses = useMemo(() => {
    const byId = new Map(LENSES.map((l) => [l.id, l]));
    const ordered = TRACK_ORDER.map((id) => byId.get(id)).filter(Boolean) as typeof LENSES;
    // Append any lenses missing from TRACK_ORDER so we don't drop them
    const known = new Set(TRACK_ORDER);
    for (const l of LENSES) if (!known.has(l.id)) ordered.push(l);
    return ordered;
  }, []);

  const lensTracks = useMemo(() => {
    return orderedLenses.map((lens, idx) => {
      const baseY = TOP_PAD + idx * TRACK_H;
      const raw = lens.nodeIds
        .map((id) => nodeById.get(id))
        .filter((n): n is Node => Boolean(n))
        .map((n) => ({ node: n, x: xFor(n.date), y: baseY }))
        .sort((a, b) => a.x - b.x);

      // Collision avoidance — stations within 12 px on X get jittered ±5 px on Y
      // so they don't sit on top of each other. Walk left-to-right, push down
      // when a previous station is still in the proximity window.
      const COLLISION_PX = 14;
      const JITTER = 5;
      let lastX = -Infinity;
      let jitterDir = 1;
      for (const s of raw) {
        if (s.x - lastX < COLLISION_PX) {
          s.y = baseY + jitterDir * JITTER;
          jitterDir = -jitterDir;
        } else {
          jitterDir = 1;
        }
        lastX = s.x;
      }
      return { lens, nodes: raw };
    });
  }, [nodeById, orderedLenses, xFor]);

  // Detect interchanges — nodes appearing in 2+ lenses
  const lensesByNode = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const lens of LENSES) {
      for (const id of lens.nodeIds) {
        if (!nodeById.has(id)) continue;
        if (!m.has(id)) m.set(id, []);
        m.get(id)!.push(lens.id);
      }
    }
    return m;
  }, [nodeById]);

  const totalH = TOP_PAD + LENSES.length * TRACK_H + BOTTOM_PAD;

  // Decade markers along the time axis
  const decades = useMemo(() => {
    const minY = Math.floor(tMin / 100000) * 100000;
    const maxY = Math.ceil(tMax / 100000) * 100000;
    const out: { x: number; label: string }[] = [];
    for (let y = minY; y <= maxY; y += 100000) {
      const year = Math.floor(y / 10000);
      out.push({
        x: HEADER_W + 30 + ((y - tMin) / Math.max(1, tMax - tMin)) * (totalW - HEADER_W - RIGHT_PAD - 30),
        label: String(year),
      });
    }
    return out;
  }, [tMin, tMax, totalW]);

  return (
    <div className="space-y-3">
      <div className="text-xs font-mono text-zinc-500 border border-zinc-800 p-2">
        Each row is a narrative arc; stations are nodes laid out by date.{" "}
        Bigger white-ringed stations are <span className="text-zinc-300">interchanges</span>{" "}
        — nodes appearing in multiple arcs. Click any station to open it on the
        board view. Hover an arc title to highlight that line.
      </div>

      <div className="overflow-auto border border-zinc-800 bg-zinc-950">
        <svg width={totalW} height={totalH} className="block">
          {/* Decade gridlines */}
          {decades.map((d) => (
            <g key={d.label}>
              <line
                x1={d.x}
                y1={TOP_PAD - 10}
                x2={d.x}
                y2={totalH - BOTTOM_PAD + 10}
                stroke="#27272a"
                strokeWidth={0.5}
                strokeDasharray="2,4"
              />
              <text
                x={d.x}
                y={TOP_PAD - 16}
                fontSize={10}
                fill="#71717a"
                textAnchor="middle"
              >
                {d.label}
              </text>
              <text
                x={d.x}
                y={totalH - BOTTOM_PAD + 22}
                fontSize={10}
                fill="#71717a"
                textAnchor="middle"
              >
                {d.label}
              </text>
            </g>
          ))}

          {/* Undated column */}
          <line
            x1={undatedX}
            y1={TOP_PAD - 10}
            x2={undatedX}
            y2={totalH - BOTTOM_PAD + 10}
            stroke="#3f3f46"
            strokeWidth={0.5}
          />
          <text x={undatedX} y={TOP_PAD - 16} fontSize={10} fill="#a1a1aa" textAnchor="middle">
            undated
          </text>

          {/* Lens tracks */}
          {lensTracks.map(({ lens, nodes: stations }, idx) => {
            const y = TOP_PAD + idx * TRACK_H;
            const color = arcLineColor(lens.id);
            const dimmed = hoverLensId !== null && hoverLensId !== lens.id;
            const opacity = dimmed ? 0.18 : 1;
            return (
              <g key={lens.id} opacity={opacity}>
                {/* Track baseline */}
                <line
                  x1={HEADER_W + 20}
                  y1={y}
                  x2={totalW - 20}
                  y2={y}
                  stroke="#3f3f46"
                  strokeWidth={1}
                />

                {/* Lens label (left gutter) */}
                <rect
                  x={4}
                  y={y - 14}
                  width={HEADER_W - 16}
                  height={28}
                  fill="#18181b"
                  stroke={color}
                  strokeWidth={hoverLensId === lens.id ? 2 : 0}
                  rx={2}
                  onMouseEnter={() => setHoverLensId(lens.id)}
                  onMouseLeave={() => setHoverLensId(null)}
                  style={{ cursor: "pointer" }}
                />
                <text
                  x={14}
                  y={y - 1}
                  fontSize={11}
                  fontWeight={600}
                  fill={color}
                  pointerEvents="none"
                >
                  ━━ {lens.title.length > 32 ? lens.title.slice(0, 30) + "…" : lens.title}
                </text>
                <text
                  x={14}
                  y={y + 11}
                  fontSize={9}
                  fill="#71717a"
                  pointerEvents="none"
                >
                  {stations.length} stations · {lens.id}
                </text>

                {/* Connecting polyline through actual station positions
                    (respects the jitter from collision avoidance) */}
                {stations.length > 1 && (
                  <polyline
                    points={stations.map((s) => `${s.x},${s.y}`).join(" ")}
                    fill="none"
                    stroke={color}
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Stations — at the (possibly-jittered) station position */}
                {stations.map(({ node, x, y: stationY }) => {
                  const lensCount = lensesByNode.get(node.id)?.length ?? 1;
                  const isHub = lensCount >= 2;
                  const r = isHub ? HUB_R : STATION_R;
                  const sel = hoverNodeId === node.id;
                  return (
                    <g
                      key={`${lens.id}-${node.id}`}
                      onMouseEnter={() => setHoverNodeId(node.id)}
                      onMouseLeave={() => setHoverNodeId(null)}
                      style={{ cursor: "pointer" }}
                    >
                      <a href={`/boards/${boardId}#${node.id}`}>
                        <circle
                          cx={x}
                          cy={stationY}
                          r={r + (sel ? 2 : 0)}
                          fill={color}
                          stroke={isHub ? "#fff" : nodeTypeColor(node.type)}
                          strokeWidth={isHub ? 2 : 1.5}
                        />
                        <title>{`${node.name}\n${node.type} · ${node.date ?? "undated"}\non ${lensCount} arc${lensCount === 1 ? "" : "s"}`}</title>
                      </a>
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Interchange tubes — soft white curves connecting stations of the
              same node across tracks. Replaces the earlier dashed line with a
              cleaner transit-map look. */}
          {Array.from(lensesByNode.entries()).map(([nodeId, lensIds]) => {
            if (lensIds.length < 2) return null;
            const node = nodeById.get(nodeId);
            if (!node) return null;
            const x = xFor(node.date);
            const ys = lensIds
              .map((lid) => orderedLenses.findIndex((l) => l.id === lid))
              .filter((i) => i >= 0)
              .map((i) => TOP_PAD + i * TRACK_H);
            const yMin = Math.min(...ys);
            const yMax = Math.max(...ys);
            const sel = hoverNodeId === nodeId;
            // Slight horizontal bow so multiple interchanges at similar X
            // visually separate. Use a quadratic bezier with control point
            // offset by ±3 px depending on node-id parity.
            const offset = (nodeId.charCodeAt(0) % 2 === 0 ? 1 : -1) * 4;
            const cx = x + offset;
            const cy = (yMin + yMax) / 2;
            return (
              <path
                key={`xc-${nodeId}`}
                d={`M ${x},${yMin} Q ${cx},${cy} ${x},${yMax}`}
                fill="none"
                stroke="#fff"
                strokeWidth={sel ? 2.5 : 1.2}
                opacity={sel ? 0.9 : 0.4}
                pointerEvents="none"
              />
            );
          })}

          {/* Inline labels for interchange stations (≥3 lenses) — these are
              the structural pivots, worth always-on labels */}
          {Array.from(lensesByNode.entries()).map(([nodeId, lensIds]) => {
            if (lensIds.length < 3) return null;
            const node = nodeById.get(nodeId);
            if (!node) return null;
            const x = xFor(node.date);
            const yIdx = Math.min(
              ...lensIds.map((lid) => orderedLenses.findIndex((l) => l.id === lid)),
            );
            const y = TOP_PAD + yIdx * TRACK_H - 14;
            return (
              <text
                key={`lbl-${nodeId}`}
                x={x}
                y={y}
                fontSize={10}
                fontWeight={600}
                fill="#fafafa"
                textAnchor="middle"
                pointerEvents="none"
                style={{
                  paintOrder: "stroke",
                  stroke: "#0a0a0a",
                  strokeWidth: 3,
                  strokeLinejoin: "round",
                }}
              >
                {node.name.length > 22 ? node.name.slice(0, 20) + "…" : node.name}
              </text>
            );
          })}

          {/* Hover label for selected station */}
          {hoverNodeId &&
            (() => {
              const node = nodeById.get(hoverNodeId);
              if (!node) return null;
              const x = xFor(node.date);
              const lensIds = lensesByNode.get(hoverNodeId) ?? [];
              const yTop = Math.min(
                ...lensIds.map((lid) => TOP_PAD + orderedLenses.findIndex((l) => l.id === lid) * TRACK_H),
              );
              return (
                <g pointerEvents="none">
                  <rect
                    x={x + 12}
                    y={yTop - 28}
                    width={Math.max(140, node.name.length * 7 + 16)}
                    height={36}
                    fill="#18181b"
                    stroke="#52525b"
                    rx={2}
                  />
                  <text x={x + 20} y={yTop - 14} fontSize={11} fontWeight={600} fill="#fafafa">
                    {node.name}
                  </text>
                  <text x={x + 20} y={yTop - 2} fontSize={9} fill="#a1a1aa">
                    {node.type} · {node.date ?? "undated"} · on {lensIds.length} arc{lensIds.length === 1 ? "" : "s"}
                  </text>
                </g>
              );
            })()}
        </svg>
      </div>

      {/* Legend — ordered to match track ordering top-to-bottom */}
      <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-zinc-500 px-1">
        <span>lines (top → bottom):</span>
        {orderedLenses.map((l) => (
          <span
            key={l.id}
            onMouseEnter={() => setHoverLensId(l.id)}
            onMouseLeave={() => setHoverLensId(null)}
            className="cursor-default"
          >
            <span
              className="inline-block w-4 h-1.5 align-middle mr-1"
              style={{ background: arcLineColor(l.id) }}
            />
            {l.id}
          </span>
        ))}
      </div>
    </div>
  );
}
