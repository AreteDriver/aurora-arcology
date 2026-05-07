#!/usr/bin/env tsx
/**
 * Dump each lens's deterministic synthesis markdown to disk so an
 * external polisher (a Claude Code session, or any other tool) can
 * read the inputs without rebuilding them. Mirrors the input that
 * synthesize-polish.ts feeds to the Anthropic API.
 *
 * Outputs land at data/syntheses/_input/<lens-id>.md (gitignored).
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { LENSES, lensById } from "../src/data/lenses";
import { buildSynthesis, renderMarkdown } from "../src/lib/synthesis";

const DB_PATH = process.env.DATABASE_URL ?? path.resolve("data/aurora.db");
const OUT_DIR = path.resolve("data/syntheses/_input");

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
  if (!lens || lens.nodeIds.length === 0) return null;

  const db = new Database(DB_PATH, { readonly: true });
  try {
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

    const drizzleNodes = nodes.map((n) => ({
      id: n.id, name: n.name, type: n.type, brief: n.brief,
      masterSummary: n.master_summary, date: n.date,
      canonicity: n.canonicity, createdBy: n.created_by, createdAt: n.created_at,
    }));
    const drizzleConns = visibleConns.map((c) => ({
      id: c.id, srcNodeId: c.src_node_id, tgtNodeId: c.tgt_node_id,
      relationType: c.relation_type, claim: c.claim, confidence: c.confidence,
      curator: c.curator, drawnAt: c.drawn_at, createdAt: c.created_at,
    }));
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
    return renderMarkdown(doc);
  } finally {
    db.close();
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const lens of LENSES) {
  const md = buildLensMarkdown(lens.id);
  if (!md) {
    console.log(`skip ${lens.id} (no nodes)`);
    continue;
  }
  const out = path.join(OUT_DIR, `${lens.id}.md`);
  fs.writeFileSync(out, md);
  console.log(`${lens.id} → ${path.relative(process.cwd(), out)} (${md.length.toLocaleString()} chars)`);
}
