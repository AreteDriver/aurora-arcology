# Project Spec — *Aurora*

> *An investigation-board framework for narrative universes.*

> **Status:** Strategic direction. Not yet started.
> **Author:** ARETE (James C. Young) — AreteDriver
> **Spec date:** May 2026
> **Earliest start:** After memboot v1 ships
> **Spec version:** v0.4 *(ingestion arc as cross-cutting concern — see Changelog at end)*

---

## 1. Thesis

Aurora externalizes the work that lore content creators already do mentally and on stream: drawing connections between current events and the deep canonical history that gives those events meaning.

The reference model is *The Wire*'s investigation board. Lester Freamon's corkboard with red string between photographs is the product, not a feature of the product. Documents and transcripts feed it; the board with its connections is the deliverable. A connection between "Warpath Protocol Failure" and "Deathless Circle activity in Pochven" is itself a claim — drawn by some source, at some time, supported by some evidence, contestable by other sources — and the board tracks all of that.

The first published artifact built on Aurora is the **Aurora Arcology Project** — a Jove-framed lore site already shipped as a Next.js application. That site demonstrates the underlying primitive (typed entities, typed relations, diegetic frame) on a single hand-curated dataset. Aurora the framework generalizes the primitive into a tool any curator can use to build similar boards on any narrative universe. EVE Online lore is the first domain Aurora ships full support for; the architecture is universe-agnostic.

The persona is the lore content creator: Ashterothi, Arsia Elkin, RP corp historians, alliance lore writers, Gorgon Media Engine pipelines. Their existing workflow is hours of cross-referencing between official press releases, decade-old chronicles, community wikis, and each other's streams, with attribution kept in their heads. Aurora's job is to externalize that mental model so the creator can defend connections on stream, share boards with their audience, and add to the board during a live event.

## 2. Why this and not the existing tools

### EVE University Wiki, Backstage Lore Forum, official EVE Universe site

Document repositories. They present curated narrative summaries with the work of synthesis already complete. They do not show *how* the synthesis was reached, *who* claimed which piece of it, or *when* a piece of canon was contested or retconned. They are the cleaned-up output, not the working surface.

### r/Eve and EVE forums

The opposite problem. Working surface with no structure. A Reddit thread on Warpath has a hundred theories with attribution by username; the good ones are buried under the bad ones, and there is no way to query "show me only the claims supported by official sources, sorted by date."

### YouTube creators (Ashterothi, Arsia, others)

The state of the art for synthesis. Also the source of the model Aurora aims to externalize. Their bottleneck is *production speed and source-grounding rigor* — not interpretation. A creator producing a 30-minute video on Warpath spends most of their time researching, not interpreting; the interpretation is the part they're already good at.

The differentiated position: **a working surface with structure, where the connections themselves are the artifact, designed to make the existing creators faster and more rigorous rather than to replace them.**

### Note on Palantir Gotham

Gotham is a structurally similar product for intelligence analysts working with classified data. Aurora is, in concept, a much smaller and lighter-weight expression of the same primitive — an ontology-backed investigation surface — applied to a fictional universe with a single curator persona instead of teams of analysts. Aurora steals specific architectural ideas from Gotham (see §5, §6, §9) and explicitly disclaims most of Gotham's surface area (see §4).

## 3. Use cases, ranked

### Tier 1 — Discovery & connection *(the killer feature)*

> *"Show me the board for Warpath. What connects to what. Where the red strings are."*

This is what existing tools do not do. It is also the visible product — the demo, the screenshot that goes on Reddit, the thing that makes a creator click "I want this."

The signature interaction is **search-around-an-object**: select a node, see the n-degree neighborhood with type-aware filtering. *"Show me everything within two hops of Warpath, only Events and Organizations, sorted by date."* This single interaction is the demo that sells the tool.

### Tier 2 — Provenance defense

> *"This connection between Warpath and the Deathless — who drew it, when, based on what source? Can I cite it on stream without embarrassing myself?"*

In service of Tier 1. The connections are only valuable if they're trustworthy. Provenance is what makes the board worth showing on a YouTube video.

### Tier 2.5 — Path summarization & gap surfacing *(LLM-assisted, source-grounded)*

> *"Show me how Warpath connects to the Deathless through the existing graph. List every path of length ≤ 4 with the supporting sources at each hop."*
>
> *"Which entities co-occur in source clusters but have no curator-drawn edges between them? Flag them as investigation candidates."*

