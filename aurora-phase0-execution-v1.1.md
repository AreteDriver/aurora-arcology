# Aurora — Phase 0 Execution Doc

> **Phase:** 0 — *The Personal Board*
> **Goal:** A working curator-editable investigation board on Aurora's data model. Single curator (me). EVE corpus. Local deployment. No public release, no LLM features yet.
> **Spec reference:** Aurora SPEC v0.3, §9 Phase 0
> **Earliest start:** This weekend (immediately after memboot v1 ships)
> **Target completion:** ~3 weekends of focused work (12–18 hours total)
> **Doc author:** ARETE
> **Doc version:** v1 (May 2026)

---

## 1. The single sentence Phase 0 has to deliver on

> *I can build a Warpath board with thirty nodes and fifty connections in under two hours, and the search-around-an-object interaction surfaces non-obvious connections I'd missed.*

This is the success test from the spec. Everything in this doc serves it. If a feature doesn't move toward this sentence, defer it.

## 2. Five decisions this doc commits to

The spec deferred these. The execution doc makes the calls.

### 2.1 Repo strategy: extend the Arcology site

Aurora is not a new repo. It extends the existing `aurora-arcology` monorepo. The shipped site (Districts, Council, News, Archive/Ontology) becomes the first board — read-only, hand-curated, the framework's calling card. Phase 0 adds a curator-editable mode and a second board (Warpath) as the proof-of-concept.

**Why:** the Arcology site is already 60% of the visual primitive Aurora needs. Starting a new repo would mean rebuilding the D3 force layout, the Jove aesthetic, the type-color system, and the click-to-inspect interaction. Extension is faster *and* it tells a cleaner story — "Aurora is the framework; the Arcology site is its first artifact" reads as obvious truth when both live in the same codebase.

**What this changes structurally:** the existing `src/data/{districts,council,news,ontology}.ts` files stop being the canonical source. The new canonical source is a SQLite database under `data/aurora.db`. The TypeScript files become *generated exports* from the DB for static-site rendering.

### 2.2 Tech stack: Next.js 15 + TypeScript + Tailwind + D3 + SQLite

Same as the existing site, plus:

- **better-sqlite3** for the SQLite driver. Synchronous, single-process, zero-config, perfect for a local-first curator tool.
- **Drizzle ORM** for typed queries. Lighter than Prisma, no codegen step, fast.
- **Zod** for runtime validation of data crossing the curator UI ↔ database boundary.

Explicitly *not* adopting:

- Postgres or any networked DB (Phase 0 is local; Phase 1 will reconsider).
- Redux, Zustand, or any state library beyond React's built-ins (the curator UI's state is small enough to not need one).
- A separate backend service (Next.js API routes are sufficient for this scale).

### 2.3 Data model: append-only event log + materialized view

The spec requires an append-only audit log. The implementation is:

- A single `events` table with `(id, timestamp, curator_id, event_type, payload_json)`. Every node creation, edge draw, source attachment, brief edit — all events.
- A set of materialized tables (`nodes`, `connections`, `sources`, `vocabulary`) rebuilt from the event log. These are the read tables for queries; the event log is the source of truth.
- A `replay()` function that rebuilds the materialized tables from the event log. Used on database initialization, schema migrations, and (eventually) temporal queries.

**Why this matters:** without the event log, the audit log requirement in §5 of the spec is a documentation promise. With the event log, it's enforced by construction — there's no way to mutate state that doesn't write an event. This is the difference between Aurora being trustworthy and Aurora *claiming* to be trustworthy.

**Cost:** maybe 30% more code at Phase 0 than a naive CRUD model would require. The cost compounds favorably — Tier 4 temporal queries become almost free at Phase 3, instead of requiring a database migration to add audit columns retroactively.

**Sources table sized for full text, not just URLs.** *(Added to align with v0.4 spec §11 ingestion arc.)* The `sources` table schema stores full source text, paginated at the document level (one Source per chronicle, not per page), with metadata fields for `publisher`, `date`, `type`, `license_tier`, `ingestion_method`, and `original_url`. Phase 0 only ever creates Sources via manual curator entry, but the schema is sized for the bulk Library import that begins Phase 0.5. Making this schema decision now is a one-line cost; making it later is a database migration.

### 2.4 Phase 0 ships *before* LLM features

Tier 2.5 (path summarization and gap surfacing) and Tier 3 (synthesis rendering) are deferred to **Phase 0.5**, between Phase 0 and Phase 1. The split:

- **Phase 0** — manual curator workflow, Board + Timeline views, search-around-an-object, append-only audit log. *No LLM integration.*
- **Phase 0.5** — add path summarization and synthesis rendering using the Anthropic API. Tested locally only. No public exposure of LLM features yet.
- **Phase 1** — public read view, LLM features included. Demo to a creator.

