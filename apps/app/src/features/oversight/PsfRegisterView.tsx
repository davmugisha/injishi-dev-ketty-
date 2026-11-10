"use client";

import { Magnifier } from "@gravity-ui/icons";
import { Alert, Button, Input } from "@heroui/react";
import { PSF_OWNER_GROUP_SHORT } from "@injishi/contracts";
import {
  DataTable,
  EmptyBlock,
  formatDay,
  formatNumber,
  KpiStrip,
  PageContent,
  PageHeader,
  SectionCard,
  StatusChip,
} from "@injishi/ui";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { rwf } from "@/server/format";
import { ExportMenu } from "@/components/ExportMenu";
import type { ExportTable } from "@/lib/table-export";
import { kigaliToday } from "./psf-csv";
import { exportPsfBusinessesAction } from "./psf-export-actions";
import { sendPaymentRemindersAction } from "./psf-reminder-actions";
import {
  PSF_STANDING_LABEL,
  type PsfBusinessesFilter,
  type PsfBusinessesPage,
  type PsfOwnerGroup,
  type PsfRegisterSummary,
  type PsfScope,
  type PsfStanding,
} from "@/server/sources/psf";

/** The standings, and two views of their own: renewal due, and awaiting payment (2026-11-02). */
type RegisterView = "" | PsfStanding | "renewal_due" | "payment_due";

/** Everything the screen is narrowed by, as the address carries it. */
export interface RegisterFilters {
  q: string;
  view: RegisterView;
  cluster: string;
  tier: string;
  district: string;
  group: string;
  tin: string;
  rdb: string;
}

