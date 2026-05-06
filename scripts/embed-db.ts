#!/usr/bin/env tsx
/**
 * Embed data/aurora.db into a TypeScript module so it ships inside every
 * serverless function bundle automatically. Workaround for the Vercel +
 * Next.js outputFileTracingIncludes gap where the .nft.json reference is
 * recorded but the file isn't actually copied into the function.
 *
 * Build pipeline:
 *   pnpm db:reset              # creates data/aurora.db
 *   pnpm news:load              # populates from news_archive seed
 *   pnpm ner:extract            # adds NER suggestions
 *   tsx scripts/embed-db.ts     # ← writes src/lib/db-blob.ts
 *   next build                  # bundle includes the blob via import
 */
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve("data/aurora.db");
const DEST = path.resolve("src/lib/db-blob.ts");

const buf = fs.readFileSync(SRC);
const base64 = buf.toString("base64");
const sizeMb = (buf.byteLength / 1024 / 1024).toFixed(2);

const content = `// AUTO-GENERATED — do not edit. Run scripts/embed-db.ts to refresh.
// Source: data/aurora.db (${buf.byteLength.toLocaleString()} bytes / ${sizeMb} MB)
// Generated: ${new Date().toISOString()}

export const DB_BLOB_BASE64 = ${JSON.stringify(base64)};
`;

fs.writeFileSync(DEST, content);
console.log(
  `embedded ${path.relative(process.cwd(), SRC)} → ${path.relative(process.cwd(), DEST)} (${sizeMb} MB raw, ${(base64.length / 1024 / 1024).toFixed(2)} MB base64)`,
);
