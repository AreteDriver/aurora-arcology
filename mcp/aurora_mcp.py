#!/usr/bin/env python3
"""
aurora-query — an MCP server over the Aurora Arcology lore graph.

Exposes the EVE-lore investigation graph (nodes, first-class typed
connections with claim text + confidence + source citations, sources, the
curated boards) as read-only MCP tools, so an LLM client (Claude Code,
Claude Desktop, ChatGPT with an MCP connector, …) can pull *current,
sourced* lore context — the live complement to a static EVE-docs bundle.

Backing store: the Aurora SQLite DB built from the seed corpus
(`pnpm db:reset` in the aurora-arcology repo). Path defaults to
`<repo>/data/aurora.db`, override with `AURORA_DB_PATH`. Opened read-only;
this server never writes.

Run:  AURORA_DB_PATH=/path/to/aurora.db  python aurora_mcp.py     (stdio)
   or register it (see mcp/README.md) and let the client launch it.

Stdlib + `mcp` only.

Threat model — prompt injection via lore-graph content. Returned strings
(node ``brief`` / ``master_summary``, connection ``claim``, source
``excerpt`` / ``title``) are curator-mediated but originate from external
publications, stream transcripts, and scraped news articles. The MCP server
returns them **verbatim** — fidelity matters — and the threat model is
documented in ``mcp/README.md`` §Security. The defense is the consuming
LLM client's job: treat lore-graph content as data, not instructions.
Sibling: the ``eve-character`` MCP server in the Quartermaster_PI repo
addresses the higher-threat case of *player-controlled* string content.
"""
from __future__ import annotations

import os
import sqlite3
from pathlib import Path
from typing import Any

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("aurora-query")

_DEFAULT_DB = Path(__file__).resolve().parents[1] / "data" / "aurora.db"


def _db_path() -> Path:
    return Path(os.environ.get("AURORA_DB_PATH", str(_DEFAULT_DB))).expanduser()


def _conn() -> sqlite3.Connection:
    p = _db_path()
    if not p.exists():
        raise FileNotFoundError(
            f"Aurora DB not found at {p}. In the aurora-arcology repo run "
            "`pnpm db:reset` (and `pnpm ner:extract`) to build it, or set AURORA_DB_PATH."
        )
    c = sqlite3.connect(f"file:{p}?mode=ro", uri=True)
    c.row_factory = sqlite3.Row
    return c


def _rows(c: sqlite3.Connection, sql: str, args: tuple = ()) -> list[dict]:
    return [dict(r) for r in c.execute(sql, args).fetchall()]


def _resolve_node(c: sqlite3.Connection, id_or_name: str) -> dict | None:
    r = c.execute("SELECT * FROM nodes WHERE id = ?", (id_or_name,)).fetchone()
    if r:
        return dict(r)
    # exact name (case-insensitive), then prefix, then substring — first hit wins
    for clause, arg in (
        ("name = ? COLLATE NOCASE", id_or_name),
        ("name LIKE ? COLLATE NOCASE", id_or_name + "%"),
        ("name LIKE ? COLLATE NOCASE", "%" + id_or_name + "%"),
    ):
        r = c.execute(f"SELECT * FROM nodes WHERE {clause} ORDER BY length(name) LIMIT 1", (arg,)).fetchone()
        if r:
            return dict(r)
    return None


def _node_brief(c: sqlite3.Connection, node_id: str) -> dict | None:
    r = c.execute("SELECT id, name, type, date FROM nodes WHERE id = ?", (node_id,)).fetchone()
    return dict(r) if r else None


def _node_citations(c: sqlite3.Connection, node_id: str) -> list[dict]:
    return _rows(
        c,
        """SELECT s.id, s.title, s.type, s.publisher, s.url, s.date, s.canonicity, s.excerpt
           FROM node_sources ns JOIN sources s ON s.id = ns.source_id
           WHERE ns.node_id = ? ORDER BY s.date DESC""",
        (node_id,),
    )


def _connection_sources(c: sqlite3.Connection, conn_id: str) -> list[dict]:
    return _rows(
        c,
        """SELECT cs.role, cs.excerpt, cs.note,
                  s.id AS source_id, s.title, s.type, s.publisher, s.url, s.date
           FROM connection_sources cs LEFT JOIN sources s ON s.id = cs.source_id
           WHERE cs.connection_id = ?""",
        (conn_id,),
    )


