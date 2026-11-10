"use client";

import {
  PSF_STANDING_LABEL,
  type PsfBusinessesPage,
  type PsfRegisterSummary,
  type PsfStanding,
} from "@injishi/contracts";
import {
  ActionButton,
  DataTable,
  EmptyBlock,
  formatDay,
  PageContent,
  PageHeader,
  type PlaceChain,
  StatusChip,
} from "@injishi/ui";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { rwf } from "@/server/format";
import {
  ALL,
  AreaFilter,
  CountStrip,
  ListBar,
  ListFilter,
  ListSearch,
  ListUrlProvider,
  useListUrl,
} from "../list/list-kit";
import { EntityMark } from "../list/stat-cards";

/** A standing, "renewal due" (inside the 60-day window) or "payment due" (sent, not paid). */
export type AdminPsfFilter = "" | PsfStanding | "renewal_due" | "payment_due";

const STATUS_ORDER: { id: Exclude<AdminPsfFilter, "">; label: string }[] = [
  { id: "member", label: "Members" },
  { id: "renewal_due", label: "Renewal due" },
  { id: "lapsed", label: "Lapsed" },
  { id: "applied", label: "Waiting for approval" },
  { id: "payment_due", label: "Sent, not paid" },
  { id: "sent_back", label: "Sent back" },
  { id: "claimed", label: "Card holders" },
  { id: "declined", label: "Declined" },
];

const TONE: Record<PsfStanding, "success" | "warning" | "danger" | "default"> = {
  member: "success",
  applied: "warning",
  sent_back: "warning",
  claimed: "warning",
  awaiting_payment: "warning",
  lapsed: "danger",
  declined: "danger",
  not_applied: "default",
};

const WITH_WITHOUT = (what: string) => [
  { id: ALL, label: "All" },
  { id: "with", label: `With ${what}` },
  { id: "without", label: `Without ${what}` },
];

/**
 * PSF memberships across Rwanda (2026-11-02, one toolbar 2026-11-09), for Injishi staff: every business on
 * PSF's register, its membership's end date, what is due for renewal and what lapsed, filtered by status,
 * area, cluster, kind, TIN and RDB certificate in the URL. Read only: PSF's District Managers decide
 * applications; a renewal is paid by the business and needs no decision.
 */
export function AdminPsfView(props: { summary: PsfRegisterSummary; page: PsfBusinessesPage; areaChain: PlaceChain }) {
  return (
    <ListUrlProvider>
      <PsfRegister {...props} />
    </ListUrlProvider>
  );
}