Two LLM-assisted operations on the existing curator-drawn graph. Both are source-grounded by construction. Neither generates new claims.

**Path summarization** takes two nodes, walks the graph between them, and renders the path as readable prose with inline citations. Every entity mentioned is a node ID; every claim is a stated edge with its supporting sources. The LLM is doing graph traversal and English rendering, nothing else. This is what produces the "ohhh, I see how this all connects" moment for creators and audiences without inventing anything.

**Gap surfacing** is the inverse: the tool identifies entities that share source contexts (mentioned in many of the same documents) but have no curator-drawn edges between them, and presents these as **investigation prompts** — visually distinct from connections, never auto-promoted to edges, requiring explicit curator action to become a real claim. The LLM is noticing *the absence of structure*, not asserting the structure should exist.

The discipline that makes both operations safe: **the LLM gets only the existing graph as input.** It does not see the underlying source corpus directly during these operations, and it does not produce claims about entities or relations that aren't already present. This is enforceable in code — every entity mentioned in output must be a node ID; every claim must be a stated edge — and Aurora's implementation must enforce it.

### Tier 3 — Synthesis rendering

> *"Take this region of the board and render it as an 800-word script with inline citations."*

The output stage. This is where LLMs help. *They do not generate connections; they render existing connections as readable prose.* This is the line that prevents the tool from becoming another hallucination machine.

A critical property here, lifted from Gotham's Dossier feature: **synthesis output retains live links back to source nodes and connections.** A script generated today reflects the data state today; six months later, with the underlying data updated, the same script can be re-rendered to reflect current canon. No static screenshots, no stale copy-pastes.

### Tier 4 — Temporal & change tracking *(v2)*

> *"Show me how the board for the Drifter / Jove ancestry question has evolved over time. Which connections strengthened? Which were broken when canon retconned?"*

The board is a temporal object. Capturing its evolution is what differentiates Aurora from a static knowledge graph. Defer to v2 because it requires the corpus to be continuously ingested, which is substantial ongoing infrastructure. *Note: the data layer must support this from v0 even though the feature ships at v2 — see §5 audit log requirement.*

## 4. Non-goals (sharpening the project by what it isn't)

- **Not a lore wiki.** Wikis present resolved narrative. Aurora presents working synthesis with seams visible.
- **Not an LLM-chat-with-the-corpus product.** That product hallucinates and has no defensible position. The board is the product; the LLM is one rendering layer.
- **Not a moderator of canon.** Aurora does not arbitrate which lore is "real." It records who claimed what; the user decides what to trust.
- **Not a real-time game intelligence tool.** Frontier Watch territory. Aurora is for narrative, not operations.
- **Not a theory-generation engine.** *Strongest non-goal.* Aurora surfaces existing claims and connections; it does not invent new lore claims. A tool that confidently asserts new lore that no source supports is worse than no tool at all — it destroys community credibility.

  This non-goal applies to LLM operations on the graph as well as to manual curator workflows. The LLM may *describe* paths that exist in the curator-drawn graph, *traverse* the graph to summarize structure, *render* synthesis output from existing nodes and edges, and *flag* gaps where entities co-occur in sources but lack edges. The LLM may **not** generate new claims, infer causal or thematic relationships not stated by sources, or fill narrative connective tissue between known facts.

  The line is enforceable: if an LLM-produced piece of text contains an entity that isn't a node, a relation that isn't a stated edge, or an epistemic hedge ("likely," "could explain," "suggests that," "probably influenced") that isn't quoted from a source, the tool has crossed the line. Aurora's implementation must validate LLM output against the graph before displaying it, and reject output that cannot be grounded.

- **Not Gotham.** Gotham has a dozen integrated applications, ten years of engineering, and customer-deployed strategists. Aurora is one person on weekends. Aurora ships with a *small, opinionated* surface area — a sharp default ontology for EVE lore, two views over the data at v1, and clear deferrals on everything else.

## 5. Data model

The data model is the spec's load-bearing decision.

### Three primary entity types

**Nodes** — the actors in the world.
- Type: drawn from the *vocabulary*, which is itself data (see below).
- Required fields: id, canonical name, type, brief, list of source citations, canonicity tag, created-by curator, created-at timestamp.
- Default vocabulary types for the EVE domain ship pre-loaded: Event, Person, Organization, Faction, Phenomenon, Concept, Place, Artifact.

