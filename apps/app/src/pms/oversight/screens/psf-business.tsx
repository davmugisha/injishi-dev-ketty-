"use client";

/**
 * One business on its own page (2026-10-20): what it is, how to reach it, and
 * every franc it has moved through Injishi, then every application and
 * membership it has had. Opened from the register, for any business, applied
 * or not; an application in its history opens that application's page.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, BadgeCheck, Building2, CalendarDays, Hash, History, Mail, MapPin, Phone, Store, UserRound, Wallet } from "lucide-react";

import {
  ENTERPRISE_REGISTRATION_KIND_LABEL,
  PSF_BRANCH_STATUS_LABEL,
  PSF_OWNER_GROUP_LABEL,
  PSF_STANDING_LABEL,
  type PsfBusinessDetail,
  type PsfBusinessHistory,
} from "@injishi/contracts";
import { formatPrice } from "@injishi/utils";

import { LoadFailed } from "../../components/ui";
import { fetchPsfBusiness } from "../data/psf-console";
import { PSF_CONSOLE, PsfConsoleShell } from "../components/psf-console-shell";
import { initialsOf, psfApplicationHref, shortDate } from "../components/psf-format";
import { Badge } from "../components/ui";
import { Fact, Facts, HistoryList, Section } from "./psf-application";
import { STANDING_INTENT } from "./membership-businesses";
import { cn } from "@/lib/utils";

export function PsfBusinessPage({ orgId }: { orgId: string }) {
  return (
    <PsfConsoleShell title="Business" lede="Payments, applications and memberships">
      <Body orgId={orgId} />
    </PsfConsoleShell>
  );
}

const PAYMENT_LABEL: Record<PsfBusinessHistory["payments"][number]["kind"], string> = {
  registration_fee: "Registration fee",
  membership_fee: "Membership fee",
  membership_renewal: "Membership renewal",
};

function Body({ orgId }: { orgId: string }) {
  const params = useSearchParams();
  const [detail, setDetail] = useState<PsfBusinessDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [failed, setFailed] = useState(false);
  const place = new URLSearchParams([...params.entries()].filter(([k]) => k === "district" || k === "province")).toString();
  const backHref = `${PSF_CONSOLE.businesses}${place ? `?${place}` : ""}`;

  const load = useCallback(async () => {
    setFailed(false);
    const r = await fetchPsfBusiness(orgId);
    if (r.outcome === "ok") setDetail(r.data);
    else if (r.outcome === "failed" && (r.status === 404 || r.status === 403)) setMissing(true);
    else setFailed(true);
  }, [orgId]);
  useEffect(() => {
    void load();
  }, [load]);

  const back = (
    <Link href={backHref} className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-muted-foreground hover:text-foreground">
      <ArrowLeft size={15} aria-hidden /> Back to Businesses
    </Link>
  );

  if (missing) {
    return (
      <div className="flex flex-col items-start gap-4">
        {back}
        <p className="rounded border border-dashed border-line bg-card px-6 py-10 text-sm text-muted-foreground">This business is not in your region.</p>
      </div>
    );
  }
  if (failed) return <LoadFailed onRetry={() => void load()}>We couldn&apos;t load this business.</LoadFailed>;
  if (!detail) {
    return (
      <div className="flex flex-col gap-5">
        <div className="h-40 animate-pulse rounded bg-hover" />
        <div className="h-72 animate-pulse rounded bg-hover" />
      </div>
    );
  }

  const b = detail.business;
  const h = detail.history;
  const newestApplicationId = [...h.applications].sort((x, y) => y.submittedAt.localeCompare(x.submittedAt))[0]?.id ?? null;
  // Nothing is refunded (2026-10-23): what came in is what was paid.
  const paidIn = h.payments.reduce((s, p) => s + p.amountRwf, 0);
  const current = h.memberships.find((m) => m.current) ?? null;
  const registration =
    b.registrationKind && b.registrationKind !== "none"
      ? ENTERPRISE_REGISTRATION_KIND_LABEL[b.registrationKind].split(",")[0]
      : b.hasTin
        ? "TIN"
        : "Not registered";

  return (
    <div className="flex flex-col gap-5">
      {back}

      {/* Who, where, and where it stands */}
      <section className="overflow-hidden rounded border border-line bg-card shadow-sm">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:p-6">
          <span className="pms-display flex size-16 shrink-0 items-center justify-center rounded bg-primary text-2xl font-bold text-primary-foreground shadow-sm">
            {initialsOf(b.legalName)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge intent={STANDING_INTENT[b.standing]}>{PSF_STANDING_LABEL[b.standing]}</Badge>
              {b.domain === "hospitality" ? <Badge intent="info">Hotel</Badge> : null}
              {b.branchCount > 0 ? <Badge intent="neutral">{b.branchCount === 1 ? "1 branch" : `${b.branchCount} branches`}</Badge> : null}
              {!b.headOfficeInScope ? <Badge intent="accent">Branch in your area</Badge> : null}
            </div>
            <h2 className="pms-display mt-2 text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl">{b.legalName}</h2>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              {b.businessCode ? (
                <span className="pms-num inline-flex items-center gap-1 font-mono font-semibold text-foreground">
                  <Hash size={13} aria-hidden /> {b.businessCode}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} aria-hidden /> {[b.sectorName, b.districtName].filter(Boolean).join(", ") || "Not recorded"}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays size={13} aria-hidden /> On Injishi since {shortDate(b.registeredAt)}
              </span>
            </p>
          </div>
          <div className="shrink-0 rounded border border-line bg-hover/50 px-4 py-3 sm:text-right">
            <p className="text-2xs font-bold uppercase tracking-wide text-muted-foreground">Paid to date</p>
            <p className="pms-num mt-0.5 text-2xl font-bold text-ink">{formatPrice(paidIn)}</p>
            {b.lastPaidAt ? <p className="text-xs text-muted-foreground">last {shortDate(b.lastPaidAt)}</p> : null}
          </div>
        </div>
        <dl className="grid grid-cols-2 border-t border-line sm:grid-cols-3">
          <Stat label="Paid in" value={formatPrice(paidIn)} />
          <Stat label="Applications" value={String(h.applications.length)} />
          <Stat
            label="Membership"
            value={current ? (current.tierName ?? "Member") : b.tierName ?? "None"}
            sub={current?.expiresOn ? `until ${shortDate(current.expiresOn)}` : undefined}
          />
        </dl>
      </section>

      {/* Where it trades (2026-10-23): the head office and every branch, in any district. */}
      {detail.branches.length > 0 ? (
        <Section icon={Store} title="Where it trades" aside={`Head office and ${detail.branches.length === 1 ? "1 branch" : `${detail.branches.length} branches`}`}>
          <ul className="-mx-5 -my-5 divide-y divide-line">
            <li className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
              <span className="min-w-0">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <MapPin size={14} aria-hidden className="text-muted-foreground" />
                  {[b.sectorName, b.districtName].filter(Boolean).join(", ") || "Not recorded"}
                </span>
                <span className="block pl-5 text-xs text-muted-foreground">The business, decided by its own district</span>
              </span>
              <span className="flex flex-wrap gap-1.5">
                <Badge intent="info">Head office</Badge>
                {b.headOfficeInScope ? <Badge intent="accent">Your area</Badge> : null}
              </span>
            </li>
            {detail.branches.map((br) => (
              <li key={br.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
                <span className="min-w-0">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
                    <MapPin size={14} aria-hidden className="text-muted-foreground" />
                    {[br.sectorName, br.districtName].filter(Boolean).join(", ") || "Not recorded"}
                  </span>
                  <span className="block pl-5 text-xs text-muted-foreground">
                    {[br.street, br.provinceName].filter(Boolean).join(" · ")}
                  </span>
                  {br.status === "declined" && br.note ? <span className="block pl-5 text-xs text-muted-foreground">&ldquo;{br.note}&rdquo;</span> : null}
                </span>
                <span className="flex flex-wrap gap-1.5">
                  <Badge intent={br.status === "admitted" ? "ok" : br.status === "declined" ? "bad" : "neutral"}>{PSF_BRANCH_STATUS_LABEL[br.status]}</Badge>
                  {br.inScope ? <Badge intent="accent">Your area</Badge> : null}
                </span>
              </li>
            ))}
          </ul>
          {newestApplicationId && detail.branches.some((br) => br.inScope && br.status === "pending") ? (
            <Link
              href={psfApplicationHref(newestApplicationId, "businesses", params)}
              className="mt-8 inline-flex text-sm font-semibold text-accent-text hover:underline"
            >
              Open the application to see its branches
            </Link>
          ) : null}
        </Section>
      ) : null}

      {/* Every payment */}
      <Section icon={Wallet} title="Payment history" aside={`${h.payments.length} recorded`}>
        {h.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">This business has not paid anything through Injishi yet.</p>
        ) : (
          <div className="-mx-5 -my-5 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line bg-hover/60 text-left text-2xs font-bold uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Payment</th>
                  <th className="px-3 py-2.5">Application</th>
                  <th className="px-3 py-2.5">Reference</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-5 py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...h.payments].reverse().map((p, i) => (
                  <tr key={`${p.kind}-${p.at ?? i}`}>
                    <td className="whitespace-nowrap px-5 py-3 text-xs">{p.at ? shortDate(p.at) : "Not sent yet"}</td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-2 font-medium text-ink">
                        <span className="flex size-6 items-center justify-center rounded-full bg-ok-bg text-ok">
                          <Wallet size={12} aria-hidden />
                        </span>
                        {PAYMENT_LABEL[p.kind]}
                      </span>
                    </td>
                    <td className="pms-num px-3 py-3 font-mono text-xs">{p.applicationDocId ?? "—"}</td>
                    <td className="pms-num max-w-tile truncate px-3 py-3 font-mono text-2xs text-muted-foreground" title={p.reference ?? undefined}>
                      {p.reference ? (p.reference.length > 18 ? `…${p.reference.slice(-12)}` : p.reference) : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <Badge intent="ok">Paid</Badge>
                    </td>
                    <td className="pms-num whitespace-nowrap px-5 py-3 text-right font-semibold text-ink">{formatPrice(p.amountRwf)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line bg-hover/40">
                  <td colSpan={5} className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Paid to date
                  </td>
                  <td className="pms-num px-5 py-3 text-right text-base font-bold text-ink">{formatPrice(paidIn)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <Section icon={Building2} title="The business">
            <Facts>
              <Fact label="Sector" value={b.clusterName ?? "Not given"} />
              <Fact label="Kind of business" value={b.subsectorName ?? "Not given"} />
              <Fact label="Association" value={b.associationName ?? "Not given"} wide />
              <Fact label="Registration" value={registration} />
              <Fact label="Membership number" value={b.membershipNumber ?? "—"} mono />
              <Fact
                label="Owned by"
                wide
                value={b.ownerGroups.length ? b.ownerGroups.map((g) => PSF_OWNER_GROUP_LABEL[g]).join(", ") : "Not marked"}
              />
            </Facts>
          </Section>
          <Section icon={UserRound} title="Contact">
            {detail.contact ? (
              <Facts>
                <Fact label="Name" value={detail.contact.name} />
                <Fact label="Role" value={detail.contact.role} />
                <Fact
                  label="Phone"
                  value={
                    <a href={`tel:${detail.contact.phoneE164}`} className="pms-num inline-flex items-center gap-1.5 text-accent-text hover:underline">
                      <Phone size={13} aria-hidden /> {detail.contact.phoneE164}
                    </a>
                  }
                />
                <Fact
                  label="Email"
                  value={
                    detail.contact.email ? (
                      <a href={`mailto:${detail.contact.email}`} className="inline-flex items-center gap-1.5 break-all text-accent-text hover:underline">
                        <Mail size={13} aria-hidden /> {detail.contact.email}
                      </a>
                    ) : (
                      "Not given"
                    )
                  }
                />
              </Facts>
            ) : (
              <p className="text-sm text-muted-foreground">No application yet, so no contact on file.</p>
            )}
          </Section>
        </div>
        <Section icon={History} title="Applications and memberships">
          {h.applications.length === 0 && h.memberships.length === 0 ? (
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <BadgeCheck size={15} aria-hidden /> It has not applied to PSF yet.
            </p>
          ) : (
            <HistoryList history={h} currentId={null} hrefFor={(id) => psfApplicationHref(id, "businesses", params)} />
          )}
        </Section>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" }) {
  return (
    <div className="min-w-0 border-line px-5 py-3.5 even:border-l sm:border-l sm:first:border-l-0">
      <dt className="text-2xs font-bold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="pms-num mt-0.5 text-sm font-semibold leading-snug text-ink">{value}</dd>
      {sub ? <dd className={cn("text-xs", tone === "warn" ? "text-warn" : "text-muted-foreground")}>{sub}</dd> : null}
    </div>
  );
}
