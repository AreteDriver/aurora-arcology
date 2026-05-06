/**
 * In-process pub/sub for SSE broadcast. Pattern lifted from
 * Overwatch's overwatch/events.py — replaced asyncio.Queue with a
 * Map of TransformStream writers since we're in Node + the Web Streams API.
 *
 * Lives in module scope; Next.js dev / prod servers each maintain one bus.
 * For cross-process publishes (e.g. from the scraper CLI), POST to
 * /api/events with { type, data } and the route handler forwards into
 * this bus.
 */

export type EventType =
  | "source.added"
  | "node.added"
  | "connection.added"
  | "scrape.progress"
  | "ping";

export interface AuroraEvent {
  type: EventType;
  data: Record<string, unknown>;
  ts: string; // ISO timestamp
}

const subscribers = new Set<WritableStreamDefaultWriter<string>>();
const encoder = new TextEncoder();

let counter = 0;
const newId = () => `${Date.now()}-${counter++}`;

export function subscriberCount(): number {
  return subscribers.size;
}

/**
 * Build the readable side of an SSE stream + register its writer.
 * Caller should pipe the readable into a Response with the appropriate
 * headers (text/event-stream, no-cache, keep-alive).
 */
export function subscribe(): {
  readable: ReadableStream<Uint8Array>;
  cleanup: () => void;
} {
  const { readable, writable } = new TransformStream<string, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(encoder.encode(chunk));
    },
  });
  const writer = writable.getWriter();
  subscribers.add(writer);

  // Initial hello so the client knows the stream is up
  writer.write(`event: hello\ndata: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`);

  // Heartbeat every 25s — keeps proxies / browsers from closing idle streams
  const heartbeat = setInterval(() => {
    writer.write(`: heartbeat ${Date.now()}\n\n`).catch(() => clearInterval(heartbeat));
  }, 25000);

  const cleanup = () => {
    clearInterval(heartbeat);
    subscribers.delete(writer);
    writer.close().catch(() => {});
  };

  return { readable, cleanup };
}

/**
 * Broadcast an event to every active subscriber. Failures (closed streams)
 * are silently dropped — the writable stream's error event handles cleanup.
 */
export async function publish(type: EventType, data: Record<string, unknown>): Promise<number> {
  const event: AuroraEvent = { type, data, ts: new Date().toISOString() };
  const payload = `id: ${newId()}\nevent: ${type}\ndata: ${JSON.stringify(event)}\n\n`;

  let delivered = 0;
  for (const writer of Array.from(subscribers)) {
    try {
      await writer.write(payload);
      delivered++;
    } catch {
      subscribers.delete(writer);
    }
  }
  return delivered;
}
