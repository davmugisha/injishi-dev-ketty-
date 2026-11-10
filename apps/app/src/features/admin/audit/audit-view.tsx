"use client";

import type { AdminAuditResponse, AdminAuditRow, AdminAuditSubjectType } from "@injishi/contracts";
import { DateText, EmptyBlock, PageContent, PageHeader, ServerDataGrid } from "@injishi/ui";
import NextLink from "next/link";
import { ALL, ListBar, ListFilter, ListSearch, ListUrlProvider, SinceFilter, useListUrl } from "../list/list-kit";
import { EntityMark } from "../list/stat-cards";

/** The subjects an admin filters by most, in their words; the rest stay reachable by search. */
const SUBJECTS: { id: AdminAuditSubjectType; label: string }[] = [
  { id: "user", label: "People" },
  { id: "org", label: "Businesses" },
  { id: "role", label: "Roles" },
  { id: "staff_role", label: "Staff roles" },
  { id: "membership", label: "Business members" },
  { id: "payment", label: "Payments" },
  { id: "broker", label: "Brokers" },
  { id: "guest_registration", label: "Guest registrations" },
  { id: "config", label: "Settings" },
];

/** "admin.user.details_changed" → "User details changed", the code kept beside it. */
function eventWords(type: string): string {
  const words = type.split(".").slice(1).join(" ").replace(/_/g, " ").trim() || type.replace(/[._]/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The time of day in Kigali, "14:05". */
const timeOf = (iso: string): string =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kigali" }).format(
    new Date(iso),
  );

/** Where a subject opens, when the console has a page for it. */
function subjectHref(row: AdminAuditRow): string | null {
  if (!row.subjectId) return null;
  if (row.subjectType === "user") return `/admin/people/${row.subjectId}`;
  if (row.subjectType === "org") return `/admin/businesses/${row.subjectId}`;
  return null;
}

/**
 * The audit log (2026-11-09, real records): what staff, people and the platform did, newest first, searched
 * by what happened or the reason given, filtered by what it was about and when. The actor and, for a
 * person or a business, the subject open their pages.
 */
export function AuditView({ log }: { log: AdminAuditResponse }) {
  return (
    <ListUrlProvider>
      <Audit log={log} />
    </ListUrlProvider>
  );
}

function Audit({ log }: { log: AdminAuditResponse }) {
  const url = useListUrl();
  return (
    <PageContent>
      <PageHeader title="Audit log" description="Every change recorded on Injishi, with who made it and why." />
      <ListBar
        keys={["q", "subject", "since", "actor"]}
        found={log.meta.total}
        noun={{ one: "event", many: "events" }}
        search={<ListSearch placeholder="What happened or the reason" />}
      >
        <ListFilter
          param="subject"
          name="About"
          icon="Persons"
          options={[{ id: ALL, label: "Everything" }, ...SUBJECTS]}
        />
        <SinceFilter name="When" />
      </ListBar>
      <ServerDataGrid<AdminAuditRow>
        label="Audit log"
        rows={log.items}
        rowKey={(r) => r.id}
        isLoading={url.pending}
        paging={{
          page: log.meta.page,
          pageSize: log.meta.pageSize,
          total: log.meta.total,
          onPageChange: (page) => url.set({ page: String(page) }),
        }}
        empty={<EmptyBlock size="sm" icon="Clock" title="Nothing matches" description="Try clearing a filter." />}
        columns={[
          {
            id: "when",
            header: "When",
            width: 150,
            cell: (r) => (
              <span className="flex flex-col text-sm">
                <DateText value={r.occurredAt} />
                <span className="text-xs text-muted tabular">{timeOf(r.occurredAt)}</span>
              </span>
            ),
          },
          {
            id: "what",
            header: "What happened",
            isRowHeader: true,
            minWidth: 220,
            cell: (r) => (
              <span className="flex min-w-0 flex-col text-sm">
                <span className="truncate font-medium">{eventWords(r.eventType)}</span>
                <span className="truncate font-mono text-xs text-muted">{r.eventType}</span>
              </span>
            ),
          },
          {
            id: "by",
            header: "By",
            cell: (r) =>
              r.actorUserId ? (
                <NextLink href={`/admin/people/${r.actorUserId}`} className="flex min-w-0 items-center gap-2.5 text-sm">
                  <EntityMark name={r.actorName?.trim() || "Someone"} />
                  <span className="truncate hover:underline">{r.actorName?.trim() || "Someone"}</span>
                </NextLink>
              ) : (
                <span className="text-sm text-muted">The system</span>
              ),
          },
          {
            id: "about",
            header: "About",
            cell: (r) => {
              const href = subjectHref(r);
              const label = SUBJECTS.find((s) => s.id === r.subjectType)?.label ?? r.subjectType?.replace(/_/g, " ");
              if (!label) return <span className="text-sm text-muted">—</span>;
              return href ? (
                <NextLink href={href} className="text-sm text-accent hover:underline">
                  {r.subjectType === "org" ? "Open business" : "Open person"}
                </NextLink>
              ) : (
                <span className="text-sm text-muted">{label}</span>
              );
            },
          },
          {
            id: "why",
            header: "Reason",
            minWidth: 200,
            cell: (r) =>
              r.reason ? (
                <span className="line-clamp-2 text-sm whitespace-normal">{r.reason}</span>
              ) : (
                <span className="text-sm text-muted">—</span>
              ),
          },
        ]}
        mobile={{
          title: (r) => eventWords(r.eventType),
          description: (r) => `${r.actorName ?? "The system"}${r.reason ? ` · ${r.reason}` : ""}`,
          trailing: (r) => <DateText value={r.occurredAt} />,
        }}
      />
    </PageContent>
  );
}
