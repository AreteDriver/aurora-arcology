// Ingest a seed file (data/seeds/*.json) into the SQLite store.
// Usage: pnpm db:seed [path/to/seed.json]
// Default: data/seeds/warpath_yc128.json

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { SeedBoard } from "../src/lib/types";
import { DEFAULT_NODE_TYPES, DEFAULT_RELATION_TYPES } from "../src/data/ontology";

const SEED_PATH = process.argv[2] ?? "data/seeds/warpath_yc128.json";
const DB_PATH = path.resolve("data/aurora.db");

if (!fs.existsSync(SEED_PATH)) {
  console.error(`Seed file not found: ${SEED_PATH}`);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(SEED_PATH, "utf-8"));
const seed = SeedBoard.parse(raw);

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// ---------------------------------------------------------------------------
// Bootstrap vocabulary (idempotent)
// ---------------------------------------------------------------------------
const upsertNodeType = sqlite.prepare(
  "INSERT OR IGNORE INTO node_types (id, name, color, description) VALUES (?, ?, ?, ?)",
);
for (const t of DEFAULT_NODE_TYPES) upsertNodeType.run(t.id, t.name, t.color, t.description);

const upsertRelType = sqlite.prepare(
  "INSERT OR IGNORE INTO relation_types (id, name, description) VALUES (?, ?, ?)",
);
for (const r of DEFAULT_RELATION_TYPES) upsertRelType.run(r.id, r.name, r.description);

// ---------------------------------------------------------------------------
// Insert sources, nodes, connections in a single transaction
// ---------------------------------------------------------------------------
const now = new Date().toISOString();
const curator = seed._meta.curator;

const insertSource = sqlite.prepare(`
  INSERT OR REPLACE INTO sources (id, type, publisher, title, url, date, excerpt, license_tier, canonicity, local_path, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertNode = sqlite.prepare(`
  INSERT OR REPLACE INTO nodes (id, name, type, brief, master_summary, date, canonicity, created_by, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertNodeSource = sqlite.prepare(
  "INSERT OR IGNORE INTO node_sources (node_id, source_id) VALUES (?, ?)",
);
const insertConnection = sqlite.prepare(`
  INSERT OR REPLACE INTO connections (id, src_node_id, tgt_node_id, relation_type, claim, confidence, curator, drawn_at, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertConnSource = sqlite.prepare(`
  INSERT OR IGNORE INTO connection_sources (connection_id, source_id, role, excerpt, note)
  VALUES (?, ?, ?, ?, ?)
`);
const insertBoard = sqlite.prepare(`
  INSERT OR REPLACE INTO boards (id, title, curator, description, created_at)
  VALUES (?, ?, ?, ?, ?)
`);
const insertBoardNode = sqlite.prepare(
  "INSERT OR IGNORE INTO board_nodes (board_id, node_id) VALUES (?, ?)",
);
const insertAudit = sqlite.prepare(`
  INSERT INTO audit_log (entity_type, entity_id, action, changed_by, changed_at, payload)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const ingest = sqlite.transaction(() => {
  // sources
  for (const s of seed.sources) {
    insertSource.run(
      s.id,
      s.type,
      s.publisher,
      s.title,
      s.url ?? null,
      s.date ?? null,
      s.excerpt ?? null,
      s.license_tier,
      s.canonicity ?? null,
      s.local_path ?? null,
      now,
    );
    insertAudit.run("source", s.id, "create", curator, now, JSON.stringify(s));
  }

  // nodes + node_sources
  for (const n of seed.nodes) {
    insertNode.run(
      n.id,
      n.name,
      n.type,
      n.brief ?? null,
      n.master_summary ?? null,
      n.date ?? null,
      n.canonicity,
      curator,
      now,
    );
    insertAudit.run("node", n.id, "create", curator, now, JSON.stringify(n));
    for (const sid of n.sources ?? []) insertNodeSource.run(n.id, sid);
  }

  // board
  insertBoard.run(seed._meta.board_id, seed._meta.board_title, curator, null, now);
  for (const n of seed.nodes) insertBoardNode.run(seed._meta.board_id, n.id);

  // connections + connection_sources (supporting + contested-by)
  let connIdx = 0;
  for (const c of seed.connections) {
    const cid = `conn_${seed._meta.board_id}_${connIdx++}`;
    insertConnection.run(
      cid,
      c.src,
      c.tgt,
      c.rel,
      c.claim ?? null,
      c.conf,
      curator,
      now,
      now,
    );
    insertAudit.run("connection", cid, "create", curator, now, JSON.stringify(c));

    for (const sid of c.supporting_sources ?? []) {
      insertConnSource.run(cid, sid, "supporting", null, null);
    }
    if (c["contested-by"]) {
      insertConnSource.run(cid, null, "contested-by", null, c["contested-by"]);
    }
  }
});

ingest();

const counts = {
  sources: (sqlite.prepare("SELECT COUNT(*) as n FROM sources").get() as { n: number }).n,
  nodes: (sqlite.prepare("SELECT COUNT(*) as n FROM nodes").get() as { n: number }).n,
  connections: (sqlite.prepare("SELECT COUNT(*) as n FROM connections").get() as { n: number }).n,
  audit_entries: (sqlite.prepare("SELECT COUNT(*) as n FROM audit_log").get() as { n: number }).n,
};

console.log(`Seeded ${SEED_PATH} → ${DB_PATH}`);
console.log(counts);
sqlite.close();
