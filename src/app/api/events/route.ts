import { NextRequest, NextResponse } from "next/server";
import { publish, subscribe, subscriberCount, type EventType } from "@/lib/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
 */
export async function POST(req: NextRequest) {
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
