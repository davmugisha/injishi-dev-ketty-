"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Download,
  Mail,
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock3,
  Crown,
  FileText,
  Hash,
  History,
  MapPin,
  Medal,
  Printer,
  RefreshCw,
  Sprout,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  PSF_BRANCH_STATUS_LABEL,
  PSF_COMPANY_TYPE_LABEL,
  psfFamilyName,
  PSF_OWNER_GROUP_SHORT,
  PSF_OWNERSHIP_LABEL,
  PSF_TRACK_STAGE_LABEL,
  PsfCompanyType,
  PsfOwnership,
  type PsfPaymentLine,
  type PsfTierFee,
  type PsfTier,
  type PsfTrackStage,
  type PsfTrackView,
} from "@injishi/contracts";
import { Button } from "@injishi/web-ui";

import {
  emailPsfCertificate,
  fetchPsfFees,
  fetchPsfQuote,
  fetchPsfTiers,
  fetchPsfTrack,
  payPsfMembership,
  payPsfRegistration,
  psfCardUrl,
  psfCertificateUrl,
  renewPsfMembership,
  resendPsfApplication,
  uploadPsfResendCard,
} from "@/data/psf";
import { Field, SelectField, TextInput } from "@/app/(app)/(entry)/register/wizard-ui";
import { apiResultMessage, retryWhileFailed } from "@/lib/api";


import { CertificatePaper } from "./certificate-paper";

import { DocIdTicket } from "../doc-id-ticket";
import { TrackForm } from "../track-form";

const rwf = (n: number | null | undefined) => `RWF ${(n ?? 0).toLocaleString("en-US")}`;
const day = (iso: string | null | undefined) =>
  iso ? new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Kigali" }) : "—";
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kigali" });

const FAMILY_ICON: Record<string, LucideIcon> = { golden_circle: Crown, indashyikirwa: Medal, indatwa: Sprout };

/**
 * The four places an application passes through, for the progress bar. PSF
 * reviews only paid applications, so paying comes before the review, and the
 * decision is the last step: a member, or declined (nothing is refunded).
 */
const MILESTONES: { key: string; label: string }[] = [
  { key: "sent", label: "Sent" },
  { key: "paid", label: "Paid" },
  { key: "review", label: "PSF review" },
  { key: "member", label: "Member" },
];
function reachedOf(stage: PsfTrackStage): number {
  switch (stage) {
    case "fee_due":
      return 0;
    case "under_review":
    case "sent_back":
    case "withdrawn":
      // An application approved before paying came first (the old order) waits here too.
    case "approved":
      return 2;
    case "declined":
    case "member":
    case "lapsed":
      return 3;
  }
}

const PAYMENT_LABEL: Record<PsfPaymentLine["kind"], string> = {
  registration_fee: "Registration fee",
  membership_fee: "Membership, first year",
  membership_renewal: "Membership renewal",
};

const TONE: Record<PsfTrackStage, { icon: LucideIcon; ring: string; chip: string }> = {
  fee_due: { icon: Wallet, ring: "ring-warning/40", chip: "bg-warning/15 text-foreground" },
  sent_back: { icon: Wallet, ring: "ring-warning/40", chip: "bg-warning/15 text-foreground" },
  under_review: { icon: Clock3, ring: "ring-border", chip: "bg-secondary text-foreground" },
  approved: { icon: BadgeCheck, ring: "ring-accent-brand/50", chip: "bg-accent-brand/15 text-accent-text" },
  member: { icon: CheckCircle2, ring: "ring-accent-brand/50", chip: "bg-accent-brand text-accent-brand-foreground" },
  lapsed: { icon: AlertCircle, ring: "ring-warning/40", chip: "bg-warning/15 text-foreground" },
  declined: { icon: XCircle, ring: "ring-destructive/40", chip: "bg-destructive/10 text-destructive" },
  withdrawn: { icon: XCircle, ring: "ring-border", chip: "bg-secondary text-foreground" },
};

/**
 * The tracking page (the public PSF path, 2026-10-19): where an application
 * stands, read by its docID, and the one place a business without an account
 * acts on it: paying the membership fee if the payment at submit did not go
 * through, and printing the certificate once it is a member.
 */
