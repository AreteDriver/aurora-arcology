#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const dest = path.resolve("src/lib/db-blob.ts");

if (fs.existsSync(dest)) {
  process.exit(0);
}

const content = `// AUTO-GENERATED PLACEHOLDER.
// Real blob content is produced by \`pnpm embed:db\` for deploy builds.
// Keeping this file present avoids typecheck/build failures on fresh clones.
export const DB_BLOB_BASE64 = "";
`;

fs.writeFileSync(dest, content);
console.log(`created placeholder ${path.relative(process.cwd(), dest)}`);
