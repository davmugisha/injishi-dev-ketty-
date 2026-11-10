"use client";

import { Tabs } from "@heroui/react";
import {
  type AdminOrgDetail,
  type AdminOrgMember,
  type AdminOrgProperty,
  type AdminOrgSubscription,
  ORG_ROLE_LABEL,
  PSF_STANDING_LABEL,
  type PsfBusinessRow,
} from "@injishi/contracts";
import {
  DataTable,
  DateText,
  EmptyBlock,
  EventTimeline,
  FlowStepper,
  formatMoney,
  LinkButton,
  PageContent,
  PageHeader,
  SectionCard,
  StatusChip,
  type TimelineEvent,
} from "@injishi/ui";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import type { RegistrationEvent } from "@/server/admin/registrations";
import { EntityMark } from "../list/stat-cards";
import { FactRow } from "../shared";
import {
  eventWords,
  HrFeaturesSection,
  kindWords,
  STAGE,
  STAGE_WORDS,
  STEP_INDEX,
  STEPS,
  StarGradeSection,
} from "./RegistrationsView";

const INVOICE_KIND = { registration_fee: "Registration fee", subscription: "Subscription" } as const;
const INVOICE_TONE = { pending: "warning", paid: "success", failed: "danger" } as const;

/**
 * One business for Injishi staff (2026-11-09): its registration steps and history, its details, people
 * (each opens their page), properties, money (finance staff) and a link to its PSF record. Read only:
 * officers decide registrations; a person's role in the business is changed on their page.
 */
