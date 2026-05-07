#!/usr/bin/env tsx
/**
 * Synthesis polisher — curator-side CLI that rewrites a deterministic
 * lens synthesis as a flowing stream-prep script via Anthropic API.
 *
 * Outputs land in data/syntheses/<lens-id>.md, committed to the repo.
 * The static deploy reads them at build time. Curator reviews each
 * polished output before publishing.
 *
 * Provenance: input is curator-authored fields (brief, master_summary,
 * lens description). Output is paraphrase-of-paraphrase, tagged
 * `llm-rendered-prose` per spec §5.
 *
 * Cost: ~$0.02 per lens × 13 lenses = ~$0.30 per full pass with
 * Sonnet 4.6.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... pnpm synthesize:polish
 *   ANTHROPIC_API_KEY=sk-... pnpm synthesize:polish --lens warpath-current
 *   pnpm synthesize:polish --dry-run                 # build + show prompts, no API call
 */
import Anthropic from "@anthropic-ai/sdk";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { LENSES, lensById } from "../src/data/lenses";
import { buildSynthesis, renderMarkdown } from "../src/lib/synthesis";

const DB_PATH = process.env.DATABASE_URL ?? path.resolve("data/aurora.db");
const OUT_DIR = path.resolve("data/syntheses");

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const has = (name: string) => args.includes(name);

const onlyLens = flag("--lens");
const dryRun = has("--dry-run");

// ---------------------------------------------------------------------------
// System prompt — kept tight and constrained. Cached across the per-lens loop.
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are a synthesis polisher for an investigation-board project covering EVE Online lore. The user provides a deterministic, curator-authored research outline organized by entity type and chronologically ordered, with source citations. Your job is to rewrite it as a clean stream-prep script.

CONSTRAINTS:
- Every factual claim in your output must come from the input. Do NOT introduce new facts, events, characters, or relationships.
- Preserve all source citations exactly as given. Each entity that has citations in the input must keep those citations on the corresponding claim in your output.
- Paraphrase the curator's prose for flow. Don't extend, embellish, or invent context.
- Keep the section structure (Events / People / Organizations / Factions / Places / Phenomena / Concepts / Artifacts) but you may merge subsections if the prose flows better.
- Output format: Markdown. Use ## for section headers, ### for entity headers. Inline source links stay as Markdown links.
- Do not add a hook, conclusion, summary, framing, or invented commentary.
- Do not invent dates, names, or relationships. If the input is silent on something, leave it silent.
- The deployed product tags your output as 'llm-rendered-prose'. Curator review is required before publish.

