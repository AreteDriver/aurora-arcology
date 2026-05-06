import { z } from "zod";

// ============================================================================
// Provenance tags — every visible string carries one (spec §5)
// ============================================================================

export const ProvenanceTag = z.enum([
  "curator-authored",
  "source-quoted",
  "llm-summarized-from-graph",
  "llm-flagged-as-gap",
  "llm-rendered-prose",
]);
export type ProvenanceTag = z.infer<typeof ProvenanceTag>;

// ============================================================================
// Canonicity tag — how trustworthy is this claim
// ============================================================================

export const Canonicity = z.enum([
  "ccp-canon", // direct quote / paraphrase from CCP material
  "creator-interpretation", // creator-derived structural read
  "curator-tinfoil", // explicit speculation by curator
]);
export type Canonicity = z.infer<typeof Canonicity>;

// ============================================================================
// Seed-file shape — what a curator drops into data/seeds/*.json
// ============================================================================

export const SeedSource = z.object({
  id: z.string(),
  type: z.string(),
  publisher: z.string(),
  title: z.string(),
  url: z.string().url().optional(),
  date: z.string().optional(),
  excerpt: z.string().nullable().optional(),
  license_tier: z.string(),
  canonicity: z.string().optional(),
  local_path: z.string().optional(),
});

export const SeedNode = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  date: z.string().optional(),
  brief: z.string().optional(),
  master_summary: z.string().optional(),
  canonicity: z.string(),
  sources: z.array(z.string()).optional(),
});

export const SeedConnection = z.object({
  src: z.string(),
  tgt: z.string(),
  rel: z.string(),
  conf: z.number().min(0).max(1),
  claim: z.string().optional(),
  "contested-by": z.string().optional(),
  supporting_sources: z.array(z.string()).optional(),
});

export const SeedBoard = z.object({
  _meta: z.object({
    board_id: z.string(),
    board_title: z.string(),
    curator: z.string(),
    created_at: z.string(),
    spec_version: z.string().optional(),
    phase: z.number().optional(),
    license_mode: z.string().optional(),
    extraction_source: z.string().optional(),
    node_count: z.number().optional(),
    connection_count: z.number().optional(),
  }),
  sources: z.array(SeedSource),
  nodes: z.array(SeedNode).optional().default([]),
  connections: z.array(SeedConnection).optional().default([]),
  _curation_notes: z.array(z.string()).optional(),
});

export type SeedBoard = z.infer<typeof SeedBoard>;