function PsfRegister({
  summary,
  page,
  areaChain,
}: {
  summary: PsfRegisterSummary;
  page: PsfBusinessesPage;
  areaChain: PlaceChain;
}) {
  const router = useRouter();
  const url = useListUrl();
  const lapsed = summary.byStanding.find((s) => s.key === "lapsed")?.count ?? 0;
  const countOf = (id: string): number | undefined =>
    id === "renewal_due"
      ? summary.renewalDue
      : id === "payment_due"
        ? summary.awaitingPayment
        : summary.byStanding.find((s) => s.key === id)?.count;
  // The register pages by cursor: the cursors behind this page ride in `back`, so Previous can return.
  const back = url.get("back") ? url.get("back").split(",") : [];
  const cursor = url.get("cursor");

  return (
    <PageContent>
      <PageHeader
        eyebrow="Government · PSF"
        title="PSF memberships"
        description="Every business on PSF's register across Rwanda."
      />

      <CountStrip
        label="Across Rwanda"
        param="status"
        items={[
          { id: "member", label: "Members", value: summary.members, icon: "Persons" },
          {
            id: "renewal_due",
            label: "Renewal due",
            value: summary.renewalDue,
            icon: "ArrowsRotateRight",
            status: summary.renewalDue > 0 ? "warning" : undefined,
            footnote: "Within 60 days of their end date",
          },
          {
            id: "lapsed",
            label: "Lapsed",
            value: lapsed,
            icon: "CircleXmark",
            status: lapsed > 0 ? "danger" : undefined,
            footnote: "Ended, not renewed",
          },
          {
            id: "applied",
            label: "Waiting for approval",
            value: summary.waiting,
            icon: "Clock",
            status: summary.waiting > 0 ? "warning" : undefined,
          },
          {
            id: "payment_due",
            label: "Sent, not paid",
            value: summary.awaitingPayment,
            icon: "Wallet",
            footnote: `${rwf(summary.paidThisYearRwf)} paid this year`,
          },
        ]}
      />

      <ListBar
        keys={["q", "status", "cluster", "kind", "tin", "rdb", "cursor", "back"]}
        found={page.total}
        noun={{ one: "business", many: "businesses" }}
        search={<ListSearch placeholder="Name, business code or TIN" />}
      >
        <ListFilter
          param="status"
          name="Status"
          options={[{ id: ALL, label: "All" }, ...STATUS_ORDER.map((s) => ({ ...s, count: countOf(s.id) }))]}
        />
        <AreaFilter chain={areaChain} depth="district" />
        <ListFilter
          param="cluster"
          name="Cluster"
          icon="Briefcase"
          options={[
            { id: ALL, label: "All" },
            ...summary.byCluster.filter((c) => c.key).map((c) => ({ id: c.key, label: c.label, count: c.count })),
          ]}
        />
        <ListFilter
          param="kind"
          name="Kind"
          icon="Persons"
          options={[
            { id: ALL, label: "All" },
            { id: "enterprise", label: "Enterprise" },
            { id: "hospitality", label: "Hospitality" },
          ]}
        />
        <ListFilter param="tin" name="TIN" icon="Persons" options={WITH_WITHOUT("a TIN")} />
        <ListFilter param="rdb" name="RDB" icon="Persons" options={WITH_WITHOUT("an RDB certificate")} />
      </ListBar>

      <DataTable
        label="PSF memberships"
        rows={page.items}
        rowKey={(b) => b.orgId}
        pageSize={100}
        onRowAction={(b) => router.push(`/admin/psf/${b.orgId}`)}
        empty={<EmptyBlock size="sm" icon="Persons" title="No business matches" description="Try clearing a filter." />}
        columns={[
          {
            id: "name",
            header: "Business",
            isRowHeader: true,
            sortValue: (b) => b.legalName,
            cell: (b) => (
              <span className="flex min-w-0 items-center gap-3">
                <EntityMark name={b.legalName} kind={b.domain} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <NextLink
                    href={`/admin/psf/${b.orgId}`}
                    className="truncate font-medium text-foreground hover:underline"
                  >
                    {b.legalName}
                  </NextLink>
                  <span className="truncate text-xs text-muted">
                    {[b.businessCode ?? "No code yet", b.membershipNumber].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </span>
            ),
          },
          {
            id: "district",
            header: "District",
            sortValue: (b) => b.districtName ?? "",
            cell: (b) => b.districtName ?? "—",
          },
          {
            id: "standing",
            header: "Status",
            sortValue: (b) => b.standing,
            cell: (b) => (
              <StatusChip tone={TONE[b.standing] ?? "default"}>
                {PSF_STANDING_LABEL[b.standing] ?? b.standing}
              </StatusChip>
            ),
          },
          { id: "tier", header: "Tier", sortValue: (b) => b.tierName ?? "", cell: (b) => b.tierName ?? "—" },
          {
            id: "ends",
            header: "Ends",
            sortValue: (b) => b.expiresOn ?? "",
            cell: (b) => <MembershipEnd expiresOn={b.standing === "member" ? b.expiresOn : null} />,
          },
          {
            id: "paid",
            header: "Paid",
            align: "end",
            sortValue: (b) => b.paidRwf,
            cell: (b) => (
              <span className="flex flex-col items-end gap-0.5">
                <span className="whitespace-nowrap tabular">{rwf(b.paidRwf)}</span>
                {b.lastPaidAt ? <span className="text-xs whitespace-nowrap text-muted">last {formatDay(b.lastPaidAt)}</span> : null}
              </span>
            ),
          },
        ]}
        mobile={{
          title: (b) => b.legalName,
          description: (b) =>
            b.expiresOn && b.standing === "member" ? `Ends ${formatDay(b.expiresOn)}` : (b.districtName ?? ""),
          trailing: (b) => (
            <StatusChip tone={TONE[b.standing] ?? "default"}>{PSF_STANDING_LABEL[b.standing] ?? b.standing}</StatusChip>
          ),
        }}
      />
      {cursor || page.nextCursor ? (
        <div className="flex items-center justify-end gap-2">
          <ActionButton
            intent="secondary"
            icon="ArrowLeft"
            isDisabled={!cursor}
            onPress={() => {
              const prev = back.slice(0, -1);
              url.set({ cursor: back.at(-1) || null, back: prev.join(",") || null, page: null });
            }}
          >
            Previous
          </ActionButton>
          <ActionButton
            intent="secondary"
            icon="ArrowRight"
            isDisabled={!page.nextCursor}
            onPress={() => url.set({ cursor: page.nextCursor, back: [...back, cursor || ""].join(","), page: null })}
          >
            Next
          </ActionButton>
        </div>
      ) : null}
    </PageContent>
  );
}

/** Days from today in Kigali to a yyyy-mm-dd date. */
function daysUntil(isoDate: string): number {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kigali" }).format(new Date());
  return Math.round((Date.parse(`${isoDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/** A member's end date, flagged once it is inside the 60-day renewal window. */
function MembershipEnd({ expiresOn }: { expiresOn: string | null }) {
  if (!expiresOn) return <span className="text-muted">—</span>;
  const left = daysUntil(expiresOn);
  if (left > 60) return <span className="tabular">{formatDay(expiresOn)}</span>;
  return (
    <span className="flex flex-col gap-0.5">
      <span className="tabular">{formatDay(expiresOn)}</span>
      <StatusChip tone={left < 0 ? "danger" : "warning"}>
        {left < 0 ? "Past its end" : left === 0 ? "Ends today" : `Renew in ${left} days`}
      </StatusChip>
    </span>
  );
}
