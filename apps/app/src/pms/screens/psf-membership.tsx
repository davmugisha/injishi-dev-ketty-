"use client";

/**
 * A business's PSF membership, its portal on Injishi (ADR-056 AC-15 to AC-17,
 * and the PSF path).
 *
 * Opens at every registration stage, for the owner (and an on behalf agent
 * until the owner claims), because the server's applicant rule decides who
 * sees it, never a permission.
 *
 * Read top down it answers, in order: who PSF knows this business as (its
 * code, its sector, who owns it), where its membership stands (a three step
 * track: applied, approved, paid), what to do next (apply, wait, or pay), and
 * what happened before. Paying is here too: once PSF approves, the fee is paid
 * by mobile money on this page and the membership starts that day.
 */
import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Building2, Check, Copy, Hash, MapPin, Smartphone, Users } from "lucide-react";

import {
  ENTERPRISE_REGISTRATION_KIND_LABEL,
  PSF_APPLICATION_STATUS_LABEL,
  PSF_DECLINE_REASON_LABEL,
  PSF_FAMILY_LABEL,
  PSF_MEMBERSHIP_SOURCE_LABEL,
  PSF_OFFERED_FAMILIES,
  PSF_OWNER_GROUP_LABEL,
  type PsfApplication,
  type PsfApplicationInput,
  type PsfMembershipOverview,
  type PsfTier,
} from "@injishi/contracts";
import { Input } from "@injishi/ui";
import { formatPrice } from "@injishi/utils";

import { ConfirmAction } from "../components/confirm-action";
import { priceOf, PsfApplicationForm } from "../components/psf-application-form";
import { ActionButton, Badge, EmptyState, LoadFailed, surfaceClass } from "../components/ui";
import { humanError } from "../data/api";
import { useWorkspaceId } from "../data/capability";
import {
  applyForPsf,
  fetchPsfMembership,
  fetchPsfTiers,
  isPaymentPending,
  payPsfMembership,
  refusalField,
  withdrawPsfApplication,
} from "../data/psf";
import { usePms } from "../store";
import { cn } from "@/lib/utils";

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Kigali" }).format(
    new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso),
  );
}

const STATUS_INTENT = { submitted: "info", approved: "warn", member: "ok", declined: "bad", withdrawn: "neutral" } as const;

/** What PSF's form is filed under, in words. */
function registrationLabel(overview: PsfMembershipOverview): string {
  const kind = overview.profile.registrationKind;
  const n = overview.registrationNumber;
  if (kind === null || kind === "tin") return n ? `TIN ${n}` : "No TIN on record";
  if (kind === "none") return ENTERPRISE_REGISTRATION_KIND_LABEL.none;
  return `${kind === "other" ? "Registration" : kind.toUpperCase()} ${n}`;
}