Your output is the polished Markdown only — no preamble, no closing remarks.`;

const CURATOR = "ARETE";

// ---------------------------------------------------------------------------
// Build deterministic synthesis for a lens (re-uses the existing renderer)
// ---------------------------------------------------------------------------
interface NodeSourceRow { node_id: string; source_id: string; }
interface SourceRow {
  id: string; type: string; publisher: string; title: string;
  url: string | null; date: string | null;
  excerpt: string | null; license_tier: string;
  canonicity: string | null; local_path: string | null;
  created_at: string;
}

function buildLensMarkdown(lensId: string): string | null {
  const lens = lensById(lensId);
  if (!lens) return null;

  const db = new Database(DB_PATH, { readonly: true });
  try {
    if (lens.nodeIds.length === 0) return null;
    const placeholders = lens.nodeIds.map(() => "?").join(",");
    const nodes = db
      .prepare(`SELECT * FROM nodes WHERE id IN (${placeholders})`)
      .all(...lens.nodeIds) as Array<{
        id: string; name: string; type: string; brief: string | null;
        master_summary: string | null; date: string | null;
        canonicity: string; created_by: string; created_at: string;
      }>;
    const idSet = new Set(lens.nodeIds);
    const conns = db
      .prepare(`SELECT * FROM connections`)
      .all() as Array<{
        id: string; src_node_id: string; tgt_node_id: string;
        relation_type: string; claim: string | null; confidence: number;
        curator: string; drawn_at: string; created_at: string;
      }>;
    const visibleConns = conns.filter((c) => idSet.has(c.src_node_id) && idSet.has(c.tgt_node_id));

    const nsRows = db
      .prepare(`SELECT node_id, source_id FROM node_sources WHERE node_id IN (${placeholders})`)
      .all(...lens.nodeIds) as NodeSourceRow[];
    const sourceIds = Array.from(new Set(nsRows.map((r) => r.source_id)));
    const sources = sourceIds.length
      ? db
          .prepare(`SELECT * FROM sources WHERE id IN (${sourceIds.map(() => "?").join(",")})`)
          .all(...sourceIds) as SourceRow[]
      : [];
    const sourceById = new Map(sources.map((s) => [s.id, s]));
    const citationsByNode: Record<string, SourceRow[]> = {};
    for (const r of nsRows) {
      const s = sourceById.get(r.source_id);
      if (!s) continue;
      (citationsByNode[r.node_id] ??= []).push(s);
    }

    // Adapt to Drizzle-shaped types expected by buildSynthesis. The shape
    // is structurally identical; just rename fields.
    const drizzleNodes = nodes.map((n) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      brief: n.brief,
      masterSummary: n.master_summary,
      date: n.date,
      canonicity: n.canonicity,
      createdBy: n.created_by,
      createdAt: n.created_at,
    }));
    const drizzleConns = visibleConns.map((c) => ({
      id: c.id,
      srcNodeId: c.src_node_id,
      tgtNodeId: c.tgt_node_id,
      relationType: c.relation_type,
      claim: c.claim,
      confidence: c.confidence,
      curator: c.curator,
      drawnAt: c.drawn_at,
      createdAt: c.created_at,
    }));
    const drizzleCitations: Record<string, Array<typeof drizzleNodes[0] & { url: string | null; title: string; date: string | null; type: string; publisher: string; excerpt: string | null; licenseTier: string; canonicity: string | null; localPath: string | null }>> = {};
    // Actually buildSynthesis expects Source[] from db schema. Just cast.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const citationsForBuild: Record<string, any[]> = {};
    for (const [k, list] of Object.entries(citationsByNode)) {
      citationsForBuild[k] = list.map((s) => ({
        id: s.id, title: s.title, type: s.type, publisher: s.publisher,
        url: s.url, date: s.date, excerpt: s.excerpt,
        licenseTier: s.license_tier, canonicity: s.canonicity,
        localPath: s.local_path, createdAt: s.created_at,
      }));
    }

    const doc = buildSynthesis({
      lensId: lens.id,
      lensTitle: lens.title,
      lensDescription: lens.description,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nodes: drizzleNodes as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      connections: drizzleConns as any,
      citationsByNode: citationsForBuild,
    });
    void drizzleCitations;
    void CURATOR;
    return renderMarkdown(doc);
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  const targets = onlyLens
    ? LENSES.filter((l) => l.id === onlyLens)
    : LENSES;
  if (targets.length === 0) {
    console.error(`No lens matches '${onlyLens}'`);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  if (!process.env.ANTHROPIC_API_KEY && !dryRun) {
    console.error("ANTHROPIC_API_KEY not set. Either export it or pass --dry-run.");
    process.exit(1);
  }

  const client = dryRun ? null : new Anthropic();

  let totalIn = 0;
  let totalOut = 0;
  let totalCacheRead = 0;

  for (const lens of targets) {
    process.stdout.write(`  ${lens.id} … `);
    const md = buildLensMarkdown(lens.id);
    if (!md) {
      console.log("skip (no nodes)");
      continue;
    }

    if (dryRun) {
      console.log(`would polish ${md.length.toLocaleString()} chars`);
      continue;
    }

    const resp = await client!.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: md }],
    });

    const polished = resp.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const outPath = path.join(OUT_DIR, `${lens.id}.md`);
    fs.writeFileSync(outPath, polished);

    const u = resp.usage;
    totalIn += u.input_tokens;
    totalOut += u.output_tokens;
    totalCacheRead += u.cache_read_input_tokens ?? 0;
    console.log(
      `${polished.length.toLocaleString()} chars · in=${u.input_tokens} out=${u.output_tokens}` +
        (u.cache_read_input_tokens ? ` cache_read=${u.cache_read_input_tokens}` : "") +
        (u.cache_creation_input_tokens ? ` cache_create=${u.cache_creation_input_tokens}` : ""),
    );
  }

  if (!dryRun) {
    console.log("");
    console.log(`Total: in=${totalIn} out=${totalOut} cache_read=${totalCacheRead}`);
    console.log(`Outputs: ${path.relative(process.cwd(), OUT_DIR)}/`);
    console.log("Review each file, then commit + push to deploy.");
  }
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