def _connections_for(c: sqlite3.Connection, node_id: str, direction: str = "both", with_sources: bool = True) -> list[dict]:
    where = {
        "out": "src_node_id = ?",
        "in": "tgt_node_id = ?",
        "both": "src_node_id = ? OR tgt_node_id = ?",
    }[direction]
    args = (node_id,) if direction != "both" else (node_id, node_id)
    out: list[dict] = []
    for row in c.execute(f"SELECT * FROM connections WHERE {where}", args):
        r = dict(row)
        other_id = r["tgt_node_id"] if r["src_node_id"] == node_id else r["src_node_id"]
        out.append({
            "id": r["id"],
            "direction": "outgoing" if r["src_node_id"] == node_id else "incoming",
            "relation_type": r["relation_type"],
            "claim": r["claim"],
            "confidence": r["confidence"],
            "curator": r["curator"],
            "src_node": _node_brief(c, r["src_node_id"]),
            "tgt_node": _node_brief(c, r["tgt_node_id"]),
            "other_node": _node_brief(c, other_id),
            **({"sources": _connection_sources(c, r["id"])} if with_sources else {}),
        })
    out.sort(key=lambda x: -(x["confidence"] or 0))
    return out


# --------------------------------------------------------------------------- #
# Tools
# --------------------------------------------------------------------------- #
@mcp.tool()
def search_nodes(query: str, node_type: str | None = None, limit: int = 20) -> list[dict[str, Any]]:
    """Find lore nodes (actors in the world) by name or brief text.

    Args:
        query: substring to match against node name and brief (case-insensitive).
        node_type: optional filter — one of the vocabulary types (Event, Person,
            Organization, Faction, Place, Phenomenon, Concept, Artifact). See vocabulary().
        limit: max results (default 20).

    Returns: id, name, type, brief, date, canonicity for each match — name hits ranked first.
    """
    with _conn() as c:
        like = f"%{query}%"
        sql = ("SELECT id, name, type, brief, date, canonicity, "
               "(name LIKE ? COLLATE NOCASE) AS name_hit FROM nodes "
               "WHERE (name LIKE ? COLLATE NOCASE OR IFNULL(brief,'') LIKE ? COLLATE NOCASE)")
        args: list = [like, like, like]
        if node_type:
            sql += " AND type = ? COLLATE NOCASE"
            args.append(node_type)
        sql += " ORDER BY name_hit DESC, length(name) LIMIT ?"
        args.append(int(limit))
        out = _rows(c, sql, tuple(args))
        for r in out:
            r.pop("name_hit", None)
        return out


@mcp.tool()
def get_node(id_or_name: str) -> dict[str, Any]:
    """Full detail on one lore node: its brief, the curator's master summary
    (synthesis paragraph), source citations, and every connection touching it
    (relation type, claim text, confidence, the other node, and that
    connection's supporting / contested-by sources).

    Args:
        id_or_name: a node id (e.g. "evt_warpath_protocol_failure") or a name
            (exact, prefix, or substring — first/shortest match wins).

    Returns: the node record + `citations` + `connections`. Empty dict with an
    `error` key if no node matches.
    """
    with _conn() as c:
        n = _resolve_node(c, id_or_name)
        if not n:
            return {"error": f"no node matches {id_or_name!r}", "hint": "try search_nodes() first"}
        return {
            **n,
            "citations": _node_citations(c, n["id"]),
            "connections": _connections_for(c, n["id"], "both", with_sources=True),
        }


@mcp.tool()
def node_connections(id_or_name: str, direction: str = "both") -> list[dict[str, Any]]:
    """Just the connections touching a node (lighter than get_node).

    Args:
        id_or_name: node id or name.
        direction: "out" (this node is the source), "in" (the target), or "both" (default).
    """
    if direction not in ("out", "in", "both"):
        return [{"error": "direction must be 'out', 'in', or 'both'"}]
    with _conn() as c:
        n = _resolve_node(c, id_or_name)
        if not n:
            return [{"error": f"no node matches {id_or_name!r}"}]
        return _connections_for(c, n["id"], direction, with_sources=True)