export function PsfMembership() {
  const { state } = usePms();
  const workspaceId = useWorkspaceId();
  const orgId = state.grants?.find((g) => g.workspaceId === workspaceId)?.orgId ?? null;

  const [overview, setOverview] = useState<PsfMembershipOverview | null>(null);
  const [tiers, setTiers] = useState<PsfTier[]>([]);
  const [failed, setFailed] = useState<number | null>(null);
  const [applying, setApplying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [fieldRefusal, setFieldRefusal] = useState<{ path: string; message: string } | null>(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    setFailed(null);
    const [o, t] = await Promise.all([fetchPsfMembership(orgId), fetchPsfTiers()]);
    if (o.outcome !== "ok") {
      setFailed(o.outcome === "failed" ? o.status : 401);
      return;
    }
    setOverview(o.data);
    if (t.outcome === "ok") setTiers(t.data);
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!orgId) return <EmptyState>This workspace has no business behind it.</EmptyState>;
  if (failed === 403 || failed === 422) {
    return <EmptyState>Only the business&apos;s owner can see its PSF membership.</EmptyState>;
  }
  if (failed !== null) {
    return <LoadFailed onRetry={() => void load()}>We couldn&apos;t load your PSF membership.</LoadFailed>;
  }
  if (!overview) {
    return (
      <div className="flex flex-col gap-4">
        <div className={cn(surfaceClass, "h-32 animate-pulse")} />
        <div className={cn(surfaceClass, "h-48 animate-pulse")} />
      </div>
    );
  }

  const apply = async (input: PsfApplicationInput) => {
    setBusy(true);
    setRefusal(null);
    setFieldRefusal(null);
    try {
      setOverview(await applyForPsf(orgId, input));
      setApplying(false);
    } catch (error) {
      setRefusal(humanError(error));
      setFieldRefusal(refusalField(error));
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (applicationId: string) => {
    setBusy(true);
    setRefusal(null);
    try {
      setOverview(await withdrawPsfApplication(orgId, applicationId));
    } catch (error) {
      setRefusal(humanError(error));
    } finally {
      setBusy(false);
    }
  };

  if (applying) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <div>
          <p className="text-2xs font-bold tracking-wide text-muted-foreground uppercase">Private Sector Federation</p>
          <h1 className="pms-display text-2xl font-bold text-ink">Apply for membership</h1>
        </div>
        <PsfApplicationForm
          tiers={tiers}
          prefill={overview.prefill}
          registrationLabel={registrationLabel(overview)}
          submitting={busy}
          refusal={refusal}
          refusalField={fieldRefusal}
          onSubmit={(input) => void apply(input)}
          onCancel={() => {
            setApplying(false);
            setRefusal(null);
            setFieldRefusal(null);
          }}
        />
      </div>
    );
  }

  const { current, open, history } = overview;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <BusinessCard overview={overview} />

      {open ? (
        <OpenApplication
          orgId={orgId}
          overview={overview}
          application={open}
          busy={busy}
          onOverview={setOverview}
          onWithdraw={() => void withdraw(open.id)}
        />
      ) : current ? (
        <MemberCard overview={overview} canRenew={overview.canApply} onRenew={() => setApplying(true)} />
      ) : overview.canApply ? (
        <JoinCard tiers={tiers} onApply={() => setApplying(true)} />
      ) : (
        <EmptyState>PSF membership applications are not open yet.</EmptyState>
      )}

      {open && current && <MemberCard overview={overview} canRenew={false} onRenew={() => undefined} />}

      {refusal && <p className="rounded border border-bad bg-bad-bg px-3.5 py-3 text-xs text-bad">{refusal}</p>}

      {history.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-2xs font-bold tracking-wide text-muted-foreground uppercase">Earlier applications</h3>
          {history.map((a) => (
            <HistoryRow key={a.id} application={a} />
          ))}
        </section>
      )}
    </div>
  );
}

/* ── Who PSF knows this business as ─────────────────────────────────────── */

