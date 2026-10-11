"use client";

/**
 * The PSF Membership console's queue (ADR-056 AC-10 to AC-14).
 *
 * One national queue, oldest first, 25 a page. Opening an application shows
 * the form exactly as the business filed it; the officer marks it a member
 * (tier, number, fee and dates) or declines it with a reason the business
 * reads. Both are final, so each asks once and waits for the server before the
 * application leaves the list.
 *
 * An application whose business the officer holds a role in is listed, and
 * says so, and cannot be decided here (AC-14): another officer must.
 */
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  COUNTRIES,
  PSF_COMPANY_TYPE_LABEL,
  PSF_CONTACT_ROLE_LABEL,
  PSF_DECLINE_REASON_LABEL,
  PSF_OWN_BUSINESS_MESSAGE,
  PSF_OWNERSHIP_LABEL,
  PSF_TRADE_DIRECTION_LABEL,
  PsfDeclineReason,
  defaultPsfMembershipDates,
  type OrgRegistrationStatus,
  type PsfOfficerApplication,
  type PsfQueueItem,
  type PsfTier,
} from "@injishi/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Textarea,
} from "@injishi/ui";
import { formatPrice } from "@injishi/utils";

import { LoadFailed } from "../../components/ui";
import { humanError } from "../../data/api";
import {
  declinePsfApplication,
  fetchPsfApplication,
  fetchPsfQueue,
  fetchPsfTiers,
  markPsfMember,
} from "../../data/psf";
import type { QueuedToast } from "../../lib/toast-queue";
import { ActionButton, Badge, EmptyState, Skeleton, surfaceClass } from "../components/ui";
import { MembershipShell } from "../components/membership-shell";
import { cn } from "@/lib/utils";

const selectClass =
  "h-10 w-full rounded border border-line2 bg-field px-2 text-sm text-foreground disabled:opacity-50";

const STAGE_LABEL: Partial<Record<OrgRegistrationStatus, string>> = {
  tin_verified: "TIN checked",
  field_verified: "Field verified",
  approved: "Approved",
  active: "Active",
};

/** Today, as a date in Kigali, which is the date PSF's paperwork uses. */
function todayInKigali(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kigali" }).format(new Date());
}

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Kigali" }).format(
    new Date(iso),
  );
}

