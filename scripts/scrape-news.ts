#!/usr/bin/env tsx
/**
 * New Eden News scraper — Stream pipeline (spec §11.2).
 *
 * Pulls article metadata from CCP's universe.eveonline.com news archive and
 * appends source records to data/seeds/news_archive.json. Idempotent: skips
 * already-ingested slugs. Rate-limited: 2s between requests.
 *
 * Storage discipline (spec §10 L1, CCP fan-content compliant):
 *   - title, url, publicationDate, slug — stored
 *   - excerpt / description / body — NOT stored (curator paraphrases when
 *     authoring claims)
 *   - article HTML may be cached locally under data/raw/news/<slug>.html
 *     (gitignored) for curator reading; never committed
 *
 * Usage:
 *   pnpm news:scrape              # first page (~50 most recent)
 *   pnpm news:scrape --pages 5    # first 5 pages (~250 articles)
 *   pnpm news:scrape --full       # all pages (~2,250 articles)
 *   pnpm news:scrape --cache-html # also cache article HTML to data/raw/news/
 */
import fs from "node:fs";
import path from "node:path";

const NEWS_INDEX = "https://universe.eveonline.com/new-eden-news";
const ALL_NEWS_CATEGORY = "2HRnxOSuNhk9SRbbK2dtLu"; // identified from __NEXT_DATA__
const USER_AGENT = "aurora-arcology/0.1 (+https://github.com/AreteDriver/aurora-arcology)";
const RATE_LIMIT_MS = 2000;

const SEED_PATH = path.resolve("data/seeds/news_archive.json");
const RAW_DIR = path.resolve("data/raw/news");

interface Article {
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

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const flag = (name: string, fallback?: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? (args[i + 1] ?? fallback) : fallback;
};
const has = (name: string) => args.includes(name);

const PAGES = has("--full") ? 999 : parseInt(flag("--pages", "1") ?? "1", 10);
const START_PAGE = parseInt(flag("--start-page", "1") ?? "1", 10);
const CACHE_HTML = has("--cache-html");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(page: number): Promise<{ articles: Article[]; pages: number }> {
  const url = page === 1 ? NEWS_INDEX : `${NEWS_INDEX}?page=${page}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  const html = await res.text();
  const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error(`__NEXT_DATA__ not found on page ${page}`);
  const data = JSON.parse(m[1]);

  const arts: Record<string, Article> = data?.props?.initialState?.article?.articles ?? {};
  const articles = Object.values(arts).map((a) => ({
    id: a.id,
    title: a.title,
    slug: a.slug,
    publicationDate: a.publicationDate,
  }));

  const allCat = data?.props?.initialState?.category?.[ALL_NEWS_CATEGORY];
  const pages = (allCat?.pages as number) ?? 1;

  return { articles, pages };
}

async function cacheArticleHtml(slug: string): Promise<void> {
  const dest = path.join(RAW_DIR, `${slug}.html`);
  if (fs.existsSync(dest)) return; // idempotent
  const url = `${NEWS_INDEX}/${slug}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    console.warn(`  cache-html ${slug}: HTTP ${res.status}`);
    return;
  }
  const html = await res.text();
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.writeFileSync(dest, html);
}

function loadSeed(): {
  _meta: Record<string, unknown>;
  sources: SeedSource[];
  _curation_notes?: string[];
} {
  if (fs.existsSync(SEED_PATH)) {
    return JSON.parse(fs.readFileSync(SEED_PATH, "utf-8"));
  }
  return {
    _meta: {
      board_id: "news_archive",
      board_title: "New Eden News Archive",
      curator: "ARETE",
      created_at: new Date().toISOString().slice(0, 10),
      spec_version: "aurora-spec-v0.4",
      phase: 0,
      license_mode: "L1-ccp-fan-content",
      extraction_source:
        "Scraped from universe.eveonline.com/new-eden-news. Title + URL + publicationDate only. " +
        "Article body and CCP description text are not stored — curator paraphrases when wiring claims.",
    },
    sources: [],
    _curation_notes: [],
  };
}

function saveSeed(seed: ReturnType<typeof loadSeed>): void {
  seed._meta.last_scraped = new Date().toISOString();
  seed._meta.source_count = seed.sources.length;
  fs.mkdirSync(path.dirname(SEED_PATH), { recursive: true });
  fs.writeFileSync(SEED_PATH, JSON.stringify(seed, null, 2) + "\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  const seed = loadSeed();
  const existingSlugs = new Set(
    seed.sources.map((s) => s.id.replace(/^src_news_/, "")),
  );

  console.log(`Loaded ${seed.sources.length} existing sources`);
  console.log(`Scraping pages ${START_PAGE}..${has("--full") ? "all" : START_PAGE + PAGES - 1}, cache-html=${CACHE_HTML}`);

  let totalPages = PAGES;
  let added = 0;
  let skipped = 0;

  for (let page = START_PAGE; page < START_PAGE + totalPages; page++) {
    process.stdout.write(`  page ${page}: `);
    const { articles, pages } = await fetchPage(page);
    if (has("--full") && page === START_PAGE) {
      totalPages = pages - START_PAGE + 1;
      console.log(`(detected ${pages} total pages, will scrape ${totalPages})`);
    }
    let pageAdded = 0;
    for (const a of articles) {
      if (existingSlugs.has(a.slug)) {
        skipped++;
        continue;
      }
      seed.sources.push({
        id: `src_news_${a.slug}`,
        type: "Press Release",
        publisher: "CCP Games — New Eden News",
        title: a.title,
        url: `${NEWS_INDEX}/${a.slug}`,
        date: a.publicationDate.slice(0, 10),
        license_tier: "ccp-fan-content",
        canonicity: "ccp-canon",
        excerpt: null,
      });
      existingSlugs.add(a.slug);
      pageAdded++;
      added++;

      if (CACHE_HTML) {
        await cacheArticleHtml(a.slug);
        await sleep(RATE_LIMIT_MS);
      }
    }
    console.log(`+${pageAdded} new, ${articles.length - pageAdded} dup`);

    // Save progress every page so a long --full run is resumable
    saveSeed(seed);

    if (page < START_PAGE + totalPages - 1) await sleep(RATE_LIMIT_MS);
  }

  // Final note
  const notes = (seed._curation_notes ??= []);
  notes.push(
    `Scrape ${new Date().toISOString().slice(0, 10)}: +${added} sources, ${skipped} already-ingested. ` +
      `Total source count: ${seed.sources.length}.`,
  );
  saveSeed(seed);

  console.log(`\nDone. +${added} new sources, ${skipped} duplicates. Total: ${seed.sources.length}`);
  console.log(`Seed: ${SEED_PATH}`);
  console.log(`Load with: pnpm db:seed data/seeds/news_archive.json`);
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
