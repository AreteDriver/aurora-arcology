"use client";

import { useMemo, useState } from "react";
import type { Node, Connection } from "@db/schema";
import { LENSES, type Lens } from "@/data/lenses";

const TYPE_COLOR: Record<string, string> = {
  Event: "#e85d75",
  Person: "#f4a261",
  Organization: "#2a9d8f",
  Faction: "#264653",
  Place: "#a8dadc",
  Phenomenon: "#9d4edd",
  Concept: "#6c757d",
  Artifact: "#e9c46a",
};

type SortMode = "type" | "degree" | "name";

interface Props {
  nodes: Node[];
  connections: Connection[];
}

export default function MatrixView({ nodes, connections }: Props) {
  const [sortMode, setSortMode] = useState<SortMode>("type");
  const [lensId, setLensId] = useState<string | null>(null);
  const [hoverCell, setHoverCell] = useState<{ src: Node; tgt: Node; conn: Connection } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [minConfidence, setMinConfidence] = useState(0);

  const lens: Lens | null = useMemo(
    () => (lensId ? LENSES.find((l) => l.id === lensId) ?? null : null),
    [lensId],
  );

  const visibleNodes = useMemo(() => {
    if (!lens) return nodes;
    const set = new Set(lens.nodeIds);
    return nodes.filter((n) => set.has(n.id));
  }, [nodes, lens]);

  // Degree per visible node
  const degree = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of visibleNodes) m.set(n.id, 0);
    const idSet = new Set(visibleNodes.map((n) => n.id));
    for (const c of connections) {
      if (!idSet.has(c.srcNodeId) || !idSet.has(c.tgtNodeId)) continue;
      m.set(c.srcNodeId, (m.get(c.srcNodeId) ?? 0) + 1);
      m.set(c.tgtNodeId, (m.get(c.tgtNodeId) ?? 0) + 1);
    }
    return m;
  }, [visibleNodes, connections]);

  // Order rows + cols
  const ordered = useMemo(() => {
    const arr = [...visibleNodes];
    if (sortMode === "type") {
      arr.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
    } else if (sortMode === "degree") {
      arr.sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) || a.name.localeCompare(b.name));
    } else {
      arr.sort((a, b) => a.name.localeCompare(b.name));
    }
    return arr;
  }, [visibleNodes, sortMode, degree]);

  // Build index lookup
  const indexById = useMemo(() => {
    const m = new Map<string, number>();
    ordered.forEach((n, i) => m.set(n.id, i));
    return m;
  }, [ordered]);

  // Filter connections to visible set + confidence
  const visibleConns = useMemo(
    () =>
      connections.filter((c) => {
        if (c.confidence < minConfidence) return false;
        return indexById.has(c.srcNodeId) && indexById.has(c.tgtNodeId);
      }),
    [connections, indexById, minConfidence],
  );

  // Sizing: choose cell size so the matrix fits ~1100px max width
  const N = ordered.length;
  const MAX_PX = 1100;
  const HEADER_PX = 180; // row label width
  const cellSize = Math.max(4, Math.min(16, Math.floor((MAX_PX - HEADER_PX) / Math.max(N, 1))));
  const matrixSize = cellSize * N;
  const totalWidth = HEADER_PX + matrixSize;
  const totalHeight = HEADER_PX + matrixSize;

  // Type-block boundaries — for sortMode='type', draw separators
  const typeBoundaries = useMemo(() => {
    if (sortMode !== "type") return [];
    const out: { idx: number; type: string }[] = [];
    let prev: string | null = null;
    ordered.forEach((n, i) => {
      if (n.type !== prev) {
        out.push({ idx: i, type: n.type });
        prev = n.type;
      }
    });
    return out;
  }, [ordered, sortMode]);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 text-xs font-mono border border-zinc-800 p-2">
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500">sort</span>
          {(["type", "degree", "name"] as SortMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setSortMode(m)}
              className={`px-1.5 py-0.5 ${sortMode === m ? "bg-zinc-100 text-black" : "bg-zinc-800 hover:bg-zinc-700"}`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500">conf ≥</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={minConfidence}
            onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
            className="w-24"
          />
          <span className="w-8 text-zinc-300">{minConfidence.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500">lens</span>
          <select
            value={lensId ?? ""}
            onChange={(e) => setLensId(e.target.value || null)}
            className="bg-zinc-900 border border-zinc-700 px-1 py-0.5 max-w-[16rem]"
            title={lens?.description ?? "Curator-authored sub-board lenses"}
          >
            <option value="">full corpus</option>
            {LENSES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto text-zinc-500">
          {ordered.length} nodes · {visibleConns.length} edges · {cellSize}px cells
        </div>
      </div>

      {/* Hover detail */}
      <div className="text-xs font-mono border border-zinc-800 p-2 min-h-[2.5rem]">
        {hoverCell ? (
          <span>
            <span className="text-zinc-300">{hoverCell.src.name}</span>{" "}
            <span className="text-zinc-500">— {hoverCell.conn.relationType} →</span>{" "}
            <span className="text-zinc-300">{hoverCell.tgt.name}</span>{" "}
            <span className="text-zinc-600">[{hoverCell.conn.confidence.toFixed(2)}]</span>
            {hoverCell.conn.claim && (
              <div className="text-zinc-500 mt-0.5 normal-case">{hoverCell.conn.claim}</div>
            )}
          </span>
        ) : (
          <span className="text-zinc-600">hover a cell to inspect the edge</span>
        )}
      </div>

      {/* Matrix */}
      <div className="overflow-auto border border-zinc-800 bg-zinc-950">
        <svg width={totalWidth} height={totalHeight} className="block">
          {/* Type-region backgrounds (sortMode='type') */}
          {typeBoundaries.map((b, i) => {
            const next = typeBoundaries[i + 1]?.idx ?? ordered.length;
            const x0 = HEADER_PX + b.idx * cellSize;
            const y0 = HEADER_PX + b.idx * cellSize;
            const span = (next - b.idx) * cellSize;
            return (
              <g key={b.type}>
                <rect
                  x={x0}
                  y={HEADER_PX}
                  width={span}
                  height={matrixSize}
                  fill={TYPE_COLOR[b.type] ?? "#888"}
                  opacity={0.04}
                />
                <rect
                  x={HEADER_PX}
                  y={y0}
                  width={matrixSize}
                  height={span}
                  fill={TYPE_COLOR[b.type] ?? "#888"}
                  opacity={0.04}
                />
              </g>
            );
          })}

          {/* Row labels + type chips */}
          {ordered.map((n, i) => {
            const y = HEADER_PX + i * cellSize + cellSize / 2;
            const sel = selectedId === n.id;
            return (
              <g key={`r-${n.id}`}>
                <rect
                  x={HEADER_PX - 8}
                  y={HEADER_PX + i * cellSize}
                  width={4}
                  height={cellSize}
                  fill={TYPE_COLOR[n.type] ?? "#888"}
                />
                <text
                  x={HEADER_PX - 12}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={Math.min(11, cellSize - 1)}
                  fill={sel ? "#fff" : "#a1a1aa"}
                  fontWeight={sel ? 600 : 400}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(sel ? null : n.id)}
                >
                  {n.name.length > 28 ? n.name.slice(0, 26) + "…" : n.name}
                  <title>{n.name}</title>
                </text>
              </g>
            );
          })}

          {/* Column headers — type chips only (rotated names get unreadable at small cell size) */}
          {ordered.map((n, i) => {
            const x = HEADER_PX + i * cellSize;
            const sel = selectedId === n.id;
            return (
              <g key={`c-${n.id}`}>
                <rect
                  x={x}
                  y={HEADER_PX - 8}
                  width={cellSize}
                  height={4}
                  fill={TYPE_COLOR[n.type] ?? "#888"}
                />
                {cellSize >= 8 && (
                  <text
                    x={x + cellSize / 2}
                    y={HEADER_PX - 12}
                    transform={`rotate(-60 ${x + cellSize / 2} ${HEADER_PX - 12})`}
                    textAnchor="start"
                    fontSize={Math.min(10, cellSize - 1)}
                    fill={sel ? "#fff" : "#71717a"}
                    fontWeight={sel ? 600 : 400}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(sel ? null : n.id)}
                  >
                    {n.name.length > 22 ? n.name.slice(0, 20) + "…" : n.name}
                    <title>{n.name}</title>
                  </text>
                )}
              </g>
            );
          })}

          {/* Selected-row + col highlight */}
          {selectedId && indexById.has(selectedId) && (
            <g>
              <rect
                x={HEADER_PX}
                y={HEADER_PX + (indexById.get(selectedId)! * cellSize)}
                width={matrixSize}
                height={cellSize}
                fill="#fff"
                opacity={0.05}
              />
              <rect
                x={HEADER_PX + (indexById.get(selectedId)! * cellSize)}
                y={HEADER_PX}
                width={cellSize}
                height={matrixSize}
                fill="#fff"
                opacity={0.05}
              />
            </g>
          )}

          {/* Cells */}
          {visibleConns.map((c) => {
            const ri = indexById.get(c.srcNodeId);
            const ci = indexById.get(c.tgtNodeId);
            if (ri === undefined || ci === undefined) return null;
            const opacity = 0.3 + c.confidence * 0.7;
            const fill =
              c.confidence < 0.5
                ? "#a1a1aa"
                : c.confidence < 0.7
                  ? "#3b82f6"
                  : c.confidence < 0.9
                    ? "#22c55e"
                    : "#f59e0b";
            return (
              <rect
                key={c.id}
                x={HEADER_PX + ci * cellSize + 0.5}
                y={HEADER_PX + ri * cellSize + 0.5}
                width={cellSize - 1}
                height={cellSize - 1}
                fill={fill}
                opacity={opacity}
                onMouseEnter={() => {
                  const src = ordered[ri];
                  const tgt = ordered[ci];
                  setHoverCell({ src, tgt, conn: c });
                }}
                onMouseLeave={() => setHoverCell(null)}
                onClick={() => setSelectedId(c.srcNodeId)}
                style={{ cursor: "pointer" }}
              >
                <title>
                  {ordered[ri].name} → {ordered[ci].name}
                  {"\n"}
                  {c.relationType} ({c.confidence.toFixed(2)})
                </title>
              </rect>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-zinc-500 px-1">
        <span>confidence:</span>
        <span><span className="inline-block w-3 h-3 align-middle mr-1" style={{ background: "#a1a1aa" }} /> &lt;0.5 (tinfoil)</span>
        <span><span className="inline-block w-3 h-3 align-middle mr-1" style={{ background: "#3b82f6" }} /> 0.5–0.7</span>
        <span><span className="inline-block w-3 h-3 align-middle mr-1" style={{ background: "#22c55e" }} /> 0.7–0.9</span>
        <span><span className="inline-block w-3 h-3 align-middle mr-1" style={{ background: "#f59e0b" }} /> ≥ 0.9</span>
        <span className="ml-4">
          rows = source · cols = target · diagonal stays empty (no self-edges in seed)
        </span>
      </div>
    </div>
  );
}
