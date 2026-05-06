/**
 * Webhook fan-out. Reads the webhook_subscriptions table, signs the payload
 * with HMAC-SHA256 against the per-subscription secret hash, POSTs to each
 * matching URL, records the delivery row.
 *
 * Wired to events.publish() via registerWebhookSender().
 *
 * The signing-secret-hash storage is a compromise: we'd need plaintext
 * secrets to sign payloads. Two patterns work:
 *   A) store secret plaintext (encrypted at rest if the column is sensitive)
 *   B) store sha256(secret) and use that as the HMAC key — recipients also
 *      hash their secret before verifying
 *
 * Pattern B used here: the hash *is* the signing key, recipient uses the
 * same hash function. Tradeoff: not a true HMAC of the original secret,
 * but immune to plaintext leaks from the DB.
 */
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { hmacSha256Hex } from "@/lib/crypto";
import type { AuroraEvent } from "@/lib/events";

const WEBHOOK_TIMEOUT_MS = 5_000;
const MAX_FAILURES = 10;

export async function deliverEvent(event: AuroraEvent): Promise<void> {
  const subs = db
    .select()
    .from(schema.webhookSubscriptions)
    .where(eq(schema.webhookSubscriptions.status, "active"))
    .all();

  // Filter by event type
  const matching = subs.filter((s) => {
    if (s.eventTypes === "*") return true;
    return s.eventTypes.split(",").map((t) => t.trim()).includes(event.type);
  });

  await Promise.all(matching.map((s) => deliverOne(s, event)));
}

async function deliverOne(
  sub: typeof schema.webhookSubscriptions.$inferSelect,
  event: AuroraEvent,
): Promise<void> {
  const body = JSON.stringify(event);
  const signature = hmacSha256Hex(sub.secretHash, body);
  const startedAt = Date.now();
  const attemptedAt = new Date(startedAt).toISOString();

  let statusCode: number | null = null;
  let error: string | null = null;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), WEBHOOK_TIMEOUT_MS);
    const res = await fetch(sub.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Aurora-Event": event.type,
        "X-Aurora-Signature": `sha256=${signature}`,
      },
      body,
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    statusCode = res.status;
    if (!res.ok) error = `HTTP ${res.status}`;
  } catch (e) {
    error = (e as Error).message;
  }

  const latencyMs = Date.now() - startedAt;

  // Record delivery
  db.insert(schema.webhookDeliveries)
    .values({
      subscriptionId: sub.id,
      eventType: event.type,
      statusCode,
      attemptedAt,
      latencyMs,
      error,
    })
    .run();

  // Update subscription stats
  if (error) {
    const newCount = sub.failureCount + 1;
    db.update(schema.webhookSubscriptions)
      .set({
        failureCount: newCount,
        lastDeliveryAt: attemptedAt,
        status: newCount >= MAX_FAILURES ? "disabled" : sub.status,
      })
      .where(eq(schema.webhookSubscriptions.id, sub.id))
      .run();
  } else {
    db.update(schema.webhookSubscriptions)
      .set({ failureCount: 0, lastDeliveryAt: attemptedAt })
      .where(eq(schema.webhookSubscriptions.id, sub.id))
      .run();
  }
}
