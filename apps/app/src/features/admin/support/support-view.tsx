"use client";

import { Tabs } from "@heroui/react";
import type {
  AdminCompliance,
  AdminComplianceArtifact,
  AdminDsrRow,
  AdminEscalation,
  AdminModeratedReview,
  AdminModeration,
  AdminSupportTicket,
} from "@injishi/contracts";
import { DataTable, DateText, EmptyBlock, PageContent, PageHeader, SectionCard, StatusChip } from "@injishi/ui";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { ListUrlProvider, useListUrl } from "../list/list-kit";
import { KpiCards } from "../list/stat-cards";

export type SupportTab = "tickets" | "escalations" | "reviews" | "privacy";

const TAB_LABEL: Record<SupportTab, string> = {
  tickets: "Tickets",
  escalations: "Escalations",
  reviews: "Reviews",
  privacy: "Privacy requests",
};

const words = (s: string | null | undefined): string => {
  if (!s) return "—";
  const w = s.replace(/_/g, " ");
  return w.charAt(0).toUpperCase() + w.slice(1);
};

const TICKET_TONE = { open: "warning", reopened: "warning", resolved: "success", closed: "default" } as const;

/**
 * Support (2026-11-09, real records): what people asked for help with, what was escalated, the reviews
 * waiting for moderation, and privacy requests with the compliance documents and when each is due for review.
 * Read only here; one tab at a time.
 */
export function SupportView(props: {
  tab: SupportTab;
  moderation: AdminModeration | null;
  compliance: AdminCompliance | null;
}) {
  return (
    <ListUrlProvider>
      <Support {...props} />
    </ListUrlProvider>
  );
}