**Sources** — the citable material.
- Type: Press Release, Chronicle, Novel, Stream Transcript, Forum Post, Patch Note (vocabulary, editable).
- Each source has a publisher, date, URL, excerpt or full text, and a license tier (public domain | CCP fan-content | permissioned creator | restricted).

**Connections** — the edges. *First-class objects.* This is where Aurora differs from a normal knowledge graph.
- Each connection has: source node, target node, relation type, claim text, list of supporting sources with quoted excerpts, the curator who drew the connection, the date drawn, a confidence value (0.0–1.0), and an optional *contested-by* list of sources that contradict.
- A connection is itself a claim. It has its own provenance, its own confidence, and its own contestability. *This is the structural primitive that distinguishes Aurora from every existing lore resource.*

### The ontology vocabulary is data, not code

Both node types and relation types live in editable vocabulary tables, not hard-coded enums. Curators add new types in-app; adding a new node type (a new EVE faction Ashterothi identifies as worth tracking) or a new relation type ("ideologically-descended-from," if that turns out to matter) does not require a code commit and a deploy. The default vocabulary ships pre-populated; curators extend it as their domain demands.

Lifted from Gotham's "dynamic ontology" pattern. The structural cost is small at v0 and large to retrofit; do it from day one.

### Default relation type vocabulary (v0)

- `caused-by` — Event → Event | Phenomenon
- `descends-from` — Person | Faction → Faction | Phenomenon
- `member-of` — Person → Organization
- `aligned-with` / `opposed-to` — Faction → Faction
- `located-in` — Place → Place | Region
- `participated-in` — Person | Organization → Event
- `succeeded-by` / `replaced-by` — Person | Concept → Person | Concept
- `parallels` — any → any *(soft connection: thematic or structural similarity)*
- `referenced-in` — any → Source *(connects nodes to the canon they appear in)*

### Required system properties on every record

Every node, source, and connection records: who created it, when, and the chain of subsequent edits. Append-only event log over the canonical store. The query "show me every claim that depended on this source, and flag connections that are now suspect" is enabled by this audit trail and is critical when canon retcons occur.

This is the architectural commitment that makes Tier 4 possible at v2. Skipping it at v0 makes Tier 4 impossible to build later.

### Confidence as a queryable property

Confidence is not a display flag. It is a value that participates in queries. *"Show me only connections with confidence ≥ 0.8 supported by at least one CCP source."* This matters for the creator persona: a creator preparing a stream wants to filter to "only connections I'd stake my reputation on" before exporting a script outline.

### Provenance tagging on every visible string

Every piece of text the user sees in Aurora carries a provenance tag identifying *what kind of statement it is*:

- `curator-authored` — written by a human curator (node briefs, claim text on connections).
- `source-quoted` — verbatim or paraphrased excerpt from an attached source.
- `LLM-summarized-from-graph` — output of a Tier 2.5 path summarization. Every entity and edge in the output is from the curator-drawn graph.
- `LLM-flagged-as-gap` — a gap-surfacing investigation prompt. Not a claim. Requires curator action to become a connection.
- `LLM-rendered-prose` — Tier 3 synthesis output from a board region. Source-grounded by construction.

The four are visually distinct in the UI. A creator on stream can always see, at a glance, which kind of statement they're looking at. A reader of a published board can do the same.

This tagging is **the architectural commitment that makes the Tier 2.5 / Tier 3 LLM features safe.** Without it, LLM-rendered prose looks identical to curator-authored claims a week after generation, and the contamination problem from §4 becomes inevitable. With it, every reader can distinguish what humans wrote from what the tool rendered, and every claim that originated from an LLM operation can be traced back to the curator-drawn graph state that produced it.

## 6. Views — multiple lenses over the same data

Aurora's data layer must support multiple views over the same ontology. Lifted from Gotham's pattern that all applications back onto a shared object model.

The four views Aurora plans to support, in build order:

1. **Board view** *(v1, primary)* — the corkboard. Force-directed graph with curator-positioned nodes, typed edges, type-color legend, click-to-inspect. The Aurora Arcology site already prototypes this.
2. **Timeline view** *(v1, secondary)* — chronological. Same nodes and connections, organized by date. Critical for narrative storylines like Warpath.
3. **Sourcebook view** *(v2)* — organized by source. "Show me everything Ashterothi has claimed, sorted by date and topic."
4. **Curator view** *(v3)* — organized by who drew connections. "Show me where Ashterothi and Arsia disagree."

