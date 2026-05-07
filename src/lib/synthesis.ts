/**
 * Deterministic synthesis renderer (spec §6 Tier 3, baseline).
 *
 * Takes a lens (node-id allowlist) and emits a structured script outline
 * organized by type and chronology. Pulls from curator-authored master_summary
 * + brief fields and the cited sources via node_sources.
 *
 * This is the baseline — no LLM call. The output is deterministic, fully
 * source-grounded, and provenance-clean (every claim traces back to a
 * curator-authored field). Curators wanting prose polish can pipe the
 * output through Claude / GPT locally; the server stays text-only.
 */
import type { Node, Connection, Source } from "@db/schema";
import { normalizeDate } from "./dates";

export type ProvenanceTag =
  | "curator-authored"
  | "source-quoted"
  | "llm-summarized-from-graph"
  | "llm-rendered-prose";

export interface SynthesisSection {
  heading: string;
  type: string;
  entries: SynthesisEntry[];
}

export interface SynthesisEntry {
  nodeId: string;
  name: string;
  type: string;
  date: string | null;
  brief: string | null;
  masterSummary: string | null;
  sources: { id: string; title: string; date: string | null; url: string | null }[];
  provenance: ProvenanceTag;
}

export interface SynthesisDoc {
  lensId: string;
  lensTitle: string;
  lensDescription: string;
  generatedAt: string;
  sections: SynthesisSection[];
  citations: { id: string; title: string; date: string | null; url: string | null; refCount: number }[];
}

const TYPE_ORDER = [
  "Event",
  "Person",
  "Organization",
  "Faction",
  "Place",
  "Phenomenon",
  "Concept",
  "Artifact",
];

interface BuildArgs {
  lensId: string;
  lensTitle: string;
  lensDescription: string;
  nodes: Node[];
  citationsByNode: Record<string, Source[]>;
  connections: Connection[];
}

export function buildSynthesis(args: BuildArgs): SynthesisDoc {
  const { lensId, lensTitle, lensDescription, nodes, citationsByNode } = args;

  // Group by type, sort within each by normalized date
  const grouped: Record<string, Node[]> = {};
  for (const n of nodes) {
    (grouped[n.type] ??= []).push(n);
  }
  for (const list of Object.values(grouped)) {
    list.sort((a, b) => {
      const da = normalizeDate(a.date);
      const db = normalizeDate(b.date);
      return da.localeCompare(db);
    });
  }

  const sections: SynthesisSection[] = TYPE_ORDER.flatMap((type) => {
    const list = grouped[type];
    if (!list || list.length === 0) return [];
    const entries: SynthesisEntry[] = list.map((n) => ({
      nodeId: n.id,
      name: n.name,
      type: n.type,
      date: n.date,
      brief: n.brief,
      masterSummary: n.masterSummary,
      sources: (citationsByNode[n.id] ?? []).map((s) => ({
        id: s.id,
        title: s.title,
        date: s.date,
        url: s.url,
      })),
      provenance: "curator-authored",
    }));
    return [{ heading: `${type}s`, type, entries }];
  });

  // Aggregate citations: list each unique source with reference count
  const refCount = new Map<string, number>();
  const sourceById = new Map<string, Source>();
  for (const list of Object.values(citationsByNode)) {
    for (const s of list) {
      refCount.set(s.id, (refCount.get(s.id) ?? 0) + 1);
      sourceById.set(s.id, s);
    }
  }
  const citations = Array.from(refCount.entries())
    .map(([id, refs]) => {
      const s = sourceById.get(id)!;
      return { id: s.id, title: s.title, date: s.date, url: s.url, refCount: refs };
    })
    .sort((a, b) => b.refCount - a.refCount || (a.date ?? "").localeCompare(b.date ?? ""));

  return {
    lensId,
    lensTitle,
    lensDescription,
    generatedAt: new Date().toISOString(),
    sections,
    citations,
  };
}

/**
 * Render the synthesis as a Markdown-flavored script outline. Suitable for
 * copy-paste into a stream-prep doc. Each entry includes its source citations
 * as inline footnotes.
 */
export function renderMarkdown(doc: SynthesisDoc): string {
  const lines: string[] = [];
  lines.push(`# ${doc.lensTitle}`);
  lines.push("");
  lines.push(`> ${doc.lensDescription}`);
  lines.push("");
  lines.push(`*Auto-generated synthesis — every claim traces to a curator-authored field. Source-grounded, no LLM. ${doc.generatedAt.slice(0, 10)}*`);
  lines.push("");

  for (const section of doc.sections) {
    lines.push(`## ${section.heading}`);
    lines.push("");
    for (const e of section.entries) {
      const dateStr = e.date ? ` *(${e.date})*` : "";
      lines.push(`### ${e.name}${dateStr}`);
      if (e.brief) lines.push(e.brief);
      if (e.masterSummary) {
        lines.push("");
        lines.push(e.masterSummary);
      }
      if (e.sources.length > 0) {
        lines.push("");
        lines.push("**Cited in:** " + e.sources.map((s) => `[${s.title}](${s.url ?? "#"})`).join(" · "));
      }
      lines.push("");
    }
  }

  if (doc.citations.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Sources cited");
    lines.push("");
    for (const c of doc.citations) {
      const dateStr = c.date ? ` (${c.date})` : "";
      lines.push(`- **${c.refCount}×** [${c.title}${dateStr}](${c.url ?? "#"})`);
    }
  }

  return lines.join("\n");
}
