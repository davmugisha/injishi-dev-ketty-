"use client";

import { Card } from "@heroui/react";
import type { AdminOrgRow, OrgRegistrationStatus } from "@injishi/contracts";
import {
  DataTable,
  DateText,
  EmptyBlock,
  EventTimeline,
  FilterTabs,
  FlowStepper,
  formatNumber,
  KeyValueList,
  KpiStrip,
  LoadingBlock,
  PageContent,
  PageHeader,
  SearchBar,
  SidePanel,
  StatusChip,
  type StatusTone,
  type TimelineEvent,
} from "@injishi/ui";
import { useEffect, useState } from "react";
import type { RegistrationEvent } from "@/server/admin/registrations";
import { loadRegistrationTimeline } from "./actions";

/** Where a registration stands, in the order it moves: paid, a field visit, a second officer's approval. */
type Stage = "unpaid" | "visit" | "approval" | "active" | "rejected" | "suspended";

const STAGE: Record<OrgRegistrationStatus, Stage> = {
  pending_payment: "unpaid",
  submitted: "visit",
  tin_verified: "visit",
  field_verified: "approval",
  approved: "active",
  active: "active",
  rejected: "rejected",
  suspended: "suspended",
};

const STAGE_WORDS: Record<Stage, { label: string; tone: StatusTone }> = {
  unpaid: { label: "Fee not paid", tone: "default" },
  visit: { label: "Waiting for a field visit", tone: "warning" },
  approval: { label: "Waiting for approval", tone: "info" },
  active: { label: "Active", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  suspended: { label: "Suspended", tone: "danger" },
};

const STEPS = [
  { id: "paid", title: "Registered and paid", description: "The business" },
  { id: "visit", title: "Document review", description: "Document review officer" },
  { id: "approval", title: "Approval", description: "A second officer" },
  { id: "active", title: "Active", description: "Can use Injishi" },
];

const STEP_INDEX: Record<Stage, number> = { unpaid: 0, visit: 1, approval: 2, active: 4, rejected: 1, suspended: 4 };

const TABS = ["all", "visit", "approval", "active", "closed"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  all: "All",
  visit: "Field visit",
  approval: "Approval",
  active: "Active",
  closed: "Rejected or suspended",
};
const inTab = (tab: Tab, s: Stage): boolean =>
  tab === "all" ||
  (tab === "closed"
    ? s === "rejected" || s === "suspended"
    : tab === "visit"
      ? s === "visit" || s === "unpaid"
      : s === tab);

const kindWords = (o: AdminOrgRow): string =>
  o.domain === "residence"
    ? o.residenceClass === "residential_property_manager"
      ? "Residence, managed for the owner"
      : "Residence, the landlord"
    : o.accommodationClass
      ? o.accommodationClass.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
      : o.domain.charAt(0).toUpperCase() + o.domain.slice(1);

/** One audit line in the officers' words: which gate, passed or refused, by which post. */
function eventWords(e: RegistrationEvent): TimelineEvent {
  const [, gate, outcome] = e.eventType.split(".");
  const passed = outcome === "passed";
  const by = e.actorName?.trim();
  if (gate === "tin_verified") {
    return {
      id: e.id,
      at: e.occurredAt,
      title: passed ? "Field visit verified" : "Refused at the field visit",
      detail: [by || "Document review officer", e.reason].filter(Boolean).join(" · "),
      tone: passed ? "success" : "danger",
    };
  }
  if (gate === "field_verified") {
    return {
      id: e.id,
      at: e.occurredAt,
      title: passed ? "Approved, the business is active" : "Refused at approval",
      detail: [by || "Approving officer", e.reason].filter(Boolean).join(" · "),
      tone: passed ? "success" : "danger",
    };
  }
  return { id: e.id, at: e.occurredAt, title: e.eventType.replace(/[._]/g, " "), detail: by || undefined };
}

function RegistrationPanel({ org, onClose }: { org: AdminOrgRow; onClose: () => void }) {
  const [events, setEvents] = useState<RegistrationEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stage = STAGE[org.registrationStatus];
  useEffect(() => {
    let live = true;
    void loadRegistrationTimeline(org.id).then((r) => {
      if (!live) return;
      if (r.ok) setEvents(r.value);
      else setError(r.error);
    });
    return () => {
      live = false;
    };
  }, [org.id]);
  const history: TimelineEvent[] = [
    { id: "registered", at: org.createdAt, title: "Registered and paid", detail: kindWords(org), tone: "success" },
    ...[...(events ?? [])].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)).map(eventWords),
    ...(stage === "visit" || stage === "approval"
      ? [
          {
            id: "next",
            at: new Date().toISOString(),
            title: stage === "visit" ? "Waiting for a field visit" : "Waiting for a second officer to approve",
            detail:
              stage === "visit"
                ? "Any field verification officer of the district"
                : "An approving officer who did not do the visit",
            tone: "current" as const,
          },
        ]
      : []),
  ];
  return (
    <SidePanel
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={org.legalName}
      description={kindWords(org)}
    >
      <div className="flex flex-col gap-5">
        <FlowStepper label="Registration steps" steps={STEPS} current={STEP_INDEX[stage]} orientation="vertical" />
        <KeyValueList
          items={[
            {
              label: "Status",
              value: <StatusChip tone={STAGE_WORDS[stage].tone}>{STAGE_WORDS[stage].label}</StatusChip>,
            },
            { label: "District", value: org.districtName ?? "Not given" },
            ...(org.upi ? [{ label: "UPI", value: <span className="tabular">{org.upi}</span> }] : []),
            ...(org.tin ? [{ label: "TIN", value: <span className="tabular">{org.tin}</span> }] : []),
            { label: "Registered", value: <DateText value={org.createdAt} style="long" /> },
          ]}
        />
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">History</h3>
          {error ? (
            <p className="text-sm text-danger">{error}</p>
          ) : events === null ? (
            <LoadingBlock shape="list" label="Loading the history" />
          ) : (
            <EventTimeline label={`History of ${org.legalName}`} events={history} />
          )}
        </section>
        <p className="text-xs text-muted">
          Two officers decide every registration: a field verification officer visits, then an approving officer who did
          not do the visit approves. Injishi records the decisions; it does not make them.
        </p>
      </div>
    </SidePanel>
  );
}