const STANDINGS: { id: RegisterView; label: string }[] = [
  { id: "", label: "All" },
  { id: "member", label: "Members" },
  { id: "renewal_due", label: "Renewal due" },
  { id: "payment_due", label: "Awaiting payment" },
  { id: "applied", label: "Waiting for approval" },
  { id: "sent_back", label: "Sent back" },
  { id: "claimed", label: "Card holders" },
  { id: "awaiting_payment", label: "Approved, to pay" },
  { id: "lapsed", label: "Lapsed" },
  { id: "declined", label: "Declined" },
  { id: "not_applied", label: "Not applied" },
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

const viewLabel = (v: RegisterView): string =>
  v === "renewal_due" ? "Renewal due" : v === "payment_due" ? "Awaiting payment" : v ? PSF_STANDING_LABEL[v] : "Every business";

/** The screen's filters as the API reads them. */
function apiFilter(f: RegisterFilters): PsfBusinessesFilter {
  return {
    q: f.q,
    standing: f.view && f.view !== "renewal_due" && f.view !== "payment_due" ? f.view : undefined,
    renewal: f.view === "renewal_due" ? "due" : undefined,
    payment: f.view === "payment_due" ? "due" : undefined,
    cluster: f.cluster || undefined,
    tier: f.tier || undefined,
    district: f.district ? Number(f.district) : undefined,
    group: (f.group || undefined) as PsfOwnerGroup | undefined,
    tin: (f.tin || undefined) as "with" | "without" | undefined,
    rdb: (f.rdb || undefined) as "with" | "without" | undefined,
  };
}

/**
 * Businesses (2026-10-30, was "Business register"): every business in the manager's region that PSF
 * knows, with how it stands with PSF. Each row opens the business: its documents, how its registration
 * was decided, whether guests can book it, and its membership.
 *
 * 2026-11-02: narrowed by sector, tier, district, owner group and TIN too; and "Awaiting payment" lists
 * the applications sent and not paid, with who to reach, so the officer can send a payment reminder.
 */
export function PsfRegisterView({
  scope,
  summary,
  page,
  filters,
  tiers,
}: {
  scope: PsfScope;
  summary: PsfRegisterSummary;
  page: PsfBusinessesPage;
  filters: RegisterFilters;
  tiers: { code: string; nameEn: string }[];
}) {
  const t = useTranslations("psfConsole.queue");
  const router = useRouter();
  const [search, setSearch] = useState(filters.q);
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [reminding, setReminding] = useState<string | null>(null);
  const payments = filters.view === "payment_due";
  const showDistrict = scope.level !== "district";
  const districts = scope.provinces.flatMap((pr) => pr.districts);
  const narrowed = Boolean(filters.q || filters.view || filters.cluster || filters.tier || filters.district || filters.group || filters.tin || filters.rdb);
  const open = (orgId: string) => router.push(`/psf/register/${orgId}`);

  const go = (next: Partial<RegisterFilters>) => {
    const f = { ...filters, q: search, ...next };
    const params = new URLSearchParams();
    if (f.q.trim()) params.set("q", f.q.trim());
    if (f.view === "renewal_due") params.set("renewal", "due");
    else if (f.view === "payment_due") params.set("payment", "due");
    else if (f.view) params.set("standing", f.view);
    for (const k of ["cluster", "tier", "district", "group", "tin", "rdb"] as const) if (f[k]) params.set(k, f[k]);
    const qs = params.toString();
    router.push(qs ? `/psf/register?${qs}` : "/psf/register");
  };

  /** One business's reminder, or every one waiting in the region (`orgId` left out). */
  const remind = async (orgId?: string) => {
    setReminding(orgId ?? "all");
    setProblem(null);
    setNote(null);
    const res = await sendPaymentRemindersAction(orgId);
    setReminding(null);
    if (!res.ok) return setProblem(res.error);
    const { sent, skipped } = res.value;
    setNote(
      sent === 0
        ? "Nothing sent: every business here was already reminded in the last day."
        : `Sent ${sent} reminder${sent === 1 ? "" : "s"} by email and text, each with the link to pay.${skipped ? ` ${skipped} reminded in the last day were left alone.` : ""}`,
    );
    router.refresh();
  };

  // Every business under this search and filter, not only the page shown (2026-11-02).
  const exportRows = async (): Promise<ExportTable | string> => {
    const res = await exportPsfBusinessesAction(apiFilter(filters));
    if (!res.ok) return res.error;
    const narrowedBy = [
      viewLabel(filters.view),
      filters.cluster ? (summary.byCluster.find((c) => c.key === filters.cluster)?.label ?? filters.cluster) : null,
      filters.tier ? (tiers.find((t) => t.code === filters.tier)?.nameEn ?? filters.tier) : null,
      filters.district ? (districts.find((d) => String(d.id) === filters.district)?.name ?? null) : null,
      filters.group ? PSF_OWNER_GROUP_SHORT[filters.group as PsfOwnerGroup] : null,
      filters.tin === "with" ? "With a TIN" : filters.tin === "without" ? "Without a TIN" : null,
      filters.rdb === "with" ? "With an RDB certificate" : filters.rdb === "without" ? "Without an RDB certificate" : null,
      filters.q ? `“${filters.q}”` : null,
    ];
    return {
      filename: `psf-businesses-${kigaliToday()}`,
      title: payments ? "PSF applications awaiting payment" : "PSF businesses",
      subtitle: [summary.regionLabel, ...narrowedBy, `exported ${kigaliToday()}`].filter(Boolean).join(" · "),
      sections: [
        payments
          ? {
              heading: ["Business", "docID", "District", "Contact", "Phone", "Email", "To pay (RWF)", "Waiting since", "Last reminder"],
              rows: res.rows.map((b) => [
                b.legalName,
                b.paymentDue?.docId,
                b.districtName,
                b.paymentDue?.contactName,
                b.paymentDue?.phoneE164,
                b.paymentDue?.email,
                b.paymentDue?.amountRwf,
                b.paymentDue?.since.slice(0, 10),
                b.paymentDue?.lastRemindedAt?.slice(0, 10) ?? "",
              ]),
            }
          : {
              heading: ["Business", "Business code", "District", "Sector", "Kind", "Association", "With PSF", "Tier", "Membership number", "Ends", "Paid (RWF)", "Last paid", "Branches"],
              rows: res.rows.map((b) => [
                b.legalName,
                b.businessCode,
                b.districtName,
                b.clusterName,
                b.subsectorName,
                b.associationName,
                PSF_STANDING_LABEL[b.standing] ?? b.standing,
                b.tierName,
                b.membershipNumber,
                b.standing === "member" ? b.expiresOn : "",
                b.paidRwf,
                b.lastPaidAt ? b.lastPaidAt.slice(0, 10) : "",
                b.branchCount,
              ]),
            },
      ],
    };
  };

  type Row = PsfBusinessesPage["items"][number];
  const select = (label: string, value: string, key: keyof RegisterFilters, options: { value: string; label: string }[]) => (
    <label className="flex min-w-[10rem] flex-col gap-1 text-xs font-medium text-muted">
      {label}
      <select
        value={value}
        onChange={(e) => go({ [key]: e.target.value })}
        className="h-9 rounded-xl border border-border bg-field px-2.5 text-sm font-normal text-foreground"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <PageContent>
      <PageHeader
        eyebrow={`${scope.title} · ${scope.label}`}
        title={t("business")}
        description={t("waitingLead")}
      />

      <KpiStrip
        label={t("business")}
        items={[
          { id: "total", label: "Businesses", value: summary.total, format: "count", icon: "FolderHouse" },
          {
            id: "members",
            label: "Members",
            value: summary.members,
            format: "count",
            icon: "Persons",
            href: "/psf/register?standing=member",
            isCurrent: filters.view === "member",
          },
          {
            id: "unpaid",
            label: "Awaiting payment",
            value: summary.awaitingPayment,
            format: "count",
            icon: "Wallet",
            status: summary.awaitingPayment > 0 ? "warning" : undefined,
            footnote: summary.awaitingPayment ? "Applied, not paid yet" : "None waiting",
            href: "/psf/register?payment=due",
            isCurrent: payments,
          },
          {
            id: "waiting",
            label: "Waiting on PSF",
            value: summary.waiting,
            format: "count",
            icon: "Clock",
            status: summary.waiting > 0 ? "warning" : undefined,
            footnote: summary.waiting ? "Decide them in Membership applications" : "None waiting",
            href: "/psf",
          },
          {
            id: "renewal",
            label: "Renewal due",
            value: summary.renewalDue,
            format: "count",
            icon: "ArrowsRotateRight",
            status: summary.renewalDue > 0 ? "warning" : undefined,
            footnote: `${formatNumber(summary.renewedThisYear)} renewed this year`,
            href: "/psf/register?renewal=due",
            isCurrent: filters.view === "renewal_due",
          },
          {
            id: "paid",
            label: "Paid to PSF this year",
            value: summary.paidThisYearRwf,
            format: "money",
            icon: "Wallet",
          },
        ]}
      />

      {scope.level !== "district" ? (
        <Alert status="accent">
          <Alert.Content>
            <Alert.Title>For reporting</Alert.Title>
            <Alert.Description>
              Membership decisions stay with each district&apos;s PSF District Manager. You see every business in{" "}
              {scope.label}.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      {note ? (
        <Alert status="success">
          <Alert.Content>
            <Alert.Description>{note}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      <SectionCard
        title={viewLabel(filters.view)}
        description={
          payments
            ? `${formatNumber(page.total)} ${page.total === 1 ? "application" : "applications"} sent and not paid. PSF reviews only paid ones: remind them, and each gets the link to pay.`
            : `${formatNumber(page.total)} ${page.total === 1 ? "business" : "businesses"}`
        }
        actions={
          <span className="flex flex-wrap items-center gap-2">
            {payments && page.total > 0 ? (
              <Button size="sm" variant="primary" isPending={reminding === "all"} isDisabled={reminding !== null} onPress={() => void remind()}>
                Remind all
              </Button>
            ) : null}
            <ExportMenu load={exportRows} isDisabled={page.total === 0} onProblem={setProblem} />
          </span>
        }
        contentClassName="gap-3"
      >
        {problem ? <p className="text-sm text-danger">{problem}</p> : null}
        <form
          className="flex max-w-xl flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            go({});
          }}
        >
          <Input
            aria-label={t("searchApplications")}
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-[16rem] flex-1"
          />
          <Button type="submit" variant="secondary">
            <Magnifier className="size-4" /> {t("searchApplications")}
          </Button>
        </form>
        <fieldset className="flex min-w-0 flex-wrap gap-1.5" aria-label={t("applicationStatus")}>
          {STANDINGS.map((st) => (
            <Button
              key={st.id || "all"}
              size="sm"
              variant={filters.view === st.id ? "primary" : "ghost"}
              aria-pressed={filters.view === st.id}
              onPress={() => go({ view: st.id })}
            >
              {st.label}
            </Button>
          ))}
        </fieldset>
        <fieldset className="flex min-w-0 flex-wrap items-end gap-3" aria-label="Narrow the list">
          {select(
            "Sector",
            filters.cluster,
            "cluster",
            summary.byCluster.filter((c) => c.key !== "none").map((c) => ({ value: c.key, label: c.label })),
          )}
          {select("Tier", filters.tier, "tier", tiers.map((t) => ({ value: t.code, label: t.nameEn })))}
          {showDistrict ? select("District", filters.district, "district", districts.map((d) => ({ value: String(d.id), label: d.name }))) : null}
          {select(
            "Owned by",
            filters.group,
            "group",
            (Object.keys(PSF_OWNER_GROUP_SHORT) as PsfOwnerGroup[]).map((g) => ({ value: g, label: PSF_OWNER_GROUP_SHORT[g] })),
          )}
          {select("TIN", filters.tin, "tin", [
            { value: "with", label: "With a TIN" },
            { value: "without", label: "Without a TIN" },
          ])}
          {select("RDB certificate", filters.rdb, "rdb", [
            { value: "with", label: "With a certificate" },
            { value: "without", label: "Without a certificate" },
          ])}
          {narrowed ? (
            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                setSearch("");
                router.push("/psf/register");
              }}
            >
              Clear all
            </Button>
          ) : null}
        </fieldset>
        <DataTable
          label={t("business")}
          rows={page.items}
          rowKey={(b) => b.orgId}
          onRowAction={(b) => open(b.orgId)}
          empty={
            <EmptyBlock
              size="sm"
              icon={payments ? "Wallet" : "FolderHouse"}
              title={payments ? "Nobody is waiting to pay" : "No business matches"}
              description={
                payments
                  ? "Every application sent in your region is paid."
                  : filters.view === "claimed"
                    ? "No business in this region has a card waiting on PSF. A card you confirm in Card holders makes it a member."
                    : narrowed
                      ? "Change the filters, or Clear all."
                      : "None in this region yet."
              }
            />
          }
          columns={
            payments
              ? [
                  {
                    id: "name",
                    header: "Business",
                    isRowHeader: true,
                    sortValue: (b: Row) => b.legalName,
                    cell: (b: Row) => (
                      <span className="flex flex-col gap-0.5">
                        <NextLink href={`/psf/register/${b.orgId}`} className="font-medium text-foreground hover:underline">
                          {b.legalName}
                        </NextLink>
                        <span className="text-xs text-muted">{[b.paymentDue?.docId, b.districtName].filter(Boolean).join(" · ")}</span>
                      </span>
                    ),
                  },
                  {
                    id: "contact",
                    header: "Contact",
                    sortValue: (b: Row) => b.paymentDue?.contactName ?? "",
                    cell: (b: Row) => (
                      <span className="flex flex-col gap-0.5">
                        <span>{b.paymentDue?.contactName ?? "—"}</span>
                        <span className="text-xs text-muted">
                          {[b.paymentDue?.phoneE164, b.paymentDue?.email].filter(Boolean).join(" · ") || "No phone or email"}
                        </span>
                      </span>
                    ),
                  },
                  {
                    id: "owes",
                    header: "To pay",
                    align: "end" as const,
                    sortValue: (b: Row) => b.paymentDue?.amountRwf ?? 0,
                    cell: (b: Row) => <span className="tabular">{b.paymentDue?.amountRwf ? rwf(b.paymentDue.amountRwf) : "—"}</span>,
                  },
                  {
                    id: "since",
                    header: "Waiting since",
                    sortValue: (b: Row) => b.paymentDue?.since ?? "",
                    cell: (b: Row) => (
                      <span className="flex flex-col gap-0.5">
                        <span className="tabular">{b.paymentDue ? formatDay(b.paymentDue.since) : "—"}</span>
                        <span className="text-xs text-muted">
                          {b.paymentDue?.lastRemindedAt ? `Reminded ${formatDay(b.paymentDue.lastRemindedAt)}` : "Not reminded yet"}
                        </span>
                      </span>
                    ),
                  },
                  {
                    id: "remind",
                    header: "",
                    align: "end" as const,
                    cell: (b: Row) => {
                      const recent = b.paymentDue?.lastRemindedAt && Date.now() - Date.parse(b.paymentDue.lastRemindedAt) < 24 * 3600 * 1000;
                      return (
                        <Button
                          size="sm"
                          variant="secondary"
                          isPending={reminding === b.orgId}
                          isDisabled={reminding !== null || Boolean(recent)}
                          onPress={() => void remind(b.orgId)}
                        >
                          {recent ? "Reminded today" : "Remind"}
                        </Button>
                      );
                    },
                  },
                ]
              : [
                  {
                    id: "name",
                    header: "Business",
                    isRowHeader: true,
                    sortValue: (b: Row) => b.legalName,
                    cell: (b: Row) => (
                      <span className="flex flex-col gap-0.5">
                        <NextLink href={`/psf/register/${b.orgId}`} className="font-medium text-foreground hover:underline">
                          {b.legalName}
                        </NextLink>
                        <span className="text-xs text-muted">
                          {b.businessCode ?? "No code yet"}
                          {b.branchCount > 0 ? ` · ${b.branchCount} more branches` : ""}
                          {!b.headOfficeInScope ? " · a branch in your region" : ""}
                        </span>
                      </span>
                    ),
                  },
                  {
                    id: "sector",
                    header: "PSF sector",
                    sortValue: (b: Row) => b.clusterName ?? "",
                    cell: (b: Row) => [b.clusterName, b.subsectorName].filter(Boolean).join(" · ") || "—",
                  },
                  ...(showDistrict
                    ? [
                        {
                          id: "district",
                          header: "District",
                          sortValue: (b: Row) => b.districtName ?? "",
                          cell: (b: Row) => b.districtName ?? "—",
                        },
                      ]
                    : []),
                  {
                    id: "standing",
                    header: "With PSF",
                    sortValue: (b: Row) => b.standing,
                    cell: (b: Row) => <StatusChip tone={TONE[b.standing] ?? "default"}>{PSF_STANDING_LABEL[b.standing] ?? b.standing}</StatusChip>,
                  },
                  { id: "tier", header: "Tier", sortValue: (b: Row) => b.tierName ?? "", cell: (b: Row) => b.tierName ?? "—" },
                  {
                    id: "ends",
                    header: "Ends",
                    sortValue: (b: Row) => b.expiresOn ?? "",
                    cell: (b: Row) => <MembershipEnd expiresOn={b.standing === "member" ? b.expiresOn : null} />,
                  },
                  {
                    id: "paid",
                    header: "Paid",
                    align: "end" as const,
                    sortValue: (b: Row) => b.paidRwf,
                    cell: (b: Row) => <span className="tabular">{rwf(b.paidRwf)}</span>,
                  },
                ]
          }
          mobile={{
            title: (b) => b.legalName,
            description: (b) =>
              payments ? [b.paymentDue?.contactName, b.paymentDue?.phoneE164].filter(Boolean).join(" · ") : (b.businessCode ?? "No code yet"),
            trailing: (b) =>
              payments ? (
                <span className="tabular">{b.paymentDue?.amountRwf ? rwf(b.paymentDue.amountRwf) : ""}</span>
              ) : (
                <StatusChip tone={TONE[b.standing] ?? "default"}>{PSF_STANDING_LABEL[b.standing] ?? b.standing}</StatusChip>
              ),
          }}
        />
      </SectionCard>
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
  const date = new Date(`${expiresOn}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  if (left > 60) return <span className="tabular">{date}</span>;
  return (
    <span className="flex flex-col gap-0.5">
      <span className="tabular">{date}</span>
      <StatusChip tone={left < 0 ? "danger" : "warning"}>{left < 0 ? "Past its end" : left === 0 ? "Ends today" : `Renew in ${left} days`}</StatusChip>
    </span>
  );
}
