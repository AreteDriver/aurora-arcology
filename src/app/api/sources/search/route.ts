import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "node:path";

const dbPath = process.env.DATABASE_URL ?? path.join(process.cwd(), "data/aurora.db");

interface FtsRow {
  id: string;
  title: string;
  publisher: string;
  url: string | null;
  date: string | null;
  type: string;
  rank: number;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "30", 10), 100);

  if (q.length < 2) {
    return NextResponse.json({ query: q, results: [], total: 0 });
  }

  // Sanitize: FTS5 reserves quotes and a few operators. Wrap the whole query
  // as a phrase if it doesn't already contain FTS operators, to keep things
  // predictable for the curator.
  const sanitized = /[\s"]/.test(q) && !/[*^]/.test(q) ? `"${q.replace(/"/g, '""')}"` : q;

  const sqlite = new Database(dbPath, { readonly: true });
  try {
    const rows = sqlite
      .prepare<[string, number], FtsRow>(`
        SELECT s.id, s.title, s.publisher, s.url, s.date, s.type, fts.rank
        FROM sources_fts fts
        JOIN sources s ON s.rowid = fts.rowid
        WHERE sources_fts MATCH ?
        ORDER BY fts.rank
        LIMIT ?
      `)
      .all(sanitized, limit);

    const total = (
      sqlite
        .prepare<[string], { n: number }>(
          "SELECT COUNT(*) AS n FROM sources_fts WHERE sources_fts MATCH ?",
        )
        .get(sanitized) ?? { n: 0 }
    ).n;

    return NextResponse.json({ query: q, total, results: rows });
  } catch (err) {
    return NextResponse.json(
      { query: q, error: (err as Error).message, results: [] },
      { status: 400 },
    );
  } finally {
    sqlite.close();
  }
}