function Support({
  tab,
  moderation,
  compliance,
}: {
  tab: SupportTab;
  moderation: AdminModeration | null;
  compliance: AdminCompliance | null;
}) {
  const url = useListUrl();
  const refused = <EmptyBlock icon="ShieldKeyhole" title="Your staff role cannot see this" />;
  return (
    <PageContent>
      <PageHeader title="Support" description="Tickets, escalations, reviews to moderate and privacy requests." />
      <Tabs
        variant="secondary"
        selectedKey={tab}
        onSelectionChange={(k) => url.set({ tab: String(k) === "tickets" ? null : String(k) })}
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Support">
            {(Object.keys(TAB_LABEL) as SupportTab[]).map((t) => (
              <Tabs.Tab key={t} id={t}>
                {TAB_LABEL[t]}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
      {tab === "tickets" ? moderation ? <Tickets rows={moderation.tickets} /> : refused : null}
      {tab === "escalations" ? moderation ? <Escalations rows={moderation.escalations} /> : refused : null}
      {tab === "reviews" ? moderation ? <Reviews rows={moderation.reviews} /> : refused : null}
      {tab === "privacy" ? compliance ? <Privacy c={compliance} /> : refused : null}
    </PageContent>
  );
}

function Tickets({ rows }: { rows: AdminSupportTicket[] }) {
  const router = useRouter();
  const count = (s: string) => rows.filter((t) => t.state === s).length;
  return (
    <DataTable<AdminSupportTicket>
      label="Support tickets"
      rows={rows}
      rowKey={(t) => t.id}
      noun={{ one: "ticket", many: "tickets" }}
      defaultSort={{ column: "opened", direction: "descending" }}
      onRowAction={(t) => (t.requesterUserId ? router.push(`/admin/people/${t.requesterUserId}`) : undefined)}
      search={{ placeholder: "Category", text: (t) => `${t.category ?? ""} ${t.domain ?? ""}` }}
      filters={[
        {
          id: "state",
          name: "Status",
          options: [
            { id: "all", label: "All", count: rows.length },
            { id: "open", label: "Open", count: count("open") },
            { id: "reopened", label: "Reopened", count: count("reopened") },
            { id: "resolved", label: "Resolved", count: count("resolved") },
            { id: "closed", label: "Closed", count: count("closed") },
          ],
          match: (t, v) => t.state === v,
        },
      ]}
      columns={[
        {
          id: "opened",
          header: "Opened",
          isRowHeader: true,
          sortValue: (t) => t.createdAt,
          cell: (t) => <DateText value={t.createdAt} />,
        },
        { id: "category", header: "About", sortValue: (t) => t.category ?? "", cell: (t) => words(t.category) },
        { id: "domain", header: "Area", cell: (t) => words(t.domain) },
        {
          id: "state",
          header: "Status",
          cell: (t) => <StatusChip tone={TICKET_TONE[t.state]}>{words(t.state)}</StatusChip>,
        },
        {
          id: "answered",
          header: "First answer",
          cell: (t) =>
            t.firstResponseAt ? <DateText value={t.firstResponseAt} /> : <span className="text-warning">Not yet</span>,
        },
        {
          id: "csat",
          header: "Rating",
          align: "end",
          cell: (t) => (t.csat === null ? <span className="text-muted">—</span> : `${t.csat} / 5`),
        },
      ]}
      empty={<EmptyBlock size="sm" icon="Envelope" title="No tickets" />}
      mobile={{ title: (t) => words(t.category), description: (t) => words(t.state) }}
    />
  );
}

function subjectLink(e: AdminEscalation) {
  if (!e.subjectId) return <span className="text-muted">—</span>;
  if (e.subjectType === "user")
    return (
      <NextLink href={`/admin/people/${e.subjectId}`} className="text-accent hover:underline">
        Open person
      </NextLink>
    );
  if (e.subjectType === "org")
    return (
      <NextLink href={`/admin/businesses/${e.subjectId}`} className="text-accent hover:underline">
        Open business
      </NextLink>
    );
  return <span className="text-muted">{words(e.subjectType)}</span>;
}

function Escalations({ rows }: { rows: AdminEscalation[] }) {
  const open = rows.filter((e) => e.state === "open").length;
  return (
    <DataTable<AdminEscalation>
      label="Escalations"
      rows={rows}
      rowKey={(e) => e.id}
      noun={{ one: "escalation", many: "escalations" }}
      defaultSort={{ column: "opened", direction: "descending" }}
      filters={[
        {
          id: "state",
          name: "Status",
          options: [
            { id: "all", label: "All", count: rows.length },
            { id: "open", label: "Open", count: open },
            { id: "resolved", label: "Resolved", count: rows.length - open },
          ],
          match: (e, v) => e.state === v,
        },
        {
          id: "type",
          name: "Kind",
          options: [
            { id: "all", label: "All" },
            ...[...new Set(rows.map((e) => e.type))].map((t) => ({ id: t, label: words(t) })),
          ],
          match: (e, v) => e.type === v,
        },
      ]}
      columns={[
        {
          id: "opened",
          header: "Opened",
          isRowHeader: true,
          sortValue: (e) => e.createdAt,
          cell: (e) => <DateText value={e.createdAt} />,
        },
        { id: "type", header: "Kind", sortValue: (e) => e.type, cell: (e) => words(e.type) },
        { id: "about", header: "About", cell: subjectLink },
        {
          id: "state",
          header: "Status",
          cell: (e) => <StatusChip tone={e.state === "open" ? "warning" : "success"}>{words(e.state)}</StatusChip>,
        },
        {
          id: "note",
          header: "Resolution",
          cell: (e) => <span className="line-clamp-2 text-sm whitespace-normal">{e.resolutionNote ?? "—"}</span>,
        },
      ]}
      empty={<EmptyBlock size="sm" icon="CircleCheck" title="Nothing escalated" />}
      mobile={{ title: (e) => words(e.type), description: (e) => words(e.state) }}
    />
  );
}

function Reviews({ rows }: { rows: AdminModeratedReview[] }) {
  return (
    <DataTable<AdminModeratedReview>
      label="Reviews to moderate"
      rows={rows}
      rowKey={(r) => r.id}
      noun={{ one: "review", many: "reviews" }}
      defaultSort={{ column: "when", direction: "descending" }}
      search={{
        placeholder: "Property, author or words",
        text: (r) => `${r.propertyName ?? ""} ${r.authorName ?? ""} ${r.body ?? ""}`,
      }}
      columns={[
        {
          id: "when",
          header: "Written",
          isRowHeader: true,
          sortValue: (r) => r.createdAt,
          cell: (r) => <DateText value={r.createdAt} />,
        },
        { id: "property", header: "Property", cell: (r) => r.propertyName ?? "—" },
        { id: "author", header: "By", cell: (r) => r.authorName ?? "—" },
        { id: "rating", header: "Stars", align: "end", cell: (r) => (r.rating === null ? "—" : `${r.rating} / 5`) },
        {
          id: "body",
          header: "Review",
          cell: (r) => <span className="line-clamp-2 text-sm whitespace-normal">{r.body ?? "—"}</span>,
        },
        { id: "state", header: "Status", cell: (r) => <StatusChip tone="default">{words(r.state)}</StatusChip> },
      ]}
      empty={<EmptyBlock size="sm" icon="CircleCheck" title="No reviews waiting" />}
      mobile={{ title: (r) => r.propertyName ?? "Review", description: (r) => r.body ?? "" }}
    />
  );
}

function Privacy({ c }: { c: AdminCompliance }) {
  const today = new Date().toISOString();
  return (
    <div className="flex flex-col gap-5">
      <KpiCards
        label="Privacy and compliance"
        items={[
          {
            id: "open",
            label: "Requests open",
            value: c.stats.openRequests,
            format: "count",
            icon: "Envelope",
            status: c.stats.openRequests > 0 ? "warning" : undefined,
          },
          {
            id: "overdue",
            label: "Documents overdue for review",
            value: c.stats.overdueReviews,
            format: "count",
            icon: "Clock",
            status: c.stats.overdueReviews > 0 ? "danger" : undefined,
          },
          { id: "docs", label: "Documents on file", value: c.stats.artifactCount, format: "count", icon: "Database" },
        ]}
      />
      <SectionCard title="Requests" description="People asking to see, correct or delete their data.">
        <DataTable<AdminDsrRow>
          label="Privacy requests"
          rows={c.requests}
          rowKey={(r) => r.id}
          defaultSort={{ column: "when", direction: "descending" }}
          columns={[
            {
              id: "when",
              header: "Received",
              isRowHeader: true,
              sortValue: (r) => r.createdAt,
              cell: (r) => <DateText value={r.createdAt} />,
            },
            { id: "type", header: "Asks to", cell: (r) => words(r.requestType) },
            {
              id: "who",
              header: "Person",
              cell: (r) =>
                r.subjectUserId ? (
                  <NextLink href={`/admin/people/${r.subjectUserId}`} className="text-accent hover:underline">
                    Open person
                  </NextLink>
                ) : (
                  "—"
                ),
            },
            {
              id: "state",
              header: "Status",
              cell: (r) => (
                <StatusChip tone={r.state === "fulfilled" ? "success" : "warning"}>{words(r.state)}</StatusChip>
              ),
            },
          ]}
          empty={<EmptyBlock size="sm" icon="CircleCheck" title="No requests" />}
          mobile={{ title: (r) => words(r.requestType), description: (r) => words(r.state) }}
        />
      </SectionCard>
      <SectionCard
        title="Compliance documents"
        description="Registrations, the DPO, impact assessments and processors."
      >
        <DataTable<AdminComplianceArtifact>
          label="Compliance documents"
          rows={c.artifacts}
          rowKey={(a) => a.id}
          columns={[
            { id: "type", header: "Document", isRowHeader: true, cell: (a) => words(a.artifactType) },
            { id: "processor", header: "Processor", cell: (a) => a.processorName ?? "—" },
            {
              id: "due",
              header: "Review due",
              align: "end",
              cell: (a) =>
                a.reviewDueAt ? (
                  <span className={a.reviewDueAt < today ? "text-danger" : undefined}>
                    <DateText value={a.reviewDueAt} />
                  </span>
                ) : (
                  "—"
                ),
            },
          ]}
          empty={<EmptyBlock size="sm" icon="Database" title="No documents on file" />}
          mobile={{ title: (a) => words(a.artifactType), description: (a) => a.processorName ?? "" }}
        />
      </SectionCard>
    </div>
  );
}
