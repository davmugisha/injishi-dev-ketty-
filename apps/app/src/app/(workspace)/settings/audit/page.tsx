import { screens } from "@injishi/data";
import type {
  AuditLogArea,
  AuditLogChain,
  AuditLogEntry,
  AuditLogExportFormat,
  AuditLogRetentionRule,
} from "@injishi/data/fixtures/owner";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuditLogView } from "@/features/owner/AuditLogView";
import { requirePersona } from "@/lib/session";
import { getCollection, requestContext } from "@/server/data";
import { businessNames } from "@/server/sources/owner";

export const metadata: Metadata = { title: screens.AuditLog.pageTitle };

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePersona("AuditLog");
  const [areas, entries, retention, formats, chains] = await Promise.all([
    getCollection<AuditLogArea>("owner.auditLogAreas"),
    getCollection<AuditLogEntry>("owner.auditLogEntries"),
    getCollection<AuditLogRetentionRule>("owner.auditLogRetention"),
    getCollection<AuditLogExportFormat>("owner.auditLogExportFormats"),
    getCollection<AuditLogChain>("owner.auditLogChain"),
  ]);
  const chain = chains[0];
  if (!chain) notFound();
  const { tab } = await searchParams;
  return (
    <AuditLogView
      businessName={businessNames(await requestContext())}
      initialTab={tab === "retention" ? "retention" : "entries"}
      data={{ areas, entries, retention, formats, chain }}
    />
  );
}