function countryName(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

export function MembershipQueue() {
  const [items, setItems] = useState<PsfQueueItem[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [toasts, setToasts] = useState<QueuedToast[]>([]);
  const [tiers, setTiers] = useState<PsfTier[]>([]);

  const [selId, setSelId] = useState<string | null>(null);
  const [sel, setSel] = useState<PsfOfficerApplication | null>(null);
  const [deciding, setDeciding] = useState<"member" | "decline" | null>(null);
  const [acting, setActing] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  const toast = useCallback((txt: string, intent: QueuedToast["intent"] = "ok") => {
    setToasts((t) => [...t, { id: Date.now() + Math.random(), txt, intent }]);
  }, []);

  const load = useCallback(async () => {
    setLoadFailed(false);
    const res = await fetchPsfQueue(null);
    if (res.outcome !== "ok") {
      setLoadFailed(true);
      return;
    }
    setItems(res.data.items);
    setNextCursor(res.data.nextCursor);
  }, []);

  useEffect(() => {
    void load();
    void fetchPsfTiers().then((res) => {
      if (res.outcome === "ok") setTiers(res.data);
    });
  }, [load]);

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    const res = await fetchPsfQueue(nextCursor);
    setLoadingMore(false);
    if (res.outcome !== "ok") {
      toast("We couldn't load more applications. Try again.", "bad");
      return;
    }
    setItems((prev) => [...(prev ?? []), ...res.data.items]);
    setNextCursor(res.data.nextCursor);
  };

  useEffect(() => {
    if (!selId) {
      setSel(null);
      return;
    }
    let live = true;
    void fetchPsfApplication(selId).then((res) => {
      if (!live) return;
      if (res.outcome === "ok") setSel(res.data);
      else {
        toast("That application is no longer in the queue.", "warn");
        setSelId(null);
      }
    });
    return () => {
      live = false;
    };
  }, [selId, toast]);

  /** A decided application leaves the list, and the sheet closes, only after the server agreed. */
  const settle = (applicationId: string, message: string) => {
    setItems((prev) => (prev ?? []).filter((i) => i.applicationId !== applicationId));
    setDeciding(null);
    setSelId(null);
    toast(message);
  };

  return (
    <MembershipShell title="Membership queue" queued={items?.length ?? null} toasts={toasts}>
      {loadFailed ? (
        <LoadFailed onRetry={() => void load()}>We couldn't load the membership queue.</LoadFailed>
      ) : items === null ? (
        <div className="flex flex-col gap-3">
          <Skeleton height={76} />
          <Skeleton height={76} delay={80} />
          <Skeleton height={76} delay={160} />
        </div>
      ) : items.length === 0 ? (
        <EmptyState>
          No applications are waiting. A business&apos;s application arrives here once the Rwanda Revenue
          Authority has checked its TIN.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((item) => (
            <Button
              key={item.applicationId}
              variant="ghost"
              onClick={() => setSelId(item.applicationId)}
              className={cn(surfaceClass, "h-auto w-full justify-between gap-4 px-4 py-3.5 text-left hover:bg-hover")}
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{item.businessName}</span>
                <span className="block text-xs text-muted-foreground">
                  {item.districtName ?? "District not recorded"} · asked for {item.requestedTierName} · sent{" "}
                  {shortDate(item.submittedAt)}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {!item.canDecide && <Badge intent="warn">Your business</Badge>}
                <Badge intent="neutral">{STAGE_LABEL[item.registrationStatus] ?? item.registrationStatus}</Badge>
              </span>
            </Button>
          ))}
          {nextCursor && (
            <ActionButton className="self-start" onClick={() => void loadMore()} disabled={loadingMore}>
              {loadingMore ? "Loading" : "Load more"}
            </ActionButton>
          )}
        </div>
      )}

      <Sheet open={!!selId} onOpenChange={(open) => !open && !acting && setSelId(null)}>
        <SheetContent className="w-full gap-0 scrollbar overflow-y-auto border-panel-bd bg-panel sm:max-w-narrow">
          {!sel ? (
            <div className="p-6">
              <Skeleton height={220} />
            </div>
          ) : (
            <>
              <SheetHeader className="gap-2 border-b border-line">
                <SheetTitle className="pms-display text-xl font-bold text-ink">{sel.businessName}</SheetTitle>
                <p className="text-xs text-muted-foreground">
                  Asked for {sel.requestedTierName}, sent {shortDate(sel.submittedAt)}
                  {sel.submittedCapacity === "on_behalf_of" && sel.submittedByName
                    ? `, on the owner's behalf by ${sel.submittedByName}`
                    : ""}
                </p>
              </SheetHeader>
              <div className="flex flex-col gap-5 p-5">
                <FormSection title="Member profile">
                  <Row label="Company" value={sel.form.companyName} />
                  <Row label="Registration" value={`TIN ${sel.form.registrationNumber}`} />
                  <Row label="Website" value={sel.form.website ?? "None given"} />
                  <Row label="Street address" value={sel.form.streetAddress} />
                  <Row label="District" value={sel.districtName ?? "Not recorded"} />
                  <Row label="Company type" value={PSF_COMPANY_TYPE_LABEL[sel.form.companyType]} />
                  <Row
                    label="Ownership"
                    value={
                      sel.form.ownership === "other"
                        ? `Other: ${sel.form.ownershipOther ?? ""}`
                        : PSF_OWNERSHIP_LABEL[sel.form.ownership]
                    }
                  />
                  <Row label="Business activity" value={sel.form.businessActivity} />
                  <Row
                    label="Export or import"
                    value={
                      sel.form.tradeDirection === "none"
                        ? "No"
                        : `${PSF_TRADE_DIRECTION_LABEL[sel.form.tradeDirection]}: ${sel.form.tradeGoods ?? ""} (${sel.form.tradeCountries.map(countryName).join(", ")})`
                    }
                  />
                </FormSection>
                <FormSection title="Personnel">
                  <Row label="Role" value={PSF_CONTACT_ROLE_LABEL[sel.form.contactRole]} />
                  <Row label="Name" value={`${sel.form.firstName} ${sel.form.lastName}`} />
                  <Row label="Gender" value={sel.form.gender === "female" ? "Female" : "Male"} />
                  <Row label="Phone" value={sel.form.phoneE164} />
                  <Row label="Email" value={sel.form.email} />
                  <Row
                    label={sel.form.idDocumentType === "passport" ? "Passport" : "National ID"}
                    value={sel.form.idDocumentNumber}
                  />
                  <Row label="Date of birth" value={sel.form.dateOfBirth} />
                </FormSection>
                <FormSection title="Tier asked for">
                  <Row label="Tier" value={sel.requestedTierName} />
                  <Row label="Price shown" value={quoted(sel)} />
                </FormSection>

                {!sel.canDecide && (
                  <p className="rounded border border-warn bg-warn-bg px-3.5 py-3 text-xs text-warn">
                    {PSF_OWN_BUSINESS_MESSAGE}
                  </p>
                )}

                <div className="flex flex-wrap gap-2.5">
                  <ActionButton
                    variant="primary"
                    className="h-11"
                    deniedReason={sel.canDecide ? undefined : PSF_OWN_BUSINESS_MESSAGE}
                    onClick={() => {
                      setRefusal(null);
                      setDeciding("member");
                    }}
                  >
                    Mark as member
                  </ActionButton>
                  <ActionButton
                    className="h-11"
                    deniedReason={sel.canDecide ? undefined : PSF_OWN_BUSINESS_MESSAGE}
                    onClick={() => {
                      setRefusal(null);
                      setDeciding("decline");
                    }}
                  >
                    Decline
                  </ActionButton>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {sel && deciding === "member" && (
        <MemberDialog
          application={sel}
          tiers={tiers}
          acting={acting}
          refusal={refusal}
          onClose={() => !acting && setDeciding(null)}
          onSubmit={async (body) => {
            setActing(true);
            setRefusal(null);
            try {
              await markPsfMember(sel.id, body);
              settle(sel.id, `${sel.businessName} is now a PSF member.`);
            } catch (error) {
              setRefusal(humanError(error));
            } finally {
              setActing(false);
            }
          }}
        />
      )}

      {sel && deciding === "decline" && (
        <DeclineDialog
          businessName={sel.businessName}
          acting={acting}
          refusal={refusal}
          onClose={() => !acting && setDeciding(null)}
          onSubmit={async (body) => {
            setActing(true);
            setRefusal(null);
            try {
              await declinePsfApplication(sel.id, body);
              settle(sel.id, `${sel.businessName}'s application was declined.`);
            } catch (error) {
              setRefusal(humanError(error));
            } finally {
              setActing(false);
            }
          }}
        />
      )}
    </MembershipShell>
  );
}

function quoted(app: PsfOfficerApplication): string {
  if (app.quotedPriceKind === "fixed" && app.quotedFeeRwf !== null) return `${formatPrice(app.quotedFeeRwf)} a year`;
  if (app.quotedPriceKind === "range" && app.quotedFeeMinRwf !== null && app.quotedFeeMaxRwf !== null) {
    return `${formatPrice(app.quotedFeeMinRwf)} to ${formatPrice(app.quotedFeeMaxRwf)} a year`;
  }
  return "Set by PSF";
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-2xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <dl className={cn(surfaceClass, "divide-y divide-line")}>{children}</dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 px-3.5 py-2.5">
      <dt className="w-36 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-ink">{value}</dd>
    </div>
  );
}

function MemberDialog({
  application,
  tiers,
  acting,
  refusal,
  onClose,
  onSubmit,
}: {
  application: PsfOfficerApplication;
  tiers: PsfTier[];
  acting: boolean;
  refusal: string | null;
  onClose: () => void;
  onSubmit: (body: {
    tierCode: string;
    membershipNumber: string;
    annualFeeRwf: number;
    startsOn: string;
    expiresOn: string;
  }) => void;
}) {
  const defaults = useMemo(() => defaultPsfMembershipDates(todayInKigali()), []);
  const [tierCode, setTierCode] = useState(application.requestedTierCode);
  const tier = tiers.find((t) => t.code === tierCode);
  const [fee, setFee] = useState<string>(
    String(tier?.annualFeeRwf ?? application.quotedFeeRwf ?? ""),
  );
  const [membershipNumber, setMembershipNumber] = useState("");
  const [startsOn, setStartsOn] = useState(defaults.startsOn);
  const [expiresOn, setExpiresOn] = useState(defaults.expiresOn);

  const feeNumber = Number(fee.replace(/[\s,]/g, ""));
  const ready =
    membershipNumber.trim().length > 0 && Number.isInteger(feeNumber) && feeNumber > 0 && expiresOn > startsOn;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-panel-bd bg-panel sm:max-w-narrow">
        <DialogHeader>
          <DialogTitle className="pms-display text-lg font-bold text-ink">Mark {application.businessName} as a member</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Record what PSF confirmed. The business is told, and shows as a PSF member from now on.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="text-sm font-semibold text-ink">
            Tier
            <select
              className={cn(selectClass, "mt-1")}
              value={tierCode}
              onChange={(e) => {
                setTierCode(e.target.value);
                const next = tiers.find((t) => t.code === e.target.value);
                if (next?.annualFeeRwf) setFee(String(next.annualFeeRwf));
              }}
            >
              {tiers.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.nameEn}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-ink">
            PSF membership number
            <Input className="mt-1" value={membershipNumber} onChange={(e) => setMembershipNumber(e.target.value)} />
          </label>
          <label className="text-sm font-semibold text-ink">
            Annual fee (RWF)
            <Input className="mt-1" inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-semibold text-ink">
              Starts
              <Input className="mt-1" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
            </label>
            <label className="text-sm font-semibold text-ink">
              Expires
              <Input className="mt-1" type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
            </label>
          </div>
          {refusal && <p className="text-xs text-bad">{refusal}</p>}
        </div>
        <DialogFooter>
          <ActionButton onClick={onClose} disabled={acting}>
            Cancel
          </ActionButton>
          <ActionButton
            variant="primary"
            disabled={!ready || acting}
            onClick={() =>
              onSubmit({ tierCode, membershipNumber: membershipNumber.trim(), annualFeeRwf: feeNumber, startsOn, expiresOn })
            }
          >
            {acting ? "Recording" : "Mark as member"}
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeclineDialog({
  businessName,
  acting,
  refusal,
  onClose,
  onSubmit,
}: {
  businessName: string;
  acting: boolean;
  refusal: string | null;
  onClose: () => void;
  onSubmit: (body: { reason: PsfDeclineReason; note?: string }) => void;
}) {
  const [reason, setReason] = useState<PsfDeclineReason>("details_incomplete");
  const [note, setNote] = useState("");
  const ready = reason !== "other" || note.trim().length > 0;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-panel-bd bg-panel sm:max-w-narrow">
        <DialogHeader>
          <DialogTitle className="pms-display text-lg font-bold text-ink">Decline {businessName}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            The business reads the reason and your note, and can correct it and apply again.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="text-sm font-semibold text-ink">
            Reason
            <select
              className={cn(selectClass, "mt-1")}
              value={reason}
              onChange={(e) => setReason(e.target.value as PsfDeclineReason)}
            >
              {PsfDeclineReason.options.map((code) => (
                <option key={code} value={code}>
                  {PSF_DECLINE_REASON_LABEL[code]}
                </option>
              ))}
            </select>
          </label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={reason === "other" ? "Say why, so the business knows what to fix" : "A note for the business (optional)"}
            aria-label="Note for the business"
          />
          {refusal && <p className="text-xs text-bad">{refusal}</p>}
        </div>
        <DialogFooter>
          <ActionButton onClick={onClose} disabled={acting}>
            Cancel
          </ActionButton>
          <ActionButton
            variant="primary"
            disabled={!ready || acting}
            onClick={() => onSubmit({ reason, ...(note.trim() ? { note: note.trim() } : {}) })}
          >
            {acting ? "Recording" : "Decline"}
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