export function BusinessView({
  org,
  timeline,
  people,
  properties,
  money,
  canSeePeople,
  psf,
}: {
  org: AdminOrgDetail;
  timeline: RegistrationEvent[];
  /** Null when this staffer may not read them. */
  people: AdminOrgMember[] | null;
  properties: AdminOrgProperty[] | null;
  money: AdminOrgSubscription | null;
  canSeePeople: boolean;
  /** Its row on PSF's register, or null when PSF has no record of it. */
  psf: PsfBusinessRow | null;
}) {
  const router = useRouter();
  const stage = STAGE[org.registrationStatus];
  const words = STAGE_WORDS[stage];
  const active = (people ?? []).filter((p) => p.status === "active");
  const hasPsf = psf !== null;
  const history: TimelineEvent[] = [
    { id: "registered", at: org.createdAt, title: "Registered", detail: kindWords(org), tone: "success" },
    ...[...timeline].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)).map(eventWords),
  ];

  return (
    <PageContent>
      <PageHeader
        eyebrow="Businesses"
        title={org.legalName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{[kindWords(org), org.districtName].filter(Boolean).join(" · ")}</span>
            <StatusChip tone={words.tone}>{words.label}</StatusChip>
          </span>
        }
        actions={
          <span className="flex flex-wrap gap-2">
            {hasPsf ? (
              <LinkButton href={`/admin/psf/${org.id}`} variant="secondary">
                PSF record
              </LinkButton>
            ) : null}
            <LinkButton href="/admin/businesses" variant="secondary">
              All businesses
            </LinkButton>
          </span>
        }
      />
      <Tabs variant="secondary" defaultSelectedKey="overview">
        <Tabs.ListContainer>
          <Tabs.List aria-label="About this business">
            <Tabs.Tab id="overview">
              Overview
              <Tabs.Indicator />
            </Tabs.Tab>
            {people ? (
              <Tabs.Tab id="people">
                People ({active.length})
                <Tabs.Indicator />
              </Tabs.Tab>
            ) : null}
            {properties ? (
              <Tabs.Tab id="properties">
                Properties ({properties.filter((p) => !p.archivedAt).length})
                <Tabs.Indicator />
              </Tabs.Tab>
            ) : null}
            {money ? (
              <Tabs.Tab id="money">
                Money
                <Tabs.Indicator />
              </Tabs.Tab>
            ) : null}
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="overview" className="pt-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <SectionCard title="Details" description="What the business registered with.">
              <dl className="flex flex-col">
                <FactRow label="Kind">{kindWords(org)}</FactRow>
                <FactRow label="TIN">{org.tin ? <span className="tabular">{org.tin}</span> : null}</FactRow>
                {org.upi ? (
                  <FactRow label="UPI">
                    <span className="tabular">{org.upi}</span>
                  </FactRow>
                ) : null}
                <FactRow label="District">{org.districtName}</FactRow>
                <FactRow label="Address">{org.addressText?.trim() || null}</FactRow>
                {org.domain === "hospitality" ? (
                  <FactRow label="Tourism licence">{org.tourismLicenseNumber}</FactRow>
                ) : null}
                <FactRow label="Plan">{org.subscriptionPlanName}</FactRow>
                <FactRow label="Registered">
                  <DateText value={org.createdAt} style="long" />
                </FactRow>
                <FactRow
                  label="PSF"
                  chip={
                    hasPsf ? (
                      <NextLink
                        href={`/admin/psf/${org.id}`}
                        className="text-sm font-medium text-accent hover:underline"
                      >
                        Open
                      </NextLink>
                    ) : undefined
                  }
                >
                  {psf
                    ? [PSF_STANDING_LABEL[psf.standing] ?? psf.standing, psf.membershipNumber]
                        .filter(Boolean)
                        .join(" · ")
                    : "No PSF record"}
                </FactRow>
              </dl>
              {org.domain === "hospitality" ? (
                <div className="border-t border-separator pt-4">
                  <StarGradeSection orgId={org.id} />
                </div>
              ) : null}
            </SectionCard>
            <SectionCard
              title="Registration"
              description={
                stage === "visit" || stage === "approval"
                  ? "Two officers decide: a field visit, then a second officer's approval."
                  : undefined
              }
            >
              <FlowStepper label="Registration steps" steps={STEPS} current={STEP_INDEX[stage]} />
              <div className="border-t border-separator pt-4">
                <EventTimeline label={`History of ${org.legalName}`} events={history} />
              </div>
            </SectionCard>
            <HrFeaturesSection orgId={org.id} />
          </div>
        </Tabs.Panel>

        {people ? (
          <Tabs.Panel id="people" className="pt-5">
            <DataTable<AdminOrgMember>
              label="People in this business"
              rows={people}
              rowKey={(p) => p.userId}
              noun={{ one: "person", many: "people" }}
              onRowAction={canSeePeople ? (p) => router.push(`/admin/people/${p.userId}`) : undefined}
              empty={<EmptyBlock size="sm" icon="Persons" title="Nobody in this business yet" />}
              columns={[
                {
                  id: "person",
                  header: "Person",
                  isRowHeader: true,
                  sortValue: (p) => p.name ?? p.email,
                  cell: (p) => (
                    <div className="flex min-w-0 items-center gap-3 text-sm">
                      <EntityMark name={p.name?.trim() || p.email} />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{p.name?.trim() || p.email}</span>
                        <span className="truncate text-xs text-muted">{p.email}</span>
                      </div>
                    </div>
                  ),
                },
                { id: "role", header: "Role", sortValue: (p) => p.orgRole, cell: (p) => ORG_ROLE_LABEL[p.orgRole] },
                {
                  id: "status",
                  header: "Status",
                  cell: (p) =>
                    p.status === "active" ? (
                      <StatusChip tone="success">Active</StatusChip>
                    ) : (
                      <StatusChip tone="default">Removed</StatusChip>
                    ),
                },
                {
                  id: "joined",
                  header: "Joined",
                  align: "end",
                  sortValue: (p) => p.joinedAt,
                  cell: (p) => <DateText value={p.joinedAt} />,
                },
              ]}
              mobile={{ title: (p) => p.name?.trim() || p.email, description: (p) => ORG_ROLE_LABEL[p.orgRole] }}
            />
          </Tabs.Panel>
        ) : null}

        {properties ? (
          <Tabs.Panel id="properties" className="pt-5">
            <DataTable<AdminOrgProperty>
              label="Properties"
              rows={properties}
              rowKey={(p) => p.id}
              noun={{ one: "property", many: "properties" }}
              empty={<EmptyBlock size="sm" icon="House" title="No properties yet" />}
              columns={[
                {
                  id: "name",
                  header: "Property",
                  isRowHeader: true,
                  sortValue: (p) => p.name,
                  cell: (p) => (
                    <div className="flex min-w-0 flex-col text-sm">
                      <span className="truncate font-medium">{p.name}</span>
                      <span className="truncate text-xs text-muted">
                        {[p.isHeadOffice ? "Head office" : null, p.districtName].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                  ),
                },
                { id: "rooms", header: "Rooms", align: "end", sortValue: (p) => p.roomCount, cell: (p) => p.roomCount },
                {
                  id: "types",
                  header: "Room types",
                  align: "end",
                  sortValue: (p) => p.roomTypeCount,
                  cell: (p) => p.roomTypeCount,
                },
                {
                  id: "status",
                  header: "On the marketplace",
                  cell: (p) =>
                    p.archivedAt ? (
                      <StatusChip tone="default">Archived</StatusChip>
                    ) : p.published ? (
                      <StatusChip tone="success">Published</StatusChip>
                    ) : (
                      <StatusChip tone="warning">Not published</StatusChip>
                    ),
                },
              ]}
              mobile={{ title: (p) => p.name, description: (p) => `${p.roomCount} rooms` }}
            />
          </Tabs.Panel>
        ) : null}

        {money ? (
          <Tabs.Panel id="money" className="pt-5">
            <div className="flex flex-col gap-5">
              <SectionCard title="Subscription">
                {money.subscription ? (
                  <dl className="flex flex-col">
                    <FactRow label="Plan">{money.subscription.planName}</FactRow>
                    <FactRow label="Status">{money.subscription.status.replace(/_/g, " ")}</FactRow>
                    <FactRow label="Current period">
                      {money.subscription.currentPeriodStart && money.subscription.currentPeriodEnd ? (
                        <>
                          <DateText value={money.subscription.currentPeriodStart} /> to{" "}
                          <DateText value={money.subscription.currentPeriodEnd} />
                        </>
                      ) : null}
                    </FactRow>
                  </dl>
                ) : (
                  <p className="m-0 text-sm text-muted">No subscription yet.</p>
                )}
              </SectionCard>
              <DataTable
                label="Invoices"
                rows={money.invoices}
                rowKey={(i) => i.id}
                noun={{ one: "invoice", many: "invoices" }}
                defaultSort={{ column: "date", direction: "descending" }}
                empty={<EmptyBlock size="sm" icon="CreditCard" title="No invoices yet" />}
                columns={[
                  {
                    id: "kind",
                    header: "Invoice",
                    isRowHeader: true,
                    cell: (i) => INVOICE_KIND[i.invoiceKind],
                  },
                  {
                    id: "amount",
                    header: "Amount",
                    align: "end",
                    sortValue: (i) => i.amountRwf,
                    cell: (i) => <span className="tabular">{formatMoney(i.amountRwf)}</span>,
                  },
                  {
                    id: "status",
                    header: "Status",
                    cell: (i) => (
                      <StatusChip tone={INVOICE_TONE[i.status]}>
                        {i.status.charAt(0).toUpperCase() + i.status.slice(1)}
                      </StatusChip>
                    ),
                  },
                  {
                    id: "date",
                    header: "Date",
                    align: "end",
                    sortValue: (i) => i.createdAt,
                    cell: (i) => <DateText value={i.createdAt} />,
                  },
                ]}
                mobile={{ title: (i) => INVOICE_KIND[i.invoiceKind], description: (i) => formatMoney(i.amountRwf) }}
              />
            </div>
          </Tabs.Panel>
        ) : null}
      </Tabs>
    </PageContent>
  );
}
