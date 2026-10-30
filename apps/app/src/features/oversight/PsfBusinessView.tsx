"use client";

import { Timeline } from "@heroui-pro/react";
import {
  ORG_CERTIFICATE_KIND_LABEL,
  type OrgCertificateKind,
  type OversightDocument,
  type PsfBusinessDetail,
  type PsfRegistrationProfile,
} from "@injishi/contracts";
import {
  ActionLink,
  EmptyBlock,
  formatDay,
  formatMoney,
  formatNumber,
  Icon,
  PageContent,
  PageHeader,
  SectionCard,
  StatusChip,
} from "@injishi/ui";
import NextLink from "next/link";
import type { PsfScope } from "@/server/sources/psf";
import { FactGrid } from "./shared";

type Tone = "success" | "warning" | "danger" | "default";

/** Where the business stands on Injishi, in words and a tone. */
const STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Approved and open", tone: "success" },
  approved: { label: "Approved, the owner has to claim it", tone: "warning" },
  rejected: { label: "Rejected, the owner can resubmit", tone: "danger" },
  suspended: { label: "Suspended", tone: "danger" },
  pending_payment: { label: "Fee not paid yet", tone: "default" },
  submitted: { label: "Waiting for review", tone: "warning" },
  tin_verified: { label: "Waiting for review", tone: "warning" },
  field_verified: { label: "Waiting for approval", tone: "warning" },
};

/** A business's standing with PSF, as the register files it. */
const STANDING: Record<string, { label: string; tone: Tone }> = {
  member: { label: "Member", tone: "success" },
  applied: { label: "Applied, waiting on PSF", tone: "warning" },
  awaiting_payment: { label: "Approved, fee not paid", tone: "warning" },
  claimed: { label: "Says it is a member, waiting for PSF", tone: "warning" },
  lapsed: { label: "Lapsed", tone: "danger" },
  declined: { label: "Declined", tone: "danger" },
  not_applied: { label: "Not applied", tone: "default" },
};

function documentName(d: OversightDocument): string {
  if (d.kind === "other") return d.kindOther ?? "Other document";
  return ORG_CERTIFICATE_KIND_LABEL[d.kind as OrgCertificateKind] ?? d.kind;
}

/**
 * One business, for the PSF District Manager covering it (2026-10-30): what it is and who owns it, how its
 * registration was decided, the documents it registered with, whether guests can find and book it, and
 * how it stands with PSF. Opened from Businesses, from Business approvals and from the reports.
 */
