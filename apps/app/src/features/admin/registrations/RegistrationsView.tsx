"use client";

import { Button, Input, Label, TextField } from "@heroui/react";
import type { AdminOrgRow, OrgRegistrationStatus } from "@injishi/contracts";
import {
  DataTable,
  DateText,
  EmptyBlock,
  EventTimeline,
  FlowStepper,
  KeyValueList,
  LoadingBlock,
  PageContent,
  SidePanel,
  StatusChip,
  type StatusTone,
  type TimelineEvent,
} from "@injishi/ui";
import { useEffect, useState } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import type { RegistrationEvent } from "@/server/admin/registrations";
import type { StarGradeState } from "@/server/admin/registrations";
import { decideStarGradeAction, loadRegistrationTimeline, loadStarGrade } from "./actions";

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

/**
 * 0118: the star grade a stay said, confirmed here once checked against its RDB grading certificate. Guests see
 * stars only from then; a lapsed or mismatched certificate is withdrawn the same way. Both take a reason.
 */
function StarGradeSection({ orgId }: { orgId: string }) {
  const [state, setState] = useState<StarGradeState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void loadStarGrade(orgId).then((r) => {
      if (!live) return;
      if (r.ok) setState(r.value);
      else setError(r.error);
    });
    return () => {
      live = false;
    };
  }, [orgId]);
  if (!state) return error ? <p className="text-sm text-danger">{error}</p> : null;
  if (state.grade === null) return null;
  const decide = async (confirm: boolean) => {
    setBusy(true);
    setError(null);
    const r = await decideStarGradeAction(orgId, confirm, reason);
    setBusy(false);
    if (r.ok) {
      setState(r.value);
      setReason("");
    } else setError(r.error);
  };
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Star grade</h3>
      <p className="m-0 text-sm">
        {`${state.grade} stars, `}
        {state.verifiedAt ? (
          <>
            confirmed <DateText value={state.verifiedAt} style="long" />. Guests see it.
          </>
        ) : (
          "said by the business, not yet checked. Guests see no stars until it is confirmed."
        )}
      </p>
      <TextField value={reason} onChange={setReason} fullWidth>
        <Label>Why</Label>
        <Input
          placeholder={state.verifiedAt ? "The grading certificate has expired" : "RDB grading certificate checked, valid to 2027"}
        />
      </TextField>
      <div className="flex flex-wrap gap-2">
        {state.verifiedAt ? (
          <Button variant="secondary" isDisabled={busy || reason.trim().length < 4} onPress={() => void decide(false)}>
            Withdraw the confirmation
          </Button>
        ) : (
          <Button isDisabled={busy || reason.trim().length < 4} onPress={() => void decide(true)}>
            Confirm the grade
          </Button>
        )}
      </div>
      {error ? <p className="m-0 text-sm text-danger">{error}</p> : null}
    </section>
  );
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
        {org.domain === "hospitality" ? <StarGradeSection orgId={org.id} /> : null}
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
export function RegistrationsView({ orgs }: { orgs: AdminOrgRow[] }) {
  const [open, setOpen] = useState<AdminOrgRow | null>(null);
  const count = (t: Tab) => orgs.filter((o) => inTab(t, STAGE[o.registrationStatus])).length;
  return (
    <PageContent>
      <AreaHeader />
      <DataTable<AdminOrgRow>
        label="Registrations"
        rows={orgs}
        rowKey={(o) => o.id}
        noun={{ one: "business", many: "businesses" }}
        search={{ placeholder: "Name, UPI or TIN", text: (o) => `${o.legalName} ${o.upi ?? ""} ${o.tin ?? ""}` }}
        filters={[
          {
            id: "stage",
            name: "Stage",
            options: TABS.map((t) => ({ id: t, label: TAB_LABEL[t], count: count(t) })),
            match: (o, v) => inTab(v as Tab, STAGE[o.registrationStatus]),
          },
        ]}
        onRowAction={setOpen}
        defaultSort={{ column: "registered", direction: "descending" }}
        empty={<EmptyBlock icon="Briefcase" title="No registrations yet" />}
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
                          bad && i === at ? "bg-danger" : i < at ? "bg-success" : i === at ? "bg-accent" : "bg-default"
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
      {open ? <RegistrationPanel org={open} onClose={() => setOpen(null)} /> : null}
    </PageContent>
  );
}
