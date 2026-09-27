"use client";

/**
 * A business's PSF membership (ADR-056 AC-15 to AC-17).
 *
 * Opens at every registration stage, for the owner (and an on behalf agent
 * until the owner claims), because the server's applicant rule decides who
 * sees it, never a permission. Shows the membership the business holds, the
 * application it has open and where that application stands, every earlier
 * application with its decision, and the form to apply again.
 */
import { useCallback, useEffect, useState } from "react";

import {
  PSF_APPLICATION_STAGE_LABEL,
  PSF_APPLICATION_STATUS_LABEL,
  PSF_DECLINE_REASON_LABEL,
  PSF_FEE_NOTICE,
  PSF_MEMBERSHIP_SOURCE_LABEL,
  type PsfApplication,
  type PsfApplicationInput,
  type PsfMembershipOverview,
  type PsfTier,
} from "@injishi/contracts";
import { formatPrice } from "@injishi/utils";

import { ConfirmAction } from "../components/confirm-action";
import { priceOf, PsfApplicationForm } from "../components/psf-application-form";
import { ActionButton, Badge, EmptyState, LoadFailed, surfaceClass } from "../components/ui";
import { humanError } from "../data/api";
import { useWorkspaceId } from "../data/capability";
import { applyForPsf, fetchPsfMembership, fetchPsfTiers, withdrawPsfApplication } from "../data/psf";
import { usePms } from "../store";
import { cn } from "@/lib/utils";

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Kigali" }).format(
    new Date(iso),
  );
}

const STATUS_INTENT = { submitted: "info", member: "ok", declined: "bad", withdrawn: "neutral" } as const;

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
  if (!overview) return <div className={cn(surfaceClass, "h-40 animate-pulse")} />;

  const apply = async (input: PsfApplicationInput) => {
    setBusy(true);
    setRefusal(null);
    try {
      setOverview(await applyForPsf(orgId, input));
      setApplying(false);
    } catch (error) {
      setRefusal(humanError(error));
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
      <PsfApplicationForm
        tiers={tiers}
        prefill={overview.prefill}
        registrationNumber={overview.registrationNumber}
        submitting={busy}
        refusal={refusal}
        onSubmit={(input) => void apply(input)}
        onCancel={() => {
          setApplying(false);
          setRefusal(null);
        }}
      />
    );
  }

  const { current, open, history } = overview;

  return (
    <div className="flex flex-col gap-5">
      {current && (
        <section className={cn(surfaceClass, "flex flex-col gap-2 p-4")}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="pms-display text-lg font-bold text-ink">PSF member</h2>
            <Badge intent={current.source === "psf_confirmed" ? "ok" : "neutral"}>
              {PSF_MEMBERSHIP_SOURCE_LABEL[current.source]}
            </Badge>
          </div>
          <p className="text-sm text-ink">
            {current.tierName ?? "Membership"} · number {current.membershipNumber}
          </p>
          {current.startsOn && current.expiresOn && (
            <p className="text-xs text-muted-foreground">
              Valid {current.startsOn} to {current.expiresOn}
              {current.annualFeeRwf !== null ? ` · ${formatPrice(current.annualFeeRwf)} a year` : ""}
            </p>
          )}
        </section>
      )}

      {open ? (
        <section className={cn(surfaceClass, "flex flex-col gap-3 p-4")}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="pms-display text-lg font-bold text-ink">Your application</h2>
            <Badge intent={open.stage === "with_psf" ? "info" : "warn"}>{PSF_APPLICATION_STAGE_LABEL[open.stage]}</Badge>
          </div>
          <p className="text-sm text-ink">
            {open.requestedTierName} · {priceOf({
              priceKind: open.quotedPriceKind,
              annualFeeRwf: open.quotedFeeRwf,
              annualFeeMinRwf: open.quotedFeeMinRwf,
              annualFeeMaxRwf: open.quotedFeeMaxRwf,
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            Sent {shortDate(open.submittedAt)}
            {open.submittedCapacity === "on_behalf_of" && open.submittedByName
              ? ` on your behalf by ${open.submittedByName}`
              : ""}
            .{" "}
            {open.stage === "with_psf"
              ? "A PSF membership officer will review it."
              : "It goes to PSF once the Rwanda Revenue Authority has checked your TIN."}
          </p>
          <p className="text-xs text-muted-foreground">{PSF_FEE_NOTICE}</p>
          <div>
            <ConfirmAction
              confirmLabel="Yes, withdraw this application"
              pending={busy}
              onConfirm={() => void withdraw(open.id)}
            >
              {busy ? "Withdrawing" : "Withdraw"}
            </ConfirmAction>
          </div>
        </section>
      ) : overview.canApply ? (
        <section className={cn(surfaceClass, "flex flex-col gap-3 p-4")}>
          <h2 className="pms-display text-lg font-bold text-ink">
            {current ? "Renew or change your membership" : "Join the Private Sector Federation"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Apply here and a PSF membership officer reviews it. Most of the form is filled in from your registration.
          </p>
          <div>
            <ActionButton variant="primary" className="h-11" onClick={() => setApplying(true)}>
              Apply for PSF membership
            </ActionButton>
          </div>
        </section>
      ) : (
        !current && <EmptyState>PSF membership applications are not open yet.</EmptyState>
      )}

      {refusal && !applying && <p className="rounded border border-bad bg-bad-bg px-3.5 py-3 text-xs text-bad">{refusal}</p>}

      {history.length > 0 && (
        <section>
          <h3 className="mb-2 text-2xs font-bold uppercase tracking-wide text-muted-foreground">Earlier applications</h3>
          <div className="flex flex-col gap-2">
            {history.map((a) => (
              <HistoryRow key={a.id} application={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

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
      {a.declineReason && (
        <span className="text-xs text-ink">
          {PSF_DECLINE_REASON_LABEL[a.declineReason]}
          {a.decisionNote ? `: ${a.decisionNote}` : ""}
        </span>
      )}
    </div>
  );
}
