import { AdminAuditSubjectType } from "@injishi/contracts";
import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { AuditView } from "@/features/admin/audit/AuditView";
import { Refused } from "@/features/admin/people/Refused";
import { requirePersona } from "@/lib/session";
import { one, pageOf, type Search, sinceDay, wordOf } from "@/server/admin/list";
import { auditLog } from "@/server/admin/people";
import { ApiError } from "@/server/api";

export const metadata: Metadata = { title: screens.AdminAudit.pageTitle };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The platform's audit log from the admin API (`admin.audit.read`), filtered by the URL. */
export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePersona("AdminAudit");
  const sp = await searchParams;
  const actor = one(sp.actor);
  try {
    const log = await auditLog({
      q: one(sp.q)?.trim() || undefined,
      subjectType: wordOf(sp.subject, AdminAuditSubjectType.options),
      actorUserId: actor && UUID.test(actor) ? actor : undefined,
      createdFrom: sinceDay(sp.since),
      page: pageOf(sp.page),
    });
    return <AuditView log={log} />;
  } catch (error) {
    if (error instanceof ApiError && error.forbidden) return <Refused code={error.code} />;
    throw error;
  }
}

export const dynamic = "force-dynamic";
