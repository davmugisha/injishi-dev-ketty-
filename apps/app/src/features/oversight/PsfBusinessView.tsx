"use client";

import { Timeline } from "@heroui-pro/react";
import {
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
import { useTranslations } from "next-intl";
import { API_BASE } from "@/pms/data/api";
import { WEB_URL } from "@/lib/return-to";
import type { PsfScope } from "@/server/sources/psf";
import { FactGrid } from "./shared";

type Tone = "success" | "warning" | "danger" | "default";

/** Where the business stands on Injishi, in words and a tone. */
const STATUS: Record<string, { tone: Tone }> = {
  active: { tone: "success" }, approved: { tone: "warning" }, rejected: { tone: "danger" },
  suspended: { tone: "danger" }, pending_payment: { tone: "default" }, submitted: { tone: "warning" },
  tin_verified: { tone: "warning" }, field_verified: { tone: "warning" },
};

/** A business's standing with PSF, as the register files it. */
const STANDING: Record<string, { tone: Tone }> = {
  member: { tone: "success" }, applied: { tone: "warning" }, awaiting_payment: { tone: "warning" },
  claimed: { tone: "warning" }, lapsed: { tone: "danger" }, declined: { tone: "danger" }, not_applied: { tone: "default" },
};

function documentName(d: OversightDocument, t: ReturnType<typeof useTranslations<"psfBusiness">>): string {
  if (d.kind === "other") return d.kindOther ?? t("documents.other");
  return t(`documents.${d.kind as OrgCertificateKind}`);
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
  const t = useTranslations("psfBusiness");
  const status = STATUS[p.status] ?? { tone: "default" as Tone };
  const live = p.listings.find((l) => l.status === "published" && l.slug);
  const place = [p.sectorName, p.districtName].filter(Boolean).join(", ");
  const rooms = p.listings.reduce((n, l) => n + l.rooms, 0);
  const m = membership?.business ?? null;
  // The application the membership stands on, else the newest: its docID is the business's key to tracking.
  const docId =
    membership?.history.applications.find((a) => a.status === "member")?.docId ?? membership?.history.applications[0]?.docId ?? null;

  return (
    <PageContent>
      <PageHeader
        eyebrow={
          <>
            <NextLink href="/psf/register" className="text-inherit no-underline hover:underline">
              {t("businesses")}
            </NextLink>
            <span aria-hidden="true"> › </span>
            <span>{p.businessCode ?? t("business")}</span>
          </>
        }
        title={p.legalName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {p.kindLabel}
              {place ? ` · ${place}` : ""}
            </span>
            <StatusChip tone={status.tone}>{t(`status.${p.status}`)}</StatusChip>
            {m ? (
              <StatusChip tone={STANDING[m.standing]?.tone ?? "default"}>
                PSF: {t(`standing.${m.standing}`)}
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
              {t("seeOnInjishi")}
            </ActionLink>
          ) : null
        }
      />

      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <SectionCard title={t("decision")} description={t("decisionDescription")}>
            {p.reviews.length === 0 ? (
              <EmptyBlock
                size="sm"
                icon="ShieldCheck"
                title={p.status === "pending_payment" ? t("feeNotPaid") : t("noDecision")}
                description={
                  p.status === "tin_verified" || p.status === "submitted"
                    ? t("waitingForReview")
                    : undefined
                }
                action={
                  p.status === "tin_verified" ? (
                    <ActionLink href={`/officer/cases/${p.orgId}`} size="sm" icon="ArrowRight">
                      {t("reviewIt")}
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
                    <span className="font-medium">{t("registeredAndPaid")}</span>
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
                            ? t("reviewedApproved")
                            : r.stage === "tin_verified"
                              ? t("documentsChecked")
                              : t("approved")
                          : t("rejected")}
                      </span>
                      <span className="text-xs text-muted">
                        {[r.byName ?? t("anOfficer"), r.roleLabel, formatDay(r.at)].join(" · ")}
                      </span>
                      {r.reasonLabel ? <span className="text-xs">{r.reasonLabel}</span> : null}
                      {r.notes ? <span className="text-xs text-muted">“{r.notes}”</span> : null}
                    </Timeline.Content>
                  </Timeline.Item>
                ))}
              </Timeline>
            )}
          </SectionCard>

          <SectionCard title={t("aboutBusiness")}>
            <FactGrid
              min={180}
              className="gap-x-5 gap-y-3"
              items={[
                { label: t("legalName"), value: p.legalName },
                { label: t("businessCode"), value: p.businessCode ?? t("notGivenYet") },
                { label: "TIN", value: p.tin ?? t("notGiven") },
                { label: t("kind"), value: p.kindLabel },
                {
                  label: t("starGrade"),
                  value: p.starGrade ? t("stars", { count: p.starGrade }) : t("noneClaimed"),
                  note: p.starGrade
                    ? p.starGradeConfirmed
                      ? t("confirmedByInjishi")
                      : t("claimedNotConfirmed")
                    : undefined,
                },
                { label: t("address"), value: p.addressText ?? (place || t("notGiven")) },
                { label: t("owner"), value: p.owner?.name ?? t("notNamed"), note: p.owner?.email },
                { label: t("ownerPhone"), value: p.owner?.phone ?? t("notGiven") },
              ]}
            />
          </SectionCard>

          <SectionCard title={t("documentsTitle")} description={t("documentsDescription")}>
            {documents.length === 0 ? (
              <EmptyBlock size="sm" icon="FileText" title={t("noDocument")} />
            ) : (
              <ul className="flex flex-col">
                {documents.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center gap-3 border-t border-separator py-2.5 first:border-t-0"
                  >
                    <Icon name="FileText" className="size-4 shrink-0 text-muted" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium">{documentName(d, t)}</span>
                      <span className="text-xs text-muted">
                        {[
                          d.certificateNumber ? t("certificateNumber", { number: d.certificateNumber }) : null,
                          d.checkedAt
                            ? t("readBy", { name: d.checkedByName ?? t("anOfficer"), date: formatDay(d.checkedAt) })
                            : t("notReadYet"),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    {d.expired ? <StatusChip tone="danger">{t("expired")}</StatusChip> : null}
                    {d.url ? (
                      <ActionLink href={d.url} size="sm" icon="ArrowUpRightFromSquare" target="_blank" prefetch={false}>
                        {t("open")}
                      </ActionLink>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <SectionCard title={t("onInjishi")} description={t("onInjishiDescription")}>
            {p.listings.length === 0 ? (
              <EmptyBlock size="sm" icon="House" title={t("noProperty")} />
            ) : (
              <ul className="flex flex-col gap-3">
                {p.listings.map((l) => {
                  const on = l.status === "published";
                  return (
                    <li key={l.propertyName} className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate font-medium">{l.propertyName}</span>
                        <StatusChip tone={on ? "success" : "default"}>{on ? t("live") : t("notPublished")}</StatusChip>
                      </div>
                      <span className="text-xs text-muted">
                        {on && l.publishedAt
                          ? t("liveSince", { date: formatDay(l.publishedAt) })
                          : t("ownerStillSettingUp")}
                      </span>
                      <span className="text-xs text-muted">
                        {t("roomSummary", { rooms: formatNumber(l.rooms), types: formatNumber(l.roomTypes) })}
                      </span>
                      {on && l.slug ? (
                        <ActionLink
                          href={`${webUrl}/property/${l.slug}`}
                          size="sm"
                          icon="ArrowUpRightFromSquare"
                          target="_blank"
                          className="self-start"
                        >
                          {t("seeItsPage")}
                        </ActionLink>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="grid grid-cols-2 gap-3 border-t border-separator pt-3">
              <div className="flex flex-col">
                <span className="text-xs text-muted">{t("rooms")}</span>
                <span className="text-lg font-semibold tabular">{formatNumber(rooms)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted">{t("bookings90Days")}</span>
                <span className="text-lg font-semibold tabular">{formatNumber(p.bookings90Days)}</span>
              </div>
            </div>
          </SectionCard>

          <SectionCard title={t("withPsf")} description={t("withPsfDescription")}>
            {m ? (
              <div className="flex flex-col gap-3">
                <FactGrid
                  min={150}
                  className="gap-x-4 gap-y-3"
                  items={[
                    { label: t("standingLabel"), value: t(`standing.${m.standing}`) },
                    { label: t("tier"), value: m.tierName ?? t("noneYet") },
                    { label: t("membershipNumber"), value: m.membershipNumber ?? t("noneYet") },
                    {
                      // The docID opens the business's tracking page: renewal and the certificate live there (2026-11-02).
                      label: "docID",
                      value: docId ? (
                        <a href={`${WEB_URL}/psf/track/${docId}`} target="_blank" rel="noreferrer" className="font-mono font-semibold text-accent hover:underline">
                          {docId}
                        </a>
                      ) : (
                        t("noneYet")
                      ),
                    },
                    {
                      label: t("validUntil"),
                      value: m.standing === "member" && m.expiresOn ? formatDay(m.expiresOn) : m.standing === "lapsed" ? t("standing.lapsed") : "—",
                    },
                    { label: t("paidToPsf"), value: formatMoney(m.paidRwf) },
                  ]}
                />
                {/* The certificate (2026-11-02), whichever way it became a member: a card PSF confirmed included. */}
                {m.standing === "member" ? (
                  <a
                    href={`${API_BASE}/api/v1/oversight/psf/businesses/${p.orgId}/certificate`}
                    className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                  >
                    {t("downloadCertificate")}
                  </a>
                ) : null}
                {m.standing === "member" ? (
                  <a
                    href={`${API_BASE}/api/v1/oversight/psf/businesses/${p.orgId}/card`}
                    className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                  >
                    Download the membership card
                  </a>
                ) : null}
                {/* Renewals (2026-11-02): paid on the tracking page, renewed at once, no decision here. */}
                {membership?.renewals.length ? (
                  <div className="flex flex-col gap-1.5 border-t border-separator pt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">{t("renewals")}</p>
                    <ul className="flex flex-col gap-1.5">
                      {membership.renewals.map((r) => (
                        <li key={`${r.paidAt}-${r.startsOn}`} className="flex flex-col gap-0.5 text-sm">
                          <span>
                            {t("dateRange", { from: formatDay(r.startsOn), to: formatDay(r.expiresOn) })}
                          </span>
                          <span className="tabular text-xs text-muted">
                            {t("renewalDetail", { tier: r.tierName, amount: formatMoney(r.amountRwf), date: formatDay(r.paidAt) })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {membership?.history.applications.length ? (
                  <ul className="flex flex-col gap-1.5 border-t border-separator pt-3">
                    {membership.history.applications.map((a) => (
                      <li key={a.id} className="flex items-center gap-2 text-sm">
                        <span className="min-w-0 flex-1 truncate">
                          {t("applicationHistory", { tier: a.tierName, date: formatDay(a.submittedAt) })}
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
                    {t("decideApplication")}
                  </ActionLink>
                ) : null}
              </div>
            ) : (
              <EmptyBlock
                size="sm"
                icon="Persons"
                title={t("notOnRegister")}
                description={t("notOnRegisterDescription")}
              />
            )}
          </SectionCard>

          <p className="text-xs text-muted">
            {t("scopeAudit", { title: scope.title, label: scope.label })}
          </p>
        </div>
      </div>
    </PageContent>
  );
}
