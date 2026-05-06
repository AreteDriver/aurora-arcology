/**
 * API key middleware. Wraps a write-mode route handler with a bearer-token
 * check against the api_keys table. Read routes never require auth.
 *
 * Enforcement is opt-in: set AURORA_REQUIRE_AUTH=1 to gate write endpoints.
 * Without it, write endpoints accept anonymous calls (local dev curator
 * pattern). Vercel deployments use AURORA_READONLY=1 to short-circuit
 * write endpoints entirely; auth is the alternative when you want a
 * mutable deployment with restricted access.
 */
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, isNull, and } from "drizzle-orm";
import { sha256Hex, timingSafeEqual } from "@/lib/crypto";

export type Scope = "read" | "write" | "admin";

const SCOPE_RANK: Record<Scope, number> = { read: 1, write: 2, admin: 3 };

const requireAuth = (): boolean =>
  process.env.AURORA_REQUIRE_AUTH === "1" || process.env.AURORA_REQUIRE_AUTH === "true";

interface AuthResult {
  ok: boolean;
  scope?: Scope;
  keyId?: number;
  reason?: string;
}

export function authenticate(req: NextRequest, requiredScope: Scope = "write"): AuthResult {
  if (!requireAuth()) return { ok: true, scope: "admin" }; // disabled: pass through

  const header = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m) return { ok: false, reason: "missing bearer token" };

  const presented = m[1].trim();
  const presentedHash = sha256Hex(presented);

  const candidates = db
    .select()
    .from(schema.apiKeys)
    .where(and(eq(schema.apiKeys.keyHash, presentedHash), isNull(schema.apiKeys.revokedAt)))
    .all();

  // Lookup by hash is already exact-match; the loop is to constant-time the
  // confirm step against the stored hash so length-different keys still
  // burn the same compare time.
  for (const k of candidates) {
    if (!timingSafeEqual(k.keyHash, presentedHash)) continue;
    if (SCOPE_RANK[k.scope as Scope] < SCOPE_RANK[requiredScope]) {
      return { ok: false, reason: `scope ${k.scope} insufficient (need ${requiredScope})` };
    }
    // best-effort last_used_at touch (write — only when auth is enforced)
    db.update(schema.apiKeys)
      .set({ lastUsedAt: new Date().toISOString() })
      .where(eq(schema.apiKeys.id, k.id))
      .run();
    return { ok: true, scope: k.scope as Scope, keyId: k.id };
  }
  return { ok: false, reason: "key not recognized or revoked" };
}

export function unauthorized(reason: string): NextResponse {
  return NextResponse.json({ error: reason }, { status: 401 });
}
