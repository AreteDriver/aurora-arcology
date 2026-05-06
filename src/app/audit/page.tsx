import { db, schema } from "@/lib/db";
import { desc, eq, and } from "drizzle-orm";
import AuditList from "@/components/AuditList";

interface Props {
  searchParams: Promise<{ entity?: string; action?: string; page?: string }>;
}

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AuditPage({ searchParams }: Props) {
  const { entity, action, page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1", 10));

  const filters = [];
  if (entity) filters.push(eq(schema.auditLog.entityType, entity));
  if (action) filters.push(eq(schema.auditLog.action, action));

  const whereClause = filters.length > 0 ? and(...filters) : undefined;

  const total = (
    db
      .select({ n: schema.auditLog.id })
      .from(schema.auditLog)
      .where(whereClause)
      .all().length
  );

  const rows = db
    .select()
    .from(schema.auditLog)
    .where(whereClause)
    .orderBy(desc(schema.auditLog.changedAt), desc(schema.auditLog.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .all();

  // Type / action counts for filter badges
  const typeCounts = db
    .select({ k: schema.auditLog.entityType, n: schema.auditLog.id })
    .from(schema.auditLog)
    .all()
    .reduce<Record<string, number>>((acc, r) => {
      acc[r.k] = (acc[r.k] ?? 0) + 1;
      return acc;
    }, {});

  const actionCounts = db
    .select({ k: schema.auditLog.action, n: schema.auditLog.id })
    .from(schema.auditLog)
    .all()
    .reduce<Record<string, number>>((acc, r) => {
      acc[r.k] = (acc[r.k] ?? 0) + 1;
      return acc;
    }, {});

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-2">Audit log</h1>
      <p className="text-sm text-zinc-400 mb-4">
        Append-only event log (spec §5). Every node, source, connection insertion
        is recorded here. Foundation for the Tier 4 temporal layer.
      </p>

      <AuditList
        rows={rows}
        page={page}
        totalPages={totalPages}
        total={total}
        currentEntity={entity ?? null}
        currentAction={action ?? null}
        typeCounts={typeCounts}
        actionCounts={actionCounts}
      />
    </div>
  );
}
