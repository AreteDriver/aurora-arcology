import { db, schema } from "@/lib/db";
import { desc } from "drizzle-orm";
import AuditList from "@/components/AuditList";

export default async function AuditPage() {
  // Fetch all entries at build time. With ~3K entries the JSON payload
  // is well under a megabyte; client filters / paginates in-browser.
  const rows = db
    .select()
    .from(schema.auditLog)
    .orderBy(desc(schema.auditLog.changedAt), desc(schema.auditLog.id))
    .all();

  const typeCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.entityType] = (acc[r.entityType] ?? 0) + 1;
    return acc;
  }, {});
  const actionCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.action] = (acc[r.action] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-2">Audit log</h1>
      <p className="text-sm text-zinc-400 mb-4">
        Append-only event log (spec §5). Every node, source, connection insertion
        is recorded here. Foundation for the Tier 4 temporal layer.
      </p>

      <AuditList rows={rows} typeCounts={typeCounts} actionCounts={actionCounts} />
    </div>
  );
}
