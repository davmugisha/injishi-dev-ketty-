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
  PSF_FAMILY_LABEL,
  PSF_OWNER_GROUP_SHORT,
  PSF_TRACK_STAGE_LABEL,
  type PsfPaymentLine,
  type PsfTrackStage,
  type PsfTrackView,
} from "@injishi/contracts";
import { Button } from "@injishi/ui";

import { emailPsfCertificate, fetchPsfTrack, payPsfMembership, payPsfRegistration, psfCertificateUrl, psfLogoSrc } from "@/data/psf";
import { apiResultMessage, retryWhileFailed } from "@/lib/api";

import { QrCode } from "@/components/receipt/qr-code";

import certificateStyles from "./certificate.module.css";

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
};

const TONE: Record<PsfTrackStage, { icon: LucideIcon; ring: string; chip: string }> = {
  fee_due: { icon: Wallet, ring: "ring-warning/40", chip: "bg-warning/15 text-foreground" },
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
                {failedHere ? (view.stage === "declined" ? "Declined" : "Withdrawn") : m.label}
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
                A PSF District Manager is reviewing your application
                {view.waitingDays !== null ? `, waiting ${view.waitingDays === 0 ? "since today" : `${view.waitingDays} day${view.waitingDays === 1 ? "" : "s"}`}` : ""}. Most are decided within a week. We text you the moment they decide.
              </p>
              <p className="mt-3 inline-flex items-start gap-2 text-sm text-muted-foreground">
                <Wallet size={14} aria-hidden className="mt-0.5 shrink-0 text-accent-text" />
                <span>Your membership fee is paid. Approved, you are a member that day.</span>
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
      return <Certificate view={view} />;
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
              onChange={(e) => setLocal(e.target.value.replace(/\D/g, "").replace(/^0/, "").slice(0, 9))}
            />
          </span>
          <Button variant="primary" size="lg" onClick={() => void submit()} pending={busy} disabled={busy}>
            <Wallet size={16} aria-hidden /> {cta}
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

/** The membership certificate: the thing a member shows, printable. */
function Certificate({ view }: { view: PsfTrackView }) {
  const m = view.membership;
  const lapsed = view.stage === "lapsed";
  // The QR opens this page; the origin is only known in the browser.
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  return (
    <section className="flex flex-col gap-4">
      {/* The same paper as the PDF: PSF at the head, the business, the level, three facts, who issued it. */}
      <div className="relative overflow-hidden rounded-card border border-border bg-card shadow-sm print:shadow-none">
        <span aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-36 rounded-full bg-accent-brand/20" />
        <span aria-hidden className="pointer-events-none absolute -right-12 -top-14 size-24 rounded-full bg-accent-brand/40" />
        <span aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 size-44 rounded-full bg-accent-brand/20" />
        <span aria-hidden className="pointer-events-none absolute -bottom-20 -left-20 size-32 rounded-full bg-accent-brand/45" />
        <div className="relative m-3 border border-accent-brand/30 px-5 py-6 sm:m-4 sm:px-10 sm:py-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/assets/partners/psf.png" alt="PSF" className="h-14 w-auto sm:h-16" />
              <div className="leading-tight">
                <p className="font-semibold text-accent-text sm:text-lg">
                  Private Sector
                  <br />
                  Federation
                </p>
                <p className="mt-1 text-2xs uppercase tracking-[0.25em] text-muted-foreground">Beyond advocacy</p>
              </div>
            </div>
            <div className="hidden pr-6 pt-6 text-right text-2xs uppercase tracking-[0.25em] text-muted-foreground sm:block">
              <p>Membership certificate</p>
              <p className="mt-1">docID {view.docId}</p>
              <span className="ml-auto mt-2 block h-px w-12 bg-accent-brand/60" />
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent-text">Private Sector Federation</p>
            <h2 className="mt-3 font-serif text-3xl font-bold tracking-tight text-accent-text sm:text-5xl">Certificate of Membership</h2>
            <p className="mt-6 text-2xs uppercase tracking-[0.3em] text-muted-foreground">This certifies that</p>
            <p className="mt-3 font-serif text-2xl font-bold text-accent-text sm:text-4xl">{view.business.name}</p>
            <span className="mt-4 block h-px w-full max-w-narrow bg-accent-brand/40" />
            <p className="mt-4 text-sm text-muted-foreground">
              {[view.business.code ? `Business code ${view.business.code}` : null, view.business.districtName].filter(Boolean).join("  ·  ")}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">is a member, at the level of</p>
            <p className="mt-1 text-xl font-semibold text-accent-text">{m?.family ? PSF_FAMILY_LABEL[m.family] : view.request.familyName}</p>

            <dl className="mt-8 grid w-full max-w-wide grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <CertFact k="Membership number" v={m?.number ?? "—"} />
              <CertFact k="Valid from" v={day(m?.startsOn)} />
              <CertFact k="Valid until" v={day(m?.expiresOn)} />
            </dl>
            {lapsed ? (
              <p className="mt-6 rounded-full bg-warning/15 px-4 py-1.5 text-sm font-semibold">This membership has ended. Apply again to renew it.</p>
            ) : null}
          </div>

          <div className="mt-10 flex items-end justify-between gap-6">
            <div className="text-center sm:ml-10">
              <p className="text-sm">{day(m?.startsOn)}</p>
              <span className="my-2 block h-px w-44 bg-accent-brand/60" />
              <p className="text-2xs font-semibold uppercase tracking-[0.25em]">Issued by</p>
              <p className="mt-0.5 text-2xs uppercase tracking-[0.15em] text-muted-foreground">{view.reviewingOffice}</p>
            </div>
            {/* The business's own logo, at the foot like the PDF's (2026-10-23). */}
            {view.business.logoUrl ? (
              // Served by the API for this docID; next/image would need it allow-listed for nothing.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={psfLogoSrc(view.business.logoUrl)}
                alt={`${view.business.name} logo`}
                className="max-h-20 w-auto max-w-40 object-contain"
              />
            ) : null}
            <div className="flex flex-col items-center gap-1.5">
              <span className={certificateStyles.qr}>
                {origin ? <QrCode value={`${origin}/psf/track/${view.docId}`} size={72} label={`Verify ${view.docId}`} /> : <span className="size-18" />}
              </span>
              <p className="text-2xs uppercase tracking-[0.2em] text-muted-foreground">Scan to verify</p>
            </div>
          </div>
        </div>
      </div>
      <div className="no-print flex flex-wrap items-center gap-3">
        <Button asChild variant="primary">
          <a href={psfCertificateUrl(view.docId)} download>
            <Download size={16} aria-hidden /> Download PDF
          </a>
        </Button>
        {view.contact.emailMasked ? <EmailCertificate docId={view.docId} to={view.contact.emailMasked} /> : null}
        <Button variant="outline" onClick={() => window.print()}>
          <Printer size={16} aria-hidden /> Print
        </Button>
        {lapsed ? (
          <Button asChild variant="primary">
            <Link href="/psf/register">Renew membership</Link>
          </Button>
        ) : null}
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

function CertFact({ k, v }: { k: string; v: string }) {
  return (
    <div className="px-4 py-3">
      <dt className="text-2xs uppercase tracking-[0.25em] text-muted-foreground">{k}</dt>
      <dd className="mt-1 text-base tabular-nums">{v}</dd>
    </div>
  );
}

function Cell({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="rounded-card bg-secondary/60 p-3">
      <p className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground">{k}</p>
      <p className={["mt-1 text-sm font-semibold", mono ? "font-mono" : ""].join(" ")}>{v}</p>
    </div>
  );
}