Aurora ships with views 1 and 2 at v1. Views 3 and 4 are designed-for in the data layer but not built until usage demands them.

The discipline: **same data, multiple lenses.** Click an entity in the Board view, see it on the Timeline view, see it in the Sourcebook view — all the same object, with its full audit trail visible.

## 7. Personas

### Primary: The Stream Creator

Pseudonym: "Ash."

A lore content creator producing weekly streams or videos on current EVE events with deep canonical context. Currently spends 4–6 hours researching per piece. Has the synthesis model in their head; the bottleneck is externalizing it fast enough and sourcing it well enough to defend on camera.

Ash's success criterion: *"I can prep a Warpath video in two hours instead of six, and my audience can see my receipts."*

What Ash needs: a board they curate themselves; a way to add new nodes and connections in under a minute each; a way to attach sources to connections quickly; the search-around-an-object interaction to surface connections they may have missed; a way to render a region of the board as a script outline with live source links.

### Secondary: The Researcher

Pseudonym: "Tess."

A lore enthusiast who watches Ash's videos and the official news. Wants to understand the deep connections without doing six hours of research themselves. Wants to question Ash's connections without flame-warring on Reddit.

Tess's success criterion: *"When Ash says X is connected to Y, I can click through and see why she thinks so, and decide if I agree."*

What Tess needs: a public read-only view of curators' boards; the ability to follow specific curators; eventually (v3), a way to compare how different curators have drawn the same region of the board.

### Out of scope: The Casual Player

Will use Reddit. Will not change behavior for a tool. Do not optimize for them.

## 8. Architecture decision

**Decision: standalone project with DOSSIER-influenced data model patterns.**

Reasoning unchanged from v0.1:

- A public-facing tool with creator persona and licensing concerns does not belong inside personal infrastructure (memboot, arete-context-mcp).
- DOSSIER's primitives are the right substrate, but generalizing DOSSIER to also do this would dilute both projects. Lift the patterns; do not fork the codebase.
- Standalone means Aurora can have its own brand, deployment, and public face. Community tools live or die on identity.
- The export format should be memboot-compatible. If memboot ever grows a domain-plugin capability, Aurora's data should round-trip. Build with the option open without committing to it.

### Naming and brand relationship

The Aurora Arcology Project (already shipped) is the first published artifact built on the Aurora primitive. Aurora the framework is the parent. The Arcology site is one instance. Future instances might cover other narrative universes (Foundation, Dune, Warhammer 40K, your own original IP) without changing the framework.

This positioning protects Aurora from being too tightly coupled to EVE Online forever, while making the EVE-specific work feel native rather than generic.

## 9. Phased capabilities (not a build plan — a capability sequence)

These are *what Aurora does at each phase*, not when to build them. The "when" gets decided in a separate execution doc closer to start.

### Phase 0 — The Personal Board

Single curator (you). Manual node and connection entry. CCP corpus only. Local-only, no public deployment. Default ontology vocabulary loaded. Board view only. Search-around-an-object interaction working. Append-only audit log running.

**Phase 0 success criterion:** *I can build a Warpath board with thirty nodes and fifty connections in under two hours, and the search-around-an-object interaction surfaces non-obvious connections I'd missed.*

### Phase 1 — The Public Read

Same single curator. CCP corpus. Add a public read-only web view. Add Timeline view as the second lens. Add the LLM rendering layer (synthesis from a board region) with live source links. Demo-able to a creator like Ashterothi as proof.

**Phase 1 success criterion:** *I can show the working tool to a creator and they can see, in five minutes, why it would save them four hours per video.*

### Phase 2 — The Creator Tool

Multi-curator. Each creator owns their boards. Permissioned creator-corpus ingestion or user-paste model (per L2 or L3 in §10). Sourcebook view added. Confidence-aware queries.

**Phase 2 success criterion:** *At least one creator other than you is using Aurora to prep their content.*

### Phase 3 — The Temporal Layer

Connections gain version history visualization (the audit log was always there; v3 surfaces it). Curator view added. Real-time ingestion of new official news with auto-suggested-but-never-auto-drawn connections.

### Phase 4 — Subscription / Sustainability