@mcp.tool()
def neighborhood(id_or_name: str, depth: int = 1, node_type: str | None = None, max_nodes: int = 60) -> dict[str, Any]:
    """The n-degree neighborhood around a node — the "search-around-an-object"
    move. Returns the nodes reachable within `depth` connection hops and the
    connections among them. Useful for "what's the context around X".

    Args:
        id_or_name: node id or name (the center).
        depth: how many hops out (1 = direct neighbors, default 1; capped at 3).
        node_type: optional — only include neighbors of this type when expanding.
        max_nodes: safety cap on neighborhood size (default 60).

    Returns: `center` (node brief), `nodes` (briefs), `connections` (between included nodes).
    """
    depth = max(1, min(int(depth), 3))
    with _conn() as c:
        center = _resolve_node(c, id_or_name)
        if not center:
            return {"error": f"no node matches {id_or_name!r}", "hint": "try search_nodes() first"}
        included: dict[str, dict] = {center["id"]: _node_brief(c, center["id"])}  # type: ignore[dict-item]
        frontier = {center["id"]}
        for _ in range(depth):
            nxt: set[str] = set()
            for nid in frontier:
                for conn in c.execute(
                    "SELECT src_node_id, tgt_node_id FROM connections WHERE src_node_id = ? OR tgt_node_id = ?",
                    (nid, nid),
                ):
                    other = conn["tgt_node_id"] if conn["src_node_id"] == nid else conn["src_node_id"]
                    if other in included:
                        continue
                    ob = _node_brief(c, other)
                    if ob is None:
                        continue
                    if node_type and ob["type"].lower() != node_type.lower():
                        continue
                    included[other] = ob
                    nxt.add(other)
                    if len(included) >= max_nodes:
                        break
                if len(included) >= max_nodes:
                    break
            frontier = nxt
            if not frontier or len(included) >= max_nodes:
                break
        idset = set(included)
        conns = [
            {
                "id": r["id"], "relation_type": r["relation_type"], "claim": r["claim"],
                "confidence": r["confidence"], "src": r["src_node_id"], "tgt": r["tgt_node_id"],
            }
            for r in c.execute("SELECT * FROM connections").fetchall()
            if r["src_node_id"] in idset and r["tgt_node_id"] in idset
        ]
        conns.sort(key=lambda x: -(x["confidence"] or 0))
        return {
            "center": included[center["id"]],
            "depth": depth,
            "nodes": list(included.values()),
            "connections": conns,
            "truncated": len(included) >= max_nodes,
        }


@mcp.tool()
def search_sources(query: str, source_type: str | None = None, limit: int = 20) -> list[dict[str, Any]]:
    """Search the source corpus (press releases, chronicles, stream transcripts,
    novels, patch notes, …) by title / publisher / excerpt.

    Args:
        query: substring (case-insensitive) matched against title, publisher, excerpt.
        source_type: optional filter on source type (e.g. "Chronicle", "Press Release", "Stream Transcript").
        limit: max results (default 20).

    Returns: id, title, type, publisher, url, date, canonicity, excerpt, and the
    number of nodes that cite this source.
    """
    with _conn() as c:
        like = f"%{query}%"
        sql = ("SELECT s.id, s.title, s.type, s.publisher, s.url, s.date, s.canonicity, s.excerpt, "
               "(SELECT COUNT(*) FROM node_sources ns WHERE ns.source_id = s.id) AS cited_by_nodes, "
               "(s.title LIKE ? COLLATE NOCASE) AS title_hit FROM sources s "
               "WHERE (s.title LIKE ? COLLATE NOCASE OR s.publisher LIKE ? COLLATE NOCASE OR IFNULL(s.excerpt,'') LIKE ? COLLATE NOCASE)")
        args: list = [like, like, like, like]
        if source_type:
            sql += " AND s.type = ? COLLATE NOCASE"
            args.append(source_type)
        sql += " ORDER BY title_hit DESC, cited_by_nodes DESC, s.date DESC LIMIT ?"
        args.append(int(limit))
        out = _rows(c, sql, tuple(args))
        for r in out:
            r.pop("title_hit", None)
        return out


