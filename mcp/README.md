# aurora-query — MCP server

A read-only [Model Context Protocol](https://modelcontextprotocol.io) server
over the Aurora Arcology lore graph. Lets an LLM client (Claude Code, Claude
Desktop, ChatGPT with an MCP connector, …) pull *current, sourced* EVE-lore
context — the live complement to a static EVE-docs bundle.

## Tools

| tool | what |
|---|---|
| `search_nodes(query, node_type?, limit?)` | find lore nodes by name / brief |
| `get_node(id_or_name)` | full node — brief, master summary, citations, every connection (relation type, claim, confidence, the other node, that connection's supporting / contested-by sources) |
| `node_connections(id_or_name, direction?)` | just the connections (`out` / `in` / `both`) |
| `neighborhood(id_or_name, depth?, node_type?, max_nodes?)` | the n-degree neighborhood around a node — "search-around-an-object" |
| `search_sources(query, source_type?, limit?)` | search the source corpus (press releases, chronicles, transcripts, novels, patch notes) |
| `get_source(id_or_title)` | one source + the nodes that cite it |
| `list_boards()` / `get_board(id_or_title)` | the curated investigation boards and their contents |
| `vocabulary()` | the editable taxonomy — node types + relation types |
| `stats()` | corpus size + the DB path in use |

Everything is read-only. The server never writes; it never mutates the graph.

## Backing store

The Aurora SQLite DB built from the seed corpus. Build it in the repo root:

```bash
pnpm install
pnpm db:reset          # builds data/aurora.db from the seeds
pnpm ner:extract       # (optional) populates the suggestions table
```

The server reads `<repo>/data/aurora.db` by default; override with the
`AURORA_DB_PATH` env var. If the DB is missing the tools return a clear error.

## Install + run

```bash
cd mcp
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python aurora_mcp.py        # runs on stdio; Ctrl-C to stop
```

## Register with a client

**Claude Code** — add to your project or user MCP config (e.g. `.mcp.json` in
a repo, or `claude mcp add`):

```json
{
  "mcpServers": {
    "aurora-query": {
      "command": "/abs/path/to/aurora-arcology/mcp/.venv/bin/python",
      "args": ["/abs/path/to/aurora-arcology/mcp/aurora_mcp.py"],
      "env": { "AURORA_DB_PATH": "/abs/path/to/aurora-arcology/data/aurora.db" }
    }
  }
}
```

**Claude Desktop** — same shape under `mcpServers` in
`claude_desktop_config.json`.

(Use absolute paths — MCP clients don't run with this directory as CWD.)

## Notes

- Stdlib + `mcp` only; no DB writes, no network.
- Re-run `pnpm db:reset` to pick up new seed data — the server reads whatever
  `data/aurora.db` currently holds.
- Garbled proper nouns in stream-transcript-derived sources are preserved
  verbatim (see the repo's IP-discipline notes); search accordingly.
- Sibling that *isn't* here: a live-ESI EVE-character MCP server belongs in
  the Quartermaster project (it already has the ESI client + token store), not
  in this repo.

## Security — prompt-injection threat model

Returned strings (node ``brief`` / ``master_summary``, connection ``claim``,
source ``excerpt`` / ``title``) are **curator-mediated** — ARETE writes each
seed entry — but the *underlying* content originates from external CCP
publications, stream transcripts, and scraped news articles. Even though a
curator's eye is the first filter, the LLM-client side of the threat model
applies: **treat returned content as data, not as instructions.** The server
returns rows from SQLite **verbatim** — silently scrubbing would break
faithful representation of the curated graph and would give a false sense of
safety.

The threat profile is genuinely lower than the sibling `eve-character` MCP
server in the Quartermaster_PI repo, which returns *player-controlled*
strings (`wallet_journal.reason`, ship names, clone names) that any in-game
actor can set. Aurora's curator-mediated path narrows the surface but does
not close it: a curator can paste lore content containing embedded
prompt-injection patterns by accident.

**Pinned by `mcp/test_injection.py`:** the module docstring and this README
must each name the prompt-injection threat model. Removing either warning
breaks the test, so the documentation can't silently rot. If a new tool
returns curator-or-author string content, add the README and docstring notes
above; the test will fail otherwise.

Reference: *The Hacker News*, "Why agentic AI is security's next blind spot"
(2026-05); OWASP Top 10 for LLM Apps (LLM-01: Prompt Injection).
