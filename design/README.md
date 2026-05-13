# design/

Design artifacts for Aurora the *framework* (Phase 0+). Not shipped — these
inform implementation, they aren't part of the Next.js app.

- **`connection-drawing.md`** — Phase 0 Week 1's load-bearing decision: how a
  curator draws a connection between two nodes. Evaluates three patterns
  against the exec-doc criteria; recommends **two-click select** as the
  primary interaction (command palette deferred as a power path; drag-from-
  handle rejected for Phase 0). *To be validated by feeling the mockups
  before code begins.*
- **`mockups/`** — standalone static HTML (no build step, no framework, fake
  data). Open in a browser:
  - `mockups/two-click.html` — the recommended pattern. + Connect → click two
    nodes → modal pre-fills the relation type from the node-type pair → save;
    connect mode stays on for batch drawing, Esc exits.
  - `mockups/drag-handle.html` — Pattern 1. Hover → grab the rim handle → drag
    → drop on target. (Rejected — see the decision doc for why.)
  - `mockups/command-palette.html` — Pattern 3. ⌘K → `connect A to B` with
    fuzzy autocomplete → Enter → same modal. (Deferred — keep as a later
    power-user path.)

Next step (per `aurora-phase0-execution-v1.1.md` Weekend 1 → 2): feel the
mockups, confirm or revise the choice, then Weekend 2 builds the data layer
(`events` append-only log + `replay()` + the four mutation API routes).