export function PsfBusinessView({
  scope,
  profile: p,
  membership,
  documents,
  webUrl,
}: {
  scope: PsfScope;
  profile: PsfRegistrationProfile;
  membership: PsfBusinessDetail | null;
  documents: OversightDocument[];
  webUrl: string;
}) {
  const status = STATUS[p.status] ?? { label: p.status, tone: "default" as Tone };
  const live = p.listings.find((l) => l.status === "published" && l.slug);
  const place = [p.sectorName, p.districtName].filter(Boolean).join(", ");
  const rooms = p.listings.reduce((n, l) => n + l.rooms, 0);
  const m = membership?.business ?? null;

  return (
    <PageContent>
      <PageHeader
        eyebrow={
          <>
            <NextLink href="/psf/register" className="text-inherit no-underline hover:underline">
              Businesses
            </NextLink>
            <span aria-hidden="true"> › </span>
            <span>{p.businessCode ?? "Business"}</span>
          </>
        }
        title={p.legalName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {p.kindLabel}
              {place ? ` · ${place}` : ""}
            </span>
            <StatusChip tone={status.tone}>{status.label}</StatusChip>
            {m ? (
              <StatusChip tone={STANDING[m.standing]?.tone ?? "default"}>
                PSF: {STANDING[m.standing]?.label ?? m.standing}
              </StatusChip>
            ) : null}
          </span>
        }
        actions={
          live ? (
            <ActionLink
              href={`${webUrl}/property/${live.slug}`}
              icon="ArrowUpRightFromSquare"
              intent="primary"
              target="_blank"
            >
              See it on Injishi
            </ActionLink>
          ) : null
        }
      />

      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <SectionCard title="The decision" description="How its registration on Injishi was decided">
            {p.reviews.length === 0 ? (
              <EmptyBlock
                size="sm"
                icon="ShieldCheck"
                title={p.status === "pending_payment" ? "Its fee is not paid yet" : "Nobody has decided it yet"}
                description={
                  p.status === "tin_verified" || p.status === "submitted"
                    ? "It is waiting for your review in Business approvals."
                    : undefined
                }
                action={
                  p.status === "tin_verified" ? (
                    <ActionLink href={`/officer/cases/${p.orgId}`} size="sm" icon="ArrowRight">
                      Review it
                    </ActionLink>
                  ) : undefined
                }
              />
            ) : (
              <Timeline size="sm" density="compact">
                <Timeline.Item status="success">
                  <Timeline.Rail>
                    <Timeline.Marker>
                      <Icon name="FileText" className="size-3" />
                    </Timeline.Marker>
                    <Timeline.Connector />
                  </Timeline.Rail>
                  <Timeline.Content className="flex flex-col pb-1">
                    <span className="font-medium">Registered and paid</span>
                    <span className="text-xs text-muted">{formatDay(p.registeredAt)}</span>
                  </Timeline.Content>
                </Timeline.Item>
                {p.reviews.map((r) => (
                  <Timeline.Item key={`${r.stage}-${r.at}`} status={r.decision === "passed" ? "success" : "danger"}>
                    <Timeline.Rail>
                      <Timeline.Marker>
                        <Icon name={r.decision === "passed" ? "Check" : "Xmark"} className="size-3" />
                      </Timeline.Marker>
                      <Timeline.Connector />
                    </Timeline.Rail>
                    <Timeline.Content className="flex flex-col pb-1">
                      <span className="font-medium">
                        {r.decision === "passed"
                          ? r.roleLabel === "PSF District Manager"
                            ? "Reviewed and approved"
                            : r.stage === "tin_verified"
                              ? "Documents checked"
                              : "Approved"
                          : "Rejected"}
                      </span>
                      <span className="text-xs text-muted">
                        {[r.byName ?? "An officer", r.roleLabel, formatDay(r.at)].join(" · ")}
                      </span>
                      {r.reasonLabel ? <span className="text-xs">{r.reasonLabel}</span> : null}
                      {r.notes ? <span className="text-xs text-muted">“{r.notes}”</span> : null}
                    </Timeline.Content>
                  </Timeline.Item>
                ))}
              </Timeline>
            )}
          </SectionCard>

          <SectionCard title="About the business">
            <FactGrid
              min={180}
              className="gap-x-5 gap-y-3"
              items={[
                { label: "Legal name", value: p.legalName },
                { label: "Business code", value: p.businessCode ?? "Not given yet" },
                { label: "TIN", value: p.tin ?? "Not given" },
                { label: "Kind", value: p.kindLabel },
                {
                  label: "Star grade",
                  value: p.starGrade ? `${p.starGrade} stars` : "None claimed",
                  note: p.starGrade
                    ? p.starGradeConfirmed
                      ? "Confirmed by Injishi"
                      : "Claimed, not confirmed"
                    : undefined,
                },
                { label: "Address", value: p.addressText ?? (place || "Not given") },
                { label: "Owner", value: p.owner?.name ?? "Not named", note: p.owner?.email },
                { label: "Owner's phone", value: p.owner?.phone ?? "Not given" },
              ]}
            />
          </SectionCard>

          <SectionCard title="Documents" description="What it registered with. Each link works for a few minutes.">
            {documents.length === 0 ? (
              <EmptyBlock size="sm" icon="FileText" title="No document on this registration" />
            ) : (
              <ul className="flex flex-col">
                {documents.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center gap-3 border-t border-separator py-2.5 first:border-t-0"
                  >
                    <Icon name="FileText" className="size-4 shrink-0 text-muted" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium">{documentName(d)}</span>
                      <span className="text-xs text-muted">
                        {[
                          d.certificateNumber ? `No. ${d.certificateNumber}` : null,
                          d.checkedAt
                            ? `Read by ${d.checkedByName ?? "an officer"} on ${formatDay(d.checkedAt)}`
                            : "Not read yet",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    {d.expired ? <StatusChip tone="danger">Expired</StatusChip> : null}
                    {d.url ? (
                      <ActionLink href={d.url} size="sm" icon="ArrowUpRightFromSquare" target="_blank" prefetch={false}>
                        Open
                      </ActionLink>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <SectionCard title="On Injishi" description="Whether guests can find and book it">
            {p.listings.length === 0 ? (
              <EmptyBlock size="sm" icon="House" title="No property set up yet" />
            ) : (
              <ul className="flex flex-col gap-3">
                {p.listings.map((l) => {
                  const on = l.status === "published";
                  return (
                    <li key={l.propertyName} className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate font-medium">{l.propertyName}</span>
                        <StatusChip tone={on ? "success" : "default"}>{on ? "Live" : "Not published"}</StatusChip>
                      </div>
                      <span className="text-xs text-muted">
                        {on && l.publishedAt
                          ? `Live since ${formatDay(l.publishedAt)}`
                          : "The owner is still setting it up. Guests cannot see it yet."}
                      </span>
                      <span className="text-xs text-muted">
                        {formatNumber(l.rooms)} rooms in {formatNumber(l.roomTypes)} room types
                      </span>
                      {on && l.slug ? (
                        <ActionLink
                          href={`${webUrl}/property/${l.slug}`}
                          size="sm"
                          icon="ArrowUpRightFromSquare"
                          target="_blank"
                          className="self-start"
                        >
                          See its page
                        </ActionLink>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="grid grid-cols-2 gap-3 border-t border-separator pt-3">
              <div className="flex flex-col">
                <span className="text-xs text-muted">Rooms</span>
                <span className="text-lg font-semibold tabular">{formatNumber(rooms)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted">Bookings, last 90 days</span>
                <span className="text-lg font-semibold tabular">{formatNumber(p.bookings90Days)}</span>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="With PSF" description="Its membership of the Private Sector Federation">
            {m ? (
              <div className="flex flex-col gap-3">
                <FactGrid
                  min={150}
                  className="gap-x-4 gap-y-3"
                  items={[
                    { label: "Standing", value: STANDING[m.standing]?.label ?? m.standing },
                    { label: "Tier", value: m.tierName ?? "None yet" },
                    { label: "Membership number", value: m.membershipNumber ?? "None yet" },
                    { label: "Paid to PSF", value: formatMoney(m.paidRwf) },
                  ]}
                />
                {membership?.history.applications.length ? (
                  <ul className="flex flex-col gap-1.5 border-t border-separator pt-3">
                    {membership.history.applications.map((a) => (
                      <li key={a.id} className="flex items-center gap-2 text-sm">
                        <span className="min-w-0 flex-1 truncate">
                          {a.tierName} · applied {formatDay(a.submittedAt)}
                        </span>
                        <span className="text-xs text-muted">{a.status}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {m.openApplicationId ? (
                  <ActionLink
                    href={`/psf/${m.openApplicationId}`}
                    size="sm"
                    icon="ArrowRight"
                    intent="primary"
                    className="self-start"
                  >
                    Decide its application
                  </ActionLink>
                ) : null}
              </div>
            ) : (
              <EmptyBlock
                size="sm"
                icon="Persons"
                title="Not on PSF's register"
                description="It has not applied to PSF, or its registration on Injishi was not approved."
              />
            )}
          </SectionCard>

          <p className="text-xs text-muted">
            {scope.title} · {scope.label}. Opening this page is logged, like every record you open.
          </p>
        </div>
      </div>
    </PageContent>
  );
}
