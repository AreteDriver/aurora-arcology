"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { Node, Connection, Source } from "@db/schema";
import NodeInspector from "./NodeInspector";
import { LENSES, type Lens } from "@/data/lenses";
import { nodeTypeColor, nodeTypeTextColor } from "@/lib/palette";
import { relationColor, RELATION_LEGEND } from "@/lib/graph-palette";

interface Props {
  nodes: Node[];
  connections: Connection[];
  citationsByNode?: Record<string, Source[]>;
}

interface SimNode extends Node, d3.SimulationNodeDatum {}
interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  id: string;
  relationType: string;
  confidence: number;
  claim: string | null;
}

export default function BoardView({ nodes, connections, citationsByNode = {} }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [hops, setHops] = useState(0); // 0 = show all
  const [minConfidence, setMinConfidence] = useState(0); // 0 = show all incl. tinfoil
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [lensId, setLensId] = useState<string | null>(null);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const allTypes = useMemo(
    () => Array.from(new Set(nodes.map((n) => n.type))).sort(),
    [nodes],
  );

  // Build adjacency for n-hop filtering
  const adjacency = useMemo(() => {
    const adj = new Map<string, Set<string>>();
    for (const n of nodes) adj.set(n.id, new Set());
    for (const c of connections) {
      adj.get(c.srcNodeId)?.add(c.tgtNodeId);
      adj.get(c.tgtNodeId)?.add(c.srcNodeId);
    }
    return adj;
  }, [nodes, connections]);

  // Visible-set computation: lens + type filter + confidence + n-hop neighborhood
  const lens: Lens | null = useMemo(
    () => (lensId ? LENSES.find((l) => l.id === lensId) ?? null : null),
    [lensId],
  );

  const visible = useMemo(() => {
    const lensSet = lens ? new Set(lens.nodeIds) : null;
    let visibleNodeIds = new Set(
      nodes
        .filter((n) => !hiddenTypes.has(n.type))
        .filter((n) => !lensSet || lensSet.has(n.id))
        .map((n) => n.id),
    );
    let visibleConns = connections.filter(
      (c) =>
        c.confidence >= minConfidence &&
        visibleNodeIds.has(c.srcNodeId) &&
        visibleNodeIds.has(c.tgtNodeId),
    );

    if (selectedId && hops > 0) {
      const inHood = new Set<string>([selectedId]);
      let frontier = new Set<string>([selectedId]);
      for (let h = 0; h < hops; h++) {
        const next = new Set<string>();
        for (const id of frontier) {
          for (const nb of adjacency.get(id) ?? []) {
            if (visibleNodeIds.has(nb) && !inHood.has(nb)) {
              inHood.add(nb);
              next.add(nb);
            }
          }
        }
        frontier = next;
      }
      visibleNodeIds = inHood;
      visibleConns = visibleConns.filter(
        (c) => visibleNodeIds.has(c.srcNodeId) && visibleNodeIds.has(c.tgtNodeId),
      );
    }

    return {
      nodes: nodes.filter((n) => visibleNodeIds.has(n.id)),
      conns: visibleConns,
    };
  }, [nodes, connections, hiddenTypes, minConfidence, selectedId, hops, adjacency, lens]);

  // Stable scope key — sim only rebuilds when the actual visible set changes,
  // not when selection alone changes. Prevents the D3 layout from spinning
  // every time the user clicks a node.
  const scopeKey = useMemo(
    () =>
      visible.nodes.map((n) => n.id).join("|") + ";;" + visible.conns.map((c) => c.id).join("|"),
    [visible],
  );

  // Cluster toggle: when on, same-type nodes are pulled toward shared anchors
  // so the eye can read regions instead of one undifferentiated cloud.
  const [clusterByType, setClusterByType] = useState(true);
  // Subway-style toggle: snap nodes to a grid + render edges as orthogonal
  // L-shapes. The closest the force layout gets to a transit-map aesthetic.
  const [subwayMode, setSubwayMode] = useState(false);

  // D3 force simulation — runs once per visible-set change OR cluster toggle.
  // Deliberately does NOT depend on selectedId; a separate effect below
  // updates highlight state imperatively without rebuilding the layout.
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth || 800;
    const height = svgRef.current.clientHeight || 600;

    const simNodes: SimNode[] = visible.nodes.map((n) => ({ ...n }));
    const simLinks: SimLink[] = visible.conns.map((c) => ({
      id: c.id,
      source: c.srcNodeId,
      target: c.tgtNodeId,
      relationType: c.relationType,
      confidence: c.confidence,
      claim: c.claim,
    }));

    // Degree per node (visual hierarchy: hubs render larger + always-labeled)
    const degree = new Map<string, number>();
    for (const n of simNodes) degree.set(n.id, 0);
    for (const c of simLinks) {
      const s = typeof c.source === "string" ? c.source : (c.source as SimNode).id;
      const t = typeof c.target === "string" ? c.target : (c.target as SimNode).id;
      degree.set(s, (degree.get(s) ?? 0) + 1);
      degree.set(t, (degree.get(t) ?? 0) + 1);
    }
    // Steeper hub scale — sub-linear (degree^0.65) so the top hubs (CONCORD
    // with ~17 incident edges) read as visibly bigger than a 4-edge node.
    const radiusOf = (id: string) =>
      Math.min(22, 4 + Math.pow(degree.get(id) ?? 0, 0.65) * 2);
    const isHub = (id: string) => (degree.get(id) ?? 0) >= 4;

    // Type-cluster anchors — 4x2 grid offset from canvas center. Strength is
    // moderate so the simulation still respects edges; just nudges same-type
    // nodes into shared regions for legibility.
    const TYPE_GRID: Record<string, [number, number]> = {
      Event:        [-0.30, -0.30],
      Person:       [-0.10, -0.30],
      Organization: [ 0.20, -0.30],
      Faction:      [ 0.35,  0.00],
      Place:        [ 0.20,  0.30],
      Phenomenon:   [-0.10,  0.30],
      Concept:      [-0.30,  0.30],
      Artifact:     [-0.40,  0.00],
    };
    const anchorX = (n: SimNode): number => {
      const off = TYPE_GRID[n.type]?.[0] ?? 0;
      return width / 2 + off * width;
    };
    const anchorY = (n: SimNode): number => {
      const off = TYPE_GRID[n.type]?.[1] ?? 0;
      return height / 2 + off * height;
    };

    const g = svg.append("g");

    // Zoom / pan — also drives label visibility (below).
    let currentZoom = 1;
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform.toString());
        currentZoom = event.transform.k;
        g.selectAll<SVGTextElement, SimNode>("text.node-label")
          .attr("display", (d) =>
            currentZoom >= 1.5 || isHub(d.id) || d.id === selectedId ? null : "none",
          );
      });
    svg.call(zoom);

    // Edges — always <path> now; the d attribute switches between curved
    // bezier (default), orthogonal L-shape (subway), and lets edges
    // visually separate when many share endpoints.
    const link = g
      .append("g")
      .attr("fill", "none")
      .selectAll<SVGPathElement, SimLink>("path")
      .data(simLinks)
      .join("path")
      .attr("stroke", (d) => relationColor(d.relationType))
      .attr("stroke-width", (d) =>
        subwayMode ? Math.max(2.5, d.confidence * 4.5) : Math.max(1, d.confidence * 2.5),
      )
      .attr("stroke-opacity", (d) => (d.confidence < 0.5 ? 0.25 : subwayMode ? 0.75 : 0.65))
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")
      .attr("stroke-dasharray", (d) => (d.confidence < 0.5 ? "3,3" : null))
      .attr("data-src", (d) => (typeof d.source === "string" ? d.source : (d.source as SimNode).id))
      .attr("data-tgt", (d) => (typeof d.target === "string" ? d.target : (d.target as SimNode).id));

    link.append("title").text((d) =>
      `${d.relationType}  (${d.confidence.toFixed(2)})${d.claim ? `\n${d.claim}` : ""}`,
    );

    // Nodes
    const node = g
      .append("g")
      .selectAll<SVGGElement, SimNode>("g")
      .data(simNodes)
      .join("g")
      .attr("cursor", "pointer")
      .attr("data-node-id", (d) => d.id)
      .on("click", (event, d) => {
        event.stopPropagation();
        setSelectedId(d.id);
      })
      .on("mouseover", function (_, d) {
        d3.select(this).select("text.node-label").attr("display", null);
        setHoverId(d.id);
      })
      .on("mouseout", function (_, d) {
        if (currentZoom < 1.5 && !isHub(d.id) && d.id !== selectedId) {
          d3.select(this).select("text.node-label").attr("display", "none");
        }
        setHoverId(null);
      })
      .call(
        d3
          .drag<SVGGElement, SimNode>()
          .on("start", (event, d) => {
            if (!event.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) sim.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      );

    node
      .append("circle")
      .attr("r", (d) => radiusOf(d.id))
      .attr("fill", (d) => nodeTypeColor(d.type))
      .attr("stroke", "#1f1f23")
      .attr("stroke-width", 1);

    node
      .append("text")
      .attr("class", "node-label")
      .attr("dx", (d) => radiusOf(d.id) + 3)
      .attr("dy", 3)
      .attr("font-size", (d) => (isHub(d.id) ? 11 : 10))
      .attr("font-weight", (d) => (isHub(d.id) ? "600" : "400"))
      .attr("fill", "#d4d4d8")
      .attr("pointer-events", "none")
      .attr("display", (d) => (isHub(d.id) ? null : "none"))
      .text((d) => d.name);

    node.append("title").text((d) => `${d.type}: ${d.name}`);

    const sim = d3
      .forceSimulation(simNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(140)
          .strength(0.5),
      )
      .force("charge", d3.forceManyBody().strength(-360))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collide",
        d3.forceCollide<SimNode>().radius((d) => radiusOf(d.id) + 8),
      );

    // Auto-weaken cluster force when many edges cross type boundaries —
    // otherwise the type-anchor pull fights the relationship gradient and
    // edges have to stretch across regions. Below 50% cross-type edges,
    // strong cluster (0.08) wins; above, weaken to 0.03.
    if (clusterByType) {
      let crossType = 0;
      for (const c of simLinks) {
        const s = typeof c.source === "string" ? simNodes.find((n) => n.id === c.source) : (c.source as SimNode);
        const t = typeof c.target === "string" ? simNodes.find((n) => n.id === c.target) : (c.target as SimNode);
        if (s && t && s.type !== t.type) crossType++;
      }
      const crossRatio = simLinks.length > 0 ? crossType / simLinks.length : 0;
      const clusterStrength = crossRatio > 0.5 ? 0.03 : 0.08;
      sim
        .force("clusterX", d3.forceX<SimNode>(anchorX).strength(clusterStrength))
        .force("clusterY", d3.forceY<SimNode>(anchorY).strength(clusterStrength));
    }

    const GRID = 40;
    const snap = (v: number) => Math.round(v / GRID) * GRID;

    sim.on("tick", () => {
      link.attr("d", (d) => {
        const sx0 = (d.source as SimNode).x ?? 0;
        const sy0 = (d.source as SimNode).y ?? 0;
        const tx0 = (d.target as SimNode).x ?? 0;
        const ty0 = (d.target as SimNode).y ?? 0;
        if (subwayMode) {
          const sx = snap(sx0), sy = snap(sy0);
          const tx = snap(tx0), ty = snap(ty0);
          const dx = Math.abs(tx - sx);
          const dy = Math.abs(ty - sy);
          if (dx >= dy) return `M ${sx},${sy} L ${tx},${sy} L ${tx},${ty}`;
          return `M ${sx},${sy} L ${sx},${ty} L ${tx},${ty}`;
        }
        // Curved bezier — perpendicular offset gives parallel edges visual
        // separation and reduces the hairball density. The offset direction
        // is consistent (rotate +90° from edge direction), so edges in the
        // same direction curve the same way.
        const dx = tx0 - sx0;
        const dy = ty0 - sy0;
        const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const offset = Math.min(28, len * 0.14);
        const cx = (sx0 + tx0) / 2 - (dy / len) * offset;
        const cy = (sy0 + ty0) / 2 + (dx / len) * offset;
        return `M ${sx0},${sy0} Q ${cx},${cy} ${tx0},${ty0}`;
      });
      if (subwayMode) {
        node.attr(
          "transform",
          (d) => `translate(${snap(d.x ?? 0)},${snap(d.y ?? 0)})`,
        );
      } else {
        node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
      }
    });

    return () => {
      sim.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, clusterByType, subwayMode]);

  // Selection highlight + hover-fade — both imperative DOM updates, no layout
  // disturbance. The fade dims everything outside the focus node's 1-hop
  // neighborhood to ~15% opacity so a single relationship is traceable
  // even at 200 nodes / 368 edges.
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    const degree = new Map<string, number>();
    for (const n of visible.nodes) degree.set(n.id, 0);
    for (const c of visible.conns) {
      degree.set(c.srcNodeId, (degree.get(c.srcNodeId) ?? 0) + 1);
      degree.set(c.tgtNodeId, (degree.get(c.tgtNodeId) ?? 0) + 1);
    }
    const baseR = (id: string) =>
      Math.min(22, 4 + Math.pow(degree.get(id) ?? 0, 0.65) * 2);

    // Focus = hover (transient) ∪ selected (sticky). Hover wins when both
    // present so cursor preview is always responsive.
    const focusId = hoverId ?? selectedId;
    const inFocus = new Set<string>();
    if (focusId) {
      inFocus.add(focusId);
      for (const c of visible.conns) {
        if (c.srcNodeId === focusId) inFocus.add(c.tgtNodeId);
        if (c.tgtNodeId === focusId) inFocus.add(c.srcNodeId);
      }
    }

    // Node opacity + selection ring
    svg.selectAll<SVGGElement, SimNode>("g[data-node-id]").each(function (d) {
      const isSelected = d?.id === selectedId;
      const r = baseR(d.id) + (isSelected ? 4 : 0);
      const dimmed = focusId !== null && !inFocus.has(d.id);
      d3.select(this)
        .attr("opacity", dimmed ? 0.15 : 1)
        .select("circle")
        .attr("r", r)
        .attr("stroke", isSelected ? "#fff" : "#1f1f23")
        .attr("stroke-width", isSelected ? 2.5 : 1);
      if (isSelected) {
        d3.select(this).select("text.node-label").attr("display", null);
      }
    });

    // Edge opacity — edges incident to focus stay visible, others dim hard
    svg.selectAll<SVGElement, SimLink>("[data-src]").attr("opacity", function () {
      if (!focusId) return 1;
      const s = (this as Element).getAttribute("data-src");
      const t = (this as Element).getAttribute("data-tgt");
      return s === focusId || t === focusId ? 1 : 0.08;
    });
  }, [selectedId, hoverId, scopeKey, visible.nodes, visible.conns]);

  const selected = selectedId ? nodeById.get(selectedId) ?? null : null;
  const toggleClass = (active: boolean) =>
    `rounded border px-2 py-1 transition-colors ${active ? "border-zinc-100 bg-zinc-100 text-black" : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"}`;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px] lg:h-[calc(100vh-190px)]">
      <div className="flex min-h-0 flex-col gap-2">
        <div className="sticky top-2 z-20">
          <div className="rounded-md border border-zinc-800 bg-zinc-950/95 p-2 text-xs font-mono backdrop-blur supports-[backdrop-filter]:bg-zinc-950/80">
            <div className="flex flex-wrap gap-2">
              <div className="flex flex-wrap items-center gap-1.5 rounded border border-zinc-800 bg-zinc-950/70 px-2 py-1.5">
                <span className="text-[10px] uppercase tracking-wide text-zinc-500">view</span>
                <button
                  onClick={() => setClusterByType((v) => !v)}
                  className={toggleClass(clusterByType)}
                  title="Pull same-type nodes toward shared anchor regions"
                >
                  cluster
                </button>
                <button
                  onClick={() => setSubwayMode((v) => !v)}
                  className={toggleClass(subwayMode)}
                  title="Snap nodes to a 40px grid + render edges as right-angle L-shapes (transit-map aesthetic)"
                >
                  subway
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 rounded border border-zinc-800 bg-zinc-950/70 px-2 py-1.5">
                <span className="text-[10px] uppercase tracking-wide text-zinc-500">scope</span>
                <span className="text-zinc-500">hops</span>
                <select
                  value={hops}
                  onChange={(e) => setHops(parseInt(e.target.value))}
                  className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-zinc-300"
                >
                  <option value={0}>all</option>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
                {selectedId && hops > 0 && (
                  <span className="text-zinc-400">around {nodeById.get(selectedId)?.name}</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 rounded border border-zinc-800 bg-zinc-950/70 px-2 py-1.5">
                <span className="text-[10px] uppercase tracking-wide text-zinc-500">filter</span>
                <span className="text-zinc-500">conf &gt;=</span>
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

              <div className="flex flex-wrap items-center gap-1.5 rounded border border-zinc-800 bg-zinc-950/70 px-2 py-1.5">
                <span className="text-[10px] uppercase tracking-wide text-zinc-500">lens</span>
                <select
                  value={lensId ?? ""}
                  onChange={(e) => setLensId(e.target.value || null)}
                  className="max-w-[16rem] rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-zinc-300"
                  title={lens?.description ?? "Curator-authored sub-board lenses"}
                >
                  <option value="">full corpus</option>
                  {LENSES.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))}
                </select>
                {(["warpath-current", "lai-dai-vs-ishukone", "old-wars", "empyrean-age"] as const).map((lid) => {
                  const l = LENSES.find((x) => x.id === lid);
                  if (!l) return null;
                  const active = lensId === lid;
                  const label = lid === "warpath-current" ? "warpath" :
                    lid === "lai-dai-vs-ishukone" ? "axis" :
                      lid === "old-wars" ? "old wars" :
                        "empyrean";
                  return (
                    <button
                      key={lid}
                      onClick={() => setLensId(active ? null : lid)}
                      className={toggleClass(active)}
                      title={l.description}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">types</span>
              {allTypes.map((t) => {
                const hidden = hiddenTypes.has(t);
                const color = nodeTypeColor(t);
                return (
                  <button
                    key={t}
                    onClick={() => {
                      const next = new Set(hiddenTypes);
                      if (hidden) next.delete(t);
                      else next.add(t);
                      setHiddenTypes(next);
                    }}
                    className="rounded border px-1.5 py-0.5"
                    style={{
                      borderColor: color,
                      background: hidden ? "transparent" : color,
                      color: hidden ? color : nodeTypeTextColor(t),
                      opacity: hidden ? 0.5 : 1,
                    }}
                  >
                    {t}
                  </button>
                );
              })}
              <div className="text-zinc-500 sm:ml-auto">
                {visible.nodes.length} / {nodes.length} nodes · {visible.conns.length} /{" "}
                {connections.length} edges
              </div>
            </div>
          </div>
        </div>

        {/* SVG canvas */}
        <svg
          ref={svgRef}
          onClick={(e) => {
            // Click on the SVG background (not a node) releases sticky selection
            if (e.target === svgRef.current) setSelectedId(null);
          }}
          className="border border-zinc-800 bg-zinc-950 flex-1 w-full"
          style={{ minHeight: 500 }}
        />

        {/* Edge-color legend — explains the relation-category palette */}
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-zinc-500 px-1">
          <span>edges:</span>
          {RELATION_LEGEND.map((item) => (
            <span key={item.label}>
              <span
                className="inline-block w-4 h-0.5 align-middle mr-1"
                style={{ background: item.color }}
              />{" "}
              {item.label}
            </span>
          ))}
          <span className="ml-auto text-zinc-600">hover a node to isolate · click to pin · click background to release</span>
        </div>
      </div>

      <NodeInspector
        node={selected}
        nodeById={nodeById}
        connections={connections}
        citations={selected ? citationsByNode[selected.id] ?? [] : []}
        onSelect={setSelectedId}
        onClear={() => setSelectedId(null)}
      />
    </div>
  );
}
