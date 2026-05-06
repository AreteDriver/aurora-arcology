/**
 * Entity resolver — surfaces canonical-name typos and transcription drift in
 * curator-authored seed files. Lifted from Dossier's resolver.py pattern,
 * reduced to the use case Aurora actually needs at v0:
 *
 *   - Pre-commit audit: detect known variants of canonical names
 *   - Suggest fuzzy matches for capitalized multi-word phrases that are
 *     close (Levenshtein ≤ 2) to a canonical but not equal
 *   - Non-destructive: returns a report; caller decides whether to apply
 *
 * The gazetteer is data, not code — `data/gazetteers/eve-canonical.json`
 * maps canonical → known variants. Curator extends after each extraction.
 */
import { distance } from "fastest-levenshtein";

export interface GazetteerEntry {
  canonical: string;
  type: string;
  variants: string[];
}

export interface Gazetteer {
  _meta?: Record<string, unknown>;
  entries: GazetteerEntry[];
}

export type MergeAction = "auto_merge" | "suggest_merge" | "no_merge";

export interface ResolverHit {
  /** The variant string we found in the source. */
  variant: string;
  /** Where it appeared (id of the offending node, plus a path hint). */
  location: { nodeId?: string; field: string };
  /** Match against canonical. */
  canonical: string;
  canonicalType: string;
  /** Levenshtein distance — 0 means exact variant match from gazetteer. */
  distance: number;
  /** Recommended action based on distance. */
  action: MergeAction;
}

/**
 * Classify a (variant, canonical) pair into a merge action.
 *
 *   distance 0          → known variant from the gazetteer → auto_merge
 *   distance 1–2        → close fuzzy match → suggest_merge
 *   distance ≥ 3        → no_merge (treat as distinct entity)
 */
export function classify(d: number): MergeAction {
  if (d === 0) return "auto_merge";
  if (d <= 2) return "suggest_merge";
  return "no_merge";
}

// Regex special chars to escape in variant strings
const RE_ESCAPE = /[.*+?^${}()|[\]\\]/g;
const escapeRe = (s: string) => s.replace(RE_ESCAPE, "\\$&");

/**
 * Audit a string against the gazetteer. Returns hits where a known variant
 * literally appears in the text *with word boundaries* — prevents false
 * positives like "Starkman" inside "Starkmanir".
 */
export function findKnownVariants(
  text: string,
  gaz: Gazetteer,
): { variant: string; canonical: string; canonicalType: string }[] {
  const hits: { variant: string; canonical: string; canonicalType: string }[] = [];
  for (const e of gaz.entries) {
    for (const v of e.variants) {
      // Word-boundary match. \b doesn't work cleanly for variants ending in
      // punctuation or starting with digits; use a lookahead/lookbehind for
      // non-word chars or string boundary.
      const re = new RegExp(`(?<![A-Za-z0-9])${escapeRe(v)}(?![A-Za-z0-9])`, "g");
      if (re.test(text)) {
        hits.push({ variant: v, canonical: e.canonical, canonicalType: e.type });
      }
    }
  }
  return hits;
}

/**
 * Audit a string for capitalized multi-word phrases that are close to a
 * canonical but not equal. Catches typos that haven't yet been added to
 * the gazetteer's known-variants list.
 *
 * Returns a list of (phrase, nearest canonical, distance) suggestions.
 */
export function findFuzzyMatches(
  text: string,
  gaz: Gazetteer,
  options: { minLength?: number; maxDistance?: number } = {},
): { phrase: string; canonical: string; canonicalType: string; distance: number }[] {
  const minLength = options.minLength ?? 4;
  const maxDistance = options.maxDistance ?? 2;

  // Pull capitalized multi-word phrases (heuristic NER from Dossier)
  const phraseRe = /\b([A-Z][a-z]+(?:[\s-][A-Z][a-z]+)+)\b/g;
  const seen = new Set<string>();
  const out: ReturnType<typeof findFuzzyMatches> = [];

  for (const m of text.matchAll(phraseRe)) {
    const phrase = m[1];
    if (phrase.length < minLength) continue;
    if (seen.has(phrase)) continue;
    seen.add(phrase);

    for (const e of gaz.entries) {
      // Skip exact canonical or known-variant matches (handled by findKnownVariants)
      if (phrase === e.canonical) {
        seen.add(phrase);
        out.push({ phrase, canonical: e.canonical, canonicalType: e.type, distance: 0 });
        break;
      }
      if (e.variants.includes(phrase)) break; // already in gazetteer
      const d = distance(phrase, e.canonical);
      if (d > 0 && d <= maxDistance) {
        out.push({ phrase, canonical: e.canonical, canonicalType: e.type, distance: d });
        break; // first canonical wins
      }
    }
  }
  return out;
}

/**
 * Walk a seed JSON object, audit every visible string field, return all hits.
 * Supports both warpath_yc128.json shape (nodes + connections) and
 * news_archive.json shape (sources only).
 */
export function auditSeed(
  seed: {
    nodes?: { id: string; name?: string; brief?: string; master_summary?: string }[];
    connections?: { src: string; tgt: string; rel: string; claim?: string }[];
    sources?: { id: string; title?: string; excerpt?: string | null }[];
  },
  gaz: Gazetteer,
): ResolverHit[] {
  const hits: ResolverHit[] = [];

  const visit = (text: string | null | undefined, location: ResolverHit["location"]) => {
    if (!text) return;
    for (const h of findKnownVariants(text, gaz)) {
      hits.push({ ...h, location, distance: 0, action: "auto_merge" });
    }
    for (const f of findFuzzyMatches(text, gaz)) {
      if (f.distance === 0) continue; // exact canonical, no work to do
      hits.push({
        variant: f.phrase,
        location,
        canonical: f.canonical,
        canonicalType: f.canonicalType,
        distance: f.distance,
        action: classify(f.distance),
      });
    }
  };

  for (const n of seed.nodes ?? []) {
    visit(n.name, { nodeId: n.id, field: "name" });
    visit(n.brief, { nodeId: n.id, field: "brief" });
    visit(n.master_summary, { nodeId: n.id, field: "master_summary" });
  }
  for (const c of seed.connections ?? []) {
    visit(c.claim, { field: `conn(${c.src}→${c.tgt})` });
  }
  for (const s of seed.sources ?? []) {
    visit(s.title, { nodeId: s.id, field: "title" });
    visit(s.excerpt, { nodeId: s.id, field: "excerpt" });
  }

  return hits;
}
