"use client";

import { Button, Input, Label, TextField } from "@heroui/react";
import type { AdminOrgListResponse, AdminOrgRow, AdminOrgStage, OrgRegistrationStatus } from "@injishi/contracts";
import {
  DateText,
  EmptyBlock,
  type IconKey,
  PageContent,
  type PlaceChain,
  ServerDataGrid,
  StatusChip,
  type StatusTone,
  type TimelineEvent,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import type { RegistrationEvent, StarGradeState } from "@/server/admin/registrations";
import {
  ALL,
  AreaFilter,
  CountStrip,
  ListBar,
  ListFilter,
  ListSearch,
  ListUrlProvider,
  SinceFilter,
  useListUrl,
} from "../list/list-kit";
import { EntityMark } from "../list/stat-cards";
import { decideStarGradeAction, loadStarGrade } from "./actions";

/** Where a registration stands, in the order it moves: paid, a field visit, a second officer's approval. */
export type Stage = "unpaid" | "visit" | "approval" | "active" | "rejected" | "suspended";

export const STAGE: Record<OrgRegistrationStatus, Stage> = {
  pending_payment: "unpaid",
  submitted: "visit",
  tin_verified: "visit",
  field_verified: "approval",
  approved: "active",
  active: "active",
  rejected: "rejected",
  suspended: "suspended",
};

export const STAGE_WORDS: Record<Stage, { label: string; tone: StatusTone }> = {
  unpaid: { label: "Fee not paid", tone: "default" },
  visit: { label: "Waiting for a field visit", tone: "warning" },
  approval: { label: "Waiting for approval", tone: "info" },
  active: { label: "Active", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  suspended: { label: "Suspended", tone: "danger" },
};

export const STEPS = [
  { id: "paid", title: "Registered and paid", description: "The business" },
  { id: "visit", title: "Document review", description: "Document review officer" },
  { id: "approval", title: "Approval", description: "A second officer" },
  { id: "active", title: "Active", description: "Can use Injishi" },
];

export const STEP_INDEX: Record<Stage, number> = {
  unpaid: 0,
  visit: 1,
  approval: 2,
  active: 4,
  rejected: 1,
  suspended: 4,
};

export const kindWords = (o: AdminOrgRow): string =>
  o.domain === "residence"
    ? o.residenceClass === "residential_property_manager"
      ? "Residence, managed for the owner"
      : "Residence, the landlord"
    : o.accommodationClass
      ? o.accommodationClass.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
      : o.domain.charAt(0).toUpperCase() + o.domain.slice(1);

/** One audit line in the officers' words: which gate, passed or refused, by which post. */
export function eventWords(e: RegistrationEvent): TimelineEvent {
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
export function StarGradeSection({ orgId }: { orgId: string }) {
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
          placeholder={
            state.verifiedAt ? "The grading certificate has expired" : "RDB grading certificate checked, valid to 2027"
          }
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

const STRIP: { id: AdminOrgStage; label: string; icon: IconKey; status?: "warning" | "danger" }[] = [
  { id: "review", label: "Waiting for review", icon: "Clock", status: "warning" },
  { id: "approval", label: "Waiting for approval", icon: "ShieldCheck" },
  { id: "active", label: "Active", icon: "CircleCheck" },
  { id: "unpaid", label: "Fee not paid", icon: "CreditCard" },
  { id: "closed", label: "Rejected or suspended", icon: "CircleXmark", status: "danger" },
];

const DOMAIN_OPTIONS = [
  { id: ALL, label: "All" },
  { id: "hospitality", label: "Hospitality" },
  { id: "residence", label: "Residence" },
  { id: "enterprise", label: "Other business" },
];

/**
 * Every business that registered, for Injishi staff (filters on the server, 2026-11-09): counts per stage
 * that are also the quickest filter, then search, kind, area and when they registered, all in the URL; one
 * page at a time, each business's history in a panel. Real records only, read from the admin API.
 */
export function RegistrationsView({ list, areaChain }: { list: AdminOrgListResponse; areaChain: PlaceChain }) {
  return (
    <ListUrlProvider>
      <Registrations list={list} areaChain={areaChain} />
    </ListUrlProvider>
  );
}

function Registrations({ list, areaChain }: { list: AdminOrgListResponse; areaChain: PlaceChain }) {
  const url = useListUrl();
  const router = useRouter();
  const counts = list.stageCounts ?? {};
  return (
    <PageContent>
      <AreaHeader />
      <CountStrip
        label="Businesses by stage"
        param="stage"
        items={STRIP.map((s) => ({
          id: s.id,
          label: s.label,
          icon: s.icon,
          value: counts[s.id] ?? 0,
          status: (counts[s.id] ?? 0) > 0 ? s.status : undefined,
        }))}
      />
      <ListBar
        keys={["q", "stage", "domain", "since"]}
        found={list.meta.total}
        noun={{ one: "business", many: "businesses" }}
        search={<ListSearch placeholder="Name, UPI or TIN" />}
      >
        <ListFilter
          param="stage"
          name="Stage"
          options={[
            { id: ALL, label: "All" },
            ...STRIP.map((s) => ({ id: s.id, label: s.label, count: counts[s.id] })),
          ]}
        />
        <ListFilter param="domain" name="Kind" icon="Briefcase" options={DOMAIN_OPTIONS} />
        <AreaFilter chain={areaChain} depth="district" />
        <SinceFilter name="Registered" />
      </ListBar>
      <ServerDataGrid<AdminOrgRow>
        label="Businesses"
        rows={list.items}
        rowKey={(o) => o.id}
        isLoading={url.pending}
        onRowAction={(o) => router.push(`/admin/businesses/${o.id}`)}
        paging={{
          page: list.meta.page,
          pageSize: list.meta.pageSize,
          total: list.meta.total,
          onPageChange: (page) => url.set({ page: String(page) }),
        }}
        empty={
          <EmptyBlock size="sm" icon="Briefcase" title="No business matches" description="Try clearing a filter." />
        }
        columns={[
          {
            id: "name",
            header: "Business",
            isRowHeader: true,
            minWidth: 240,
            cell: (o) => (
              <div className="flex min-w-0 items-center gap-3">
                <EntityMark name={o.legalName} kind={o.domain} />
                <div className="flex min-w-0 flex-col text-sm">
                  <span className="truncate font-medium">{o.legalName}</span>
                  <span className="truncate text-xs text-muted">
                    {kindWords(o)}
                    {o.tin ? ` · TIN ${o.tin}` : o.upi ? ` · UPI ${o.upi}` : ""}
                  </span>
                </div>
              </div>
            ),
          },
          { id: "district", header: "District", cell: (o) => o.districtName ?? "Not given" },
          {
            id: "progress",
            header: "Progress",
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
            cell: (o) => {
              const w = STAGE_WORDS[STAGE[o.registrationStatus]];
              return <StatusChip tone={w.tone}>{w.label}</StatusChip>;
            },
          },
          { id: "registered", header: "Registered", align: "end", cell: (o) => <DateText value={o.createdAt} /> },
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
    </PageContent>
  );
}
