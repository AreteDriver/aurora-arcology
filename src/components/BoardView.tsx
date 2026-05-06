"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { Node, Connection } from "@db/schema";
import NodeInspector from "./NodeInspector";

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
}

interface SimNode extends Node, d3.SimulationNodeDatum {}
interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  id: string;
  relationType: string;
  confidence: number;
  claim: string | null;
}

export default function BoardView({ nodes, connections }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hops, setHops] = useState(0); // 0 = show all
  const [minConfidence, setMinConfidence] = useState(0); // 0 = show all incl. tinfoil
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());

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

  // Visible-set computation: type filter + confidence + n-hop neighborhood
  const visible = useMemo(() => {
    let visibleNodeIds = new Set(
      nodes.filter((n) => !hiddenTypes.has(n.type)).map((n) => n.id),
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
  }, [nodes, connections, hiddenTypes, minConfidence, selectedId, hops, adjacency]);

  // D3 force simulation — runs once per visible-set change
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

    const g = svg.append("g");

    // Zoom / pan
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => g.attr("transform", event.transform.toString()));
    svg.call(zoom);

    // Edges
    const link = g
      .append("g")
      .attr("stroke", "#52525b")
      .selectAll("line")
      .data(simLinks)
      .join("line")
      .attr("stroke-width", (d) => Math.max(0.5, d.confidence * 2))
      .attr("stroke-opacity", (d) => (d.confidence < 0.5 ? 0.25 : 0.6))
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
      .on("click", (_, d) => setSelectedId(d.id))
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
      .attr("r", (d) => (d.id === selectedId ? 10 : 6))
      .attr("fill", (d) => TYPE_COLOR[d.type] ?? "#888")
      .attr("stroke", (d) => (d.id === selectedId ? "#fff" : "#1f1f23"))
      .attr("stroke-width", (d) => (d.id === selectedId ? 2 : 1));

    node
      .append("text")
      .attr("dx", 9)
      .attr("dy", 3)
      .attr("font-size", 10)
      .attr("fill", "#d4d4d8")
      .attr("pointer-events", "none")
      .text((d) => d.name);

    node.append("title").text((d) => `${d.type}: ${d.name}`);

    const sim = d3
      .forceSimulation(simNodes)
      .force(
        "link",
        d3.forceLink<SimNode, SimLink>(simLinks).id((d) => d.id).distance(80).strength(0.4),
      )
      .force("charge", d3.forceManyBody().strength(-180))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide(14))
      .on("tick", () => {
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
  }, [visible, selectedId]);

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
        onSelect={setSelectedId}
        onClear={() => setSelectedId(null)}
      />
    </div>
  );
}