**Why split this way:** the LLM features are valuable but they are *not the load-bearing primitive*. The board is. If the manual curator workflow doesn't feel right — if drawing thirty nodes and fifty connections takes six hours instead of two — fixing the LLM features won't save the project. Phase 0 proves the manual workflow first, on the principle that *the LLM should accelerate a workflow that already works, not paper over a workflow that doesn't.*

### 2.5 The "drawing a connection" interaction is Phase 0's load-bearing design problem

Spec §12 named this as the deferred design exercise. The execution doc names it as **Week 1's primary deliverable**, ahead of any data model code.

The reason: a curator workflow lives or dies on the speed and feel of its primary action. If drawing a connection takes 30 seconds and 5 clicks, no one will populate a board. If it takes 5 seconds and 1 motion, populating becomes pleasurable and the tool succeeds. There is no recovering from the wrong interaction shipped first; getting it right *first* makes everything else easier.

**Week 1's deliverable is a static HTML mockup of three competing connection-drawing interactions, evaluated against the criteria below.** Code begins after one is chosen.

---

## 3. Week-by-week plan

Each weekend is ~6 hours of focused work. Adjust if your reality diverges.

### Weekend 1 — Design the connection-drawing interaction

**Sessions:**
- *Session A (2h):* sketch three competing UI patterns for "draw a connection between two nodes":
  1. **Drag-from-handle** — hover a node, a handle appears, drag it to another node, drop to create connection. Modal opens for relation type and source.
  2. **Two-click select** — click first node, click second node, modal opens with relation type pre-suggested by node-type pair.
  3. **Command palette** — Cmd-K opens a palette, type "connect Warpath to Deathless," autocomplete on node names, Enter creates a draft connection that opens the modal.
- *Session B (2h):* build static HTML mockups of all three (no real data, no D3 — just visual flow).
- *Session C (2h):* evaluate each against criteria:
  - **Speed** — how many seconds to add one connection?
  - **Discoverability** — would someone figure it out without docs?
  - **Mid-stream usability** — could Ashterothi do this on a live stream while talking?
  - **Mobile-friendliness** — does it work on a tablet?
  - **Error recovery** — what happens if you start a connection and want to cancel?

**End-of-weekend deliverable:** a 1-page decision doc naming the chosen interaction and explaining why. Mockup HTML committed to a `design/` folder in the repo.

**Stop condition:** if all three interactions feel wrong by Sunday afternoon, *don't pick the least-bad one and start coding.* Stop, sleep on it, and come back the following weekend with a fourth option. Coding the wrong interaction is more expensive than skipping a week.

### Weekend 2 — Data layer + initial schema

**Sessions:**
- *Session A (2h):* set up SQLite + Drizzle. Define schemas for `events`, `nodes`, `connections`, `sources`, `vocabulary`. Write `replay()` that rebuilds materialized tables from events.
- *Session B (2h):* migration script that imports the existing Arcology data (`districts.ts`, `council.ts`, `news.ts`, `ontology.ts`) into the database as the first board. Confirm the existing site still renders correctly using DB-backed data.
- *Session C (2h):* Next.js API routes for the four core mutations: `createNode`, `createConnection`, `attachSource`, `updateNode`. Each writes an event and refreshes the materialized view. Manual curl tests to confirm.

**End-of-weekend deliverable:** the existing Arcology site reads from SQLite instead of TypeScript files, byte-for-byte identical visual output. Four API routes work in isolation.

**Stop condition:** if the migration produces visual diffs from the original site, *fix the migration before continuing.* The Arcology site is the regression test for Phase 0.

### Weekend 3 — Curator UI + the chosen connection-drawing interaction

**Sessions:**
- *Session A (2h):* implement node creation. A `+` button on the board opens a modal with type, name, brief, source-attachment fields. Saves via the API route. New node appears on the board immediately.
- *Session B (2h):* implement the connection-drawing interaction chosen in Week 1. Test by adding ten new connections to the existing Arcology board.
- *Session C (2h):* implement search-around-an-object. Click a node → keyboard shortcut `S` (or button) → board re-renders showing only the n-degree neighborhood with type filtering controls.

**End-of-weekend deliverable:** I can sit down with a fresh empty board called "Warpath," add 30 nodes and 50 connections from CCP source material, and run `S` on the Warpath node to see its neighborhood.

**Stop condition:** if adding a node + connection takes longer than 30 seconds end-to-end, the interaction is too slow. Fix before adding more features.

---

## 4. Day 1 checklist

For when you sit down this weekend after memboot v1 ships. In order. No skipping.

1. ☐ Pull the `aurora-arcology` repo. Confirm it still builds (`npm install && npm run dev`).
2. ☐ Read SPEC v0.3 §1, §3, §4, §5 again. *Especially the non-goals.* Ten minutes max.
3. ☐ Read this exec doc §1 and §2 again. Five minutes.
4. ☐ Create a `design/` folder and a `design/connection-drawing.md` empty file. The first entry is the date and "Three patterns to evaluate."
5. ☐ Start Week 1 Session A. Sketch the three patterns on paper or in a sketch tool. *Do not write code.* Code is Week 2.
6. ☐ When Session A is done, commit the sketches as scanned images or screenshots into `design/`.