/**
 * Every business that registered, for Injishi staff: where each stands on its way (paid, field visit,
 * approval, active), filtered by stage and searched by name or UPI, with each one's history in a panel.
 * Real records only, read from the admin API.
 */
export function RegistrationsView({ orgs, total }: { orgs: AdminOrgRow[]; total: number }) {
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<AdminOrgRow | null>(null);
  const count = (t: Tab) => orgs.filter((o) => inTab(t, STAGE[o.registrationStatus])).length;
  const needle = q.trim().toLowerCase();
  const rows = orgs.filter(
    (o) =>
      inTab(tab, STAGE[o.registrationStatus]) &&
      (!needle ||
        o.legalName.toLowerCase().includes(needle) ||
        (o.upi ?? "").includes(needle) ||
        (o.tin ?? "").includes(needle)),
  );
  return (
    <PageContent>
      <PageHeader title="Registrations" description={`${formatNumber(total)} businesses`} />
      <KpiStrip
        label="Registrations"
        items={[
          {
            id: "visit",
            label: "Field visit",
            value: count("visit"),
            format: "count",
            icon: "MapPin",
            status: count("visit") > 0 ? "warning" : undefined,
            footnote: "Waiting for an officer",
          },
          {
            id: "approval",
            label: "Approval",
            value: count("approval"),
            format: "count",
            icon: "ShieldCheck",
            footnote: "Waiting for a second officer",
          },
          {
            id: "active",
            label: "Active",
            value: count("active"),
            format: "count",
            icon: "CircleCheck",
            footnote: "Approved and running",
          },
          {
            id: "closed",
            label: "Rejected or suspended",
            value: count("closed"),
            format: "count",
            icon: "CircleXmark",
            footnote: "Not running",
          },
        ]}
      />
      <Card className="flex min-w-0 flex-col gap-3 p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <FilterTabs
            label="Registrations by stage"
            name="Stage"
            selectedKey={tab}
            onSelectionChange={(k) => setTab(k as Tab)}
            tabs={TABS.map((t) => ({ id: t, label: TAB_LABEL[t], count: count(t) }))}
          />
          <SearchBar
            label="Search registrations"
            placeholder="Name, UPI or TIN"
            defaultValue={q}
            onSubmit={setQ}
            onChange={setQ}
          />
        </div>
        <DataTable<AdminOrgRow>
          label="Registrations"
          rows={rows}
          rowKey={(o) => o.id}
          onRowAction={setOpen}
          defaultSort={{ column: "registered", direction: "descending" }}
          empty={
            <EmptyBlock
              icon="Briefcase"
              title={needle || tab !== "all" ? "No registrations match" : "No registrations yet"}
              description={
                needle || tab !== "all"
                  ? "Clear the search or pick another stage."
                  : "Businesses appear here as they register."
              }
            />
          }
          columns={[
            {
              id: "name",
              header: "Business",
              isRowHeader: true,
              sortValue: (o) => o.legalName,
              cell: (o) => (
                <div className="flex min-w-0 flex-col text-sm">
                  <span className="truncate font-medium">{o.legalName}</span>
                  <span className="truncate text-xs text-muted">{kindWords(o)}</span>
                </div>
              ),
            },
            {
              id: "district",
              header: "District",
              hideBelow: "xl",
              sortValue: (o) => o.districtName ?? "",
              cell: (o) => o.districtName ?? "Not given",
            },
            {
              id: "progress",
              header: "Progress",
              hideBelow: "lg",
              cell: (o) => {
                const at = STEP_INDEX[STAGE[o.registrationStatus]];
                const bad = STAGE[o.registrationStatus] === "rejected" || STAGE[o.registrationStatus] === "suspended";
                return (
                  <div className="flex items-center gap-1" role="img" aria-label={`${Math.min(at, 4)} of 4 steps done`}>
                    {STEPS.map((s, i) => (
                      <span key={s.id} className="flex items-center gap-1">
                        {i > 0 ? <span aria-hidden className="h-px w-3 bg-separator" /> : null}
                        <span
                          aria-hidden
                          title={s.title}
                          className={`size-2.5 rounded-full ${
                            bad && i === at
                              ? "bg-danger"
                              : i < at
                                ? "bg-success"
                                : i === at
                                  ? "bg-accent"
                                  : "bg-default"
                          }`}
                        />
                      </span>
                    ))}
                  </div>
                );
              },
            },
            {
              id: "status",
              header: "Status",
              sortValue: (o) => o.registrationStatus,
              cell: (o) => {
                const w = STAGE_WORDS[STAGE[o.registrationStatus]];
                return <StatusChip tone={w.tone}>{w.label}</StatusChip>;
              },
            },
            {
              id: "registered",
              header: "Registered",
              align: "end",
              sortValue: (o) => o.createdAt,
              cell: (o) => <DateText value={o.createdAt} />,
            },
          ]}
          mobile={{
            title: (o) => o.legalName,
            description: (o) => `${kindWords(o)} · ${o.districtName ?? ""}`,
            trailing: (o) => {
              const w = STAGE_WORDS[STAGE[o.registrationStatus]];
              return <StatusChip tone={w.tone}>{w.label}</StatusChip>;
            },
          }}
        />
      </Card>
      {open ? <RegistrationPanel org={open} onClose={() => setOpen(null)} /> : null}
    </PageContent>
  );
}
