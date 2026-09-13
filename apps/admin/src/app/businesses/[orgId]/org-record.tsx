import Link from "next/link";

import type { StaffPermission } from "@injishi/contracts";
import { Badge, Card, CardDescription, CardTitle } from "@injishi/ui";
import { Zap } from "lucide-react";
import { FailureNextStep } from "@/components/failure/failure-next-step";
import {
  getOboAudit,
  getOrg,
  getOrgMoney,
  getOrgPeople,
  getOrgProperties,
  getOrgSubscription,
  getOrgTimeline,
} from "@/lib/api/orgs";
import { apiFailureMessage, failureHeading, type ApiFailure } from "@/lib/api/server";
import { EMPTY, count, date, elapsed } from "@/lib/present/format";
import {
  presentInvoice,
  presentLedgerEntry,
  presentPayout,
  presentRegistrationFee,
} from "@/lib/present/finance";
import { presentAccessLogRow, presentTimelineEvent } from "@/lib/present/audit";
import {
  presentOrgMember,
  presentOrgProperty,
  presentOrgRow,
} from "@/lib/present/orgs";
import type { AdminOrgDetail } from "@injishi/contracts";
import type { SectionRow } from "@/lib/types";
import { STAT_TERM, STAT_TILE, STAT_VALUE } from "@/lib/stat-tile";

import { ORG_LENSES, orgHref, type OrgLens } from "../lenses";
import { OrgActions } from "./org-actions";
import { PayoutStub } from "./payout-stub";

/**
 * Why this record reads the people who work here, in the words that reach the log.
 *
 * `getOrgPeople` takes a reason as a required argument because the route writes
 * a `record_access_logs` row naming this staffer and each member they are about
 * to see. Stated at the call site, never defaulted in a helper: a log where
 * every row carries the same sentence answers nothing when somebody asks why
 * their record was read.
 */
const PEOPLE_READ_REASON =
  "Business record — People lens: confirming who holds a role in this " +
  "workspace before acting on a registration, payout or support case";

/**
 * One business, at its own address (ADR-018, move 3, AC-8).
 *
 * NOW A SERVER COMPONENT THAT READS. It used to search a fixture array by a
 * slug of the legal name; the address is the org's uuid and the record is
 * `GET /api/v1/admin/orgs/:orgId`, so opening a business finally opens the
 * business rather than a row somebody typed.
 *
 * A LENS IS A ROUTE SEGMENT (D-c). A compliance officer sends a colleague the
 * money lens, not "open Businesses, find Umurage, click the third tab". Each
 * lens is a separate read, so a staffer who may see the record but not its
 * money gets the header and a refusal in the body — not a blank page.
 *
 * WHAT GUARDS WHAT, because this page adds nothing of its own. A per-section
 * route guard now stands in front of Businesses like every other section
 * (ADR-049 AC-25, `components/shell/section-boundary.tsx`): a staffer without
 * `admin.business.view` never reaches this file. That guard is per SECTION and
 * not per LENS, so a caller who may see the record but not its money still
 * arrives here and is refused by the API — 403, landing in `denied` below.
 * The API is the boundary for both. This page does not add a third control and
 * must not be read as having one.
 */