If you find yourself opening a code file before completing steps 1–4, you are skipping the design work. The work is the design.

---

## 5. Stop conditions

These are failure modes that should make you pause Phase 0, not push through them.

### 5.1 The interaction feels wrong

Phase 0's whole point is proving the curator workflow works. If the connection-drawing interaction still feels clunky after Week 3, *stop adding features.* Iterate on the interaction until it doesn't. A board with a great interaction and ten connections beats a board with a clunky interaction and a hundred.

### 5.2 The Warpath board doesn't reach 30 nodes / 50 connections in under 2 hours

The success criterion in §1. If by end-of-Weekend-3 you can't hit it, Phase 0 is not done. Don't move to Phase 0.5 (LLM features) or Phase 1 (public release) before this is true.

### 5.3 You start wanting to add LLM features before the manual workflow works

This is the temptation that destroys Aurora. *The LLM is supposed to accelerate a workflow that already works.* If the manual workflow is painful, the LLM will paper over the pain instead of fixing it, and the tool ships with hidden brokenness. Resist this. Phase 0.5 starts only after Phase 0's success criterion is met.

### 5.4 The job search needs your weekends

Aurora is a side-project for the next several months while the job search is active. If a recruiter screen, a take-home, or an interview cycle needs your weekend, *take the weekend.* Aurora can wait. The forward-deployed framing in spec §13 is a happy side effect of building Aurora — it is not a substitute for actually applying to and interviewing for jobs.

### 5.5 The Arcology site visual regression

If anywhere in Phase 0 the existing Arcology site (Districts/Council/News/Archive pages) starts visually diverging from its v1 shipped state, fix that *before* continuing. The Arcology site is Aurora's calling card; if it breaks, Aurora's credibility breaks with it.

---

## 6. What's *not* in Phase 0 (deferred to later phases)

Naming what's deferred is as load-bearing as naming what's included.

- **Public deployment.** Local-only. Phase 1 problem.
- **Multi-curator support.** Single curator. Phase 2 problem.
- **LLM features.** Path summarization, gap surfacing, synthesis rendering. Phase 0.5.
- **Timeline view.** Board view only at Phase 0. Timeline is Phase 1.
- **Sourcebook view, Curator view.** Phase 2 / Phase 3.
- **Real-time canon ingestion (RSS, transcript polling).** Phase 3.
- **Confidence-aware querying.** The data model supports it; UI exposure waits.
- **Vocabulary editing in-app.** The vocabulary is data per spec §5, but at Phase 0 it's edited in the database directly. The in-app vocabulary editor is Phase 1+.

If during Phase 0 you find yourself building any of the above, *stop.* It's scope creep. Note it for the next phase doc and return to the Phase 0 checklist.

---

## 7. What's next (the breadcrumb)

When Phase 0 is done — you can build a Warpath board fluently, the search-around interaction surfaces real insights, the audit log captures every change — the next decision is:

- Do you go to **Phase 0.5** (add LLM features locally)?
- Or skip to **Phase 1** (public deployment of Phase 0's manual workflow)?

That decision gets made when Phase 0 is complete, with real usage data from your own boards, not now. The architectural decisions in this doc — append-only event log, monorepo with Arcology site, materialized views — are made compatibly with both paths. You're not locked into either.

The Phase 0.5 / Phase 1 execution doc gets written when you reach that decision point.

---

## Appendix A — Open questions for Phase 0

These are *intentionally* unresolved here. They get answered during Phase 0 with real implementation data, not speculated about now.

- Does the chosen connection-drawing interaction work on mobile? Tablet?
- Does SQLite-via-better-sqlite3 work with Next.js's serverless-ish dev server, or do we need to fall back to a thin Express layer?
- Is `replay()` fast enough that we can run it on every page load, or do we need to cache the materialized view?
- Does the existing D3 graph component handle 100+ nodes well, or does Phase 0 need Cosmograph or sigma.js?
- Is `gray-matter` + MDX still the right way to handle longer-form node briefs, or should they be plain Markdown stored as text in the database?

If you find yourself wanting answers to these *before* starting, you are over-thinking. Start. The answers come from the implementation.

---

## Appendix B — What this doc deliberately does *not* contain

- A specific calendar date. *"This weekend"* is correct; pinning a Saturday risks slipping the spec for arbitrary scheduling reasons.
- A line count, file count, or LOC target. *Aurora is not measured by code volume.*
- A full UI specification. *Week 1's design exercise produces this; pre-specifying it defeats the exercise.*
- An estimated launch date for Phase 0.5 or Phase 1. *Phase 0 success determines the schedule for those.*
- A budget. *No paid services until Phase 1 deployment; Phase 0 is free.*

These omissions are deliberate. The execution doc commits to *what to do this weekend* and *what success looks like for Phase 0*. Everything else is premature.