@mcp.tool()
def get_source(id_or_title: str) -> dict[str, Any]:
    """Detail on one source + the nodes that cite it.

    Args:
        id_or_title: source id (e.g. "src_news_warpath_failure") or a title substring.
    """
    with _conn() as c:
        r = c.execute("SELECT * FROM sources WHERE id = ?", (id_or_title,)).fetchone()
        if not r:
            r = c.execute(
                "SELECT * FROM sources WHERE title LIKE ? COLLATE NOCASE ORDER BY length(title) LIMIT 1",
                ("%" + id_or_title + "%",),
            ).fetchone()
        if not r:
            return {"error": f"no source matches {id_or_title!r}"}
        s = dict(r)
        s["cited_by"] = _rows(
            c,
            "SELECT n.id, n.name, n.type FROM node_sources ns JOIN nodes n ON n.id = ns.node_id WHERE ns.source_id = ?",
            (s["id"],),
        )
        return s


@mcp.tool()
def list_boards() -> list[dict[str, Any]]:
    """List the curated investigation boards (each a hand-picked subset of the
    graph) with node counts. Use get_board() to pull one."""
    with _conn() as c:
        return _rows(
            c,
            """SELECT b.id, b.title, b.curator, b.description,
                      (SELECT COUNT(*) FROM board_nodes bn WHERE bn.board_id = b.id) AS node_count
               FROM boards b ORDER BY node_count DESC""",
        )


@mcp.tool()
def get_board(id_or_title: str) -> dict[str, Any]:
    """A curated board's contents: its nodes (brief form) and the connections
    among them.

    Args:
        id_or_title: board id or a title substring.
    """
    with _conn() as c:
        r = c.execute("SELECT * FROM boards WHERE id = ?", (id_or_title,)).fetchone()
        if not r:
            r = c.execute("SELECT * FROM boards WHERE title LIKE ? COLLATE NOCASE LIMIT 1", ("%" + id_or_title + "%",)).fetchone()
        if not r:
            return {"error": f"no board matches {id_or_title!r}"}
        board = dict(r)
        node_ids = [x["node_id"] for x in c.execute("SELECT node_id FROM board_nodes WHERE board_id = ?", (board["id"],))]
        if not node_ids:
            return {**board, "nodes": [], "connections": []}
        ph = ",".join("?" * len(node_ids))
        nodes = _rows(c, f"SELECT id, name, type, brief, date FROM nodes WHERE id IN ({ph})", tuple(node_ids))
        idset = set(node_ids)
        conns = [
            {"id": r2["id"], "relation_type": r2["relation_type"], "claim": r2["claim"],
             "confidence": r2["confidence"], "src": r2["src_node_id"], "tgt": r2["tgt_node_id"]}
            for r2 in c.execute("SELECT * FROM connections").fetchall()
            if r2["src_node_id"] in idset and r2["tgt_node_id"] in idset
        ]
        return {**board, "nodes": nodes, "connections": conns}


@mcp.tool()
def vocabulary() -> dict[str, list[dict[str, Any]]]:
    """The editable taxonomy: node types and relation types in the graph.
    Useful to know what `node_type` / relation values are valid."""
    with _conn() as c:
        return {
            "node_types": _rows(c, "SELECT id, name, color, description FROM node_types ORDER BY name"),
            "relation_types": _rows(c, "SELECT id, name, description FROM relation_types ORDER BY name"),
        }


@mcp.tool()
def stats() -> dict[str, Any]:
    """Corpus size — node / connection / source / board counts, and the DB path in use."""
    with _conn() as c:
        n = c.execute("SELECT COUNT(*) FROM nodes").fetchone()[0]
        e = c.execute("SELECT COUNT(*) FROM connections").fetchone()[0]
        s = c.execute("SELECT COUNT(*) FROM sources").fetchone()[0]
        b = c.execute("SELECT COUNT(*) FROM boards").fetchone()[0]
        types = _rows(c, "SELECT type, COUNT(*) AS n FROM nodes GROUP BY type ORDER BY n DESC")
        return {"db_path": str(_db_path()), "nodes": n, "connections": e, "sources": s, "boards": b, "nodes_by_type": types}


if __name__ == "__main__":
    mcp.run()  # stdio transport