Whatever the business model is. Patron-supported, paid tier for advanced features, sponsored by Gorgon Media Engine as production infrastructure. The decision is made at Phase 3 with real usage data.

## 10. Licensing — flagged, not solved

The single largest open question. CCP grants a generous fan-content license for non-commercial EVE-themed projects, which covers ingesting CCP material and presenting paraphrased synthesis. *Permissioned creator content is a different problem.*

Three options, unchanged from v0.1:

**L1: CCP material only at v1.** Defer creator content to v2. Cleanest legally; weakest as a creator tool.

**L2: Permissioned creator content with explicit signed agreements.** Approach Ashterothi (and Arsia, etc.) with a working prototype and offer ownership of their curated boards in exchange for ingestion permission. Legally tractable; requires real agreements.

**L3: User-paste model — creators paste their own transcripts into their own boards.** Aurora never ingests creator content directly; it provides the structure for creators to organize their own material. Legally cleanest; requires the creator to do data entry.

**Recommendation: L3 → L2.** Start with the user-paste model (Phases 0–1 with you as the only curator pasting your own annotations). When approaching Ashterothi for Phase 2, offer the user-paste model with the option to upgrade to direct ingestion if they want it. Both options stay available; the creator decides per-curator.

## 11. Ingestion arc — two pipelines, not one

The corpus that backs Aurora has two materially different shapes, and they want different ingestion pipelines. Treating them as one thing produces a compromise design that serves neither well; treating them as two pipelines that share the data model produces a sharper architecture and clearer phase milestones.

### 11.1 The Library — static historical corpus

**Shape:** bulk, episodic, mostly stable. Hundreds to low thousands of documents from a known publisher, dating from project inception. EVE Online's situation: ~20 years of CCP-published chronicles, novels, the official EVE Universe news archive, faction backstory pages.

**Ingestion pattern:** one-time bulk import, with occasional re-ingest when canon retcons. A weekend-scale script that fetches a known set of URLs, paginates as needed, extracts text, normalises metadata (publisher, date, type), and writes `Source` records. *No daemon. No polling. No scheduler.*

**Done state is real.** The Library is "ingested" when the known historical corpus is in the database. New chronicles published after that date are caught by the Stream pipeline (§11.2), not the Library import.

**Phase target: Phase 0.5 → early Phase 1.** Specifically: after Phase 0's manual workflow proves out (you can build a board fluently from sources you've read), the next Phase 0.5 increment is *"I want to find any chronicle by searching across all of them, not just the ones I happened to remember."* The Library import unlocks this. It also dramatically increases Phase 1's public-read value — visitors can search the lore corpus, not just navigate hand-curated boards.

**Architectural notes:**
- The `sources` table stores **full text**, not just URLs. Pagination handled at the document level (one Source per chronicle, not one per page).
- Source metadata includes `publisher`, `date`, `type` (chronicle | news | novel | backstory), `license_tier`, `ingestion_method` (bulk | stream | manual), and `original_url`.
- The Library import is idempotent: re-running it on the same corpus is a no-op. This makes occasional re-ingest (after a CCP retcon) safe.
- No automatic node or connection creation from Library content. Sources land as Sources only; nodes and connections still come from curator action. The Library expands what the curator *can* cite, not what's already on the board.

### 11.2 The Stream — live ongoing news feed

**Shape:** continuous, low-volume, mostly relevant. CCP publishes new universe news every few days. A small fraction of these are storyline-relevant (NPC events, faction announcements, lore developments); the rest are operational, player-event, or product-related (patch announcements, sales, tournament results).

**Ingestion pattern:** scheduled polling (RSS or scraping), classification, queue for curator review. *Daemon-shaped.* New posts arrive on a schedule, get classified, and surface as candidates for curator action.

**Never auto-promoted to nodes or connections.** The Stream produces *Source candidates*, not facts on the board. Curator decides which posts represent storyline-relevant content worth structuring into nodes.

**Phase target: Phase 3.** This is the original spec target and it's still right. The Stream pipeline is real ongoing infrastructure — RSS polling, classification, queue management, deduplication, change detection — and it doesn't unlock value until the manual board workflow and Library are both stable.

