"use client";

/**
 * Narrative arcs rendered as a subway-map style board.
 *
 * This version favors readability over density:
 * - Focus mode shows one selected arc plus related arcs.
 * - Lane-packing prevents station overlap on dense date clusters.
 * - Track order is auto-optimized to reduce interchange span.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Node } from "@db/schema";
import { LENSES, type Lens } from "@/data/lenses";
import { normalizeDate } from "@/lib/dates";
import { nodeTypeColor } from "@/lib/palette";
import { arcLineColor } from "@/lib/graph-palette";

interface Props {
  boardId: string;
  nodes: Node[];
}

const PREFERRED_TRACK_ORDER = [
  "old-wars",
  "amarr-royal-succession",
  "drifter-arc",
  "pirate-factions",
  "caldari-mega-corp-axis",
  "lai-dai-vs-ishukone",
  "empyrean-age",
  "sarpati-network",
  "intaki-religious-arc",
  "kahah-yc120",
  "exordium",
  "warpath-current",
  "deathless-arc",
];

const HEADER_W = 240;
const STATION_R = 7;
const HUB_R = 10;
const TOP_PAD = 60;
const BOTTOM_PAD = 40;
const RIGHT_PAD = 80;

const MIN_TRACK_H = 56;
const TRACK_GAP = 12;
const LANE_STEP = 12;
const STATION_MIN_X_GAP = 20;
const RELATED_FOCUS_LIMIT = 4;

type DensityMode = "compact" | "balanced" | "roomy";
type EraMode = "all" | "yc120_and_before" | "yc121_to_yc125" | "yc126_plus" | "undated_only";

const DENSITY_PRESET: Record<
  DensityMode,
  { minTrackH: number; laneStep: number; minStationXGap: number }
> = {
  compact: {
    minTrackH: 52,
    laneStep: 10,
    minStationXGap: 16,
  },
  balanced: {
    minTrackH: MIN_TRACK_H,
    laneStep: LANE_STEP,
    minStationXGap: STATION_MIN_X_GAP,
  },
  roomy: {
    minTrackH: 62,
    laneStep: 14,
    minStationXGap: 24,
  },
};

const ERA_OPTIONS: Array<{ id: EraMode; label: string }> = [
  { id: "all", label: "all eras" },
  { id: "yc120_and_before", label: "YC120 and before" },
  { id: "yc121_to_yc125", label: "YC121-YC125" },
  { id: "yc126_plus", label: "YC126+" },
  { id: "undated_only", label: "undated only" },
];

function asDensityMode(value: string | null): DensityMode {
  if (value === "compact" || value === "balanced" || value === "roomy") return value;
  return "balanced";
}

function asEraMode(value: string | null): EraMode {
  if (
    value === "all" ||
    value === "yc120_and_before" ||
    value === "yc121_to_yc125" ||
    value === "yc126_plus" ||
    value === "undated_only"
  ) {
    return value;
  }
  return "all";
}

function asFocusMode(value: string | null): boolean {
  if (value === "0" || value === "false") return false;
  return true;
}

function yearFromRawDate(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const normalized = normalizeDate(raw);
  const match = /^(\d{4})/.exec(normalized);
  if (!match) return null;
  return parseInt(match[1], 10);
}

function isNodeInEra(raw: string | null | undefined, era: EraMode): boolean {
  const year = yearFromRawDate(raw);

  if (era === "undated_only") return year === null;
  if (year === null) return era === "all";
  if (era === "all") return true;
  if (era === "yc120_and_before") return year <= 2018; // YC120
  if (era === "yc121_to_yc125") return year >= 2019 && year <= 2023; // YC121..YC125
  return year >= 2024; // YC126+
}

type Station = {
  node: Node;
  x: number;
  y: number;
  lane: number;
};

type LensTrack = {
  lens: Lens;
  rowTop: number;
  rowHeight: number;
  baseY: number;
  lanes: number;
  stations: Station[];
};

function overlapCount(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let count = 0;
  for (const id of small) {
    if (large.has(id)) count++;
  }
  return count;
}

function spanPenalty(order: Lens[], lensesByNode: Map<string, string[]>): number {
  const indexById = new Map(order.map((lens, idx) => [lens.id, idx]));
  let penalty = 0;

  for (const memberships of lensesByNode.values()) {
    if (memberships.length < 2) continue;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for (const lensId of memberships) {
      const idx = indexById.get(lensId);
      if (idx === undefined) continue;
      if (idx < min) min = idx;
      if (idx > max) max = idx;
    }

    if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
      penalty += max - min;
    }
  }

  return penalty;
}

export default function ArcsView({ boardId, nodes }: Props) {
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const [hoverLensId, setHoverLensId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(true);
  const [selectedLensId, setSelectedLensId] = useState<string | null>(null);
  const [densityMode, setDensityMode] = useState<DensityMode>("balanced");
  const [eraMode, setEraMode] = useState<EraMode>("all");
  const [urlInitialized, setUrlInitialized] = useState(false);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const boardLenses = useMemo(() => {
    const filtered = LENSES
      .map((lens) => ({
        ...lens,
        nodeIds: lens.nodeIds.filter((id) => nodeById.has(id)),
      }))
      .filter((lens) => lens.nodeIds.length > 0);

    return filtered;
  }, [nodeById]);

  const nodeIdsByLens = useMemo(() => {
    return new Map(boardLenses.map((lens) => [lens.id, new Set(lens.nodeIds)]));
  }, [boardLenses]);

  // Detect interchanges from board-scoped lenses.
  const lensesByNodeAll = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const lens of boardLenses) {
      for (const id of lens.nodeIds) {
        if (!m.has(id)) m.set(id, []);
        m.get(id)!.push(lens.id);
      }
    }
    return m;
  }, [boardLenses]);

  // Track ordering pass:
  // 1) Greedy chain by overlap from densest lens.
  // 2) Adjacent-swap optimization minimizing interchange span.
  const orderedLenses = useMemo(() => {
    if (boardLenses.length <= 1) return boardLenses;

    const preferredIndex = new Map(PREFERRED_TRACK_ORDER.map((id, idx) => [id, idx]));
    const remaining = new Map(boardLenses.map((lens) => [lens.id, lens]));

    let seed = boardLenses[0];
    for (const lens of boardLenses) {
      if (lens.nodeIds.length > seed.nodeIds.length) seed = lens;
    }

    const ordered: Lens[] = [seed];
    remaining.delete(seed.id);

    while (remaining.size > 0) {
      const last = ordered[ordered.length - 1];
      const lastSet = nodeIdsByLens.get(last.id) ?? new Set<string>();

      let best: Lens | null = null;
      let bestScore = Number.NEGATIVE_INFINITY;

      for (const candidate of remaining.values()) {
        const overlap = overlapCount(lastSet, nodeIdsByLens.get(candidate.id) ?? new Set<string>());
        const prefA = preferredIndex.get(last.id);
        const prefB = preferredIndex.get(candidate.id);
        const preferredAdj =
          prefA !== undefined && prefB !== undefined ? 1 / (1 + Math.abs(prefA - prefB)) : 0;

        // Overlap dominates; preferred adjacency and density break ties.
        const score = overlap * 100 + preferredAdj * 10 + candidate.nodeIds.length * 0.1;
        if (score > bestScore) {
          bestScore = score;
          best = candidate;
        }
      }

      if (!best) break;
      ordered.push(best);
      remaining.delete(best.id);
    }

    for (const lens of remaining.values()) ordered.push(lens);

    let improved = true;
    let current = [...ordered];

    while (improved) {
      improved = false;
      const currentPenalty = spanPenalty(current, lensesByNodeAll);

      for (let i = 0; i < current.length - 1; i++) {
        const swapped = [...current];
        const temp = swapped[i];
        swapped[i] = swapped[i + 1];
        swapped[i + 1] = temp;

        if (spanPenalty(swapped, lensesByNodeAll) < currentPenalty) {
          current = swapped;
          improved = true;
          break;
        }
      }
    }

    return current;
  }, [boardLenses, nodeIdsByLens, lensesByNodeAll]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hydrateFromLocation = () => {
      const params = new URLSearchParams(window.location.search);
      const qsArc = params.get("arc");
      const qsFocus = asFocusMode(params.get("focus"));
      const qsDensity = asDensityMode(params.get("density"));
      const qsEra = asEraMode(params.get("era"));

      setFocusMode(qsFocus);
      setDensityMode(qsDensity);
      setEraMode(qsEra);
      setSelectedLensId(qsArc);
    };

    hydrateFromLocation();
    setUrlInitialized(true);
    window.addEventListener("popstate", hydrateFromLocation);
    return () => window.removeEventListener("popstate", hydrateFromLocation);
  }, []);

  useEffect(() => {
    if (orderedLenses.length === 0) {
      setSelectedLensId(null);
      return;
    }
    if (!selectedLensId || !orderedLenses.some((lens) => lens.id === selectedLensId)) {
      setSelectedLensId(orderedLenses[0].id);
    }
  }, [orderedLenses, selectedLensId]);

  useEffect(() => {
    if (!urlInitialized || typeof window === "undefined") return;
    const current = new URLSearchParams(window.location.search);
    const currentArc = current.get("arc");
    const currentFocus = asFocusMode(current.get("focus"));
    const currentDensity = asDensityMode(current.get("density"));
    const currentEra = asEraMode(current.get("era"));

    if (
      currentArc === (selectedLensId ?? null) &&
      currentFocus === focusMode &&
      currentDensity === densityMode &&
      currentEra === eraMode
    ) {
      return;
    }

    const next = new URLSearchParams();
    if (selectedLensId) next.set("arc", selectedLensId);
    next.set("focus", focusMode ? "1" : "0");
    next.set("density", densityMode);
    next.set("era", eraMode);
    const query = next.toString();
    const path = query.length > 0 ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, "", path);
  }, [densityMode, eraMode, focusMode, selectedLensId, urlInitialized]);

  const densityPreset = DENSITY_PRESET[densityMode];
  const eraLabel = ERA_OPTIONS.find((opt) => opt.id === eraMode)?.label ?? "all eras";

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
    const width = Math.max(1400, (max - min) * 0.001 + 1200);

    return { tMin: min, tMax: max, undatedX: width - 60, totalW: width };
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

  const relatedLensIds = useMemo(() => {
    if (!selectedLensId) return [];
    const selectedSet = nodeIdsByLens.get(selectedLensId) ?? new Set<string>();

    return orderedLenses
      .filter((lens) => lens.id !== selectedLensId)
      .map((lens) => ({
        id: lens.id,
        overlap: overlapCount(selectedSet, nodeIdsByLens.get(lens.id) ?? new Set<string>()),
      }))
      .filter((entry) => entry.overlap > 0)
      .sort((a, b) => b.overlap - a.overlap)
      .slice(0, RELATED_FOCUS_LIMIT)
      .map((entry) => entry.id);
  }, [selectedLensId, orderedLenses, nodeIdsByLens]);

  const visibleLensIds = useMemo(() => {
    if (!focusMode) {
      return new Set(orderedLenses.map((lens) => lens.id));
    }

    const out = new Set<string>();

    if (selectedLensId) out.add(selectedLensId);
    for (const id of relatedLensIds) out.add(id);
    if (hoverLensId) out.add(hoverLensId);

    if (hoverNodeId) {
      for (const id of lensesByNodeAll.get(hoverNodeId) ?? []) {
        out.add(id);
      }
    }

    if (out.size === 0 && orderedLenses[0]) {
      out.add(orderedLenses[0].id);
    }

    return out;
  }, [focusMode, hoverLensId, hoverNodeId, lensesByNodeAll, orderedLenses, relatedLensIds, selectedLensId]);

  const displayLenses = useMemo(() => {
    return orderedLenses.filter((lens) => visibleLensIds.has(lens.id));
  }, [orderedLenses, visibleLensIds]);

  const { lensTracks, totalH } = useMemo(() => {
    let cursorY = TOP_PAD;
    const tracks: LensTrack[] = [];

    for (const lens of displayLenses) {
      const rawStations = lens.nodeIds
        .map((id) => nodeById.get(id))
        .filter((n): n is Node => Boolean(n))
        .filter((n) => isNodeInEra(n.date, eraMode))
        .map((node) => ({ node, x: xFor(node.date) }))
        .sort((a, b) => a.x - b.x);

      if (rawStations.length === 0) continue;

      const spread =
        rawStations.length > 1 ? rawStations[rawStations.length - 1].x - rawStations[0].x : 0;
      const crowdScore = rawStations.length / Math.max(1, spread / 120);
      const dynamicGapBoost = Math.max(0, Math.min(8, Math.round((crowdScore - 1) * 5)));
      const stationGap = densityPreset.minStationXGap + dynamicGapBoost;

      const laneLastX: number[] = [];
      const staged = rawStations.map(({ node, x }) => {
        let lane = 0;
        while (lane < laneLastX.length && x - laneLastX[lane] < stationGap) {
          lane++;
        }
        if (lane === laneLastX.length) laneLastX.push(x);
        else laneLastX[lane] = x;

        return { node, x, lane };
      });

      const lanes = Math.max(1, laneLastX.length);
      const rowHeight = Math.max(densityPreset.minTrackH, 42 + (lanes - 1) * densityPreset.laneStep + 14);
      const baseY = cursorY + rowHeight / 2;

      const stations: Station[] = staged.map((s) => ({
        node: s.node,
        x: s.x,
        lane: s.lane,
        y: baseY + (s.lane - (lanes - 1) / 2) * densityPreset.laneStep,
      }));

      tracks.push({
        lens,
        rowTop: cursorY,
        rowHeight,
        baseY,
        lanes,
        stations,
      });

      cursorY += rowHeight + TRACK_GAP;
    }

    const height = Math.max(TOP_PAD + BOTTOM_PAD + 120, cursorY - TRACK_GAP + BOTTOM_PAD);
    return { lensTracks: tracks, totalH: height };
  }, [densityPreset.laneStep, densityPreset.minStationXGap, densityPreset.minTrackH, displayLenses, eraMode, nodeById, xFor]);

  const stationPositionsByNode = useMemo(() => {
    const m = new Map<string, Array<{ lensId: string; x: number; y: number }>>();

    for (const track of lensTracks) {
      for (const station of track.stations) {
        if (!m.has(station.node.id)) m.set(station.node.id, []);
        m.get(station.node.id)!.push({
          lensId: track.lens.id,
          x: station.x,
          y: station.y,
        });
      }
    }

    return m;
  }, [lensTracks]);

  const lensesByNodeVisible = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const track of lensTracks) {
      for (const station of track.stations) {
        if (!m.has(station.node.id)) m.set(station.node.id, []);
        m.get(station.node.id)!.push(track.lens.id);
      }
    }
    return m;
  }, [lensTracks]);

  const semanticLabels = useMemo(() => {
    const candidates: Array<{ nodeId: string; count: number; x: number; y: number; name: string }> = [];

    for (const [nodeId, lensIds] of lensesByNodeVisible.entries()) {
      const positions = stationPositionsByNode.get(nodeId) ?? [];
      if (positions.length === 0) continue;

      const shouldLabel = focusMode
        ? lensIds.includes(selectedLensId ?? "") && lensIds.length >= 2
        : lensIds.length >= 4;

      if (!shouldLabel) continue;

      const node = nodeById.get(nodeId);
      if (!node) continue;

      let top = positions[0];
      for (const p of positions) {
        if (p.y < top.y) top = p;
      }

      candidates.push({
        nodeId,
        count: lensIds.length,
        x: top.x,
        y: top.y,
        name: node.name,
      });
    }

    candidates.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return candidates.slice(0, focusMode ? 14 : 10);
  }, [focusMode, lensesByNodeVisible, nodeById, selectedLensId, stationPositionsByNode]);

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

  const layoutStats = useMemo(() => {
    const maxLanes = lensTracks.reduce((best, track) => Math.max(best, track.lanes), 1);
    const multiLaneTracks = lensTracks.filter((track) => track.lanes > 1).length;
    return { maxLanes, multiLaneTracks };
  }, [lensTracks]);

  const summaryText = `${lensTracks.length} / ${orderedLenses.length} arcs visible · era: ${eraLabel} · ${layoutStats.multiLaneTracks} packed tracks · max ${layoutStats.maxLanes} lanes`;

  return (
    <div className="space-y-3">
      <div className="space-y-2 border border-zinc-800 p-2 text-xs font-mono text-zinc-400">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFocusMode((v) => !v)}
            className={`rounded border px-2 py-1 ${focusMode ? "border-zinc-100 bg-zinc-100 text-black" : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"}`}
          >
            {focusMode ? "focus mode" : "overview mode"}
          </button>

          <span className="text-zinc-500">primary arc</span>
          <select
            value={selectedLensId ?? ""}
            onChange={(e) => {
              setSelectedLensId(e.target.value || null);
              setFocusMode(true);
            }}
            className="max-w-[20rem] rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-300"
          >
            {orderedLenses.map((lens) => (
              <option key={lens.id} value={lens.id}>
                {lens.title}
              </option>
            ))}
          </select>

          <button
            onClick={() => setFocusMode(false)}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-300 hover:border-zinc-500"
          >
            show all arcs
          </button>

          <span className="text-zinc-500">density</span>
          <select
            value={densityMode}
            onChange={(e) => setDensityMode(asDensityMode(e.target.value))}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-300"
            title="Compact packs more data; Roomy spreads lanes to reduce visual collisions"
          >
            <option value="compact">compact</option>
            <option value="balanced">balanced</option>
            <option value="roomy">roomy</option>
          </select>

          <span className="text-zinc-500">era</span>
          <select
            value={eraMode}
            onChange={(e) => setEraMode(asEraMode(e.target.value))}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-300"
            title="Filter arcs by period to reduce clutter"
          >
            {ERA_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>

          <span className="ml-auto text-zinc-500">{summaryText}</span>
        </div>

        <p>
          Stations are lane-packed to prevent overlap; track order is auto-optimized for interchange readability. In
          focus mode, only the selected arc plus related arcs are shown. Arc, focus, density, and era are persisted in the
          URL for shareable review links.
        </p>
      </div>

      <div className="overflow-auto border border-zinc-800 bg-zinc-950">
        <svg width={totalW} height={totalH} className="block">
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
              <text x={d.x} y={TOP_PAD - 16} fontSize={10} fill="#71717a" textAnchor="middle">
                {d.label}
              </text>
              <text x={d.x} y={totalH - BOTTOM_PAD + 22} fontSize={10} fill="#71717a" textAnchor="middle">
                {d.label}
              </text>
            </g>
          ))}

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

          {lensTracks.map((track) => {
            const { lens, baseY, stations } = track;
            const color = arcLineColor(lens.id);
            const focused = selectedLensId === lens.id;
            const dimmed = hoverLensId !== null && hoverLensId !== lens.id;
            const opacity = dimmed ? 0.2 : 1;

            return (
              <g key={lens.id} opacity={opacity}>
                <line
                  x1={HEADER_W + 20}
                  y1={baseY}
                  x2={totalW - 20}
                  y2={baseY}
                  stroke="#3f3f46"
                  strokeWidth={1}
                />

                <rect
                  x={4}
                  y={baseY - 14}
                  width={HEADER_W - 16}
                  height={28}
                  fill="#18181b"
                  stroke={color}
                  strokeWidth={hoverLensId === lens.id || focused ? 2 : 0}
                  rx={2}
                  onMouseEnter={() => setHoverLensId(lens.id)}
                  onMouseLeave={() => setHoverLensId(null)}
                  onClick={() => {
                    setSelectedLensId(lens.id);
                    setFocusMode(true);
                  }}
                  style={{ cursor: "pointer" }}
                />
                <text
                  x={14}
                  y={baseY - 1}
                  fontSize={11}
                  fontWeight={focused ? 700 : 600}
                  fill={color}
                  pointerEvents="none"
                >
                  ━━ {lens.title.length > 32 ? `${lens.title.slice(0, 30)}...` : lens.title}
                </text>
                <text x={14} y={baseY + 11} fontSize={9} fill="#71717a" pointerEvents="none">
                  {stations.length} stations · {lens.id}
                </text>

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

                {stations.map((station) => {
                  const { node, x, y } = station;
                  const lensCount = lensesByNodeAll.get(node.id)?.length ?? 1;
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
                          cy={y}
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

          {Array.from(lensesByNodeVisible.entries()).map(([nodeId, lensIds]) => {
            if (lensIds.length < 2) return null;
            const node = nodeById.get(nodeId);
            if (!node) return null;

            const positions = stationPositionsByNode.get(nodeId) ?? [];
            if (positions.length < 2) return null;

            const shouldDraw = hoverNodeId
              ? hoverNodeId === nodeId
              : focusMode
                ? lensIds.length >= 5
                : lensIds.length >= 4;
            if (!shouldDraw) return null;

            const sorted = [...positions].sort((a, b) => a.y - b.y);
            const top = sorted[0];
            const bottom = sorted[sorted.length - 1];
            const x = top.x;
            const offset = (nodeId.charCodeAt(0) % 2 === 0 ? 1 : -1) * 4;
            const cx = x + offset;
            const cy = (top.y + bottom.y) / 2;
            const sel = hoverNodeId === nodeId;

            return (
              <path
                key={`xc-${nodeId}`}
                d={`M ${x},${top.y} Q ${cx},${cy} ${x},${bottom.y}`}
                fill="none"
                stroke="#fff"
                strokeWidth={sel ? 2.5 : 1.2}
                opacity={sel ? 0.9 : focusMode ? 0.25 : 0.35}
                pointerEvents="none"
              />
            );
          })}

          {semanticLabels.map((entry) => {
            const labelX = Math.max(HEADER_W + 20, Math.min(totalW - 20, entry.x));
            return (
              <text
                key={`lbl-${entry.nodeId}`}
                x={labelX}
                y={entry.y - 12}
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
                {entry.name.length > 22 ? `${entry.name.slice(0, 20)}...` : entry.name}
              </text>
            );
          })}

          {hoverNodeId &&
            (() => {
              const node = nodeById.get(hoverNodeId);
              if (!node) return null;
              const positions = stationPositionsByNode.get(hoverNodeId) ?? [];
              if (positions.length === 0) return null;

              const top = positions.reduce((acc, p) => (p.y < acc.y ? p : acc), positions[0]);
              const lensIds = lensesByNodeVisible.get(hoverNodeId) ?? [];
              const tooltipW = Math.max(140, node.name.length * 7 + 16);
              const tooltipX = Math.min(
                totalW - tooltipW - 8,
                Math.max(HEADER_W + 8, top.x + 12),
              );
              const tooltipY = Math.max(8, Math.min(totalH - 44, top.y - 28));

              return (
                <g pointerEvents="none">
                  <rect
                    x={tooltipX}
                    y={tooltipY}
                    width={tooltipW}
                    height={36}
                    fill="#18181b"
                    stroke="#52525b"
                    rx={2}
                  />
                  <text x={tooltipX + 8} y={tooltipY + 14} fontSize={11} fontWeight={600} fill="#fafafa">
                    {node.name}
                  </text>
                  <text x={tooltipX + 8} y={tooltipY + 26} fontSize={9} fill="#a1a1aa">
                    {node.type} · {node.date ?? "undated"} · on {lensIds.length} arc
                    {lensIds.length === 1 ? "" : "s"}
                  </text>
                </g>
              );
            })()}
        </svg>
      </div>

      {lensTracks.length === 0 && (
        <div className="rounded border border-zinc-800 bg-zinc-950 px-3 py-4 text-xs font-mono text-zinc-400">
          No stations match this filter combination. Try switching era or turning off focus mode.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 px-1 text-xs font-mono text-zinc-500">
        <span>lines{focusMode ? " (focused set)" : ""}:</span>
        {lensTracks.map((track) => (
          <button
            key={track.lens.id}
            onMouseEnter={() => setHoverLensId(track.lens.id)}
            onMouseLeave={() => setHoverLensId(null)}
            onClick={() => {
              setSelectedLensId(track.lens.id);
              setFocusMode(true);
            }}
            className={`rounded border px-2 py-0.5 ${selectedLensId === track.lens.id ? "border-zinc-100 text-zinc-100" : "border-zinc-700 hover:border-zinc-500"}`}
          >
            <span className="mr-1 inline-block h-1.5 w-4 align-middle" style={{ background: arcLineColor(track.lens.id) }} />
            {track.lens.id}
          </button>
        ))}
      </div>
    </div>
  );
}
