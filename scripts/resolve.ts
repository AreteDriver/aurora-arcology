#!/usr/bin/env tsx
/**
 * Entity resolver CLI — audit a seed file for canonical-name drift.
 *
 *   pnpm resolver:audit                                  # audits warpath_yc128.json
 *   pnpm resolver:audit data/seeds/news_archive.json     # audits news archive
 *
 * Outputs a grouped report: auto_merge hits (known variants from the
 * gazetteer) and suggest_merge hits (fuzzy matches the curator should
 * eyeball before adding to the gazetteer or fixing in-place).
 *
 * Non-destructive — never modifies the seed. The pattern lifted from
 * Dossier's resolver: surface candidates, let the curator decide.
 */
import fs from "node:fs";
import path from "node:path";
import { auditSeed, type Gazetteer, type ResolverHit } from "../src/lib/resolver";

const DEFAULT_SEED = "data/seeds/warpath_yc128.json";
const DEFAULT_GAZ = "data/gazetteers/eve-canonical.json";

const args = process.argv.slice(2);
const seedPath = path.resolve(args.find((a) => !a.startsWith("--")) ?? DEFAULT_SEED);
const gazPath = path.resolve(DEFAULT_GAZ);

if (!fs.existsSync(seedPath)) {
  console.error(`Seed not found: ${seedPath}`);
  process.exit(1);
}
if (!fs.existsSync(gazPath)) {
  console.error(`Gazetteer not found: ${gazPath}`);
  process.exit(1);
}

const seed = JSON.parse(fs.readFileSync(seedPath, "utf-8"));
const gaz: Gazetteer = JSON.parse(fs.readFileSync(gazPath, "utf-8"));

const hits = auditSeed(seed, gaz);

const auto = hits.filter((h) => h.action === "auto_merge");
const suggest = hits.filter((h) => h.action === "suggest_merge");

const groupBy = <T, K extends string>(arr: T[], key: (t: T) => K): Map<K, T[]> => {
  const m = new Map<K, T[]>();
  for (const t of arr) {
    const k = key(t);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(t);
  }
  return m;
};

const fmt = (h: ResolverHit) =>
  `  ${h.variant.padEnd(28)} → ${h.canonical.padEnd(24)} ${h.canonicalType.padEnd(14)} ${h.location.nodeId ?? h.location.field}`;

console.log(`\nAuditing: ${path.relative(process.cwd(), seedPath)}`);
console.log(`Gazetteer: ${gaz.entries.length} canonicals`);
console.log(`\n=== AUTO_MERGE — known variants from gazetteer (${auto.length}) ===`);
if (auto.length === 0) {
  console.log("  (none — all known variants resolved to canonical)");
} else {
  const byVariant = groupBy(auto, (h) => `${h.variant} → ${h.canonical}`);
  for (const [k, group] of byVariant) {
    console.log(`  ${group.length}× ${k}`);
    for (const h of group.slice(0, 3)) {
      console.log(`     in ${h.location.nodeId ?? h.location.field}`);
    }
    if (group.length > 3) console.log(`     … and ${group.length - 3} more`);
  }
}

console.log(`\n=== SUGGEST_MERGE — fuzzy matches (Levenshtein ≤ 2) (${suggest.length}) ===`);
if (suggest.length === 0) {
  console.log("  (none)");
} else {
  // Dedupe: same variant → same canonical only shown once
  const seen = new Set<string>();
  const dedup = suggest.filter((h) => {
    const k = `${h.variant}→${h.canonical}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  for (const h of dedup) {
    console.log(fmt(h) + `  [d=${h.distance}]`);
  }
  if (dedup.length < suggest.length) {
    console.log(`  (${suggest.length - dedup.length} duplicates suppressed)`);
  }
}

console.log("\nNext steps:");
console.log("  - For AUTO_MERGE hits: fix in seed and add the variant to the gazetteer");
console.log("    (so future passes don't re-flag).");
console.log("  - For SUGGEST_MERGE hits: eyeball each. Real typo? add to gazetteer +");
console.log("    fix seed. Distinct entity? leave it; the lookup is harmless.");
console.log("");

process.exit(auto.length > 0 ? 1 : 0);