**Architectural notes:**
- The classifier ("NPC storyline vs. player event vs. product news") is the load-bearing design problem of the Stream. Three implementation strategies, in order of safety:
  1. **CCP-tag-based filter** (preferred if the feed has structured tags). Zero new infrastructure, zero classifier failure modes. *Verify this is feasible before Phase 3 starts.*
  2. **Curator triage queue.** Every new post enters as an unclassified candidate; curator reviews and accepts/rejects/categorises. Slow but unambiguous. Reasonable Phase 3 default.
  3. **LLM classifier.** A bounded-classification call ("is this post primarily about NPC storyline events, player operational events, or product/meta news? answer with one of three labels"). Faster than triage, but introduces a model dependency in the pipeline. *Only adopt if option 1 is unavailable and triage is overwhelming.*
- The Stream writes to the same `sources` table the Library uses. Source records distinguished by `ingestion_method = "stream"` and `classification` (set by whichever strategy is in use).
- Real-time canon-change detection — *"this new post contradicts an existing source we have"* — is a distinct future capability, separable from the Stream itself. Defer to Phase 3.5 or later.

### 11.3 What the two pipelines share

Both produce `Source` records in the same table with the same schema. Both respect the same `license_tier` field. Both are subject to the same audit log. The data model is unified; only the pipelines differ.

This is the discipline: **one data model, multiple pipelines.** Same primitive everything else in Aurora reads from. The Library and the Stream feed it via different mechanisms; queries, views, and curator workflows treat their outputs identically.

### 11.4 Creator content (Ashterothi transcripts, etc.) — neither Library nor Stream

Permissioned creator content (per L2 in §10) is a third ingestion shape, distinct from both. It's bulk-shaped *per agreement* (a creator grants ingestion rights to their archive at a point in time) but stream-shaped *over time* (new videos publish weekly). It also has acute licensing constraints the other two don't.

The Phase 2 design decision: creator content uses the user-paste model (L3) by default, which is *neither* a Library import nor a Stream poll — it's manual curator entry into the existing Sources table. Creators who upgrade to L2 (direct ingestion permission) get a dedicated per-creator pipeline that resembles the Library shape but with creator-specific consent, attribution, and revocation handling.

This is intentionally underspecified at v0.4. Phase 2 is far enough away that pre-specifying it commits to assumptions about creator agreements we can't make today. The Phase 2 execution doc will resolve this when the time comes.

## 12. Recommendations

Three opinionated calls Aurora is committed to unless overridden:

1. **Architecture: standalone project with DOSSIER-influenced data model.** Not a fork, not a memboot extension. Lift the patterns; build the project clean.
2. **Phase 0 corpus: CCP material only, manually entered.** Even though creator content is the eventual differentiator, prove the workflow on legally clean material first. Then approach creators with a working prototype.
3. **Licensing path: L3 → L2.** Start with user-paste; upgrade to permissioned ingestion per-creator on the path to Phase 2.
4. **Ingestion: two pipelines, one data model.** Library import in Phase 0.5/1; Stream poll in Phase 3. Both feed the same `sources` table. *(Added in v0.4.)*

## 13. Open questions

These deliberately remain open. They are not blocking; they are flagged for the execution doc.

- **What does "drawing a connection" actually look like in the UI?** This is the demo's load-bearing interaction. Worth a whole separate design exercise before Phase 0 starts. The Aurora Arcology site's D3 component is a starting point but not a finished answer — that component is read-only; Aurora needs *create* and *edit*.
- **Should Aurora be local-first like memboot, or web-first?** Tradeoff: local-first is faster for the curator and respects creator IP; web-first is necessary for the public-read use case. Probably *both* — local Electron-style app for curation, web read-only for public view, sync via Git or similar.
- **Does Ashterothi want this?** Has to be tested with a real conversation, not assumed. Phase 1 ends with this conversation, not before it.
- **What happens when canon retcons?** The temporal layer in Phase 3 partly answers this, but the data model needs to be designed in Phase 0 to support it. The append-only audit log requirement in §5 is the architectural commitment that keeps this option open.
- **How does Aurora handle player-generated lore vs. canonical lore?** The canonicity tag on every node propagates to connections that touch the node. Worth thinking about before Phase 2.
- **What is the non-EVE expansion path?** Not a v1 question, but the framework-vs-instance positioning in §8 deserves a future thought experiment: what's the *second* universe Aurora supports? Foundation? Dune? Worth knowing the answer before naming it.
- **Does CCP's news feed have structured tags distinguishing NPC storyline from player events from product news?** Determines whether the Stream's classifier is option 1 (free) or option 2 (curator triage) or option 3 (LLM). *Verify before Phase 3 design begins.* (Added in v0.4.)
- **What does "creator content ingestion" actually look like once a creator has agreed?** Phase 2 problem, but the answer affects Phase 1 architecture if not flagged early. The current default is user-paste (L3); the L2 upgrade path needs design when Phase 2 approaches. (Added in v0.4.)

