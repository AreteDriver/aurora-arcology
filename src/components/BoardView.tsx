"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { Node, Connection, Source } from "@db/schema";
import NodeInspector from "./NodeInspector";
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
    const radiusOf = (id: string) =>
      Math.min(14, 4 + Math.sqrt(degree.get(id) ?? 0) * 1.6);
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

    // Edges
    const link = g
      .append("g")
      .attr("stroke", "#52525b")
      .selectAll("line")
      .data(simLinks)
      .join("line")
      .attr("stroke-width", (d) => Math.max(0.5, d.confidence * 2))
      .attr("stroke-opacity", (d) => (d.confidence < 0.5 ? 0.2 : 0.5))
      .attr("stroke-dasharray", (d) => (d.confidence < 0.5 ? "3,3" : null));

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
      .on("click", (_, d) => setSelectedId(d.id))
      .on("mouseover", function () {
        d3.select(this).select("text.node-label").attr("display", null);
      })
      .on("mouseout", function (_, d) {
        if (currentZoom < 1.5 && !isHub(d.id) && d.id !== selectedId) {
          d3.select(this).select("text.node-label").attr("display", "none");
        }
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
      .attr("fill", (d) => TYPE_COLOR[d.type] ?? "#888")
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

    if (clusterByType) {
      sim
        .force("clusterX", d3.forceX<SimNode>(anchorX).strength(0.08))
        .force("clusterY", d3.forceY<SimNode>(anchorY).strength(0.08));
    }

    sim.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as SimNode).x ?? 0)
        .attr("y1", (d) => (d.source as SimNode).y ?? 0)
        .attr("x2", (d) => (d.target as SimNode).x ?? 0)
        .attr("y2", (d) => (d.target as SimNode).y ?? 0);
      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      sim.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, clusterByType]);

  // Selection highlight — imperative DOM update, no layout disturbance.
  // Recompute degree-based base radius so the highlight bumps it up by a
  // consistent amount instead of overwriting it.
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
      Math.min(14, 4 + Math.sqrt(degree.get(id) ?? 0) * 1.6);

    svg.selectAll<SVGGElement, SimNode>("g[data-node-id]").each(function (d) {
      const isSelected = d?.id === selectedId;
      const r = baseR(d.id) + (isSelected ? 4 : 0);
      d3.select(this)
        .select("circle")
        .attr("r", r)
        .attr("stroke", isSelected ? "#fff" : "#1f1f23")
        .attr("stroke-width", isSelected ? 2.5 : 1);
      // Ensure the selected node always shows its label
      if (isSelected) {
        d3.select(this).select("text.node-label").attr("display", null);
      }
    });
  }, [selectedId, scopeKey, visible.nodes, visible.conns]);

  const selected = selectedId ? nodeById.get(selectedId) ?? null : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 h-[calc(100vh-160px)]">
      <div className="flex flex-col gap-2">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono border border-zinc-800 p-2">
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
            <span className="text-zinc-500">hops</span>
            <select
              value={hops}
              onChange={(e) => setHops(parseInt(e.target.value))}
              className="bg-zinc-900 border border-zinc-700 px-1 py-0.5"
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

          <button
            onClick={() => setClusterByType((v) => !v)}
            className={`px-1.5 py-0.5 border ${clusterByType ? "bg-zinc-100 text-black border-zinc-100" : "bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-zinc-500"}`}
            title="Pull same-type nodes toward shared anchor regions"
          >
            cluster
          </button>

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

          <div className="flex items-center gap-1.5 flex-wrap">
            {allTypes.map((t) => {
              const hidden = hiddenTypes.has(t);
              return (
                <button
                  key={t}
                  onClick={() => {
                    const next = new Set(hiddenTypes);
                    hidden ? next.delete(t) : next.add(t);
                    setHiddenTypes(next);
                  }}
                  className="px-1.5 py-0.5 border"
                  style={{
                    borderColor: TYPE_COLOR[t] ?? "#888",
                    background: hidden ? "transparent" : TYPE_COLOR[t] ?? "#888",
                    color: hidden ? TYPE_COLOR[t] ?? "#888" : "#000",
                    opacity: hidden ? 0.5 : 1,
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>

          <div className="ml-auto text-zinc-500">
            {visible.nodes.length} / {nodes.length} nodes · {visible.conns.length} /{" "}
            {connections.length} edges
          </div>
        </div>

        {/* SVG canvas */}
        <svg
          ref={svgRef}
          className="border border-zinc-800 bg-zinc-950 flex-1 w-full"
          style={{ minHeight: 500 }}
        />
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
