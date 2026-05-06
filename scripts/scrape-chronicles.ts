#!/usr/bin/env tsx
/**
 * Chronicle scraper — Library pipeline (spec §11.1).
 *
 * Pulls chronicle metadata from CCP's universe.eveonline.com archive into
 * data/seeds/chronicle_archive.json. Idempotent on slug.
 *
 * Storage discipline (L1 fan-content): title, url, publicationDate, slug.
 * No body, no description (CCP-authored preview). Curator authors a
 * synopsis when wiring claims.
 *
 * Usage:
 *   pnpm chronicle:scrape              # first page (~24)
 *   pnpm chronicle:scrape --pages 5    # first 5 pages
 *   pnpm chronicle:scrape --full       # all pages (~247 chronicles)
 */
import fs from "node:fs";
import path from "node:path";

const CHRON_INDEX = "https://universe.eveonline.com/chronicles";
const ALL_CHRON_CATEGORY = "4C6HHcEW2KcAqkkmctONCB"; // identified from __NEXT_DATA__
const USER_AGENT = "aurora-arcology/0.1 (+https://github.com/AreteDriver/aurora-arcology)";
const RATE_LIMIT_MS = 2000;

const SEED_PATH = path.resolve("data/seeds/chronicle_archive.json");

interface Chronicle {
  id: string;
  title: string;
  slug: string;
  publicationDate: string;
}

interface SeedSource {
  id: string;
  type: string;
  publisher: string;
  title: string;
  url: string;
  date: string;
  license_tier: string;
  canonicity: string;
  excerpt: string | null;
}

const args = process.argv.slice(2);
const flag = (name: string, fallback?: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? (args[i + 1] ?? fallback) : fallback;
};
const has = (name: string) => args.includes(name);

const PAGES = has("--full") ? 999 : parseInt(flag("--pages", "1") ?? "1", 10);
const START_PAGE = parseInt(flag("--start-page", "1") ?? "1", 10);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(page: number): Promise<{ chronicles: Chronicle[]; pages: number }> {
  const url = page === 1 ? CHRON_INDEX : `${CHRON_INDEX}?page=${page}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  const html = await res.text();
  const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error(`__NEXT_DATA__ not found on page ${page}`);
  const data = JSON.parse(m[1]);

  const arts: Record<string, Chronicle> = data?.props?.initialState?.article?.articles ?? {};
  const chronicles = Object.values(arts).map((a) => ({
    id: a.id,
    title: a.title,
    slug: a.slug,
    publicationDate: a.publicationDate,
  }));

  const allCat = data?.props?.initialState?.category?.[ALL_CHRON_CATEGORY];
  const pages = (allCat?.pages as number) ?? 1;

  return { chronicles, pages };
}

interface SeedDoc {
  _meta: Record<string, unknown>;
  sources: SeedSource[];
  _curation_notes?: string[];
}

function loadSeed(): SeedDoc {
  if (fs.existsSync(SEED_PATH)) {
    return JSON.parse(fs.readFileSync(SEED_PATH, "utf-8"));
  }
  return {
    _meta: {
      board_id: "chronicle_archive",
      board_title: "EVE Universe Chronicle Archive",
      curator: "ARETE",
      created_at: new Date().toISOString().slice(0, 10),
      spec_version: "aurora-spec-v0.4",
      phase: 0,
      license_mode: "L1-ccp-fan-content",
      extraction_source:
        "Scraped from universe.eveonline.com/chronicles. Title + URL + publicationDate + slug only. " +
        "Body and CCP-authored description are NOT stored — curator paraphrases when wiring claims.",
    },
    sources: [],
    _curation_notes: [],
  };
}

function saveSeed(seed: SeedDoc): void {
  seed._meta.last_scraped = new Date().toISOString();
  seed._meta.source_count = seed.sources.length;
  fs.mkdirSync(path.dirname(SEED_PATH), { recursive: true });
  fs.writeFileSync(SEED_PATH, JSON.stringify(seed, null, 2) + "\n");
}

(async () => {
  const seed = loadSeed();
  const existingSlugs = new Set(seed.sources.map((s) => s.id.replace(/^src_chronicle_/, "")));
  console.log(`Loaded ${seed.sources.length} existing chronicles`);

  let totalPages = PAGES;
  let added = 0;
  let skipped = 0;

  for (let page = START_PAGE; page < START_PAGE + totalPages; page++) {
    process.stdout.write(`  page ${page}: `);
    const { chronicles, pages } = await fetchPage(page);
    if (has("--full") && page === START_PAGE) {
      totalPages = pages - START_PAGE + 1;
      console.log(`(${pages} total pages, scraping ${totalPages})`);
    }
    let pageAdded = 0;
    for (const c of chronicles) {
      if (existingSlugs.has(c.slug)) {
        skipped++;
        continue;
      }
      seed.sources.push({
        id: `src_chronicle_${c.slug}`,
        type: "Chronicle",
        publisher: "CCP Games — EVE Universe",
        title: c.title,
        url: `${CHRON_INDEX}/${c.slug}`,
        date: c.publicationDate.slice(0, 10),
        license_tier: "ccp-fan-content",
        canonicity: "ccp-canon",
        excerpt: null,
      });
      existingSlugs.add(c.slug);
      pageAdded++;
      added++;
    }
    console.log(`+${pageAdded} new, ${chronicles.length - pageAdded} dup`);
    saveSeed(seed); // resumable per page
    if (page < START_PAGE + totalPages - 1) await sleep(RATE_LIMIT_MS);
  }

  const notes = (seed._curation_notes ??= []);
  notes.push(
    `Scrape ${new Date().toISOString().slice(0, 10)}: +${added} chronicles, ${skipped} already-ingested. ` +
      `Total: ${seed.sources.length}.`,
  );
  saveSeed(seed);

  console.log(`\nDone. +${added} chronicles, ${skipped} duplicates. Total: ${seed.sources.length}`);
  console.log(`Seed: ${SEED_PATH}`);
  console.log(`Load with: pnpm db:seed data/seeds/chronicle_archive.json`);
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
