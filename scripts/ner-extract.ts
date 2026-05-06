#!/usr/bin/env tsx
/**
 * NER extraction — gazetteer-driven candidate-entity surfacing over
 * the source corpus. Spec §9 Phase 3 "auto-suggested-but-never-auto-drawn":
 * never modifies the graph, populates `suggestions` table for curator review.
 *
 * Strategy (Dossier ner.py — all four layers):
 *   L1 gazetteer:    word-bounded match against existing nodes + canonicals
 *   L2 regex:        YC dates, ISO dates, EVE system names (X-XXX format)
 *   L3 heuristic:    capitalized multi-word phrases not in gazetteer
 *   L4 frequency:    terms appearing in ≥ N source titles
 *
 * Each layer tags suggestions with a different `rationale` so the curator
 * can filter the review queue.
 *
 *   pnpm ner:extract                    # all layers, all sources
 *   pnpm ner:extract --layer 1          # gazetteer only
 *   pnpm ner:extract --layer 2,3        # regex + heuristic
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
const layerArg = (() => {
  const i = args.indexOf("--layer");
  return i >= 0 ? args[i + 1] : "1,2,3,4";
})();
const enabledLayers = new Set(layerArg.split(",").map((s) => parseInt(s.trim(), 10)));

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
// Layer 2 patterns — regex extractors. Each returns matched_text, type, and
// the rationale that distinguishes it from gazetteer hits.
// ---------------------------------------------------------------------------
const L2_PATTERNS: { name: string; re: RegExp; type: string; rationale: string }[] = [
  // YC dates (in-universe). YC###, YC###-MM, YC###.MM.DD
  { name: "yc-date", re: /\bYC\s?\d{2,3}(?:[.\-]\d{1,2}){0,2}\b/g, type: "Event", rationale: "regex-yc-date" },
  // EVE system names (X-XXX format like 1DQ1-A, HED-GP, 4-EFLU)
  { name: "system", re: /\b[0-9A-Z]{1,4}-[0-9A-Z]{2,5}\b/g, type: "Place", rationale: "regex-system-name" },
  // Empire / Republic / Federation / State / Kingdom suffixes
  {
    name: "polity",
    re: /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+(Empire|Republic|Federation|State|Kingdom|Mandate|Collective|Coalition|Cartel|Syndicate)\b/g,
    type: "Faction",
    rationale: "regex-polity",
  },
];

// ---------------------------------------------------------------------------
// Layer 3 — capitalized multi-word phrases not in gazetteer
// ---------------------------------------------------------------------------
const L3_PHRASE_RE = /\b([A-Z][a-z]+(?:[\s'-][A-Z][a-z]+){1,4})\b/g;
const gazetteerLowercased = new Set(qualityTerms.map((t) => t.text.toLowerCase()));

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
const layerCounts: Record<string, number> = {};

const tryInsert = (
  sourceId: string,
  matchedText: string,
  candidateType: string,
  existingNodeId: string | null,
  rationale: string,
) => {
  const citKey = existingNodeId ? `${sourceId}|${existingNodeId}` : null;
  if (citKey && existingCitations.has(citKey)) return;
  if (existingSuggestions.has(`${sourceId}|${matchedText}`)) return;
  insert.run(sourceId, matchedText, candidateType, existingNodeId, rationale, curator, now);
  existingSuggestions.add(`${sourceId}|${matchedText}`);
  layerCounts[rationale] = (layerCounts[rationale] ?? 0) + 1;
  suggestions++;
};

// Layer 4 prep: tally term frequency across all sources first if enabled
const l4FreqMap = new Map<string, { type: string; count: number; firstSrc: string }>();

const run = db.transaction(() => {
  for (const src of sourceRows) {
    scanned++;
    const text = `${src.title} ${src.excerpt}`;

    // ─── Layer 1: gazetteer ───────────────────────────────────────────
    if (enabledLayers.has(1)) {
      for (const t of compiled) {
        if (!t.re.test(text)) continue;
        tryInsert(
          src.id,
          t.text,
          t.type,
          t.existingNodeId,
          t.existingNodeId ? "gazetteer-existing-node" : "gazetteer-new-entity",
        );
      }
    }

    // ─── Layer 2: regex ───────────────────────────────────────────────
    if (enabledLayers.has(2)) {
      for (const p of L2_PATTERNS) {
        for (const m of text.matchAll(p.re)) {
          let match = m[0].trim();
          // For polity, the match group may be "X Empire" — keep the full phrase
          if (p.name === "polity" && m[1] && m[2]) match = `${m[1]} ${m[2]}`;
          if (gazetteerLowercased.has(match.toLowerCase())) continue;
          tryInsert(src.id, match, p.type, null, p.rationale);
        }
      }
    }

    // ─── Layer 3: capitalized multi-word ───────────────────────────────
    if (enabledLayers.has(3)) {
      for (const m of text.matchAll(L3_PHRASE_RE)) {
        const phrase = m[1];
        if (phrase.length < 6) continue;
        if (gazetteerLowercased.has(phrase.toLowerCase())) continue;
        // Skip phrases starting with very common words
        if (/^(The|This|That|These|Those|New|Old)\s/.test(phrase)) continue;
        tryInsert(src.id, phrase, "unknown", null, "heuristic-multi-word");
      }
    }

    // ─── Layer 4: tally for frequency ─────────────────────────────────
    if (enabledLayers.has(4)) {
      for (const m of text.matchAll(L3_PHRASE_RE)) {
        const phrase = m[1];
        if (phrase.length < 6) continue;
        if (gazetteerLowercased.has(phrase.toLowerCase())) continue;
        const cur = l4FreqMap.get(phrase);
        if (cur) {
          cur.count += 1;
        } else {
          l4FreqMap.set(phrase, { type: "unknown", count: 1, firstSrc: src.id });
        }
      }
    }

    if (scanned % 500 === 0) process.stdout.write(`  ${scanned}/${sourceRows.length}…\r`);
  }

  // Layer 4 emit: phrases appearing in ≥3 distinct sources, deduped vs L3
  if (enabledLayers.has(4)) {
    for (const [phrase, info] of l4FreqMap) {
      if (info.count < 3) continue;
      // Use firstSrc as the representative source for the suggestion. The
      // curator can confirm the entity once and the citation will be wired.
      tryInsert(info.firstSrc, phrase, info.type, null, `tf-frequency-${info.count}`);
    }
  }
});

run();

const counts = {
  pending: (db.prepare<[], { n: number }>("SELECT COUNT(*) AS n FROM suggestions WHERE status='pending'").get() ?? { n: 0 }).n,
  total: (db.prepare<[], { n: number }>("SELECT COUNT(*) AS n FROM suggestions").get() ?? { n: 0 }).n,
};

console.log(`\nDone. +${suggestions} new suggestions across ${scanned} sources.`);
if (Object.keys(layerCounts).length > 0) {
  console.log("By rationale:");
  for (const [k, v] of Object.entries(layerCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(30)} ${v}`);
  }
}
console.log(`\nSuggestions table: ${counts.pending} pending / ${counts.total} total`);
console.log(`Review at /suggestions`);

db.close();
