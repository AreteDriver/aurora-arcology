#!/usr/bin/env tsx
/**
 * NER extraction — gazetteer-driven candidate-entity surfacing over
 * the source corpus. Spec §9 Phase 3 "auto-suggested-but-never-auto-drawn":
 * never modifies the graph, populates `suggestions` table for curator review.
 *
 * v0 strategy (Dossier ner.py Layer 1):
 *   - Build gazetteer from existing nodes (canonical name + brief)
 *   - Add canonical-name gazetteer entries (data/gazetteers/eve-canonical.json)
 *   - For each source title: word-bounded substring match against gazetteer
 *   - Emit a suggestion if a node is mentioned but not yet wired as a citation
 *
 * Future layers (deferred): regex patterns for YC dates / system names,
 * capitalized multi-word heuristic for unknown entities, TF-frequency.
 *
 *   pnpm ner:extract                    # all sources
 *   pnpm ner:extract --limit 100        # first 100 sources by date desc
 *   pnpm ner:extract --reset            # clear pending suggestions first
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DB_PATH = process.env.DATABASE_URL ?? path.resolve("data/aurora.db");
const GAZ_PATH = path.resolve("data/gazetteers/eve-canonical.json");

const args = process.argv.slice(2);
const limit = (() => {
  const i = args.indexOf("--limit");
  return i >= 0 ? parseInt(args[i + 1], 10) : 0;
})();
const reset = args.includes("--reset");

const RE_ESCAPE = /[.*+?^${}()|[\]\\]/g;
const escapeRe = (s: string) => s.replace(RE_ESCAPE, "\\$&");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

if (reset) {
  const n = db.prepare("DELETE FROM suggestions WHERE status = 'pending'").run();
  console.log(`Cleared ${n.changes} pending suggestions`);
}

// ---------------------------------------------------------------------------
// Build gazetteer: existing nodes ∪ canonical-name list. Filter out single
// short words that produce too much noise (e.g. "Jita" matches every Jita
// trade article — high recall but low signal for new-citation suggestions).
// ---------------------------------------------------------------------------
interface GazTerm {
  text: string;
  type: string;
  existingNodeId: string | null;
}

const nodeRows = db
  .prepare<[], { id: string; name: string; type: string }>(
    "SELECT id, name, type FROM nodes",
  )
  .all();

const canonicalGaz = JSON.parse(fs.readFileSync(GAZ_PATH, "utf-8")) as {
  entries: { canonical: string; type: string; variants: string[] }[];
};

const terms: GazTerm[] = [];
const seen = new Set<string>();

// Existing-node names (highest priority — direct citation candidates)
for (const n of nodeRows) {
  if (seen.has(n.name.toLowerCase())) continue;
  seen.add(n.name.toLowerCase());
  terms.push({ text: n.name, type: n.type, existingNodeId: n.id });
}

// Canonical-name gazetteer (no existing node yet — new-entity candidates)
for (const e of canonicalGaz.entries) {
  if (seen.has(e.canonical.toLowerCase())) continue;
  seen.add(e.canonical.toLowerCase());
  terms.push({ text: e.canonical, type: e.type, existingNodeId: null });
}

// Quality filter: drop terms shorter than 4 chars (too noisy) or single-token
// terms that are common English words. Multi-word terms are kept regardless.
const isMultiWord = (s: string) => /\s/.test(s) || /'/.test(s);
const qualityTerms = terms.filter(
  (t) => t.text.length >= 4 && (isMultiWord(t.text) || t.text.length >= 6),
);

console.log(`Gazetteer: ${terms.length} terms, ${qualityTerms.length} after quality filter`);

// Pre-compile regex per term for speed
const compiled = qualityTerms.map((t) => ({
  ...t,
  re: new RegExp(`(?<![A-Za-z0-9])${escapeRe(t.text)}(?![A-Za-z0-9])`, "i"),
}));

// ---------------------------------------------------------------------------
// Sources to scan: all sources, optionally limited
// ---------------------------------------------------------------------------
const sourceRows = limit
  ? db
      .prepare<[number], { id: string; title: string; excerpt: string | null }>(
        "SELECT id, title, COALESCE(excerpt, '') as excerpt FROM sources ORDER BY date DESC LIMIT ?",
      )
      .all(limit)
  : db
      .prepare<[], { id: string; title: string; excerpt: string | null }>(
        "SELECT id, title, COALESCE(excerpt, '') as excerpt FROM sources",
      )
      .all();

console.log(`Scanning ${sourceRows.length} sources…`);

// Existing citations to dedupe — don't suggest something already wired
const existingCitations = new Set<string>(); // key: source_id|node_id
for (const row of db
  .prepare<[], { node_id: string; source_id: string }>(
    "SELECT node_id, source_id FROM node_sources",
  )
  .all()) {
  existingCitations.add(`${row.source_id}|${row.node_id}`);
}

// Existing suggestions — don't double-suggest
const existingSuggestions = new Set<string>(); // key: source_id|matched_text
for (const row of db
  .prepare<[], { source_id: string; matched_text: string }>(
    "SELECT source_id, matched_text FROM suggestions",
  )
  .all()) {
  existingSuggestions.add(`${row.source_id}|${row.matched_text}`);
}

// ---------------------------------------------------------------------------
// Match
// ---------------------------------------------------------------------------
const insert = db.prepare<
  [string, string, string, string | null, string, string, string]
>(`
  INSERT INTO suggestions (source_id, matched_text, candidate_type, existing_node_id, rationale, status, curator, created_at)
  VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
`);

const now = new Date().toISOString();
const curator = "ner-extract";
let suggestions = 0;
let scanned = 0;

const run = db.transaction(() => {
  for (const src of sourceRows) {
    scanned++;
    const text = `${src.title} ${src.excerpt}`;
    for (const t of compiled) {
      if (!t.re.test(text)) continue;
      // dedupe vs existing citation + existing suggestion
      const citKey = t.existingNodeId ? `${src.id}|${t.existingNodeId}` : null;
      if (citKey && existingCitations.has(citKey)) continue;
      if (existingSuggestions.has(`${src.id}|${t.text}`)) continue;
      insert.run(
        src.id,
        t.text,
        t.type,
        t.existingNodeId,
        t.existingNodeId ? "gazetteer-existing-node" : "gazetteer-new-entity",
        curator,
        now,
      );
      existingSuggestions.add(`${src.id}|${t.text}`);
      suggestions++;
    }
    if (scanned % 500 === 0) process.stdout.write(`  ${scanned}/${sourceRows.length}…\r`);
  }
});

run();

const counts = {
  pending: (db.prepare<[], { n: number }>("SELECT COUNT(*) AS n FROM suggestions WHERE status='pending'").get() ?? { n: 0 }).n,
  total: (db.prepare<[], { n: number }>("SELECT COUNT(*) AS n FROM suggestions").get() ?? { n: 0 }).n,
};

console.log(`\nDone. +${suggestions} new suggestions across ${scanned} sources.`);
console.log(`Suggestions table: ${counts.pending} pending / ${counts.total} total`);
console.log(`Review at /suggestions`);

db.close();