function BusinessCard({ overview }: { overview: PsfMembershipOverview }) {
  const { profile } = overview;
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!profile.businessCode) return;
    try {
      await navigator.clipboard.writeText(profile.businessCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // A browser that refuses the clipboard still shows the code to copy by hand.
    }
  };
  return (
    <section className={cn(surfaceClass, "flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between")}>
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-2xs font-bold tracking-wide text-muted-foreground uppercase">Your business with PSF</p>
        <h1 className="pms-display truncate text-2xl font-bold text-ink">{overview.prefill.companyName ?? "Your business"}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink2">
          {(profile.clusterName || profile.associationName) && (
            <span className="flex items-center gap-1.5">
              <Building2 aria-hidden="true" className="size-4 text-muted-foreground" />
              {[profile.clusterName, profile.associationName].filter(Boolean).join(" · ")}
            </span>
          )}
          {profile.districtName && (
            <span className="flex items-center gap-1.5">
              <MapPin aria-hidden="true" className="size-4 text-muted-foreground" />
              {profile.districtName}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Hash aria-hidden="true" className="size-4 text-muted-foreground" />
            {registrationLabel(overview)}
          </span>
        </div>
        {profile.ownerGroups.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {profile.ownerGroups.map((g) => (
              <Badge key={g} intent="accent" icon={Users}>
                {PSF_OWNER_GROUP_LABEL[g]}
              </Badge>
            ))}
          </div>
        )}
      </div>
      {profile.businessCode && (
        <div className="flex shrink-0 flex-col items-start gap-1 rounded-card border border-accent-text/30 bg-accent-soft px-4 py-3 sm:items-end">
          <span className="text-2xs font-bold tracking-wide text-accent-text uppercase">Business code</span>
          <span className="pms-num text-2xl font-bold tracking-wider text-ink">{profile.businessCode}</span>
          <button
            type="button"
            onClick={() => void copy()}
            className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-accent-text"
          >
            {copied ? <Check aria-hidden="true" className="size-3.5" /> : <Copy aria-hidden="true" className="size-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
    </section>
  );
}

/* ── Where an application stands ──────────────────────────────────────────── */

const STEPS = [
  { key: "applied", label: "Applied", hint: "PSF reviews it" },
  { key: "approved", label: "Approved", hint: "You pay the fee" },
  { key: "member", label: "Member", hint: "A year from payment" },
] as const;

function Track({ at }: { at: 0 | 1 | 2 }) {
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Where your membership stands">
      {STEPS.map((s, i) => {
        const done = i < at;
        const now = i === at;
        return (
          <li key={s.key} className="flex flex-col gap-1.5" aria-current={now ? "step" : undefined}>
            <span className={cn("h-1.5 rounded-full", done ? "bg-ok" : now ? "bg-accent" : "bg-line2")} />
            <span className={cn("flex items-center gap-1 text-xs font-bold", done ? "text-ok" : now ? "text-accent-text" : "text-muted-foreground")}>
              {done && <Check aria-hidden="true" className="size-3.5" strokeWidth={2.6} />}
              {s.label}
            </span>
            <span className="text-2xs text-muted-foreground">{s.hint}</span>
          </li>
        );
      })}
    </ol>
  );
}

function OpenApplication({
  orgId,
  overview,
  application: open,
  busy,
  onOverview,
  onWithdraw,
}: {
  orgId: string;
  overview: PsfMembershipOverview;
  application: NonNullable<PsfMembershipOverview["open"]>;
  busy: boolean;
  onOverview: (o: PsfMembershipOverview) => void;
  onWithdraw: () => void;
}) {
  const approved = open.stage === "awaiting_payment";
  return (
    <section className={cn(surfaceClass, "flex flex-col gap-5 p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="pms-display text-lg font-bold text-ink">
            {approved ? "PSF approved your application" : "Your application is with PSF"}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {open.requestedTierName}
            {open.declaredFeeRwf !== null ? ` · ${formatPrice(open.declaredFeeRwf)} a year` : ` · ${priceOf({
              priceKind: open.quotedPriceKind,
              annualFeeRwf: open.quotedFeeRwf,
              annualFeeMinRwf: open.quotedFeeMinRwf,
              annualFeeMaxRwf: open.quotedFeeMaxRwf,
            })}`}
            {" · sent "}
            {shortDate(open.submittedAt)}
            {open.submittedCapacity === "on_behalf_of" && open.submittedByName ? ` on your behalf by ${open.submittedByName}` : ""}
          </p>
        </div>
        <Badge intent={approved ? "warn" : open.stage === "with_psf" ? "info" : "neutral"}>
          {approved ? "Waiting for your payment" : open.stage === "with_psf" ? "With PSF" : "Waiting for your TIN check"}
        </Badge>
      </div>

      <Track at={approved ? 1 : 0} />

      {approved ? (
        <PayPanel orgId={orgId} overview={overview} application={open} onOverview={onOverview} />
      ) : (
        <p className="text-sm text-ink2">
          {open.stage === "with_psf"
            ? "A PSF District Manager is reviewing it. We email you the moment they decide, and you pay only once they approve."
            : "It goes to PSF as soon as the Rwanda Revenue Authority has checked your TIN. You do not need to do anything."}
        </p>
      )}

      <div className="border-t border-line pt-3">
        <ConfirmAction confirmLabel="Yes, withdraw this application" pending={busy} onConfirm={onWithdraw}>
          {busy ? "Withdrawing" : "Withdraw application"}
        </ConfirmAction>
      </div>
    </section>
  );
}

/** Pay an approved application by mobile money. The amount is PSF's approval, never typed. */
function PayPanel({
  orgId,
  overview,
  application: open,
  onOverview,
}: {
  orgId: string;
  overview: PsfMembershipOverview;
  application: NonNullable<PsfMembershipOverview["open"]>;
  onOverview: (o: PsfMembershipOverview) => void;
}) {
  const [phone, setPhone] = useState(overview.prefill.phoneE164 ?? "+250");
  const [paying, setPaying] = useState(false);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const amount = open.approvedFeeRwf ?? 0;

  const pay = async () => {
    setPaying(true);
    setProblem(null);
    try {
      onOverview(await payPsfMembership(orgId, open.id, { phoneE164: phone }));
    } catch (error) {
      if (isPaymentPending(error)) setPending(true);
      else setProblem(humanError(error));
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="grid gap-4 rounded-card border border-warn/40 bg-warn-bg/40 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-2xs font-bold tracking-wide text-muted-foreground uppercase">To pay</dt>
          <dd className="pms-num text-xl font-bold text-ink">{formatPrice(amount)}</dd>
        </div>
        <div>
          <dt className="text-2xs font-bold tracking-wide text-muted-foreground uppercase">Membership number</dt>
          <dd className="pms-num font-semibold text-ink">{open.approvedMembershipNumber}</dd>
        </div>
        <div>
          <dt className="text-2xs font-bold tracking-wide text-muted-foreground uppercase">Valid for</dt>
          <dd className="font-semibold text-ink">A year from today</dd>
        </div>
      </dl>
      <div className="flex flex-col gap-2 sm:w-72">
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink">
          Mobile money number
          <span className="relative">
            <Smartphone aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pms-num pl-9" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </span>
        </label>
        <ActionButton variant="primary" className="h-11" disabled={paying} onClick={() => void pay()}>
          {paying ? "Sending the prompt" : pending ? "Check payment" : `Pay ${formatPrice(amount)}`}
        </ActionButton>
      </div>
      {pending && (
        <p className="text-xs text-ink2 sm:col-span-2">
          We sent a payment prompt to {phone}. Approve it on your phone with your PIN, then press Check payment.
        </p>
      )}
      {problem && <p className="text-xs text-bad sm:col-span-2">{problem}</p>}
      <p className="text-2xs text-muted-foreground sm:col-span-2">The fee goes to PSF. Injishi keeps none of it.</p>
    </div>
  );
}

/* ── A member ──────────────────────────────────────────────────────────────── */

function MemberCard({
  overview,
  canRenew,
  onRenew,
}: {
  overview: PsfMembershipOverview;
  canRenew: boolean;
  onRenew: () => void;
}) {
  const current = overview.current;
  if (!current) return null;
  const daysLeft = current.expiresOn
    ? Math.ceil((new Date(`${current.expiresOn}T23:59:59+02:00`).getTime() - Date.now()) / 86_400_000)
    : null;
  return (
    <section className={cn(surfaceClass, "flex flex-col gap-4 p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-ok-bg text-ok">
            <BadgeCheck className="size-5" strokeWidth={2} />
          </span>
          <div>
            <h2 className="pms-display text-lg font-bold text-ink">You are a PSF member</h2>
            <p className="text-sm text-muted-foreground">{current.tierName ?? "Membership"}</p>
          </div>
        </div>
        <Badge intent={current.source === "psf_confirmed" ? "ok" : "neutral"}>{PSF_MEMBERSHIP_SOURCE_LABEL[current.source]}</Badge>
      </div>
      <Track at={2} />
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
        <Fact label="Membership number" value={current.membershipNumber} mono />
        {current.annualFeeRwf !== null && <Fact label="Paid a year" value={formatPrice(current.annualFeeRwf)} mono />}
        {current.startsOn && <Fact label="Member since" value={shortDate(current.startsOn)} />}
        {current.expiresOn && (
          <Fact
            label="Renew by"
            value={`${shortDate(current.expiresOn)}${daysLeft !== null && daysLeft <= 30 && daysLeft >= 0 ? ` · ${daysLeft} days` : ""}`}
            tone={daysLeft !== null && daysLeft <= 30 ? "warn" : undefined}
          />
        )}
      </dl>
      {canRenew && (
        <div className="border-t border-line pt-3">
          <ActionButton onClick={onRenew}>Renew or change your membership</ActionButton>
        </div>
      )}
    </section>
  );
}

function Fact({ label, value, mono, tone }: { label: string; value: string; mono?: boolean; tone?: "warn" }) {
  return (
    <div>
      <dt className="text-2xs font-bold tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className={cn("font-semibold", mono && "pms-num", tone === "warn" ? "text-warn" : "text-ink")}>{value}</dd>
    </div>
  );
}

/* ── Not yet applied ───────────────────────────────────────────────────────── */

function JoinCard({ tiers, onApply }: { tiers: PsfTier[]; onApply: () => void }) {
  const families = PSF_OFFERED_FAMILIES.map((f) => ({ f, group: tiers.filter((t) => t.family === f) })).filter((x) => x.group.length > 0);
  return (
    <section className={cn(surfaceClass, "flex flex-col gap-4 p-5")}>
      <div>
        <h2 className="pms-display text-lg font-bold text-ink">Join the Private Sector Federation</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose the membership your business can afford. PSF reviews your application, and you pay here by mobile money once
          it is approved. Most of the form is already filled in from your registration.
        </p>
      </div>
      <Track at={0} />
      {families.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-3">
          {families.map(({ f, group }) => {
            const low = Math.min(...group.map((t) => t.annualFeeMinRwf ?? t.annualFeeRwf ?? Number.MAX_SAFE_INTEGER));
            return (
              <li key={f} className="rounded-card border border-line2 bg-field px-3.5 py-3">
                <p className="text-sm font-bold text-ink">{PSF_FAMILY_LABEL[f]}</p>
                <p className="pms-num text-xs text-muted-foreground">
                  {low === Number.MAX_SAFE_INTEGER ? "Price set by PSF" : `From ${formatPrice(low)} a year`}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      <div>
        <ActionButton variant="primary" className="h-11" onClick={onApply}>
          Apply for PSF membership
        </ActionButton>
      </div>
    </section>
  );
}

/* ── What happened before ──────────────────────────────────────────────────── */

function HistoryRow({ application: a }: { application: PsfApplication }) {
  return (
    <div className={cn(surfaceClass, "flex flex-col gap-1 px-4 py-3")}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-ink">{a.requestedTierName}</span>
        <Badge intent={STATUS_INTENT[a.status]}>{PSF_APPLICATION_STATUS_LABEL[a.status]}</Badge>
      </div>
      <span className="text-xs text-muted-foreground">
        Sent {shortDate(a.submittedAt)}
        {a.decidedAt ? `, decided ${shortDate(a.decidedAt)}` : ""}
        {a.withdrawnAt ? `, withdrawn ${shortDate(a.withdrawnAt)}` : ""}
      </span>
      {a.payment && (
        <span className="pms-num text-xs text-ink2">
          Paid {formatPrice(a.payment.amountRwf)} on {shortDate(a.payment.paidAt)} · reference {a.payment.reference}
        </span>
      )}
      {a.declineReason && (
        <span className="text-xs text-ink">
          {PSF_DECLINE_REASON_LABEL[a.declineReason]}
          {a.decisionNote ? `: ${a.decisionNote}` : ""}
        </span>
      )}
    </div>
  );
}
