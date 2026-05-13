# Connection-drawing interaction — design decision

> **Phase 0, Week 1 deliverable** (per `aurora-phase0-execution-v1.1.md` §2.5, §3, Day-1 checklist).
> **Status:** decision drafted 2026-05-12 — *to be validated by feeling the mockups before code begins (Week 3).* This doc may be revised after mockup play.
> **Three patterns evaluated:** drag-from-handle · two-click select · command palette. Static mockups in `design/mockups/`.

---

## The problem (why this is Week 1's load-bearing decision)

A curator workflow lives or dies on its primary action. Drawing a connection is the primary action — a board is nodes plus *typed, sourced, first-class connections between them*, and the connections are the part that takes work. If it takes 30 seconds and 5 clicks, no board gets populated. If it takes ~5 seconds and one fluid gesture, populating is pleasurable and the tool succeeds. There is no recovering from the wrong interaction shipped first, so it's chosen *before* the data-model code.

A "connection" here is not a bare edge. Per the spec, it carries: source & target node, relation type (from the editable `relation_types` vocabulary), claim text, confidence (0–1), curator, drawn-at timestamp, and a list of supporting / contested-by sources. So the interaction is really two beats:

1. **Pick the pair** — which two nodes.
2. **Fill the connection** — a modal: relation type (pre-suggested), confidence, claim text, source attachment.

Beat 2 is the same modal regardless of how beat 1 works. The three patterns differ only in beat 1. That's the thing being decided.

---

## Evaluation criteria (from the exec doc)

| # | Criterion | Why it matters |
|---|---|---|
| C1 | **Speed** — seconds to add one connection | The 30-nodes-50-connections-in-under-2-hours success test. |
| C2 | **Discoverability** — figure it out without docs | Phase 1 ends with a creator "getting it" in five minutes. |
| C3 | **Mid-stream usability** — could Ashterothi do this *while talking on a live stream* | Phase 2's success criterion is a creator actually using it. Live-stream is the hardest case: hands and attention are split. |
| C4 | **Mobile / tablet** — works without a mouse | Curators sketch on tablets; the exec doc Appendix-A flags this as open. |
| C5 | **Error recovery** — start a connection, change your mind | A primary action you can't bail out of cleanly becomes a primary action you avoid. |

Plus one practical constraint: it has to compose with the existing `BoardView.tsx` D3 force-directed graph (nodes already have positions, drag-to-reposition, click-to-inspect via `NodeInspector`). Whatever we add can't fight the behaviours already there.

---

## Pattern 1 — Drag-from-handle

**Flow:** hover a node → a small handle (•→) appears on its rim → press and drag from the handle → a "rubber-band" line follows the cursor → release over a target node → the connection modal opens with `source = first node, target = node you dropped on`. Release over empty space = cancel.

**Mockup:** `design/mockups/drag-handle.html`

- C1 **Speed: A.** One continuous gesture. Fastest of the three *when it lands cleanly.*
- C2 **Discoverability: B.** The handle-on-hover-then-drag idiom is familiar from Figma/diagram tools — but only once you've hovered and noticed the handle. Not zero-doc, close.
- C3 **Mid-stream: D.** Press-drag-release demands a precise sustained gesture; doing it accurately while narrating and watching chat is exactly the case it's worst at. One slipped drop and you've made a wrong connection (and now have to delete it — which on a first-class object means *supersede*, not undo).
- C4 **Mobile/tablet: D.** Touch-drag from a small rim handle is fiddly; the handle competes with the existing drag-to-reposition gesture; long-press disambiguation adds latency. The existing D3 node-drag already owns "press and move a node" — adding a second press-drag meaning is an ergonomics collision.
- C5 **Error recovery: B.** "Drop on empty space = cancel" is clean — but a *mis*-drop on the wrong node isn't a cancel, it's a wrong connection that needs superseding.

**Verdict:** the speed champion on a good day, disqualified by C3+C4. Aurora's Phase-2 bet is "Ashterothi uses it"; an interaction whose worst case is "live-streaming on a tablet" can't be the primary path.

---

## Pattern 2 — Two-click select  ⟵ recommended

**Flow:** toggle **Connect mode** (a button in the board toolbar, or hold a modifier — `C`) → the cursor/board picks up a subtle "connecting" affordance → click node A (it gets a "source" ring) → click node B → the connection modal opens, pre-filled: `source = A, target = B, relation type = the default for that node-type pair` (e.g. Person→Organization ⇒ `member-of`; Event→Event ⇒ `caused-by`; Faction→Faction ⇒ `opposed-to`) — curator confirms/changes the type, sets confidence, writes the claim, attaches a source, saves. `Esc` or clicking empty space after the first click cancels; the connection isn't created until the modal's Save. Connect mode stays on for rapid batch-drawing (draw five connections off the same node without re-toggling); `Esc` exits the mode.

**Mockup:** `design/mockups/two-click.html`

