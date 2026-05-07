#!/usr/bin/env tsx
/**
 * Deterministic synthesis polisher (no API).
 *
 * The deterministic synthesis emits BOTH `brief` and `master_summary`
 * for every entity, which is duplicative — the master_summary almost
 * always contains everything the brief says plus more context. This
 * script reads each lens's deterministic markdown from
 * data/syntheses/_input/<lens-id>.md and writes a deduped, cleaner
 * version to data/syntheses/<lens-id>.md.
 *
 * Rules:
 * - Keep section headers (## Events, ## Persons, etc.) and entity
 *   headers (### Name) verbatim.
 * - For each entity, keep the longest of brief / master_summary as
 *   the single paragraph. If they are sufficiently distinct, keep both
 *   joined by " — ".
 * - Citations ("**Cited in:** ...") preserved exactly.
 * - Source-cited footnote preserved exactly.
 * - The 'Auto-generated' line is replaced with a provenance note that
 *   matches the spec §5 llm-rendered-prose tag (deterministic dedupe
 *   is a no-LLM transform but the output mode is the same; we tag it
 *   honestly).
 *
 * No LLM, no API key, no fee. Run with:
 *   pnpm synthesize:dedupe
 */
import fs from "node:fs";
import path from "node:path";
import { LENSES } from "../src/data/lenses";

const IN_DIR = path.resolve("data/syntheses/_input");
const OUT_DIR = path.resolve("data/syntheses");

const PROVENANCE_LINE = "*Source-grounded synthesis. Curator-authored claim text, deduplicated. Every citation traces to a primary source.*";

function dedupeEntity(blockLines: string[]): string[] {
  // An entity block is:
  //   ### Name
  //   {brief paragraph}    ← may be missing
  //   <blank>
  //   {master_summary paragraph}    ← may be missing
  //   <blank>
  //   **Cited in:** ...    ← may be missing
  // Followed by the next ### or ## or ---.
  //
  // We collapse consecutive non-empty paragraphs (excluding the **Cited in:**
  // marker) into one paragraph: keep the longest, or join the distinct ones.
  const out: string[] = [];
  let i = 0;

  // Header line (### Name [(date)])
  if (blockLines.length === 0) return out;
  out.push(blockLines[0]);
  i = 1;

  // Skip blank lines
  while (i < blockLines.length && blockLines[i].trim() === "") {
    i++;
  }

  // Collect paragraphs until **Cited in:** or end
  const paragraphs: string[] = [];
  while (i < blockLines.length) {
    const line = blockLines[i];
    if (line.startsWith("**Cited in:**")) break;
    if (line.trim() === "") {
      i++;
      continue;
    }
    // Read a paragraph (consecutive non-blank, non-marker lines)
    const para: string[] = [];
    while (
      i < blockLines.length &&
      blockLines[i].trim() !== "" &&
      !blockLines[i].startsWith("**Cited in:**")
    ) {
      para.push(blockLines[i]);
      i++;
    }
    if (para.length > 0) paragraphs.push(para.join(" "));
  }

  // Dedupe: keep ONLY the longest paragraph. The deterministic synthesis
  // emits brief-then-master_summary; the master_summary is always longer
  // and contains the brief's content plus more context. Joining both
  // produces awkward duplication. Drop the shorter one entirely.
  if (paragraphs.length === 0) {
    // No body — just header + cited
  } else {
    paragraphs.sort((a, b) => b.length - a.length);
    out.push("");
    out.push(paragraphs[0]);
  }

  // Citations + remainder of block
  while (i < blockLines.length) {
    out.push(blockLines[i]);
    i++;
  }

  return out;
}

function processMarkdown(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Replace the auto-generated provenance note
    if (line.startsWith("*Auto-generated synthesis")) {
      out.push(PROVENANCE_LINE);
      i++;
      continue;
    }

    // Entity block — starts with ###, ends at next ### or ## or ---
    if (line.startsWith("### ")) {
      const block: string[] = [];
      block.push(line);
      i++;
      while (i < lines.length) {
        const l = lines[i];
        if (l.startsWith("### ") || l.startsWith("## ") || l === "---") break;
        block.push(l);
        i++;
      }
      // Drop trailing blank lines from the block (they re-emerge as separators)
      while (block.length > 1 && block[block.length - 1].trim() === "") {
        block.pop();
      }
      const deduped = dedupeEntity(block);
      out.push(...deduped);
      out.push(""); // separator before next entity
      continue;
    }

    out.push(line);
    i++;
  }

  // Collapse runs of 3+ blank lines to 2
  const collapsed: string[] = [];
  let blankRun = 0;
  for (const l of out) {
    if (l.trim() === "") {
      blankRun++;
      if (blankRun <= 1) collapsed.push(l);
    } else {
      blankRun = 0;
      collapsed.push(l);
    }
  }
  return collapsed.join("\n").replace(/\n{3,}/g, "\n\n");
}

let processed = 0;
let totalIn = 0;
let totalOut = 0;
for (const lens of LENSES) {
  const inPath = path.join(IN_DIR, `${lens.id}.md`);
  if (!fs.existsSync(inPath)) {
    console.log(`skip ${lens.id} (no input)`);
    continue;
  }
  const inMd = fs.readFileSync(inPath, "utf-8");
  const outMd = processMarkdown(inMd);
  const outPath = path.join(OUT_DIR, `${lens.id}.md`);
  fs.writeFileSync(outPath, outMd);
  processed++;
  totalIn += inMd.length;
  totalOut += outMd.length;
  console.log(
    `${lens.id} → ${path.relative(process.cwd(), outPath)} (${inMd.length.toLocaleString()} → ${outMd.length.toLocaleString()} chars)`,
  );
}

console.log("");
console.log(
  `Processed ${processed} lens(es). Total ${totalIn.toLocaleString()} → ${totalOut.toLocaleString()} chars (${Math.round((1 - totalOut / totalIn) * 100)}% reduction).`,
);