## 14. Forward-deployed engineering note

A working version of Aurora is, structurally, an investigation-board interface for graph-structured analysis with provenance, dynamic ontology, audit logging, and multi-view rendering. *Aurora is a smaller, single-domain instance of the Palantir Gotham pattern.* This is not coincidence — both products solve the same problem (analytical synthesis over heterogeneous sources) for different audiences (intelligence analysts vs. lore creators).

This is not a reason to build the tool. It is a reason to know what you're building when you build it.

A working, public, demo-able lore-investigation tool with a defensible data model, a working search-around-an-object interaction, an append-only audit log, and a multi-view architecture is **a remarkable portfolio piece for forward-deployed and AI-enablement roles at Palantir, Scale AI, Glean, and Anthropic.** It is more compelling evidence of the analytical pattern those companies hire for than a personal CRUD app, a portfolio of dev-tooling packages, or another LLM wrapper. It is, accidentally, one of the strongest possible demonstrations of the career lane being targeted.

The implication: when Aurora gets built, build it well enough to demo. Don't ship slop; ship something that holds up to a forward-deployed engineer asking "show me how the data model handles a contested claim across two retconned sources."

---

## Appendix A — Glossary

- **Aurora** — the framework. An investigation-board tool for narrative universes.
- **Aurora Arcology Project** — the first published artifact built on Aurora. A Jove-framed lore showcase site, already shipped.
- **Board** — a curator's view of nodes and connections on a topic. Multiple boards can exist for the same topic, curated by different people.
- **Node** — an entity in the world (Event, Person, Organization, etc.). Type drawn from the editable ontology vocabulary.
- **Connection** — a typed edge between two nodes. First-class object with its own provenance, confidence, and contestability.
- **Source** — a citable piece of canonical or community material with publisher, date, URL, and license tier.
- **Curator** — a person who maintains one or more boards.
- **Vocabulary** — the editable set of node types and relation types. Data, not code.
- **Audit log** — append-only event log capturing every change to the data layer. Enables temporal queries and retcon handling.
- **Canonicity** — a node's status as official canon, creator-asserted, community-speculated, or player-generated.
- **Search-around-an-object** — the signature interaction. Select a node, see its n-degree neighborhood with type-aware filtering.

## Appendix B — What this spec deliberately does *not* contain

- A build timeline or week-by-week plan. *The execution doc handles this, written closer to start.*
- A tech stack decision. *Implied by "standalone, DOSSIER-influenced data model," but not fixed.*
- A UI mockup. *The "drawing a connection" interaction deserves its own design exercise.*
- A business model. *Phase 4 placeholder only.*
- A specific outreach plan for Ashterothi. *Phase 1 deliverable.*
- A non-EVE expansion plan. *Open question for the future, not a v1 commitment.*

These are not oversights. They are deferred to keep the spec at strategic-direction altitude, where it should be when the earliest start is two-plus weeks away.

---

## Changelog

### v0.4 (May 2026)

**Ingestion arc as cross-cutting concern.** Adds §11 "Ingestion arc — two pipelines, not one." Renumbers former §11 (Recommendations) → §12, §12 (Open questions) → §13, §13 (Forward-deployed note) → §14.

The previous spec versions described ingestion in fragments scattered across phase descriptions and the licensing section. v0.4 consolidates the corpus question into a single section and commits to the **two-pipeline framing**: a Library (bulk historical import, Phase 0.5/1, done-state) and a Stream (live ongoing news poll, Phase 3, daemon-shaped). Both write to the same `sources` table; only the pipelines differ.

This consolidation produced two architectural commitments worth flagging:

1. **The Library import lands earlier than originally specified** — Phase 0.5 to early Phase 1, not Phase 3. Reasoning: once Phase 0's manual workflow proves out, the next obvious capability is search across the entire chronicled corpus, and that capability dramatically increases Phase 1's public-read value. Postponing Library import to Phase 3 hides it behind harder, slower work.
2. **The Stream's classifier is the load-bearing design problem of Phase 3.** Three implementation strategies named in priority order: CCP-tag-based (free, preferred), curator triage (slow but unambiguous, default), LLM classifier (last resort). Verifying CCP feed structure before Phase 3 starts is now an open question.