export async function OrgRecord({
  orgId,
  lens,
}: {
  orgId: string;
  lens: OrgLens;
}) {
  const result = await getOrg(orgId);

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
        <Link
          href="/businesses"
          className="text-xs font-semibold text-muted-foreground hover:underline"
        >
          ← All businesses
        </Link>
        <div className="mt-4">
          <Unavailable reason={result.reason} permission="admin.business.view" />
        </div>
      </div>
    );
  }

  const detail = result.data;
  const org = presentOrgRow(detail);

  return (
    <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
      <Link
        href="/businesses"
        className="text-xs font-semibold text-muted-foreground hover:underline"
      >
        ← All businesses
      </Link>

      <header className="mt-2 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight">{org.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {org.type} · {org.district} · TIN {org.tin}
            {/* Time in the current stage, from the event log (ADR-053, AC-R7).
                The review queue never lists `pending_payment` or `suspended`, so
                this is the one place those waits are read. No log entry, no wait
                shown, rather than a guessed one. */}
            {detail.stageEnteredAt ? ` · in stage ${elapsed(detail.stageEnteredAt)}` : null}
          </p>
        </div>
        <Badge variant={org.state.intent}>{org.state.text}</Badge>
        {/* The record's own writes, offered only where the business is in a
            position to take them. The API is what refuses an illegal move;
            this only avoids offering one. */}
        <OrgActions
          orgId={detail.id}
          name={detail.legalName}
          status={detail.registrationStatus}
          hasTin={detail.tin !== null}
        />
      </header>

      {/* Every lens, because every lens is a real read now. A lens the caller
          may not open refuses in the body with its own words, which is more
          use than a tab that silently is not there. */}
      <nav
        aria-label="Record sections"
        className="mt-4 flex gap-1 scrollbar overflow-x-auto border-b border-border"
      >
        {ORG_LENSES.map((entry) => {
          const on = entry.key === lens;
          const href =
            entry.key === ORG_LENSES[0].key
              ? orgHref(detail.id)
              : `${orgHref(detail.id)}/${entry.key}`;
          return (
            <Link
              key={entry.key}
              href={href}
              aria-current={on ? "page" : undefined}
              className={
                on
                  ? "whitespace-nowrap border-b-2 border-accent px-3 py-2 text-sm font-bold"
                  : "whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground"
              }
            >
              {entry.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-5">
        <LensBody lens={lens} detail={detail} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ lenses */

async function LensBody({
  lens,
  detail,
}: {
  lens: OrgLens;
  detail: AdminOrgDetail;
}) {
  switch (lens) {
    case "properties":
      return <PropertiesLens orgId={detail.id} />;
    case "people":
      return <PeopleLens orgId={detail.id} />;
    case "money":
      return <MoneyLens orgId={detail.id} />;
    case "subscription":
      return <SubscriptionLens detail={detail} />;
    case "obo-audit":
      return <OboAuditLens orgId={detail.id} isObo={detail.isObo} />;
    case "timeline":
      return <TimelineLens orgId={detail.id} />;
    default:
      return <ProfileLens detail={detail} />;
  }
}

function ProfileLens({ detail }: { detail: AdminOrgDetail }) {
  const org = presentOrgRow(detail);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Fact label="TIN" value={org.tin} />
        <Fact label="District" value={org.district} />
        <Fact label="Domain" value={org.domain} />
        <Fact label="Type" value={org.type} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Fact label="People" value={count(detail.memberCount)} />
        <Fact label="Properties" value={count(detail.propertyCount)} />
        <Fact label="Certificates" value={count(detail.certificateCount)} />
        <Fact label="UPI" value={detail.upi ?? EMPTY} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {org.rdbEntityGroup ? (
          <Fact label="RDB entity group" value={org.rdbEntityGroup} />
        ) : null}
        {org.accommodationClass ? (
          <Fact label="Accommodation class" value={org.accommodationClass} />
        ) : null}
        {org.residenceClass ? (
          <Fact label="Residence class" value={org.residenceClass} />
        ) : null}
        {org.tourismLicenseNumber ? (
          <Fact label="Tourism licence" value={org.tourismLicenseNumber} />
        ) : null}
        {org.eacStarGrade ? (
          <Fact label="EAC star grade" value={String(org.eacStarGrade)} />
        ) : null}
      </div>

      {detail.addressText ? (
        <p className="text-sm text-muted-foreground">{detail.addressText}</p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        TIN state is authoritative only when the RRA adapter is live — currently{" "}
        <Badge variant="warning">
          <Zap className="size-3" aria-hidden />
          mock
        </Badge>
        .
      </p>
    </div>
  );
}

async function PropertiesLens({ orgId }: { orgId: string }) {
  const result = await getOrgProperties(orgId);
  if (!result.ok) return <Unavailable reason={result.reason} permission="admin.business.view" />;
  return (
    <RowTable
      caption="Properties this business operates"
      rows={result.data.items.map(presentOrgProperty)}
      empty="This business operates no property yet. Rooms, units and listings appear here as its inventory is built."
    />
  );
}

async function PeopleLens({ orgId }: { orgId: string }) {
  const result = await getOrgPeople(orgId, PEOPLE_READ_REASON);
  if (!result.ok) return <Unavailable reason={result.reason} permission="admin.business.view" />;
  return (
    <>
      <RowTable
        caption="People who hold a role in this business"
        rows={result.data.items.map(presentOrgMember)}
        empty="Nobody holds a role in this business yet — not even an owner, which happens while a registration is still being filed."
      />
      <p className="mt-3 text-xs text-muted-foreground">
        Opening this lens wrote a record-access log entry naming you, each person
        listed and the reason, visible in{" "}
        <Link href="/audit" className="font-semibold text-accent-text hover:underline">
          Audit
        </Link>
        . Granting and revoking a role happens in{" "}
        <Link href="/users" className="font-semibold text-accent-text hover:underline">
          Users
        </Link>
        , where it is dual authorised (F-A04).
      </p>
    </>
  );
}

async function MoneyLens({ orgId }: { orgId: string }) {
  const result = await getOrgMoney(orgId);
  if (!result.ok) return <Unavailable reason={result.reason} permission="admin.finance.view" />;
  const { registrationFee, invoices, payouts, ledger } = result.data;
  const fee = presentRegistrationFee(registrationFee);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Fact label={fee.label} value={fee.value}>
          <dd className="mt-2">
            <Badge variant={fee.intent}>{fee.note}</Badge>
          </dd>
        </Fact>
      </div>

      <RowTable
        caption="Invoices raised against this business"
        heading="Invoices"
        rows={invoices.map(presentInvoice)}
        empty="No invoice has been raised against this business."
      />

      <section aria-label="Payouts">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Payouts
        </h2>
        {payouts.length === 0 ? (
          <Empty>No payout has been scheduled for this business.</Empty>
        ) : (
          <div className="mt-3 divide-y divide-border rounded-card border border-border bg-field">
            {payouts.map((raw) => {
              const payout = presentPayout(raw);
              return (
                <div key={payout.ref} className="queue-row flex-wrap">
                  <span className="min-w-0 grow">
                    <span className="money block text-sm font-semibold">{payout.title}</span>
                    <span
                      className={`block text-xs ${
                        payout.detailTone === "warning"
                          ? "text-warning"
                          : "text-muted-foreground"
                      }`}
                    >
                      {payout.detail}
                    </span>
                  </span>
                  {payout.action.kind === "status" && (
                    <Badge variant={payout.action.intent} className="shrink-0">
                      {payout.action.text}
                    </Badge>
                  )}
                  {payout.action.kind === "override" && (
                    <PayoutStub
                      variant="outline"
                      contract={`Manual payout override — ${payout.title}, dual authorised and audited`}
                    >
                      Override…
                    </PayoutStub>
                  )}
                  {payout.action.kind === "stub" && (
                    <PayoutStub variant="ghost" contract={payout.action.stub}>
                      {payout.action.label}
                    </PayoutStub>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section aria-label="Ledger">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Ledger
        </h2>
        {ledger.length === 0 ? (
          <Empty>Nothing has posted to the ledger for this business.</Empty>
        ) : (
          <div className="mt-3 scrollbar overflow-x-auto rounded-card border border-border bg-field">
            <table className="w-full min-w-[42rem] text-sm">
              <caption className="sr-only">
                Double-entry postings for this business, newest first
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="p-4">When</th>
                  <th className="p-4">Primitive</th>
                  <th className="p-4">Account</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Adapter</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ledger.map((raw) => {
                  const entry = presentLedgerEntry(raw);
                  return (
                    <tr key={entry.id}>
                      <td className="money p-4 text-xs">{entry.when}</td>
                      <td className="p-4 font-semibold">{entry.primitive}</td>
                      <td className="p-4 text-muted-foreground">{entry.counterparty}</td>
                      <td className="money p-4 font-bold">{entry.amount}</td>
                      <td className="p-4">
                        <Badge variant={entry.state.intent}>{entry.state.text}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

async function SubscriptionLens({ detail }: { detail: AdminOrgDetail }) {
  const result = await getOrgSubscription(detail.id);
  if (!result.ok) return <Unavailable reason={result.reason} permission="admin.finance.view" />;
  const { subscription, invoices } = result.data;
  // The badge comes from the mapping the directory row already uses, off the
  // same `subscriptionStatus` the record carries — so a subscription is never
  // coloured one way in a list and another way on the record it belongs to.
  const badge = presentOrgRow(detail).subscription;

  return (
    <div className="space-y-6">
      {subscription === null ? (
        <Empty>
          This business holds no subscription. That is the ordinary state of an
          org still in the registration pipeline — the registration fee is a
          separate charge, on the Money lens.
        </Empty>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Fact label="Plan" value={subscription.planName ?? EMPTY}>
            <dd className="mt-2">
              <Badge variant={badge.intent}>{badge.text}</Badge>
            </dd>
          </Fact>
          <Fact label="Period start" value={date(subscription.currentPeriodStart)} />
          <Fact label="Period end" value={date(subscription.currentPeriodEnd)} />
          <Fact label="Cancelled" value={date(subscription.canceledAt)} />
        </div>
      )}

      <RowTable
        caption="Invoices for this subscription"
        heading="Invoices"
        rows={invoices.map(presentInvoice)}
        empty="No invoice has been raised for this business."
      />
    </div>
  );
}

async function OboAuditLens({ orgId, isObo }: { orgId: string; isObo: boolean }) {
  const result = await getOboAudit(orgId);
  if (!result.ok) return <Unavailable reason={result.reason} permission="admin.audit.read" />;
  const { events, accessLogs } = result.data;

  if (!isObo && events.length === 0 && accessLogs.length === 0) {
    return (
      <Empty>
        Nobody registered this business on their behalf, so there is no claim to
        track and nobody has read an intended owner&apos;s details.
      </Empty>
    );
  }

  return (
    <div className="space-y-6">
      <RowTable
        caption="What happened to this on-behalf-of registration"
        heading="Events"
        rows={events.map(presentTimelineEvent)}
        empty="Nothing has happened to this registration yet."
      />
      <RowTable
        caption="Who read the intended owner's details, and why"
        heading="Record reads"
        rows={accessLogs.map(presentAccessLogRow)}
        empty="Nobody has read the intended owner's details."
      />
    </div>
  );
}

async function TimelineLens({ orgId }: { orgId: string }) {
  const result = await getOrgTimeline(orgId);
  if (!result.ok) return <Unavailable reason={result.reason} permission="admin.business.view" />;
  return (
    <>
      <RowTable
        caption="Everything that happened to this business"
        rows={result.data.items.map(presentTimelineEvent)}
        empty="Nothing has been recorded against this business yet."
      />
      <p className="mt-3 text-xs text-muted-foreground">
        The platform-wide trail, and the record-access log beside it, are in{" "}
        <Link href="/audit" className="font-semibold text-accent-text hover:underline">
          Audit
        </Link>
        ; this lens is that trail narrowed to one business.
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ pieces */

/**
 * The shared table for the record's sub-lists.
 *
 * `SectionRow` is the shape `lib/present/` already maps a member, a property,
 * an invoice and a timeline event into, so one table draws all four rather than
 * four tables drifting apart.
 */
function RowTable({
  caption,
  heading,
  rows,
  empty,
}: {
  caption: string;
  heading?: string;
  rows: SectionRow[];
  empty: string;
}) {
  return (
    <section aria-label={heading ?? caption}>
      {heading ? (
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          {heading}
        </h2>
      ) : null}
      {rows.length === 0 ? (
        <Empty>{empty}</Empty>
      ) : (
        <div className="mt-3 scrollbar overflow-x-auto rounded-card border border-border bg-field">
          <table className="w-full min-w-[42rem] text-sm">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <th className="p-4">Ref</th>
                <th className="p-4">Subject</th>
                <th className="p-4">Context</th>
                <th className="p-4">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row, i) => (
                // The index rides in the key because `ref` is a timestamp on a
                // timeline row, and two events in the same minute would
                // otherwise collide into one React key.
                <tr key={`${row.ref}-${i}`}>
                  <td className="money p-4 text-xs font-semibold">{row.ref}</td>
                  <td className="p-4">{row.subject}</td>
                  <td className="p-4 text-muted-foreground">{row.context}</td>
                  <td className="p-4">
                    <Badge variant={row.intent}>{row.state}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * One labelled fact about this business: a `Card as="dl"` of its own, so the
 * label is announced as the term and the value as its definition. `children`
 * go after the value and must themselves be a `<dd>` (a badge, say).
 */
function Fact({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <Card as="dl" className={STAT_TILE}>
      <CardTitle className={STAT_TERM}>{label}</CardTitle>
      <CardDescription className={`${STAT_VALUE} text-xl`}>{value}</CardDescription>
      {children}
    </Card>
  );
}

/** Nothing here YET — a fact about this business, never a failure to load. */
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-card border border-dashed border-border px-5 py-4 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

/**
 * This lens could not be read.
 *
 * Kept apart from {@link Empty} on purpose: "this business has no payouts" and
 * "we could not ask about its payouts" are different sentences, and only the
 * first is a statement anybody should act on. `apiFailureMessage` supplies the
 * words, so `unreachable` never accuses the caller of lacking access.
 */
function Unavailable({
  reason,
  permission,
}: {
  reason: ApiFailure;
  /** The permission this lens's route declares, named if it is refused. */
  permission?: StaffPermission;
}) {
  return (
    <div className="animate-arrive rounded-card border border-border bg-field p-5">
      <p className="text-sm font-semibold">{failureHeading(reason, permission)}</p>
      <p className="mt-1.5 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
        {apiFailureMessage(reason)}
      </p>
      <FailureNextStep reason={reason} />
    </div>
  );
}
