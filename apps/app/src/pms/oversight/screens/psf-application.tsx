"use client";

/**
 * One PSF application, on its own page (2026-10-20). It replaced a side panel
 * with a dialog on top: an officer reads every detail here, top to bottom,
 * and decides in the column beside it, with no window over another.
 *
 * The left column is the business as PSF knows it, the person who applied,
 * every payment it has made, and every application and membership it has
 * had. The right column is the decision: Approve (PSF's membership number;
 * a paid application becomes a member that day) or Decline (a reason the
 * business reads; a paid one is owed its membership fee back). Both are
 * final, so each waits for the server, then the page shows the outcome.
 *
 * An application whose business the officer holds a role in is shown and says
 * so, and cannot be decided here (AC-14): another officer must.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Globe,
  Hash,
  History,
  Mail,
  MapPin,
  Phone,
  Store,
  UserRound,
  Wallet,
  XCircle,
} from "lucide-react";

import {
  PSF_BRANCH_STATUS_LABEL,
  PSF_COMPANY_TYPE_LABEL,
  PSF_CONTACT_ROLE_LABEL,
  PSF_DECLINE_REASON_LABEL,
  PSF_FAMILY_LABEL,
  PSF_OVERDUE_DAYS,
  PSF_OWNER_GROUP_LABEL,
  PSF_OWN_BUSINESS_MESSAGE,
  PSF_OWNERSHIP_LABEL,
  PSF_TRADE_DIRECTION_LABEL,
  PsfDeclineReason,
  defaultPsfMembershipDates,
  kigaliDay,
  type PsfApplicationBranch,
  type PsfBusinessHistory,
  type PsfOfficerApplication,
} from "@injishi/contracts";
import { formatPrice } from "@injishi/utils";

import { humanError } from "../../data/api";
import { approvePsfApplication, declinePsfApplication, decidePsfBranch, fetchPsfApplication, refusalField } from "../../data/psf";
import { LoadFailed } from "../../components/ui";
import type { QueuedToast } from "../../lib/toast-queue";
import { emailPsfCertificate, fetchPsfBusinessHistory, psfCertificateHref } from "../data/psf-console";
import { PSF_CONSOLE, PsfConsoleShell, usePsfConsole } from "../components/psf-console-shell";
import { amountOf, countryName, initialsOf, registrationOf, shortDate } from "../components/psf-format";
import { Badge } from "../components/ui";
import { cn } from "@/lib/utils";

const BACK: Record<string, { href: string; label: string }> = {
  queue: { href: PSF_CONSOLE.queue, label: "Queue" },
  decisions: { href: PSF_CONSOLE.decisions, label: "Decisions" },
  businesses: { href: PSF_CONSOLE.businesses, label: "Businesses" },
};

export function PsfApplicationPage({ applicationId }: { applicationId: string }) {
  const [toasts, setToasts] = useState<QueuedToast[]>([]);
  const toast = useCallback((txt: string, intent: QueuedToast["intent"] = "ok") => {
    setToasts((t) => [...t, { id: Date.now() + Math.random(), txt, intent }]);
  }, []);
  return (
    <PsfConsoleShell title="Application" lede="Read it through, then decide" toasts={toasts}>
      <Body applicationId={applicationId} toast={toast} />
    </PsfConsoleShell>
  );
}

function Body({ applicationId, toast }: { applicationId: string; toast: (txt: string, intent?: QueuedToast["intent"]) => void }) {
  const params = useSearchParams();
  const { refreshCount } = usePsfConsole();
  const [app, setApp] = useState<PsfOfficerApplication | null>(null);
  const [history, setHistory] = useState<PsfBusinessHistory | null>(null);
  const [missing, setMissing] = useState(false);
  const [failed, setFailed] = useState(false);

  const back = BACK[params.get("from") ?? "queue"] ?? BACK.queue!;
  const place = new URLSearchParams([...params.entries()].filter(([k]) => k === "district" || k === "province")).toString();
  const backHref = `${back.href}${place ? `?${place}` : ""}`;

  const load = useCallback(async () => {
    setFailed(false);
    const [a, h] = await Promise.all([fetchPsfApplication(applicationId), fetchPsfBusinessHistory(applicationId)]);
    if (a.outcome === "ok") setApp(a.data);
    else if (a.outcome === "failed" && (a.status === 404 || a.status === 403)) setMissing(true);
    else setFailed(true);
    if (h.outcome === "ok") setHistory(h.data);
  }, [applicationId]);
  useEffect(() => {
    void load();
  }, [load]);

  if (missing) {
    return (
      <div className="flex flex-col items-start gap-4">
        <BackLink href={backHref} label={back.label} />
        <p className="rounded border border-dashed border-line bg-card px-6 py-10 text-sm text-muted-foreground">
          This application is not in your region, or no longer exists.
        </p>
      </div>
    );
  }
  if (failed) return <LoadFailed onRetry={() => void load()}>We couldn&apos;t load this application.</LoadFailed>;
  if (!app) {
    return (
      <div className="flex flex-col gap-5">
        <div className="h-44 animate-pulse rounded bg-hover" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="h-96 animate-pulse rounded bg-hover" />
          <div className="h-72 animate-pulse rounded bg-hover" />
        </div>
      </div>
    );
  }

  const paid = app.payment?.amountRwf ?? null;
  const open = app.status === "submitted";

  return (
    <div className="flex flex-col gap-5">
      <BackLink href={backHref} label={back.label} />

      <Hero app={app} history={history} paid={paid} />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* The decision comes first on a phone, beside the detail on a screen. */}
        <div className="lg:sticky lg:top-24 lg:order-2">
          <DecisionPanel
            app={app}
            paid={paid}
            history={history}
            backHref={backHref}
            onDecided={async (message) => {
              toast(message);
              refreshCount();
              await load();
            }}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-5 lg:order-1">
          <Section icon={Building2} title="The business">
            <Facts>
              <Fact label="Registered name" value={app.form.companyName} />
              <Fact label="Registration" value={registrationOf(app)} mono />
              <Fact label="Company type" value={PSF_COMPANY_TYPE_LABEL[app.form.companyType]} />
              <Fact
                label="Ownership"
                value={app.form.ownership === "other" ? `Other: ${app.form.ownershipOther ?? ""}` : PSF_OWNERSHIP_LABEL[app.form.ownership]}
              />
              <Fact label="Sector" value={app.profile.clusterName ?? "Not given"} />
              <Fact label="Kind of business" value={app.profile.subsectorName ?? "Not given"} />
              <Fact label="Association" value={app.profile.associationName ?? "Not given"} wide />
              <Fact
                label="Owned by"
                wide
                value={
                  app.profile.ownerGroups.length ? (
                    <span className="flex flex-wrap gap-1.5">
                      {app.profile.ownerGroups.map((g) => (
                        <span key={g} className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-text">
                          {PSF_OWNER_GROUP_LABEL[g]}
                        </span>
                      ))}
                    </span>
                  ) : (
                    "Not marked"
                  )
                }
              />
              <Fact
                label="Address"
                wide
                value={
                  <span className="inline-flex items-start gap-1.5">
                    <MapPin size={14} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
                    {[app.form.streetAddress, app.districtName].filter(Boolean).join(", ")}
                  </span>
                }
              />
              <Fact
                label="Website"
                value={
                  app.form.website ? (
                    <a href={app.form.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent-text hover:underline">
                      <Globe size={13} aria-hidden /> {app.form.website.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    "None given"
                  )
                }
              />
              <Fact
                label="Export or import"
                value={
                  app.form.tradeDirection === "none"
                    ? "No"
                    : `${PSF_TRADE_DIRECTION_LABEL[app.form.tradeDirection]}: ${app.form.tradeGoods ?? ""} (${app.form.tradeCountries.map(countryName).join(", ")})`
                }
              />
            </Facts>
            <div className="mt-5 rounded border-l-4 border-primary bg-hover/60 px-4 py-3">
              <p className="text-2xs font-bold uppercase tracking-wide text-muted-foreground">What it does</p>
              <p className="mt-1 text-sm leading-relaxed text-ink">{app.form.businessActivity}</p>
            </div>
          </Section>

          {app.branches.length > 0 ? (
            <Section icon={Store} title={`Branches (${app.branches.length})`}>
              <p className="-mt-1 mb-4 text-sm text-muted-foreground">
                Each branch is admitted by the PSF office of its own district, whoever decides the business.
              </p>
              <ul className="flex list-none flex-col gap-3 p-0">
                {app.branches.map((b) => (
                  <BranchItem
                    key={b.id}
                    applicationId={app.id}
                    branch={b}
                    onDecided={async (message) => {
                      toast(message);
                      refreshCount();
                      await load();
                    }}
                  />
                ))}
              </ul>
            </Section>
          ) : null}

          <Section icon={UserRound} title="Who applied">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent-text">
                {initialsOf(`${app.form.firstName} ${app.form.lastName}`)}
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-ink">
                  {app.form.firstName} {app.form.lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {PSF_CONTACT_ROLE_LABEL[app.form.contactRole]} · {app.form.gender === "female" ? "Female" : "Male"}
                  {app.submittedCapacity === "on_behalf_of" && app.submittedByName ? ` · sent on the owner's behalf by ${app.submittedByName}` : ""}
                </p>
              </div>
            </div>
            <Facts>
              <Fact
                label="Phone"
                value={
                  <a href={`tel:${app.form.phoneE164}`} className="pms-num inline-flex items-center gap-1.5 text-accent-text hover:underline">
                    <Phone size={13} aria-hidden /> {app.form.phoneE164}
                  </a>
                }
              />
              <Fact
                label="Email"
                value={
                  app.form.email ? (
                    <a href={`mailto:${app.form.email}`} className="inline-flex items-center gap-1.5 break-all text-accent-text hover:underline">
                      <Mail size={13} aria-hidden /> {app.form.email}
                    </a>
                  ) : (
                    "Not given"
                  )
                }
              />
              <Fact label={app.form.idDocumentType === "passport" ? "Passport" : "National ID"} value={app.form.idDocumentNumber} mono />
              <Fact label="Date of birth" value={app.form.dateOfBirth} mono />
            </Facts>
          </Section>

          <Section icon={Wallet} title="Payments" aside={history ? `${history.payments.length} recorded` : undefined}>
            <Payments history={history} currentDocId={app.docId} />
          </Section>

          <Section icon={History} title="History with PSF">
            <HistoryList history={history} currentId={app.id} />
          </Section>
        </div>
      </div>
    </div>
  );
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-muted-foreground hover:text-foreground">
      <ArrowLeft size={15} aria-hidden /> Back to {label}
    </Link>
  );
}