export function PsfTrack({ docId }: { docId: string }) {
  const [view, setView] = useState<PsfTrackView | null>(null);
  const [missing, setMissing] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const res = await retryWhileFailed(() => fetchPsfTrack(docId));
    if (res.status === "ok") {
      setView(res.data);
      setMissing(null);
      setFailed(false);
    } else if (res.status === "refused" && (res.httpStatus === 404 || res.httpStatus === 400)) setMissing(res.message);
    else setFailed(true);
  }, [docId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (missing) {
    return (
      <div className="mx-auto flex max-w-narrow flex-col items-center gap-5 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <FileText size={26} aria-hidden />
        </span>
        <h1 className="text-2xl font-semibold">We could not find {docId}</h1>
        <p className="text-muted-foreground">{missing}</p>
        <div className="w-full max-w-form text-left">
          <TrackForm initial={docId} />
        </div>
      </div>
    );
  }
  if (failed) {
    return (
      <div className="mx-auto flex max-w-narrow flex-col items-center gap-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">We could not load this application</h1>
        <p className="text-muted-foreground">We couldn&apos;t reach the server just now. Try again in a moment.</p>
        <Button variant="outline" onClick={() => void load()}>
          <RefreshCw size={16} aria-hidden /> Try again
        </Button>
      </div>
    );
  }
  if (!view) {
    return (
      <div className="flex flex-col gap-6 py-10">
        <div className="h-10 w-1/2 animate-pulse rounded bg-secondary" />
        <div className="h-48 animate-pulse rounded-card bg-secondary" />
        <div className="h-64 animate-pulse rounded-card bg-secondary" />
      </div>
    );
  }

  const tone = TONE[view.stage];
  const reached = reachedOf(view.stage);
  const stopped = view.stage === "declined" || view.stage === "withdrawn";
  const stopAt = view.stage === "declined" ? 3 : 2;
  const FamilyIcon = FAMILY_ICON[view.request.family] ?? Sprout;

  return (
    <div className="flex flex-col gap-8 py-8 lg:py-12 print:py-0">
      <style>{`@media print { header, footer, nav, .no-print { display: none !important; } }`}</style>
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/psf/track" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} aria-hidden /> Track another
        </Link>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <RefreshCw size={14} aria-hidden /> Refresh
        </button>
      </div>

      {/* Header: the business, and where it stands */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-text">PSF application · {view.docId}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{view.business.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {view.business.code ? (
              <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-foreground">
                <Hash size={14} aria-hidden /> {view.business.code}
              </span>
            ) : null}
            {view.business.districtName ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={14} aria-hidden /> {view.business.districtName}
                {view.business.provinceName ? `, ${view.business.provinceName}` : ""}
              </span>
            ) : null}
            {view.business.subsectorName ? (
              <span className="inline-flex items-center gap-1.5">
                <Briefcase size={14} aria-hidden /> {view.business.subsectorName}
              </span>
            ) : null}
            {view.business.associationName ? (
              <span className="inline-flex items-center gap-1.5">
                <Building2 size={14} aria-hidden /> {view.business.associationName}
              </span>
            ) : null}
            {view.business.ownerGroups.map((g) => (
              <span key={g} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-foreground">
                {PSF_OWNER_GROUP_SHORT[g]}
              </span>
            ))}
          </div>
        </div>
        <span className={`inline-flex items-center gap-2 self-start rounded-full px-4 py-1.5 text-sm font-semibold lg:self-auto ${tone.chip}`}>
          <tone.icon size={16} aria-hidden /> {PSF_TRACK_STAGE_LABEL[view.stage]}
        </span>
      </header>

      {/* Progress */}
      <ol className="no-print grid list-none grid-cols-4 gap-2 p-0" aria-label="Progress">
        {MILESTONES.map((m, i) => {
          const done = i <= reached && !(stopped && i >= stopAt);
          const here = i === reached && !stopped && view.stage !== "member";
          const failedHere = stopped && i === stopAt;
          return (
            <li key={m.key} className="flex flex-col gap-2">
              <span
                className={[
                  "h-1.5 rounded-full",
                  failedHere ? "bg-destructive" : done ? "bg-accent-brand" : "bg-secondary",
                  here ? "animate-pulse" : "",
                ].join(" ")}
              />
              <span className={["text-xs font-medium", done || failedHere ? "text-foreground" : "text-muted-foreground"].join(" ")}>
                {failedHere
                  ? view.stage === "declined"
                    ? "Declined"
                    : "Withdrawn"
                  : m.key === "paid" && view.intake === "card_holder"
                    ? "Card sent"
                    : m.label}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <StageCard view={view} onChanged={setView} />

          {/* Timeline */}
          <section className="no-print rounded-card border border-border bg-card p-5 sm:p-6">
            <h2 className="text-base font-semibold">What has happened</h2>
            <ol className="mt-5 flex list-none flex-col p-0">
              {[...view.events].reverse().map((e, i, all) => (
                <li key={`${e.kind}-${e.at}`} className="relative flex gap-4 pb-6 last:pb-0">
                  {i < all.length - 1 ? <span aria-hidden className="absolute left-[11px] top-6 h-full w-px bg-border" /> : null}
                  <span
                    className={[
                      "relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ring-4 ring-card",
                      i === 0 ? (e.kind === "declined" ? "bg-destructive text-white" : "bg-accent-brand text-accent-brand-foreground") : "bg-secondary text-muted-foreground",
                    ].join(" ")}
                  >
                    {e.kind === "declined" ? (
                      <XCircle size={13} aria-hidden />
                    ) : (
                      <CheckCircle2 size={13} aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="font-medium">{e.title}</p>
                      <p className="text-xs text-muted-foreground">{when(e.at)}</p>
                    </div>
                    {e.detail ? <p className="text-sm text-muted-foreground">{e.detail}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="no-print flex flex-col gap-4">
          <DocIdTicket docId={view.docId} size="md" />
          <section className="rounded-card border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Membership asked for</h2>
            <div className="mt-3 flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-accent-brand/15 text-accent-text">
                <FamilyIcon size={18} aria-hidden />
              </span>
              <div>
                <p className="font-semibold">{view.request.familyName}</p>
                {view.request.tierName !== view.request.familyName ? (
                  <p className="text-sm text-muted-foreground">{view.request.tierName.replace(`${view.request.familyName}, `, "Band ")}</p>
                ) : null}
              </div>
            </div>
            <dl className="mt-4 divide-y divide-border text-sm">
              <Row k="A year" v={view.request.declaredFeeRwf ? rwf(view.request.declaredFeeRwf) : "Set by PSF"} />
              <Row k="Reviewed by" v={view.reviewingOffice} />
              <Row k="Sent" v={day(view.submittedAt)} />
            </dl>
          </section>
          <Payments view={view} />
          {view.renewals.length > 0 ? <Renewals view={view} /> : null}
          {view.business.branches.length > 0 ? <Branches view={view} /> : null}
          <section className="rounded-card border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Contact on file</h2>
            <dl className="mt-3 divide-y divide-border text-sm">
              <Row k="Name" v={view.contact.name} />
              <Row k="Phone" v={view.contact.phoneMasked} />
              {view.contact.emailMasked ? <Row k="Email" v={view.contact.emailMasked} /> : null}
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">Masked on purpose: your docID shows the status, never your details.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

/** Every franc this application has paid. Nothing is refunded. */
function Payments({ view }: { view: PsfTrackView }) {
  const paidIn = view.payments.reduce((sum, p) => sum + p.amountRwf, 0);
  return (
    <section className="rounded-card border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Payments</h2>
        {paidIn > 0 ? <p className="text-xs text-muted-foreground">{rwf(paidIn)} paid</p> : null}
      </div>
      {view.payments.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing paid yet{view.dueRwf ? `: ${rwf(view.dueRwf)} is due to send it to PSF` : ""}.
        </p>
      ) : (
        <ul className="mt-3 flex list-none flex-col divide-y divide-border p-0 text-sm">
          {view.payments.map((p) => (
            <li key={`${p.kind}-${p.at ?? "pending"}`} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="font-medium">{PAYMENT_LABEL[p.kind]}</p>
                <p className="text-xs text-muted-foreground">
                  {p.at ? day(p.at) : "—"}
                </p>
                {p.reference ? (
                  <p className="truncate font-mono text-2xs text-muted-foreground" title={p.reference}>
                    Ref {shortRef(p.reference)}
                  </p>
                ) : null}
              </div>
              <p className="shrink-0 font-semibold tabular-nums">{rwf(p.amountRwf)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Each branch, and where its own district's PSF office stands on it (2026-10-23). */
function Branches({ view }: { view: PsfTrackView }) {
  return (
    <section className="rounded-card border border-border bg-card p-5">
      <h2 className="text-sm font-semibold">Branches</h2>
      <p className="mt-1 text-xs text-muted-foreground">The PSF office of each branch&rsquo;s district admits it.</p>
      <ul className="mt-3 flex list-none flex-col divide-y divide-border p-0 text-sm">
        {view.business.branches.map((b, i) => (
          <li key={i} className="flex flex-col gap-0.5 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">{[b.sectorName, b.districtName].filter(Boolean).join(", ") || "Branch"}</span>
              <span
                className={[
                  "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                  b.status === "admitted"
                    ? "bg-accent-brand/15 text-accent-text"
                    : b.status === "declined"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-secondary text-muted-foreground",
                ].join(" ")}
              >
                {PSF_BRANCH_STATUS_LABEL[b.status]}
              </span>
            </div>
            {b.status === "declined" && b.note ? <span className="text-xs text-muted-foreground">{b.note}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}

/** The one card that says what to do now, shaped by the stage. */
function StageCard({ view, onChanged }: { view: PsfTrackView; onChanged: (v: PsfTrackView) => void }) {
  switch (view.stage) {
    case "fee_due":
      return (
        <PayPanel
          title="Pay to send it to PSF"
          body={`Your application is saved, but PSF reviews only paid applications and the payment did not go through. Pay ${rwf(view.dueRwf)} for your first year, and it joins PSF's queue straight away. The membership fee is not refunded.`}
          amount={view.dueRwf ?? 0}
          cta="Pay and send to PSF"
          pay={(phone) => payPsfRegistration(view.docId, phone)}
          onPaid={onChanged}
        />
      );
    case "sent_back":
      return <FixAndResend view={view} onChanged={onChanged} />;
    case "under_review":
      return (
        <section className="relative overflow-hidden rounded-card border border-border bg-card p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="relative flex size-20 shrink-0 items-center justify-center">
              
              <span className="relative flex size-16 items-center justify-center rounded-full bg-accent-brand/15 text-accent-text">
                <Clock3 size={30} aria-hidden />
              </span>
            </div>
            <div>
              <h2 className="text-xl font-semibold">With the {view.reviewingOffice}</h2>
              <p className="mt-1.5 text-muted-foreground">
                {view.intake === "card_holder" ? "A PSF District Manager is checking your PSF card" : "A PSF District Manager is reviewing your application"}
                {view.waitingDays !== null ? `, waiting ${view.waitingDays === 0 ? "since today" : `${view.waitingDays} day${view.waitingDays === 1 ? "" : "s"}`}` : ""}. Most are decided within a week. We text you the moment they decide.
              </p>
              <p className="mt-3 inline-flex items-start gap-2 text-sm text-muted-foreground">
                <Wallet size={14} aria-hidden className="mt-0.5 shrink-0 text-accent-text" />
                <span>
                  {view.intake === "card_holder"
                    ? "A card holder: nothing to pay now. Confirmed, you get a new membership number and your certificate that day."
                    : "Your membership fee is paid. Approved, you are a member that day."}
                </span>
              </p>
            </div>
          </div>
        </section>
      );
    case "approved":
      return (
        <PayPanel
          title="PSF approved your application"
          body={`Welcome aboard. Pay ${rwf(view.approval?.feeRwf)} for your first year of ${view.request.familyName} membership, and you are a PSF member from today.`}
          amount={view.approval?.feeRwf ?? 0}
          cta="Pay and become a member"
          extra={view.approval ? [["Membership number", view.approval.membershipNumber], ["Approved", day(view.approval.approvedAt)]] : []}
          pay={(phone) => payPsfMembership(view.docId, phone)}
          onPaid={onChanged}
          celebrate
        />
      );
    case "member":
    case "lapsed":
      return (
        <div className="flex flex-col gap-6">
          <MembershipStatus view={view} onChanged={onChanged} />
          <Certificate view={view} />
        </div>
      );
    case "declined":
      return (
        <section className="rounded-card border border-destructive/30 bg-destructive/5 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <XCircle size={24} aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-semibold">PSF declined this application</h2>
              <p className="mt-1 text-sm text-muted-foreground">{view.decline ? `Decided ${day(view.decline.decidedAt)}` : null}</p>
              {view.decline ? (
                <div className="mt-4 rounded-card bg-card p-4 ring-1 ring-border">
                  <p className="text-sm font-semibold">{view.decline.reasonLabel}</p>
                  {view.decline.note ? <p className="mt-1 text-sm">&ldquo;{view.decline.note}&rdquo;</p> : null}
                </div>
              ) : null}
              <p className="mt-4 text-sm text-muted-foreground">Fix what PSF asked for, then register again. Your business code stays the same.</p>
              <Button asChild variant="primary" className="mt-4">
                <Link href="/psf/register">Apply again</Link>
              </Button>
            </div>
          </div>
        </section>
      );
    case "withdrawn":
      return (
        <section className="rounded-card border border-border bg-card p-6">
          <h2 className="text-xl font-semibold">This application was withdrawn</h2>
          <p className="mt-1.5 text-muted-foreground">Nothing more happens with it. You can apply again at any time.</p>
        </section>
      );
  }
}

function PayPanel({
  title,
  body,
  amount,
  cta,
  pay,
  onPaid,
  extra = [],
  celebrate = false,
}: {
  title: string;
  body: string;
  amount: number;
  cta: string;
  pay: (phone: string) => ReturnType<typeof payPsfMembership>;
  onPaid: (v: PsfTrackView) => void;
  extra?: [string, string][];
  celebrate?: boolean;
}) {
  // The nine digits after +250: mobile money here is Rwandan, so the country is not a question.
  const [local, setLocal] = useState("");
  const phone = `+250${local}`;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "danger" | "info"; text: string } | null>(null);
  // A prompt sent and not yet approved (2026-11-02): the button becomes the Check payment the message
  // names. Pressing it asks again under the same charge, so it never charges twice.
  const [waiting, setWaiting] = useState(false);
  const submit = async () => {
    if (!/^\+2507\d{8}$/.test(phone)) {
      setMessage({ tone: "danger", text: "Give a Rwandan mobile money number, like +250788123456." });
      return;
    }
    setBusy(true);
    setMessage(null);
    const res = await pay(phone);
    setBusy(false);
    if (res.status !== "ok") return setMessage({ tone: "danger", text: apiResultMessage(res) });
    if (res.data.status === "paid") return onPaid(res.data.view);
    setWaiting(res.data.status === "pending");
    setMessage({ tone: res.data.status === "pending" ? "info" : "danger", text: res.data.message ?? "The payment did not go through." });
    onPaid(res.data.view);
  };
  return (
    <section
      className={[
        "relative overflow-hidden rounded-card border p-6 sm:p-8",
        celebrate ? "border-accent-brand/40 bg-card" : "border-warning/40 bg-card",
      ].join(" ")}
    >
      <div className="relative grid grid-cols-1 gap-6 xl:grid-cols-[1fr_18rem]">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="mt-2 text-muted-foreground">{body}</p>
          {extra.length ? (
            <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              {extra.map(([k, v]) => (
                <div key={k} className="rounded-card bg-card p-3 ring-1 ring-border">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="mt-0.5 break-words font-mono font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 rounded-card bg-card p-4 ring-1 ring-border">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">To pay</p>
          <p className="text-3xl font-semibold tabular-nums">{rwf(amount)}</p>
          <label className="text-sm font-medium" htmlFor="psf-pay-phone">
            Mobile money number
          </label>
          <span className="flex items-center gap-2 rounded border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
            <span className="text-sm font-medium text-muted-foreground">+250</span>
            <input
              id="psf-pay-phone"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="78 812 3456"
              className="h-11 min-w-0 flex-1 bg-transparent font-mono tracking-wider outline-none"
              value={local.replace(/(\d{2})(\d{3})(\d{0,4})/, (_, a, b, c) => [a, b, c].filter(Boolean).join(" "))}
              onChange={(e) => {
                setLocal(e.target.value.replace(/\D/g, "").replace(/^0/, "").slice(0, 9));
                setWaiting(false);
              }}
            />
          </span>
          <Button variant="primary" size="lg" onClick={() => void submit()} pending={busy} disabled={busy}>
            <Wallet size={16} aria-hidden /> {waiting ? "Check payment" : cta}
          </Button>
          <p className="text-xs text-muted-foreground">MTN MoMo or Airtel Money. The whole fee goes to PSF.</p>
        </div>
      </div>
      {message ? (
        <p role="alert" className={`relative mt-4 rounded-card p-3 text-sm ${message.tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-secondary"}`}>
          {message.text}
        </p>
      ) : null}
    </section>
  );
}

/**
 * PSF sent it back with what to fix (2026-11-05): PSF never rejects. The business corrects it here, or
 * sends its card again, and it returns to the District Manager's queue with its docID and any fee paid.
 */
function FixAndResend({ view, onChanged }: { view: PsfTrackView; onChanged: (v: PsfTrackView) => void }) {
  const fix = view.sentBack!;
  const [legalName, setLegalName] = useState(fix.legalName);
  const [streetAddress, setStreet] = useState(fix.streetAddress);
  const [website, setWebsite] = useState(fix.website ?? "");
  const [companyType, setCompanyType] = useState<string>(fix.companyType);
  const [ownership, setOwnership] = useState<string>(fix.ownership);
  const [ownershipOther, setOwnershipOther] = useState(fix.ownershipOther ?? "");
  const [businessActivity, setActivity] = useState(fix.businessActivity);
  const [card, setCard] = useState<{ key: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const pickCard = async (file: File | undefined) => {
    if (!file) return;
    setProblem(null);
    setBusy(true);
    const res = await uploadPsfResendCard(view.docId, file);
    setBusy(false);
    if (res.status !== "ok") return setProblem(apiResultMessage(res));
    setCard({ key: res.data.objectKey, name: file.name });
  };

  const send = async () => {
    setBusy(true);
    setProblem(null);
    const res = await resendPsfApplication(view.docId, {
      legalName,
      streetAddress,
      ...(website.trim() ? { website: website.trim() } : {}),
      companyType: companyType as PsfCompanyType,
      ownership: ownership as PsfOwnership,
      ...(ownership === "other" ? { ownershipOther } : {}),
      businessActivity,
      ...(card ? { cardObjectKey: card.key } : {}),
    });
    setBusy(false);
    if (res.status !== "ok") return setProblem(apiResultMessage(res));
    onChanged(res.data);
  };

  return (
    <section className="flex flex-col gap-5 rounded-card border border-warning/40 bg-card p-6 sm:p-8">
      <div>
        <h2 className="text-xl font-semibold">PSF needs a correction</h2>
        <p className="mt-1.5 text-muted-foreground">Your application stays open, with its docID and anything you paid. Fix this, then send it back to PSF.</p>
      </div>
      <p className="rounded-card bg-secondary p-3 text-sm">
        <span className="font-semibold">What to fix: </span>
        {fix.note}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name of the business" required>
          <TextInput className="w-full" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
        </Field>
        <Field label="Street address">
          <TextInput className="w-full" value={streetAddress} onChange={(e) => setStreet(e.target.value)} />
        </Field>
        <Field label="Kind of company" required>
          <SelectField value={companyType} options={PsfCompanyType.options.map((v) => ({ value: v, label: PSF_COMPANY_TYPE_LABEL[v] }))} onChange={setCompanyType} />
        </Field>
        <Field label="Ownership" required>
          <SelectField value={ownership} options={PsfOwnership.options.map((v) => ({ value: v, label: PSF_OWNERSHIP_LABEL[v] }))} onChange={setOwnership} />
        </Field>
        {ownership === "other" ? (
          <Field label="What is the ownership?" required>
            <TextInput className="w-full" value={ownershipOther} onChange={(e) => setOwnershipOther(e.target.value)} />
          </Field>
        ) : null}
        <Field label="Website (optional)">
          <TextInput className="w-full" placeholder="https://" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </Field>
      </div>
      <Field label="What does the business do?" required>
        <TextInput className="w-full" value={businessActivity} onChange={(e) => setActivity(e.target.value)} />
      </Field>
      {view.intake === "card_holder" ? (
        <Field label="Your PSF card" hint={card ? card.name : "Only if PSF asked for it again. PDF, JPEG or PNG, up to 10 MB."}>
          <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="text-sm" disabled={busy} onChange={(e) => void pickCard(e.target.files?.[0])} />
        </Field>
      ) : null}
      {problem ? (
        <p role="alert" className="rounded-card bg-destructive/10 p-3 text-sm text-destructive">
          {problem}
        </p>
      ) : null}
      <div>
        <Button variant="primary" size="lg" onClick={() => void send()} pending={busy} disabled={busy}>
          Send back to PSF
        </Button>
      </div>
    </section>
  );
}

/** Today in Kigali, and whole days from it to a yyyy-mm-dd date. */
function daysUntil(isoDate: string): number {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kigali" }).format(new Date());
  return Math.round((Date.parse(`${isoDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/**
 * Where the membership stands, and renewing it (2026-11-02). Renewal opens 60
 * days before the end date and runs on from it; a lapsed membership renews
 * from the day it is paid, under the same number. Paid is renewed: no
 * officer decides it.
 */
function MembershipStatus({ view, onChanged }: { view: PsfTrackView; onChanged: (v: PsfTrackView) => void }) {
  // An upgrade is open any time to a current member (2026-11-05); renewing opens near the end date.
  const [upgrading, setUpgrading] = useState(false);
  const m = view.membership;
  const renewal = view.renewal;
  // Said here, not in the panel: a paid renewal closes the window, and the panel with it.
  const [renewed, setRenewed] = useState<string | null>(null);
  if (!m?.expiresOn) return null;
  const lapsed = view.stage === "lapsed";
  const left = daysUntil(m.expiresOn);
  const soon = !lapsed && left <= 60;
  const headline = lapsed
    ? `Ended on ${day(m.expiresOn)}`
    : left === 0
      ? "Ends today"
      : soon
        ? `Ends in ${left} day${left === 1 ? "" : "s"}, on ${day(m.expiresOn)}`
        : `Active until ${day(m.expiresOn)}`;
  return (
    <section id="renew" className={["no-print scroll-mt-24 rounded-card border bg-card p-6 sm:p-8", lapsed || soon ? "border-warning/40" : "border-border"].join(" ")}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Membership {m.number}</p>
          <h2 className="mt-1 text-xl font-semibold">{headline}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {m.tierName}
            {m.feeRwf ? ` · ${rwf(m.feeRwf)} a year` : ""}
          </p>
        </div>
        <span
          className={[
            "inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-xs font-semibold",
            lapsed || soon ? "bg-warning/15 text-foreground" : "bg-accent-brand/15 text-accent-text",
          ].join(" ")}
        >
          {lapsed ? <AlertCircle size={14} aria-hidden /> : <CheckCircle2 size={14} aria-hidden />}
          {lapsed ? "Lapsed" : soon ? "Renewal due" : "Active"}
        </span>
      </div>
      {renewed ? (
        <p role="status" className="mt-5 flex items-start gap-2 rounded-card bg-accent-brand/15 p-3 text-sm text-accent-text">
          <CheckCircle2 size={15} aria-hidden className="mt-0.5 shrink-0" />
          <span>{renewed}</span>
        </p>
      ) : null}
      {renewal && !lapsed ? (
        <button type="button" onClick={() => setUpgrading((u) => !u)} className="mt-4 text-sm font-medium text-accent-text hover:underline">
          {upgrading ? (renewal.open ? "Renew instead" : "Keep my level") : "Upgrade to a higher level"}
        </button>
      ) : null}
      {!renewal ? null : renewal.open || upgrading ? (
        <RenewPanel key={upgrading ? "upgrade" : "renew"} view={view} onChanged={onChanged} onRenewed={setRenewed} upgrade={upgrading} />
      ) : (
        <p className="mt-5 flex items-start gap-2 rounded-card bg-secondary/60 p-3 text-sm text-muted-foreground">
          <Clock3 size={15} aria-hidden className="mt-0.5 shrink-0" />
          <span>
            You can renew from {day(renewal.opensOn)}, 60 days before it ends. Renewing early loses nothing: the new year starts the day this one
            ends. We remind you 30 days before.
          </span>
        </p>
      )}
    </section>
  );
}

type RenewBand = PsfTierFee & { name: string; family: PsfTier["family"]; familyName: string; amountRwf: number };

/** A band's yearly range, as the band list and the level cards print it. */
const bandRange = (from: number, to: number | null) => (to !== null ? `${rwf(from)} to ${rwf(to)}` : `${rwf(from)} and up`);

function RenewPanel({
  view,
  onChanged,
  onRenewed,
  upgrade = false,
}: {
  view: PsfTrackView;
  onChanged: (v: PsfTrackView) => void;
  onRenewed: (note: string) => void;
  /** An upgrade (2026-11-05): only a higher band, its full price, a new year from today. */
  upgrade?: boolean;
}) {
  const renewal = view.renewal!;
  const pending = renewal.pending;
  const districtId = view.business.districtId;
  const [bands, setBands] = useState<RenewBand[] | null>(null);
  // A prompt waiting opens on its own band and amount, so Check payment is one press (2026-11-02).
  const [tierCode, setTierCode] = useState(pending?.tierCode || (upgrade ? "" : renewal.tierCode) || "");
  const [amount, setAmount] = useState("");
  // Its kind's floor and its admitted branches' prices, for the band picked (2026-11-05).
  const [quote, setQuote] = useState<{ floorRwf: number | null; branchesRwf: number } | null>(null);
  const [seeded, setSeeded] = useState(false);
  const [local, setLocal] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "danger" | "info"; text: string } | null>(null);

  useEffect(() => {
    if (!districtId) return;
    void Promise.all([retryWhileFailed(fetchPsfTiers), retryWhileFailed(() => fetchPsfFees(districtId))]).then(([t, f]) => {
      if (t.status !== "ok" || f.status !== "ok") return setBands([]);
      const tiers = new Map<string, PsfTier>(t.data.map((x) => [x.code, x]));
      setBands(
        f.data.fees
          .filter((x): x is PsfTierFee & { amountRwf: number } => x.amountRwf !== null && tiers.has(x.tierCode))
          .map((x) => ({ ...x, name: tiers.get(x.tierCode)!.nameEn, family: tiers.get(x.tierCode)!.family, familyName: tiers.get(x.tierCode)!.familyName }))
          .sort((a, b) => a.amountRwf - b.amountRwf),
      );
    });
  }, [districtId]);

  // The levels PSF names (Indatwa, Indashyikirwa, Golden Circle), cheapest first, each with its bands.
  // An upgrade offers only the bands above the one it holds.
  const heldPrice = bands?.find((b) => b.tierCode === renewal.tierCode)?.amountRwf ?? 0;
  const offered = upgrade ? (bands ?? []).filter((b) => b.amountRwf > heldPrice) : (bands ?? []);
  const levels = offered.reduce<{ family: RenewBand["family"]; bands: RenewBand[] }[]>((acc, b) => {
    const level = acc.find((l) => l.family === b.family);
    if (level) level.bands.push(b);
    else acc.push({ family: b.family, bands: [b] });
    return acc;
  }, []);
  useEffect(() => {
    if (!districtId || !tierCode) return;
    let live = true;
    void fetchPsfQuote({ district: districtId, tierCode, subsectorId: renewal.subsectorId ?? undefined, branches: renewal.branchDistrictIds }).then((r) => {
      if (live && r.status === "ok") setQuote(r.data);
    });
    return () => {
      live = false;
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: the renewal's kind and branches do not change here.
  }, [districtId, tierCode]);
  // A prompt waiting opens on its own head-office amount: its total, less the branches.
  useEffect(() => {
    if (seeded || !pending || !quote || tierCode !== pending.tierCode) return;
    setSeeded(true);
    setAmount(String(pending.amountRwf - quote.branchesRwf));
  }, [seeded, pending, quote, tierCode]);
  const branchesRwf = quote?.branchesRwf ?? 0;

  const band = offered.find((b) => b.tierCode === tierCode) ?? null;
  const level = levels.find((l) => l.family === band?.family) ?? null;
  const currentFamily = bands?.find((b) => b.tierCode === renewal.tierCode)?.family ?? null;
  // The band's price unless the business typed another amount inside it.
  const least = Math.max(band?.amountRwf ?? 0, quote?.floorRwf ?? 0);
  const due = amount.trim() === "" ? least : Number(amount.replace(/\D/g, ""));
  const phone = `+250${local}`;
  // Check payment is the waiting prompt asked about again: the same band and amount, and no new number.
  const checking = pending !== null && tierCode === pending.tierCode && due + branchesRwf === pending.amountRwf && local === "";

  const pickBand = (code: string) => {
    setTierCode(code);
    setAmount("");
    setMessage(null);
  };

  const submit = async () => {
    if (!band) return setMessage({ tone: "danger", text: upgrade ? "Pick the level to move up to." : "Pick the membership level for the new year." });
    if (quote?.floorRwf != null && due < quote.floorRwf) {
      return setMessage({ tone: "danger", text: `Your kind of business costs at least ${rwf(quote.floorRwf)} a year here.` });
    }
    if (due < band.amountRwf || (band.ceilingRwf !== null && due > band.ceilingRwf)) {
      return setMessage({
        tone: "danger",
        text: band.ceilingRwf !== null ? `This band is ${rwf(band.amountRwf)} to ${rwf(band.ceilingRwf)} a year.` : `This band starts at ${rwf(band.amountRwf)} a year.`,
      });
    }
    if (!checking && !/^\+2507\d{8}$/.test(phone)) return setMessage({ tone: "danger", text: "Give a Rwandan mobile money number, like +250788123456." });
    setBusy(true);
    setMessage(null);
    const res = await renewPsfMembership(view.docId, { tierCode: band.tierCode, declaredFeeRwf: due, ...(checking ? {} : { phoneE164: phone }), ...(upgrade ? { upgrade: true } : {}) });
    setBusy(false);
    if (res.status !== "ok") return setMessage({ tone: "danger", text: apiResultMessage(res) });
    if (res.data.status === "paid") {
      const next = res.data.view.membership;
      onRenewed(`${upgrade ? "Upgraded" : "Renewed"}. You are a member until ${day(next?.expiresOn)}. We sent the receipt to your phone${view.contact.emailMasked ? " and email" : ""}.`);
    } else {
      // A prompt sent: the number is now the waiting prompt's, and the button its Check payment.
      if (res.data.status === "pending") setLocal("");
      setMessage({ tone: res.data.status === "pending" ? "info" : "danger", text: res.data.message ?? "The payment did not go through." });
    }
    onChanged(res.data.view);
  };

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 border-t border-border pt-6 xl:grid-cols-[1fr_18rem]">
      <div className="flex flex-col gap-5">
        <div>
          <h3 className="text-base font-semibold">{upgrade ? "Upgrade your membership" : `Renew for ${day(renewal.startsOn)} to ${day(renewal.expiresOn)}`}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {upgrade
              ? "Same membership number. You pay the higher level's full yearly fee, and a new year starts today. What is left of your current year is not refunded."
              : "Same membership number. Paid is renewed: there is nothing for PSF to approve. You may change level if your business has grown or shrunk."}
          </p>
        </div>
        {!districtId ? (
          <p className="text-sm text-destructive">This business has no district on file, so PSF has no price for it. Contact PSF.</p>
        ) : !bands ? (
          <div className="h-32 animate-pulse rounded-card bg-secondary" />
        ) : (
          <>
            {/* First the level, then, where a level has several, the yearly fee band inside it (2026-11-02). */}
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">1. Your level</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {levels.map((l) => {
                  const on = l.family === level?.family;
                  const first = l.bands[0]!;
                  const last = l.bands[l.bands.length - 1]!;
                  return (
                    <label
                      key={l.family}
                      className={[
                        "flex cursor-pointer items-start gap-3 rounded-card p-3 ring-1 transition-colors",
                        on ? "bg-accent-brand/10 ring-accent-brand" : "ring-border hover:bg-secondary/60",
                      ].join(" ")}
                    >
                      <input
                        type="radio"
                        name="psf-renew-level"
                        className="mt-1 accent-[var(--accent-brand)]"
                        checked={on}
                        onChange={() => pickBand((l.bands.find((b) => b.tierCode === renewal.tierCode) ?? first).tierCode)}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">
                          {l.bands[0]?.familyName || psfFamilyName(l.family)}
                          {l.family === currentFamily ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">(now)</span> : null}
                        </span>
                        <span className="block text-xs text-muted-foreground">{bandRange(first.amountRwf, last.ceilingRwf)} a year</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            {level && level.bands.length > 1 ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-medium">2. What you pay a year, within {level.bands[0]?.familyName || psfFamilyName(level.family)}</legend>
                <div className="flex flex-wrap gap-2">
                  {level.bands.map((b) => {
                    const on = b.tierCode === tierCode;
                    return (
                      <label
                        key={b.tierCode}
                        className={[
                          "inline-flex cursor-pointer items-center gap-2 rounded-full px-3.5 py-2 text-sm ring-1 transition-colors",
                          on ? "bg-accent-brand/10 font-semibold ring-accent-brand" : "ring-border hover:bg-secondary/60",
                        ].join(" ")}
                      >
                        <input type="radio" name="psf-renew-band" className="sr-only" checked={on} onChange={() => pickBand(b.tierCode)} />
                        <span className="tabular-nums">{bandRange(b.amountRwf, b.ceilingRwf)}</span>
                        {b.tierCode === renewal.tierCode ? <span className="text-xs font-normal text-muted-foreground">(now)</span> : null}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ) : null}
          </>
        )}
      </div>
      <div className="flex flex-col gap-3 self-start rounded-card bg-card p-4 ring-1 ring-border">
        <label className="text-sm font-medium" htmlFor="psf-renew-amount">
          A year
        </label>
        <span className="flex items-center gap-2 rounded border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
          <span className="text-sm font-medium text-muted-foreground">RWF</span>
          <input
            id="psf-renew-amount"
            inputMode="numeric"
            className="h-11 min-w-0 flex-1 bg-transparent font-mono tabular-nums outline-none"
            placeholder={band ? least.toLocaleString("en-US") : ""}
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d,]/g, ""))}
          />
        </span>
        <label className="text-sm font-medium" htmlFor="psf-renew-phone">
          Mobile money number
        </label>
        <span className="flex items-center gap-2 rounded border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
          <span className="text-sm font-medium text-muted-foreground">+250</span>
          <input
            id="psf-renew-phone"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder={checking && pending?.phoneMasked ? pending.phoneMasked.replace(/^\+250\s?/, "") : "78 812 3456"}
            className="h-11 min-w-0 flex-1 bg-transparent font-mono tracking-wider outline-none"
            value={local.replace(/(\d{2})(\d{3})(\d{0,4})/, (_, a, b, c) => [a, b, c].filter(Boolean).join(" "))}
            onChange={(e) => setLocal(e.target.value.replace(/\D/g, "").replace(/^0/, "").slice(0, 9))}
          />
        </span>
        <Button variant="primary" size="lg" onClick={() => void submit()} pending={busy} disabled={busy || !band}>
          <Wallet size={16} aria-hidden /> {checking ? "Check payment" : `Pay ${rwf(due + branchesRwf)} and ${upgrade ? "upgrade" : "renew"}`}
        </Button>
        {branchesRwf > 0 ? <p className="text-xs text-muted-foreground">Includes {rwf(branchesRwf)} for your branches.</p> : null}
        <p className="text-xs text-muted-foreground">MTN MoMo or Airtel Money. The whole fee goes to PSF.</p>
      </div>
      {message ?? pending ? (
        <p
          role="alert"
          className={[
            "rounded-card p-3 text-sm xl:col-span-2",
            message?.tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-secondary",
          ].join(" ")}
        >
          {message
            ? message.text
            : checking
              ? `A prompt for ${rwf(pending!.amountRwf)} (${pending!.tierName}) is waiting on ${pending!.phoneMasked ?? "your phone"}. Approve it, then press Check payment.`
              : `A prompt for ${rwf(pending!.amountRwf)} (${pending!.tierName}) is still waiting on your phone. Paying for this choice replaces it.`}
        </p>
      ) : null}
    </div>
  );
}

/** Every renewal paid on this membership, newest first. */
function Renewals({ view }: { view: PsfTrackView }) {
  return (
    <section className="rounded-card border border-border bg-card p-5">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold">
        <History size={14} aria-hidden /> Renewals
      </h2>
      <ul className="mt-3 flex list-none flex-col divide-y divide-border p-0 text-sm">
        {view.renewals.map((r) => (
          <li key={`${r.paidAt}-${r.startsOn}`} className="flex flex-col gap-0.5 py-2.5">
            <span className="flex items-baseline justify-between gap-3">
              <span className="font-medium">{day(r.startsOn)} to {day(r.expiresOn)}</span>
              <span className="tabular-nums">{rwf(r.amountRwf)}</span>
            </span>
            <span className="text-xs text-muted-foreground">
              {r.tierName} · paid {day(r.paidAt)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The membership certificate: the thing a member shows, printable. */
function Certificate({ view }: { view: PsfTrackView }) {
  return (
    <section className="flex flex-col gap-4">
      <CertificatePaper view={view} />
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Button asChild variant="primary">
          <a href={psfCertificateUrl(view.docId)} download>
            <Download size={16} aria-hidden /> Download PDF
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={psfCardUrl(view.docId)} download>
            <Download size={16} aria-hidden /> Download card
          </a>
        </Button>
        {view.contact.emailMasked ? <EmailCertificate docId={view.docId} to={view.contact.emailMasked} /> : null}
        <Button variant="outline" onClick={() => window.print()}>
          <Printer size={16} aria-hidden /> Print
        </Button>
      </div>
    </section>
  );
}

/** Send the certificate to the email on the application, never one typed here. */
function EmailCertificate({ docId, to }: { docId: string; to: string }) {
  const [state, setState] = useState<{ busy: boolean; note: string | null; bad: boolean }>({ busy: false, note: null, bad: false });
  const send = async () => {
    setState({ busy: true, note: null, bad: false });
    const res = await emailPsfCertificate(docId);
    if (res.status === "ok") setState({ busy: false, note: `Sent to ${res.data.sentTo}`, bad: false });
    else setState({ busy: false, note: apiResultMessage(res), bad: true });
  };
  return (
    <>
      <Button variant="outline" onClick={() => void send()} pending={state.busy} disabled={state.busy}>
        <Mail size={16} aria-hidden /> Email to {to}
      </Button>
      {state.note ? (
        <span role="status" className={["text-sm", state.bad ? "text-destructive" : "text-accent-text"].join(" ")}>
          {state.note}
        </span>
      ) : null}
    </>
  );
}

/** A provider reference is long; its tail is what a person quotes. */
function shortRef(ref: string): string {
  return ref.length > 18 ? `…${ref.slice(-12)}` : ref;
}

function Cell({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="rounded-card bg-secondary/60 p-3">
      <p className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground">{k}</p>
      <p className={["mt-1 text-sm font-semibold", mono ? "font-mono" : ""].join(" ")}>{v}</p>
    </div>
  );
}
