#!/usr/bin/env tsx
/**
 * Admin CLI for API keys + webhook subscriptions.
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
 * Plain key + secret are printed ONCE at create time and never recoverable.
 * Curator pattern: create key, copy it, store wherever the consumer lives.
 */
import Database from "better-sqlite3";
import path from "node:path";
import { sha256Hex, generateKey } from "../src/lib/crypto";

const DB_PATH = process.env.DATABASE_URL ?? path.resolve("data/aurora.db");

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
} else {
  help();
}

db.close();