- C1 **Speed: A−.** Two clicks + a mostly-pre-filled modal. A hair slower than a perfect drag, but it has *no failure mode that costs you time* — there's no "missed the drop, start over." With the node-pair relation-type suggestion the modal is often two confirmations (type ✓, source ✓) plus a sentence of claim text. Batch mode (mode stays on) makes "everything that connects to the Warpath node" a rhythm: click Warpath, click X, save; click Warpath, click Y, save.
- C2 **Discoverability: A.** "Click the things you want to connect" is the most obvious instruction in software. The Connect-mode toggle makes the state explicit (you always know whether a click means "inspect" or "connect"), so no surprise connections.
- C3 **Mid-stream: A.** Two discrete clicks with no sustained gesture, no precision drag, no typing-from-memory. This is the one a creator can do mid-sentence without looking. The explicit mode toggle is also *narratable* — "okay, I'm drawing connections now" maps to a real UI state.
- C4 **Mobile/tablet: A−.** Two taps. Works with a finger. Doesn't collide with the existing node-drag (different mode). Only caveat: on a small screen the modal needs a mobile layout — but that's true of every pattern's beat 2.
- C5 **Error recovery: A.** After click 1, `Esc`/empty-click cancels; after click 2 you're in the modal, where Cancel discards (nothing was written). Because creation only commits on Save, there's no "made a wrong connection" mid-flow at all.

**Verdict:** wins or ties on every criterion except a sliver of raw speed vs. a flawless drag — and beats drag decisively on the two criteria (C3, C4) that the project's success bets actually depend on. It's also the cheapest of the three to implement *well* (no rubber-band hit-testing, no touch-vs-drag disambiguation, no fuzzy-name autocomplete index) and the easiest to make accessible (it's just buttons and clicks). **This is the primary interaction.**

---

## Pattern 3 — Command palette

**Flow:** `⌘K` / `Ctrl-K` opens a palette → type `connect Warpath to Deathless` → fuzzy-autocomplete on node names resolves `Warpath` and `Deathless` to nodes → Enter creates a *draft* connection and opens the same modal. (Variant: `connect` with no args → palette walks you through "from?" → "to?" with autocomplete at each step.)

**Mockup:** `design/mockups/command-palette.html`

- C1 **Speed: B / A.** Blazing *if you remember the exact node names and can type*; slow when you're hunting for "what was that org called again" — at which point you're back to the graph anyway.
- C2 **Discoverability: D.** `⌘K` is invisible. Nobody finds this without being told. (Mitigable with a visible "⌘K" hint, but it's still a learned gesture, not a discovered one.)
- C3 **Mid-stream: C.** Typing two node names from memory while narrating is harder than two clicks, and a typo sends you into autocomplete-fixing mid-sentence.
- C4 **Mobile/tablet: D.** No `⌘` key; typing on a tablet; the whole idiom is keyboard-native.
- C5 **Error recovery: A.** It's a text field — clear it, `Esc` closes. Nothing commits until the modal Save.

**Verdict:** not the primary interaction — but a genuinely good *power-user accelerant* once a curator knows the corpus. **Add it in a later phase as a second path, not Phase 0's primary.** It should produce the exact same draft-connection + modal as the two-click path, so it's purely additive.

---

## Decision

| | C1 Speed | C2 Discover | C3 Mid-stream | C4 Mobile | C5 Recovery | Build cost |
|---|---|---|---|---|---|---|
| Drag-from-handle | **A** | B | **D** | **D** | B | medium (hit-testing, touch disambiguation) |
| **Two-click select** | A− | **A** | **A** | A− | **A** | **low** |
| Command palette | B/A | **D** | C | **D** | A | medium (fuzzy index) |

**Chosen primary interaction: two-click select (Pattern 2).** Rationale in one line: it's the only pattern that's *good at the cases the project's success criteria actually live in* (a creator using it mid-stream, on a tablet) while still being fast, obvious, robust, and the cheapest to build well.

**Also adopted:**
- The **connection modal (beat 2)** is shared by all paths and is where connections' first-class-ness lives: relation type (pre-suggested from the node-type pair, editable), confidence slider, claim text, source attachment — with the provenance prompt from `CLAUDE.md` ("no source yet? → downgrade confidence and add a contested-by note rather than dropping the claim"). Creation commits only on the modal's Save; every save writes an `audit_log` entry (Phase-0 §2.3 event log).
- **Connect mode stays on** after a save (for batch-drawing off one node); `Esc` exits. The mode is an explicit, visible state so a click is never ambiguously "inspect" vs "connect".
- **Command palette (Pattern 3) is deferred**, not rejected — it's a later-phase power path that produces the same draft + modal. Drag-from-handle is **rejected** for Phase 0 (the C3/C4 penalty is disqualifying for this tool's audience).

**Stop condition still applies** (exec doc §5.1): if feeling the mockups says two-click is wrong, don't ship the least-bad one — sleep on it and bring a fourth option. But the criteria-vs-mockup case for two-click is strong enough to start Week 2's data-layer work in parallel.

---

## Open questions carried into implementation (Appendix A of the exec doc)

- Mobile modal layout for beat 2 — needs a phone/tablet pass; the *selection* is fine on touch, the modal needs a responsive form.
- How aggressive should the node-type-pair → relation-type suggestion be? A wrong default that the curator has to correct every time is worse than no default. Start conservative (suggest only for the handful of unambiguous pairs); widen with usage data.
- Does Connect-mode need to *also* support "click a node, then click a *new* node-creation hotspot" so you can connect-to-a-node-that-doesn't-exist-yet in one flow? Probably yes, eventually — but Phase 0 can require the target node to exist first.
