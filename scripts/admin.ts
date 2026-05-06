#!/usr/bin/env tsx
/**
 * Admin CLI for API keys, webhook subscriptions, and NER suggestions.
 *
 *   pnpm admin keys list
 *   pnpm admin keys create <label> [--scope read|write|admin]
 *   pnpm admin keys revoke <id>
 *
 *   pnpm admin webhooks list
 *   pnpm admin webhooks create <label> <url> [--events type1,type2]
 *   pnpm admin webhooks pause <id>
 *   pnpm admin webhooks resume <id>
 *
 *   pnpm admin suggestions list [--rationale R]
 *   pnpm admin suggestions accept <id>
 *   pnpm admin suggestions reject <id>
 *   pnpm admin suggestions accept-all [--rationale R]   # default: gazetteer-existing-node
 *   pnpm admin suggestions reject-all --rationale R
 *
 * Accepts update both the live DB and data/seeds/warpath_yc128.json so the
 * citation survives the next `pnpm db:reset`.
 *
 * Plain key + secret are printed ONCE at create time and never recoverable.
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { sha256Hex, generateKey } from "../src/lib/crypto";

const DB_PATH = process.env.DATABASE_URL ?? path.resolve("data/aurora.db");
const SEED_PATH = path.resolve("data/seeds/warpath_yc128.json");

const args = process.argv.slice(2);
const [resource, action, ...rest] = args;

const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");

const flag = (name: string, fallback?: string) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : fallback;
};

function help(): void {
  console.error("Usage:");
  console.error("  pnpm admin keys list");
  console.error("  pnpm admin keys create <label> [--scope read|write|admin]");
  console.error("  pnpm admin keys revoke <id>");
  console.error("");
  console.error("  pnpm admin webhooks list");
  console.error("  pnpm admin webhooks create <label> <url> [--events ev1,ev2]");
  console.error("  pnpm admin webhooks pause <id>");
  console.error("  pnpm admin webhooks resume <id>");
  process.exit(1);
}

const now = () => new Date().toISOString();

if (resource === "keys") {
  if (action === "list") {
    const rows = db
      .prepare(
        "SELECT id, scope, label, created_at, last_used_at, revoked_at FROM api_keys ORDER BY id DESC",
      )
      .all() as Array<{
      id: number;
      scope: string;
      label: string;
      created_at: string;
      last_used_at: string | null;
      revoked_at: string | null;
    }>;
    if (rows.length === 0) console.log("(no keys)");
    for (const r of rows) {
      const status = r.revoked_at ? "REVOKED" : "active";
      console.log(
        `  #${r.id}  ${r.scope.padEnd(6)}  ${status.padEnd(8)}  ${(r.last_used_at ?? "—").slice(0, 19).padEnd(19)}  ${r.label}`,
      );
    }
  } else if (action === "create") {
    const label = rest[0];
    if (!label) help();
    const scope = flag("--scope", "write");
    if (!["read", "write", "admin"].includes(scope!)) {
      console.error("scope must be read|write|admin");
      process.exit(1);
    }
    const plain = generateKey("ark");
    const result = db
      .prepare(
        "INSERT INTO api_keys (key_hash, scope, label, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(sha256Hex(plain), scope, label, now());
    console.log(`Created key #${result.lastInsertRowid}  scope=${scope}  label=${label}`);
    console.log("");
    console.log(`  ${plain}`);
    console.log("");
    console.log("Copy this NOW — only the hash is stored. Use as: Authorization: Bearer <key>");
  } else if (action === "revoke") {
    const id = parseInt(rest[0], 10);
    if (!id) help();
    const result = db
      .prepare("UPDATE api_keys SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL")
      .run(now(), id);
    console.log(`Revoked ${result.changes} key(s)`);
  } else help();
} else if (resource === "webhooks") {
  if (action === "list") {
    const rows = db
      .prepare(
        "SELECT id, url, event_types, status, failure_count, label, created_at, last_delivery_at FROM webhook_subscriptions ORDER BY id DESC",
      )
      .all() as Array<{
      id: number;
      url: string;
      event_types: string;
      status: string;
      failure_count: number;
      label: string;
      created_at: string;
      last_delivery_at: string | null;
    }>;
    if (rows.length === 0) console.log("(no subscriptions)");
    for (const r of rows) {
      console.log(
        `  #${r.id}  ${r.status.padEnd(8)}  fail=${String(r.failure_count).padEnd(2)}  ${r.event_types.padEnd(20)}  ${r.url}`,
      );
      console.log(`        ${r.label}`);
    }
  } else if (action === "create") {
    const label = rest[0];
    const url = rest[1];
    if (!label || !url) help();
    const events = flag("--events", "*");
    const secret = generateKey("whk");
    const result = db
      .prepare(
        "INSERT INTO webhook_subscriptions (url, event_types, secret_hash, label, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(url, events, sha256Hex(secret), label, now());
    console.log(`Created subscription #${result.lastInsertRowid}  url=${url}  events=${events}`);
    console.log("");
    console.log(`  signing secret: ${secret}`);
    console.log("");
    console.log("Verify each delivery: hmac-sha256(sha256(secret), body) == X-Aurora-Signature");
  } else if (action === "pause" || action === "resume") {
    const id = parseInt(rest[0], 10);
    if (!id) help();
    const status = action === "pause" ? "paused" : "active";
    const result = db
      .prepare("UPDATE webhook_subscriptions SET status = ? WHERE id = ?")
      .run(status, id);
    console.log(`${action}d ${result.changes} subscription(s)`);
  } else help();
} else if (resource === "suggestions") {
  // ─── Suggestion record shape ──────────────────────────────────────────
  interface SuggestionRow {
    id: number;
    source_id: string;
    matched_text: string;
    candidate_type: string;
    existing_node_id: string | null;
    rationale: string | null;
    status: string;
  }

  // Mutate the seed JSON in lock-step with the live DB so accepts survive
  // db:reset. Loads once, mutated in-memory, written at end of subcommand.
  let seed: { nodes: Array<{ id: string; sources?: string[] }> } | null = null;
  const loadSeed = () => {
    if (!seed) seed = JSON.parse(fs.readFileSync(SEED_PATH, "utf-8"));
    return seed!;
  };
  const saveSeed = () => {
    if (seed) fs.writeFileSync(SEED_PATH, JSON.stringify(seed, null, 2) + "\n");
  };

  const acceptOne = (s: SuggestionRow): "wired" | "no-node" | "already-cited" => {
    // Write to live DB
    db.prepare("UPDATE suggestions SET status = 'accepted', resolved_at = ? WHERE id = ?")
      .run(now(), s.id);

    if (!s.existing_node_id) return "no-node";

    const seedDoc = loadSeed();
    const node = seedDoc.nodes.find((n) => n.id === s.existing_node_id);
    if (!node) return "no-node";

    const cur = (node.sources ??= []);
    if (cur.includes(s.source_id)) return "already-cited";
    cur.push(s.source_id);

    db.prepare("INSERT OR IGNORE INTO node_sources (node_id, source_id) VALUES (?, ?)")
      .run(s.existing_node_id, s.source_id);
    return "wired";
  };

  if (action === "list") {
    const rationale = flag("--rationale");
    const where = rationale
      ? "WHERE status = 'pending' AND rationale = ?"
      : "WHERE status = 'pending'";
    const rows = db
      .prepare(
        `SELECT id, source_id, matched_text, candidate_type, existing_node_id, rationale, status
         FROM suggestions ${where}
         ORDER BY rationale, matched_text, id LIMIT 50`,
      )
      .all(...(rationale ? [rationale] : [])) as SuggestionRow[];
    if (rows.length === 0) console.log("(no pending)");
    for (const r of rows) {
      const tgt = r.existing_node_id ?? "(new entity)";
      console.log(
        `  #${String(r.id).padEnd(5)}  ${r.matched_text.padEnd(28)}  ${r.candidate_type.padEnd(14)}  ${(r.rationale ?? "").padEnd(28)}  → ${tgt}`,
      );
    }
    // Summary of rationale buckets
    const buckets = db
      .prepare(
        "SELECT rationale, COUNT(*) AS n FROM suggestions WHERE status = 'pending' GROUP BY rationale ORDER BY n DESC",
      )
      .all() as Array<{ rationale: string | null; n: number }>;
    console.log("");
    console.log("Pending by rationale:");
    for (const b of buckets) console.log(`  ${(b.rationale ?? "—").padEnd(30)}  ${b.n}`);
  } else if (action === "accept") {
    const id = parseInt(rest[0], 10);
    if (!id) help();
    const s = db
      .prepare("SELECT * FROM suggestions WHERE id = ?")
      .get(id) as SuggestionRow | undefined;
    if (!s) {
      console.error(`No suggestion #${id}`);
      process.exit(1);
    }
    const result = acceptOne(s);
    saveSeed();
    console.log(`#${id}  ${s.matched_text} → ${s.existing_node_id ?? "(new)"}  [${result}]`);
  } else if (action === "reject") {
    const id = parseInt(rest[0], 10);
    if (!id) help();
    const r = db
      .prepare("UPDATE suggestions SET status = 'rejected', resolved_at = ? WHERE id = ?")
      .run(now(), id);
    console.log(`Rejected ${r.changes} suggestion(s)`);
  } else if (action === "accept-all") {
    // Default rationale: only gazetteer-existing-node (the safe class —
    // every accept writes a real citation). Other classes have no
    // existing_node_id and accepting them is just status-bookkeeping.
    const rationale = flag("--rationale", "gazetteer-existing-node");
    const force = rest.includes("--force");
    const rows = db
      .prepare(
        "SELECT id, source_id, matched_text, candidate_type, existing_node_id, rationale, status FROM suggestions WHERE status = 'pending' AND rationale = ?",
      )
      .all(rationale) as SuggestionRow[];

    if (rows.length === 0) {
      console.log(`No pending suggestions with rationale '${rationale}'`);
    } else if (
      rationale !== "gazetteer-existing-node" &&
      rows.some((r) => !r.existing_node_id) &&
      !force
    ) {
      console.error(
        `Refusing to bulk-accept ${rows.length} suggestions in '${rationale}': ` +
          "they have no existing_node_id, so accept just marks status without wiring a citation.\n" +
          "Pass --force to mark them accepted anyway, or curate one-by-one with `pnpm admin suggestions accept <id>`.",
      );
      process.exit(1);
    } else {
      const tally: Record<string, number> = { wired: 0, "no-node": 0, "already-cited": 0 };
      const tx = db.transaction(() => {
        for (const s of rows) {
          const r = acceptOne(s);
          tally[r] = (tally[r] ?? 0) + 1;
        }
      });
      tx();
      saveSeed();
      console.log(`Processed ${rows.length} suggestions (rationale='${rationale}'):`);
      for (const [k, v] of Object.entries(tally)) console.log(`  ${k.padEnd(16)} ${v}`);
      if (tally.wired > 0) {
        console.log("");
        console.log(`Updated seed: ${path.relative(process.cwd(), SEED_PATH)}`);
        console.log("Run `pnpm db:reset && pnpm news:load && pnpm ner:extract` to refresh.");
      }
    }
  } else if (action === "reject-all") {
    const rationale = flag("--rationale");
    if (!rationale) {
      console.error("reject-all requires --rationale R");
      process.exit(1);
    }
    const r = db
      .prepare(
        "UPDATE suggestions SET status = 'rejected', resolved_at = ? WHERE status = 'pending' AND rationale = ?",
      )
      .run(now(), rationale);
    console.log(`Rejected ${r.changes} suggestion(s) in rationale='${rationale}'`);
  } else help();
} else {
  help();
}

db.close();