**Recommendations updated.** Added a fourth recommendation: "Ingestion: two pipelines, one data model."

**Open questions added.** Two new entries: CCP feed tag structure (Phase 3 prerequisite); creator content ingestion mechanics post-L2 agreement (Phase 2 design).

**Phase 0 unchanged.** Phase 0's manual-workflow scope is preserved. The Library import begins Phase 0.5; Phase 0 ships first.

**Phase 0 execution doc gets a single corresponding edit:** the `sources` table schema is clarified to store full text (not just URLs), in anticipation of bulk Library import in Phase 0.5. This is the only Phase 0 implementation change.

### v0.3 (May 2026)

**LLM operations bounded.** Adds Tier 2.5 (path summarization & gap surfacing) as a deliberately scoped LLM-assisted capability, distinct from Tier 3 (synthesis rendering). Strengthens the §4 "no theory generation" non-goal to apply explicitly to LLM operations. Adds the provenance-tagging requirement in §5 that makes the Tier 2.5 and Tier 3 features safe by construction.

The spec previously had a single non-goal forbidding "theory generation" but no positive specification of *what LLM operations Aurora does support*. The user request that prompted this revision — "spotting deeper connections" — surfaced the gap. v0.3 closes it by:

1. **Naming the safe operations explicitly** (path summarization, gap surfacing, prose rendering) so the implementation has clear targets.
2. **Strengthening the forbidden boundary** with an enforceable rule: LLM output must validate against the graph; entities and relations not in the graph cannot appear; epistemic hedges not quoted from sources are rejected.
3. **Requiring provenance tags on every visible string** so curator-authored content, source quotes, LLM summaries, gap flags, and rendered prose are visually distinct at all times.

The discipline this imposes: Aurora's LLM features are *graph-bounded*, not *corpus-bounded*. The LLM operates on the curator-drawn structure, not the underlying source text. This is enforceable in code and is the architectural difference between a tool creators can trust and a tool that quietly hallucinates lore.

**No other sections changed in v0.3.** Phases, personas, architecture, licensing, and naming all carry forward from v0.2 unchanged.

### v0.2 (May 2026)

**Rename.** Project renamed from "Stringer" / "lore-DOSSIER" to **Aurora**. The Aurora Arcology Project (already shipped) is repositioned as the first artifact built on Aurora the framework. Naming convention: Aurora is the parent; specific lore boards are instances.

**Gotham-inspired architectural edits**, in five places:

1. **§2** — Added explicit Gotham comparison subsection. Aurora is, in concept, a smaller and lighter expression of the same primitive.
2. **§5** — *Ontology vocabulary is data, not code.* Node types and relation types are editable in-app, not hard-coded. Lifted from Gotham's dynamic ontology pattern.
3. **§5** — *Append-only audit log* required from v0. Enables retcon handling and Tier 4 temporal queries. Architectural commitment now, payoff at v2/v3.
4. **§5** — *Confidence is a queryable property,* not a display flag. Creators filter to "connections I'd stake my reputation on" via query, not via UI toggle.
5. **§6** — New section. *Multiple views over the same data.* Board (v1), Timeline (v1), Sourcebook (v2), Curator (v3). All views back onto the same ontology. Lifted from Gotham's shared-object-model pattern.

**Use case ranking refined.** Tier 1 now explicitly names search-around-an-object as the killer interaction. Tier 3 (synthesis) gains the live-source-link property from Gotham's Dossier feature.

**Non-goal added.** "Not Gotham." Aurora ships a small, opinionated surface area, not a dozen integrated applications.

**§13 (forward-deployed note) strengthened.** The Gotham parallel is now explicit. Aurora is structurally a single-domain instance of the Gotham pattern, and saying so plainly improves the spec's defensibility as a portfolio artifact.

**§9 phase success criteria added.** Each phase now has a single concrete success criterion to test against, not just a description of capabilities.

**§12 open questions expanded.** Added the non-EVE expansion path as a flagged future thought experiment.

### v0.1 (May 2026)

Initial restart from earlier "lore-DOSSIER" framing. Wire-board thesis introduced. Use cases ranked. Personas defined. Architecture decision (standalone). Licensing options flagged.
