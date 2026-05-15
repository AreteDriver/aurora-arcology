# Dossier → Aurora Integration Surface

> Scoping doc — what Aurora can lift from Dossier, ranked by ROI.
> Captured 2026-05-14 after a fleet-audit pass surfaced cross-pollination questions.

## Premise

Aurora and Dossier solve adjacent problems:

- **Dossier** — forensic document analysis. Pythonic, FastAPI-served, 16+ analysis endpoints over a typed corpus.
- **Aurora** — investigation-board for narrative universes. TypeScript / Next.js, curator-authored claim graph with sources and connections.

They share architecture instincts (typed entities, provenance discipline, append-only logs) but live in different runtimes. Cross-pollination is service-call or pattern-port, not code-share.

## Already done — pattern port

**NER strategy (4-layer extraction).** `scripts/ner-extract.ts` is an explicit TS port of `dossier/core/ner.py`. Same four layers (L1 gazetteer / L2 regex / L3 heuristic / L4 frequency), same rationale tags, EVE-specific patterns substituted for Frontier-specific ones. The header comment names Dossier as the source. **No further work needed on this bridge.**

---

## Bridge 1 — Briefing generator (high ROI, untapped)

**Dossier:** `POST /api/ai/briefing` at `dossier/api/routes_intelligence.py:319`. Produces 1-2 paragraph domain-verbiage briefings from entity + source context. Uses Ollama backend.

**Aurora gap:** Nodes carry connections + supporting_sources, but there's no auto-generated per-node summary. Curator-authored seed JSON is the only text; lens output is structural, not prose.

**What this unlocks:** Each Aurora node could surface a "What we know about X" briefing pulled from its connections + cited sources. Lens markdown becomes browsable narrative, not just structural rendering.

**Integration shape:**
- Add `scripts/generate-briefings.ts` that POSTs each node's structured context to Dossier's `/api/ai/briefing` endpoint
- Cache results in a new `node_briefings` table (regenerate when connection set or supporting_sources changes)
- Render in `BoardView` and dumped lens markdown

**Dependencies / blockers:**
- Dossier must be running locally during the build pipeline (or move to a separate `pnpm briefings:generate` step that's optional)
- Briefing prompt needs EVE-domain verbiage tuning — Dossier's Frontier defaults won't read right
- Ollama model and budget per briefing (~500 tokens × N nodes)

**Estimated effort:** 1-2 days. Script + table + caching + UI wiring.

---

## Bridge 2 — `/clusters` and `/duplicates` for curator review (medium-high ROI)

**Dossier:** `GET /api/clusters` at line 585, `GET /api/duplicates` + `POST /duplicates/dismiss` at lines 510/554. Built for grouping similar documents and flagging probable duplicates for human dismissal.

**Aurora gap:** `scripts/resolve.ts` is the entity-resolver audit, but the curator review UX for "these two nodes might be the same entity" is rudimentary. No persistent dismiss tracking.

**What this unlocks:** Curator workflow becomes: NER extraction → cluster suggestions → dismiss-or-merge UI → audit-logged decisions. Dossier already shipped this loop; Aurora can mirror the UX.

**Integration shape:**
- Pattern port (not service call) — Dossier's duplicates UX is FastAPI + frontend; Aurora needs the same surface in Next.js
- New `node_merge_suggestions` table with `status` field (`pending` / `dismissed` / `merged`)
- Curator UI page mirroring Dossier's duplicates review panel

**Dependencies / blockers:**
- Read Dossier's duplicates route + frontend to extract the UX pattern
- Aurora's `resolve.ts` becomes the source of suggestions; UI is new

**Estimated effort:** 2-3 days. New table + script wiring + UI page.

---

## Bridge 3 — `/corroboration` and `/link-analysis` (medium ROI, exploratory)

**Dossier:**
- `GET /api/corroboration` at line 1065 — how multiple sources independently support a claim
- `GET /api/link-analysis` at line 749 — relationship analysis over the entity graph

**Aurora model already supports this** — connections carry `supporting_sources` and `contested-by`. Dossier's corroboration logic could surface "this claim is corroborated by 4 independent sources" as a node-level signal in Aurora's lens output.

**What this unlocks:**
- Lens dumps could include a confidence-uplift section: claims with high independent corroboration float to the top
- Graph rendering (Phase 1) could weight edges by corroboration count, not just confidence

**Integration shape:**
- Read Dossier's corroboration computation, port the algorithm to TS
- Add corroboration score column to `connections` table
- Plumb into lens markdown and (Phase 1) graph rendering

**Dependencies / blockers:**
- Phase 1 graph rendering must be live to see most of the value
- Algorithm is small (likely SQL aggregation over `supporting_sources` join)

**Estimated effort:** 1 day for corroboration; 2 days additional for link-analysis port.

---

## Bridge 4 — `/narrative` synthesis (high ROI but speculative)

**Dossier:** `GET /api/narrative` at line 1203. Synthesizes a coherent narrative across the entity graph and source corpus.

**Aurora analogue:** `scripts/synthesize-polish.ts` + `synthesize-dump.ts` + `synthesize-dedupe.ts`. Aurora already has a synthesis pipeline.

**Potential bridge:** Dossier's narrative endpoint might use a different synthesis strategy (sourced narration vs raw LLM dump). Read the implementation, identify whether Aurora's synthesis pipeline could benefit from Dossier's narrative-construction patterns.

**Status:** Needs investigation before scoping. Could be already-equivalent, could be a meaningful upgrade.

---

## Not promising

- **`/financial-trail`, `/communication-flow`, `/witness-index`, `/depositions`** — Dossier's legal-forensics endpoints. EVE lore isn't legal-grade material. No real bridge.
- **`/patterns`** — Pattern detection over Dossier's document corpus. Aurora's source corpus is too narrow/structural for this to surface useful signal.

---

## Prioritization

| Bridge | ROI | Effort | Recommend |
|---|---|---|---|
| 1. Briefing generator | High | 1-2 days | **Do next** (most user-visible win) |
| 2. Clusters / duplicates | Med-High | 2-3 days | Do after briefing — curator UX win |
| 3. Corroboration / link-analysis | Medium | 1-2 days | Defer until Phase 1 graph ships |
| 4. Narrative synthesis | High but speculative | TBD | Investigate before scoping |
| NER (already done) | — | 0 | Already a TS port |
| Legal-forensics endpoints | None | — | Skip |

## Open questions

- Does Aurora want to run Dossier locally as a service (Bridge 1 service-call), or port the briefing template to TS (Bridge 1 pattern-port)? Service-call is faster to wire but adds a runtime dependency.
- Should briefings be regenerated incrementally on connection changes, or full-rebuild on each `pnpm db:reset`? Incremental needs change-detection; full-rebuild is simpler but slower.
- Phase 1 (D3 graph) timing — does it unlock Bridge 3 before Bridge 3's work makes sense to start?

## Next steps (when ready)

1. Pick service-call vs pattern-port for Bridge 1
2. Read Dossier's `briefing` route implementation to understand the prompt + output shape
3. Define `node_briefings` schema
4. Prototype Bridge 1 on a small slice of nodes; measure quality before generalizing
