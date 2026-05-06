import { NextRequest, NextResponse } from "next/server";
import { publish, registerWebhookSender, subscribe, subscriberCount, type EventType } from "@/lib/events";
import { authenticate, unauthorized } from "@/lib/auth";
import { deliverEvent } from "@/lib/webhooks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Wire webhook delivery into the event bus on first import.
// Idempotent — registerWebhookSender just overwrites the slot.
registerWebhookSender(deliverEvent);

/**
 * GET /api/events — open an SSE stream. Browser EventSource subscribes here.
 */
export async function GET(req: NextRequest) {
  const { readable, cleanup } = subscribe();

  // Wire abort -> cleanup
  req.signal.addEventListener("abort", cleanup);

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // tell nginx not to buffer
    },
  });
}

/**
 * POST /api/events — publish an event. Used by the scraper CLI to forward
 * progress into the in-process bus. Body: { type: EventType, data: {...} }.
 *
 * Auth: requires write scope when AURORA_REQUIRE_AUTH=1; otherwise pass-through
 * for local dev convenience.
 */
export async function POST(req: NextRequest) {
  const auth = authenticate(req, "write");
  if (!auth.ok) return unauthorized(auth.reason ?? "forbidden");

  let body: { type?: string; data?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const validTypes: EventType[] = [
    "source.added",
    "node.added",
    "connection.added",
    "scrape.progress",
    "ping",
  ];
  if (!body.type || !validTypes.includes(body.type as EventType)) {
    return NextResponse.json({ error: "type must be one of " + validTypes.join(",") }, { status: 400 });
  }

  const delivered = await publish(body.type as EventType, body.data ?? {});
  return NextResponse.json({ delivered, subscribers: subscriberCount() });
}
