import { sqliteTable, text, real, integer, primaryKey } from "drizzle-orm/sqlite-core";

// ============================================================================
// Vocabulary tables — editable taxonomies (spec §5: "ontology vocabulary is data, not code")
// ============================================================================

export const nodeTypes = sqliteTable("node_types", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color"),
  description: text("description"),
});

export const relationTypes = sqliteTable("relation_types", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
});

// ============================================================================
// Sources — citable material (spec §5)
// ============================================================================

export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(),
  type: text("type").notNull(), // Press Release, Chronicle, Stream Transcript, etc.
  publisher: text("publisher").notNull(),
  title: text("title").notNull(),
  url: text("url"),
  date: text("date"), // ISO date
  excerpt: text("excerpt"),
  licenseTier: text("license_tier").notNull(), // public-domain | ccp-fan-content | permissioned-creator | restricted
  canonicity: text("canonicity"), // ccp-canon | creator-interpretation | curator-tinfoil
  localPath: text("local_path"), // L3 user-paste: untracked local file reference
  createdAt: text("created_at").notNull(),
});

// ============================================================================
// Nodes — the actors in the world
// ============================================================================

export const nodes = sqliteTable("nodes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().references(() => nodeTypes.id),
  brief: text("brief"),
  // Synthesis paragraph (spec §6 Tier 3 view, persisted form). Explains the
  // node's role in the universe via its connections. Curator-authored.
  masterSummary: text("master_summary"),
  // In-universe or real-world date. Free-form to accept ISO ("2026-04-30"),
  // EVE YC notation ("YC110"), or imprecise era markers. Timeline view
  // normalizes for sort.
  date: text("date"),
  canonicity: text("canonicity").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
});

// many-to-many: each node may cite multiple sources
export const nodeSources = sqliteTable(
  "node_sources",
  {
    nodeId: text("node_id").notNull().references(() => nodes.id),
    sourceId: text("source_id").notNull().references(() => sources.id),
  },
  (t) => ({ pk: primaryKey({ columns: [t.nodeId, t.sourceId] }) }),
);

// ============================================================================
// Connections — first-class objects (spec §5: "the edges. First-class objects.")
// ============================================================================

export const connections = sqliteTable("connections", {
  id: text("id").primaryKey(),
  srcNodeId: text("src_node_id").notNull().references(() => nodes.id),
  tgtNodeId: text("tgt_node_id").notNull().references(() => nodes.id),
  relationType: text("relation_type").notNull().references(() => relationTypes.id),
  claim: text("claim"),
  confidence: real("confidence").notNull(), // 0.0–1.0
  curator: text("curator").notNull(),
  drawnAt: text("drawn_at").notNull(),
  createdAt: text("created_at").notNull(),
});

// many-to-many: a connection cites supporting sources and/or contested-by sources
export const connectionSources = sqliteTable(
  "connection_sources",
  {
    connectionId: text("connection_id").notNull().references(() => connections.id),
    sourceId: text("source_id").references(() => sources.id),
    role: text("role").notNull(), // supporting | contested-by
    excerpt: text("excerpt"), // optional pull-quote
    note: text("note"), // free-text contested-by reason when no source attached
  },
  (t) => ({ pk: primaryKey({ columns: [t.connectionId, t.role, t.sourceId] }) }),
);

// ============================================================================
// Boards — curated subsets with layout (spec §6 Board view)
// ============================================================================

export const boards = sqliteTable("boards", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  curator: text("curator").notNull(),
  description: text("description"),
  createdAt: text("created_at").notNull(),
});

export const boardNodes = sqliteTable(
  "board_nodes",
  {
    boardId: text("board_id").notNull().references(() => boards.id),
    nodeId: text("node_id").notNull().references(() => nodes.id),
    positionX: real("position_x"),
    positionY: real("position_y"),
  },
  (t) => ({ pk: primaryKey({ columns: [t.boardId, t.nodeId] }) }),
);

// ============================================================================
// Audit log — append-only event log (spec §5: "Required system properties on every record")
// Critical for Tier 4 temporal-layer queries.
// ============================================================================

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entityType: text("entity_type").notNull(), // node | source | connection | board
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(), // create | update | delete
  changedBy: text("changed_by").notNull(),
  changedAt: text("changed_at").notNull(),
  payload: text("payload"), // JSON snapshot
});

// ============================================================================
// Suggestions — NER auto-extracted candidate entities awaiting curator review
// (spec §9 Phase 3 "auto-suggested-but-never-auto-drawn"). Lifted from
// Dossier's NER pattern; gazetteer match in v0.
// ============================================================================

export const suggestions = sqliteTable("suggestions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceId: text("source_id").notNull().references(() => sources.id),
  matchedText: text("matched_text").notNull(), // the substring that triggered the suggestion
  candidateType: text("candidate_type").notNull(), // Event | Person | Organization | …
  existingNodeId: text("existing_node_id").references(() => nodes.id), // null = new entity
  rationale: text("rationale"), // gazetteer | fuzzy | regex | heuristic
  status: text("status").notNull().default("pending"), // pending | accepted | rejected
  curator: text("curator").notNull(),
  createdAt: text("created_at").notNull(),
  resolvedAt: text("resolved_at"),
});

export type Suggestion = typeof suggestions.$inferSelect;

// ============================================================================
// Type exports for downstream code
// ============================================================================

export type Node = typeof nodes.$inferSelect;
export type NewNode = typeof nodes.$inferInsert;
export type Source = typeof sources.$inferSelect;
export type Connection = typeof connections.$inferSelect;
export type Board = typeof boards.$inferSelect;