function StatusBadge({ app }: { app: PsfOfficerApplication }) {
  if (app.status === "submitted") return <Badge intent={app.paidBeforeReview ? "ok" : "info"}>{app.paidBeforeReview ? "Paid · with PSF" : "With PSF"}</Badge>;
  if (app.status === "approved") return <Badge intent="warn">Approved, waiting for payment</Badge>;
  if (app.status === "member") return <Badge intent="ok">Member</Badge>;
  if (app.status === "declined") return <Badge intent="bad">Declined</Badge>;
  return <Badge>Withdrawn</Badge>;
}

/** Who, where, and the four facts an officer looks for first. */
function Hero({ app, history, paid }: { app: PsfOfficerApplication; history: PsfBusinessHistory | null; paid: number | null }) {
  const open = app.status === "submitted";
  const band = app.requestedTierName.includes(",") ? app.requestedTierName.split(",").slice(1).join(",").trim() : null;
  const family = app.requestedTierName.split(",")[0]!.trim();
  return (
    <section className="overflow-hidden rounded border border-line bg-card shadow-sm">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:p-6">
        <span className="pms-display flex size-16 shrink-0 items-center justify-center rounded bg-primary text-2xl font-bold text-primary-foreground shadow-sm">
          {initialsOf(app.businessName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge app={app} />
            {open ? (
              <Badge intent={app.waitingDays > PSF_OVERDUE_DAYS ? "bad" : "neutral"}>
                {app.waitingDays === 0 ? "Arrived today" : `Waiting ${app.waitingDays} day${app.waitingDays === 1 ? "" : "s"}`}
              </Badge>
            ) : null}
            {app.profile.domain === "hospitality" ? <Badge intent="info">Hotel</Badge> : null}
          </div>
          <h2 className="pms-display mt-2 text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl">{app.businessName}</h2>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            {app.docId ? (
              <span className="pms-num inline-flex items-center gap-1 font-mono font-semibold text-foreground">
                <FileText size={13} aria-hidden /> {app.docId}
              </span>
            ) : null}
            {app.profile.businessCode ? (
              <span className="pms-num inline-flex items-center gap-1 font-mono">
                <Hash size={13} aria-hidden /> {app.profile.businessCode}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <MapPin size={13} aria-hidden /> {app.districtName ?? "No district"}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={13} aria-hidden /> Sent {shortDate(app.submittedAt)}
            </span>
          </p>
        </div>
        <div className="shrink-0 rounded border border-line bg-hover/50 px-4 py-3 sm:text-right">
          <p className="text-2xs font-bold uppercase tracking-wide text-muted-foreground">{paid !== null ? (open ? "Paid, held for PSF" : "Paid") : "A year"}</p>
          <p className="pms-num mt-0.5 text-2xl font-bold text-ink">{paid !== null ? formatPrice(paid) : amountOf(app)}</p>
          {app.payment ? <p className="text-xs text-muted-foreground">{shortDate(app.payment.paidAt)}</p> : null}
        </div>
      </div>
      <dl className="grid grid-cols-2 border-t border-line sm:grid-cols-4">
        <Strip label="Membership" value={family} sub={band ? `Band ${band}` : undefined} />
        <Strip label="Sector" value={app.profile.clusterName ?? "Not given"} sub={app.profile.subsectorName ?? undefined} />
        <Strip label="Association" value={app.profile.associationName ?? "Not given"} />
        <Strip label="On Injishi since" value={history?.registeredAt ? shortDate(history.registeredAt) : "…"} />
      </dl>
    </section>
  );
}

function Strip({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 border-line px-5 py-3.5 even:border-l sm:border-l sm:first:border-l-0">
      <dt className="text-2xs font-bold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold leading-snug text-ink">{value}</dd>
      {sub ? <dd className="text-xs text-muted-foreground">{sub}</dd> : null}
    </div>
  );
}

export function Section({ icon: Icon, title, aside, children }: { icon: typeof Building2; title: string; aside?: string; children: ReactNode }) {
  return (
    <section className="rounded border border-line bg-card shadow-sm">
      <header className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
        <span className="flex size-7 items-center justify-center rounded bg-accent-soft text-accent-text">
          <Icon size={15} aria-hidden />
        </span>
        <h3 className="flex-1 text-sm font-bold text-ink">{title}</h3>
        {aside ? <span className="text-xs text-muted-foreground">{aside}</span> : null}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Facts({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">{children}</dl>;
}

export function Fact({ label, value, mono, wide }: { label: string; value: ReactNode; mono?: boolean; wide?: boolean }) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <dt className="text-2xs font-bold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 break-words text-sm font-medium text-ink", mono && "pms-num font-mono")}>{value}</dd>
    </div>
  );
}

const PAYMENT_LABEL: Record<PsfBusinessHistory["payments"][number]["kind"], string> = {
  registration_fee: "Registration fee",
  membership_fee: "Membership fee",
};

function Payments({ history, currentDocId }: { history: PsfBusinessHistory | null; currentDocId: string | null }) {
  if (!history) return <div className="h-28 animate-pulse rounded bg-hover" />;
  if (history.payments.length === 0) return <p className="text-sm text-muted-foreground">No payment yet.</p>;
  const paidIn = history.payments.reduce((s, p) => s + p.amountRwf, 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded bg-ok-bg px-4 py-3">
        <p className="text-2xs font-bold uppercase tracking-wide text-ok">Paid in</p>
        <p className="pms-num mt-0.5 text-lg font-bold text-ink">{formatPrice(paidIn)}</p>
      </div>
      <ol className="flex list-none flex-col p-0">
        {history.payments.map((p, i) => (
          <li key={`${p.kind}-${p.at ?? i}`} className="relative flex gap-3 pb-4 last:pb-0">
            {i < history.payments.length - 1 ? <span aria-hidden className="absolute left-4 top-9 h-[calc(100%-2rem)] w-px bg-line" /> : null}
            <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-ok-bg text-ok">
              <Wallet size={14} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-sm font-semibold text-ink">{PAYMENT_LABEL[p.kind]}</p>
                <p className="pms-num text-sm font-bold text-ink">{formatPrice(p.amountRwf)}</p>
              </div>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <span>{p.at ? shortDate(p.at) : "—"}</span>
                {p.applicationDocId && p.applicationDocId !== currentDocId ? <span className="pms-num font-mono">{p.applicationDocId}</span> : null}
              </p>
              {p.reference ? <p className="pms-num mt-0.5 truncate font-mono text-2xs text-faint" title={p.reference}>{p.reference}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

const APPLICATION_STATUS: Record<string, { label: string; intent: "ok" | "warn" | "bad" | "info" | "neutral" }> = {
  submitted: { label: "With PSF", intent: "info" },
  approved: { label: "Approved, unpaid", intent: "warn" },
  member: { label: "Member", intent: "ok" },
  declined: { label: "Declined", intent: "bad" },
  withdrawn: { label: "Withdrawn", intent: "neutral" },
};

export function HistoryList({
  history,
  currentId,
  hrefFor,
}: {
  history: PsfBusinessHistory | null;
  currentId: string | null;
  /** Where an application row links to, when it should. */
  hrefFor?: (applicationId: string) => string;
}) {
  if (!history) return <div className="h-24 animate-pulse rounded bg-hover" />;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-2xs font-bold uppercase tracking-wide text-muted-foreground">Applications</p>
        <ul className="flex list-none flex-col divide-y divide-line rounded border border-line p-0">
          {history.applications.map((a) => {
            const st = APPLICATION_STATUS[a.status] ?? { label: a.status, intent: "neutral" as const };
            return (
              <li key={a.id} className={cn("relative flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3", a.id === currentId && "bg-accent-soft/40", hrefFor && "hover:bg-hover/60")}>
                {hrefFor ? <Link href={hrefFor(a.id)} className="absolute inset-0" aria-label={`Open ${a.docId ?? "the application"}`} /> : null}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">
                    {a.tierName}
                    {a.id === currentId ? <span className="ml-2 text-2xs font-bold uppercase text-accent-text">This one</span> : null}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {[a.docId, `sent ${shortDate(a.submittedAt)}`, a.decidedAt ? `decided ${shortDate(a.decidedAt)}` : null, a.membershipNumber, a.declineReasonLabel]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <Badge intent={st.intent}>{st.label}</Badge>
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <p className="mb-2 text-2xs font-bold uppercase tracking-wide text-muted-foreground">Memberships</p>
        {history.memberships.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not a PSF member yet.</p>
        ) : (
          <ul className="flex list-none flex-col divide-y divide-line rounded border border-line p-0">
            {history.memberships.map((m) => (
              <li key={m.number} className="flex items-center gap-3 px-4 py-3">
                <BadgeCheck size={18} aria-hidden className={m.current ? "text-ok" : "text-faint"} />
                <span className="min-w-0 flex-1">
                  <span className="pms-num block font-mono text-sm font-semibold text-ink">{m.number}</span>
                  <span className="block text-xs text-muted-foreground">
                    {[m.tierName, m.startsOn && m.expiresOn ? `${shortDate(m.startsOn)} to ${shortDate(m.expiresOn)}` : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <Badge intent={m.current ? "ok" : "neutral"}>{m.current ? "Current" : "Ended"}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// --- The decision ---------------------------------------------------------------

const fieldClass =
  "w-full rounded border border-line2 bg-field px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50";

function DecisionPanel({
  app,
  paid,
  history,
  backHref,
  onDecided,
}: {
  app: PsfOfficerApplication;
  paid: number | null;
  history: PsfBusinessHistory | null;
  backHref: string;
  onDecided: (message: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"approve" | "decline">("approve");
  const [membershipNumber, setMembershipNumber] = useState(app.suggestedMembershipNumber ?? "");
  const [fee, setFee] = useState("");
  const [reason, setReason] = useState<PsfDeclineReason>("details_incomplete");
  const [note, setNote] = useState("");
  const [acting, setActing] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  useEffect(() => setMembershipNumber(app.suggestedMembershipNumber ?? ""), [app.suggestedMembershipNumber]);

  if (app.status !== "submitted") return <Outcome app={app} history={history} backHref={backHref} />;

  // Only the District Manager of its district decides (2026-10-23). Here
  // for a branch only, or from a province or national post: read, report.
  if (!app.decidesHere) {
    return (
      <Panel title="Decision">
        <p className="rounded bg-hover px-3.5 py-3 text-sm text-ink">
          {app.headOfficeInScope
            ? `For reporting: the PSF District Manager of ${app.districtName ?? "its district"} approves or declines it.`
            : `The business is decided by the PSF District Manager of ${app.districtName ?? "its head office"}. You decide its branches in your district, under Branches.`}
        </p>
      </Panel>
    );
  }

  if (!app.canDecide) {
    return (
      <Panel title="Decision">
        <p className="rounded bg-warn-bg px-3.5 py-3 text-sm text-warn">{PSF_OWN_BUSINESS_MESSAGE}</p>
      </Panel>
    );
  }

  const declared = paid ?? app.declaredFeeRwf ?? (app.quotedPriceKind === "fixed" ? app.quotedFeeRwf : null);
  const needsFee = declared === null;
  const feeNumber = Number(fee.replace(/[\s,]/g, ""));
  const { startsOn, expiresOn } = defaultPsfMembershipDates(kigaliDay(new Date()));
  const approveReady = membershipNumber.trim().length > 0 && (!needsFee || (Number.isInteger(feeNumber) && feeNumber > 0));
  const declineReady = reason !== "other" || note.trim().length > 0;

  const approve = async () => {
    setActing(true);
    setRefusal(null);
    try {
      await approvePsfApplication(app.id, { membershipNumber: membershipNumber.trim(), ...(needsFee ? { feeRwf: feeNumber } : {}) });
      await onDecided(app.paidBeforeReview ? `${app.businessName} is now a PSF member.` : `${app.businessName} is approved. They pay to become a member.`);
    } catch (error) {
      setRefusal(refusalField(error)?.message ?? humanError(error));
    } finally {
      setActing(false);
    }
  };
  const decline = async () => {
    setActing(true);
    setRefusal(null);
    try {
      await declinePsfApplication(app.id, { reason, ...(note.trim() ? { note: note.trim() } : {}) });
      await onDecided(
        `${app.businessName}'s application was declined.`,
      );
    } catch (error) {
      setRefusal(humanError(error));
    } finally {
      setActing(false);
    }
  };

  return (
    <Panel title="Your decision">
      <div role="tablist" aria-label="Decision" className="grid grid-cols-2 gap-1 rounded bg-hover p-1">
        {(
          [
            ["approve", "Approve", CheckCircle2],
            ["decline", "Decline", XCircle],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            onClick={() => {
              setMode(key);
              setRefusal(null);
            }}
            className={cn(
              "inline-flex h-9 items-center justify-center gap-1.5 rounded text-sm font-semibold transition-colors",
              mode === key
                ? key === "approve"
                  ? "bg-card text-ok shadow-sm ring-1 ring-line"
                  : "bg-card text-bad shadow-sm ring-1 ring-line"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon size={15} aria-hidden /> {label}
          </button>
        ))}
      </div>

      {mode === "approve" ? (
        <div className="mt-4 flex flex-col gap-4">
          <dl className="divide-y divide-line rounded border border-line text-sm">
            <Row label="Membership" value={PSF_FAMILY_LABEL[app.requestedTierName.toLowerCase().startsWith("golden") ? "golden_circle" : app.requestedTierName.toLowerCase().startsWith("indashyikirwa") ? "indashyikirwa" : "indatwa"] ?? app.requestedTierName} />
            <Row label={paid !== null ? "Already paid" : "They will pay"} value={declared !== null ? formatPrice(declared) : "You name it"} strong />
            {paid !== null ? <Row label="Member" value={`${shortDate(startsOn)} to ${shortDate(expiresOn)}`} /> : null}
          </dl>
          <label className="text-sm font-semibold text-ink">
            PSF membership number
            <input className={cn(fieldClass, "pms-num mt-1.5 h-10 font-mono")} value={membershipNumber} onChange={(e) => setMembershipNumber(e.target.value)} placeholder="PSF/KIC/2026/0001" />
            {app.suggestedMembershipNumber ? <span className="mt-1 block text-xs font-normal text-muted-foreground">Next number for this district. Change it if PSF gave another.</span> : null}
          </label>
          {needsFee ? (
            <label className="text-sm font-semibold text-ink">
              Annual fee (RWF)
              <input className={cn(fieldClass, "pms-num mt-1.5 h-10")} inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value)} />
            </label>
          ) : null}
          {refusal ? <p className="text-sm text-bad">{refusal}</p> : null}
          <button
            type="button"
            onClick={() => void approve()}
            disabled={!approveReady || acting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-95 disabled:opacity-50"
          >
            <BadgeCheck size={16} aria-hidden /> {acting ? "Approving" : paid !== null ? "Approve and make a member" : "Approve"}
          </button>
          <p className="text-xs text-muted-foreground">The business is told by text, and its certificate appears on its tracking page.</p>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <label className="text-sm font-semibold text-ink">
            Reason
            <select className={cn(fieldClass, "mt-1.5 h-10")} value={reason} onChange={(e) => setReason(e.target.value as PsfDeclineReason)}>
              {PsfDeclineReason.options.map((code) => (
                <option key={code} value={code}>
                  {PSF_DECLINE_REASON_LABEL[code]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-ink">
            Note for the business {reason === "other" ? "" : <span className="font-normal text-muted-foreground">(optional)</span>}
            <textarea
              className={cn(fieldClass, "mt-1.5 min-h-24 py-2")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What should they fix before applying again?"
            />
          </label>
          {paid !== null && app.paidBeforeReview ? (
            <p className="flex items-start gap-2 rounded bg-hover px-3 py-2.5 text-xs text-muted-foreground">
              <Wallet size={14} aria-hidden className="mt-px shrink-0" />
              <span>The {formatPrice(paid)} they paid is kept and goes on to PSF. Nothing is refunded.</span>
            </p>
          ) : null}
          {refusal ? <p className="text-sm text-bad">{refusal}</p> : null}
          <button
            type="button"
            onClick={() => void decline()}
            disabled={!declineReady || acting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded border border-bad bg-card text-sm font-semibold text-bad shadow-sm transition-colors hover:bg-bad-bg disabled:opacity-50"
          >
            <XCircle size={16} aria-hidden /> {acting ? "Recording" : "Decline application"}
          </button>
        </div>
      )}
    </Panel>
  );
}

/**
 * One branch, with Admit and Decline for the officer of its district
 * (2026-10-23). A decline says why, because the business reads it.
 */
function BranchItem({
  applicationId,
  branch,
  onDecided,
}: {
  applicationId: string;
  branch: PsfApplicationBranch;
  onDecided: (message: string) => Promise<void>;
}) {
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const [acting, setActing] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  const place = [branch.sectorName, branch.districtName].filter(Boolean).join(", ") || "This branch";
  const decide = async (decision: "admit" | "decline") => {
    setActing(true);
    setRefusal(null);
    try {
      await decidePsfBranch(applicationId, branch.id, { decision, ...(note.trim() ? { note: note.trim() } : {}) });
      await onDecided(decision === "admit" ? `The ${place} branch is admitted.` : `The ${place} branch was declined.`);
    } catch (error) {
      setRefusal(refusalField(error)?.message ?? humanError(error));
    } finally {
      setActing(false);
    }
  };

  return (
    <li className="rounded border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-start gap-1.5 font-semibold text-ink">
            <MapPin size={15} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
            {place}
          </p>
          <p className="mt-0.5 pl-5 text-sm text-muted-foreground">{branch.street}</p>
        </div>
        <Badge intent={branch.status === "admitted" ? "ok" : branch.status === "declined" ? "bad" : "neutral"}>
          {PSF_BRANCH_STATUS_LABEL[branch.status]}
        </Badge>
      </div>
      {branch.status === "declined" && branch.note ? <p className="mt-2 text-sm text-muted-foreground">{branch.note}</p> : null}
      {branch.canDecide ? (
        declining ? (
          <div className="mt-3 flex flex-col gap-3">
            <label className="text-sm font-semibold text-ink">
              Why is it declined?
              <textarea
                className={cn(fieldClass, "mt-1.5 min-h-20 py-2")}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What the business should know or fix"
              />
            </label>
            {refusal ? <p className="text-sm text-bad">{refusal}</p> : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void decide("decline")}
                disabled={acting || note.trim().length === 0}
                className="inline-flex h-9 items-center gap-1.5 rounded border border-bad bg-card px-3.5 text-sm font-semibold text-bad hover:bg-bad-bg disabled:opacity-50"
              >
                <XCircle size={15} aria-hidden /> {acting ? "Recording" : "Decline branch"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeclining(false);
                  setRefusal(null);
                }}
                className="inline-flex h-9 items-center rounded px-3.5 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {refusal ? <p className="text-sm text-bad">{refusal}</p> : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void decide("admit")}
                disabled={acting}
                className="inline-flex h-9 items-center gap-1.5 rounded bg-primary px-3.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-95 disabled:opacity-50"
              >
                <CheckCircle2 size={15} aria-hidden /> {acting ? "Admitting" : "Admit branch"}
              </button>
              <button
                type="button"
                onClick={() => setDeclining(true)}
                disabled={acting}
                className="inline-flex h-9 items-center gap-1.5 rounded border border-line bg-card px-3.5 text-sm font-semibold text-bad hover:bg-bad-bg disabled:opacity-50"
              >
                <XCircle size={15} aria-hidden /> Decline
              </button>
            </div>
          </div>
        )
      ) : null}
    </li>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded border border-line bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-bold text-ink">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3.5 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-right text-ink", strong ? "pms-num text-base font-bold" : "text-sm font-medium")}>{value}</dd>
    </div>
  );
}

/** The member's certificate: download it, or send it to the email the business gave. */
function CertificateActions({ app }: { app: PsfOfficerApplication }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);
  const send = async () => {
    setBusy(true);
    setNote(null);
    try {
      const r = await emailPsfCertificate(app.id);
      setNote({ text: `Sent to ${r.sentTo}`, bad: false });
    } catch (error) {
      setNote({ text: humanError(error), bad: true });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
      <p className="text-2xs font-bold uppercase tracking-wide text-muted-foreground">Certificate</p>
      <a
        href={psfCertificateHref(app.id)}
        download
        className="inline-flex h-10 items-center justify-center gap-2 rounded bg-primary text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-95"
      >
        <Download size={15} aria-hidden /> Download PDF
      </a>
      {app.form.email ? (
        <button
          type="button"
          onClick={() => void send()}
          disabled={busy}
          className="inline-flex h-10 items-center justify-center gap-2 rounded border border-input bg-card text-sm font-semibold shadow-sm hover:bg-hover disabled:opacity-50"
        >
          <Mail size={15} aria-hidden /> {busy ? "Sending" : "Email it to the business"}
        </button>
      ) : (
        <p className="text-xs text-muted-foreground">No email was given with this application, so it can only be downloaded.</p>
      )}
      {note ? <p className={cn("text-xs", note.bad ? "text-bad" : "text-ok")}>{note.text}</p> : null}
    </div>
  );
}

/** A decided application: what was decided. */
function Outcome({ app, history, backHref }: { app: PsfOfficerApplication; history: PsfBusinessHistory | null; backHref: string }) {
  const approved = app.status === "member" || app.status === "approved";
  return (
    <Panel title="Decision">
      <div className={cn("flex items-start gap-3 rounded px-4 py-3.5", approved ? "bg-ok-bg" : app.status === "declined" ? "bg-bad-bg" : "bg-hover")}>
        {approved ? <CheckCircle2 size={20} aria-hidden className="shrink-0 text-ok" /> : <XCircle size={20} aria-hidden className="shrink-0 text-bad" />}
        <div className="min-w-0 text-sm">
          <p className={cn("font-semibold", approved ? "text-ok" : "text-bad")}>
            {app.status === "member" ? "Approved · a member" : app.status === "approved" ? "Approved · waiting for payment" : app.status === "declined" ? "Declined" : "Withdrawn"}
          </p>
          {app.decidedAt ? (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock3 size={12} aria-hidden /> {shortDate(app.decidedAt)}
            </p>
          ) : null}
        </div>
      </div>
      <dl className="mt-4 divide-y divide-line rounded border border-line text-sm">
        {app.approvedMembershipNumber ? <Row label="Membership number" value={app.approvedMembershipNumber} /> : null}
        {app.approvedFeeRwf !== null ? <Row label="A year" value={formatPrice(app.approvedFeeRwf)} strong /> : null}
        {app.declineReason ? <Row label="Reason" value={PSF_DECLINE_REASON_LABEL[app.declineReason]} /> : null}
      </dl>
      {app.decisionNote ? <p className="mt-3 rounded bg-hover px-3.5 py-2.5 text-sm italic text-ink">&ldquo;{app.decisionNote}&rdquo;</p> : null}
      {app.status === "member" && app.docId ? <CertificateActions app={app} /> : null}
      <Link
        href={backHref}
        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded border border-input bg-card text-sm font-semibold shadow-sm hover:bg-hover"
      >
        <ArrowLeft size={15} aria-hidden /> Back to the list
      </Link>
    </Panel>
  );
}
