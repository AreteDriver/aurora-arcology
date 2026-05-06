# aurora-arcology

> An investigation-board framework for narrative universes. First instance: EVE Online lore.

Aurora externalizes the work that lore content creators already do mentally and on stream:
drawing connections between current events and the deep canonical history that gives those
events meaning. The reference model is *The Wire*'s investigation board — Lester Freamon's
corkboard with red string between photographs is the product, not a feature of the product.

## Status

Phase 0 — *The Personal Board*. Single curator. Local SQLite. Default ontology loaded.
First board ships with the repo: `data/seeds/warpath_yc128.json` (Warpath / Syndicate
Conquest, YC128 Q2; 56 nodes, 78 connections).

## Stack

- Next.js 15 + TypeScript + Tailwind
- SQLite via better-sqlite3 + Drizzle ORM
- Zod for runtime seed validation
- D3 (Phase 1 — current view is a list placeholder)

## Quick start

```bash
pnpm install
pnpm db:generate    # emit Drizzle migrations from db/schema.ts
pnpm db:reset       # reset DB and seed data/seeds/warpath_yc128.json
pnpm dev            # http://localhost:3000
```

## Data model

See `db/schema.ts` and `aurora-spec-v0.4.md` §5.

Three primary tables:
- **nodes** — actors in the world (Event, Person, Organization, Faction, Place, Phenomenon, Concept, Artifact)
- **sources** — citable material (press release, chronicle, stream transcript, etc.)
- **connections** — *first-class objects*, not bare edges. Each carries claim text, confidence (0–1), curator, drawn-at timestamp, and supporting/contested-by source list.

Vocabulary tables (`node_types`, `relation_types`) are editable at runtime — adding a new
node type or relation type does not require a code change.

## Adding a board

Drop a JSON seed at `data/seeds/<board_id>.json` matching the `SeedBoard` schema in
`src/lib/types.ts`. Then:

```bash
pnpm db:seed data/seeds/<board_id>.json
```

The seed format encodes nodes, connections, and source citations with full provenance.
See `data/seeds/warpath_yc128.json` for a worked example.

## Licensing

Code: MIT.

Data: the curator owns their own boards. The default seed (`warpath_yc128.json`) is
curator-authored claim text drawn from publicly-available CCP material and creator
content under L3 user-paste licensing — Aurora itself does not redistribute creator
transcripts. See spec §10 for the licensing arc.

## Spec

The full design document is `aurora-spec-v0.4.md` (root). The Phase 0 execution doc is
`aurora-phase0-execution-v1.1.md`.
