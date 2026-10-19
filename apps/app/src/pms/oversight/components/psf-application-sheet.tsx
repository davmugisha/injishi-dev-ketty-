"use client";

/**
 * One PSF application, as an officer reads and decides it (ADR-056 AC-10 to
 * AC-14, and the PSF path).
 *
 * Opened from the membership queue and from the register of businesses, so it
 * lives here once. It shows the business as PSF knows it (its code, sector,
 * owner groups and registration), the form exactly as filed, and the membership
 * asked for with the amount the business chose. An application with PSF is
 * approved (the officer names PSF's membership number; the business then pays)
 * or declined with a reason the business reads. Both are final, so each asks
 * once and waits for the server before the sheet moves on.
 *
 * An application whose business the officer holds a role in is shown, and
 * says so, and cannot be decided here (AC-14): another officer must.
 */
import { useEffect, useState } from "react";

import {
  COUNTRIES,
  ENTERPRISE_REGISTRATION_KIND_LABEL,
  PSF_COMPANY_TYPE_LABEL,
  PSF_CONTACT_ROLE_LABEL,
  PSF_DECLINE_REASON_LABEL,
  PSF_OWNER_GROUP_LABEL,
  PSF_OWN_BUSINESS_MESSAGE,
  PSF_OWNERSHIP_LABEL,
  PSF_TRADE_DIRECTION_LABEL,
  PsfDeclineReason,
  REGISTRATION_TYPE_SHORT,
  type PsfOfficerApplication,
} from "@injishi/contracts";
import {
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

import { humanError } from "../../data/api";
import { approvePsfApplication, declinePsfApplication, fetchPsfApplication, refusalField } from "../../data/psf";
import { ActionButton, Badge, Skeleton, surfaceClass } from "./ui";
import { cn } from "@/lib/utils";

const selectClass =
  "h-10 w-full rounded border border-line2 bg-field px-2 text-sm text-foreground disabled:opacity-50";

export function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Kigali" }).format(
    new Date(iso),
  );
}

function countryName(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

/** The registration a form was filed under, in words. */
export function registrationOf(app: Pick<PsfOfficerApplication, "form">): string {
  const { registrationType, registrationNumber } = app.form;
  if (registrationType === "none" || !registrationNumber) return ENTERPRISE_REGISTRATION_KIND_LABEL.none;
  return `${REGISTRATION_TYPE_SHORT[registrationType] ?? "Registration"} ${registrationNumber}`;
}

/** The yearly amount an application carries: the business's own, or the price shown. */
export function amountOf(app: PsfOfficerApplication): string {
  if (app.approvedFeeRwf !== null) return `${formatPrice(app.approvedFeeRwf)} a year`;
  if (app.declaredFeeRwf !== null) return `${formatPrice(app.declaredFeeRwf)} a year`;
  if (app.quotedPriceKind === "fixed" && app.quotedFeeRwf !== null) return `${formatPrice(app.quotedFeeRwf)} a year`;
  return "PSF names the price";
}

export function PsfApplicationSheet({
  applicationId,
  onClose,
  onDecided,
}: {
  applicationId: string | null;
  onClose: () => void;
  /** After the server agreed: the application, and the sentence to toast. */
  onDecided: (application: PsfOfficerApplication, message: string) => void;
}) {
  const [sel, setSel] = useState<PsfOfficerApplication | null>(null);
  const [missing, setMissing] = useState(false);
  const [deciding, setDeciding] = useState<"approve" | "decline" | null>(null);
  const [acting, setActing] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  useEffect(() => {
    setSel(null);
    setMissing(false);
    if (!applicationId) return;
    let live = true;
    void fetchPsfApplication(applicationId).then((res) => {
      if (!live) return;
      if (res.outcome === "ok") setSel(res.data);
      else setMissing(true);
    });
    return () => {
      live = false;
    };
  }, [applicationId]);

  const closeAll = () => {
    if (acting) return;
    setDeciding(null);
    onClose();
  };

  return (
    <>
      <Sheet open={!!applicationId} onOpenChange={(open) => !open && closeAll()}>
        <SheetContent className="w-full gap-0 scrollbar overflow-y-auto border-panel-bd bg-panel sm:max-w-narrow">
          {missing ? (
            <div className="p-6 text-sm text-muted-foreground">This application is no longer open, or is outside your region.</div>
          ) : !sel ? (
            <div className="p-6">
              <Skeleton height={220} />
            </div>
          ) : (
            <>
              <SheetHeader className="gap-2 border-b border-line">
                <div className="flex items-center gap-2">
                  {sel.profile.businessCode && (
                    <span className="pms-num rounded bg-accent-soft px-1.5 py-0.5 text-xs font-bold text-accent-text">
                      {sel.profile.businessCode}
                    </span>
                  )}
                  <Badge intent={sel.status === "approved" ? "warn" : "info"}>
                    {sel.status === "approved" ? "Approved, waiting for payment" : "With PSF"}
                  </Badge>
                </div>
                <SheetTitle className="pms-display text-xl font-bold text-ink">{sel.businessName}</SheetTitle>
                <p className="text-xs text-muted-foreground">
                  Asked for {sel.requestedTierName}, sent {shortDate(sel.submittedAt)}
                  {sel.submittedCapacity === "on_behalf_of" && sel.submittedByName
                    ? `, on the owner's behalf by ${sel.submittedByName}`
                    : ""}
                </p>
              </SheetHeader>
              <div className="flex flex-col gap-5 p-5">
                <div className={cn(surfaceClass, "grid grid-cols-2 gap-3 p-3.5")}>
                  <Figure label="Membership" value={sel.requestedTierName} />
                  <Figure label="A year" value={amountOf(sel)} strong />
                </div>

                <FormSection title="The business">
                  <Row label="Sector" value={[sel.profile.clusterName, sel.profile.associationName].filter(Boolean).join(" · ") || "Not given"} />
                  <Row label="District" value={sel.districtName ?? "Not recorded"} />
                  <Row label="Registration" value={registrationOf(sel)} />
                  <Row
                    label="Owned by"
                    value={sel.profile.ownerGroups.length ? sel.profile.ownerGroups.map((g) => PSF_OWNER_GROUP_LABEL[g]).join(", ") : "Not marked"}
                  />
                  <Row label="Kind" value={sel.profile.domain === "enterprise" ? "Registered for PSF" : "Hotel or hospitality"} />
                </FormSection>
                <FormSection title="Member profile">
                  <Row label="Company" value={sel.form.companyName} />
                  <Row label="Website" value={sel.form.website ?? "None given"} />
                  <Row label="Street address" value={sel.form.streetAddress} />
                  <Row label="Company type" value={PSF_COMPANY_TYPE_LABEL[sel.form.companyType]} />
                  <Row
                    label="Ownership"
                    value={sel.form.ownership === "other" ? `Other: ${sel.form.ownershipOther ?? ""}` : PSF_OWNERSHIP_LABEL[sel.form.ownership]}
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
                  <Row label={sel.form.idDocumentType === "passport" ? "Passport" : "National ID"} value={sel.form.idDocumentNumber} />
                  <Row label="Date of birth" value={sel.form.dateOfBirth} />
                </FormSection>

                {sel.status === "approved" && (
                  <p className="rounded border border-warn bg-warn-bg px-3.5 py-3 text-xs text-warn">
                    Approved as {sel.approvedMembershipNumber}. The membership starts when the business pays {amountOf(sel)}.
                  </p>
                )}
                {sel.status === "submitted" && !sel.canDecide && (
                  <p className="rounded border border-warn bg-warn-bg px-3.5 py-3 text-xs text-warn">{PSF_OWN_BUSINESS_MESSAGE}</p>
                )}

                {sel.status === "submitted" && (
                  <div className="flex flex-wrap gap-2.5">
                    <ActionButton
                      variant="primary"
                      className="h-11"
                      deniedReason={sel.canDecide ? undefined : PSF_OWN_BUSINESS_MESSAGE}
                      onClick={() => {
                        setRefusal(null);
                        setDeciding("approve");
                      }}
                    >
                      Approve
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
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {sel && deciding === "approve" && (
        <ApproveDialog
          application={sel}
          acting={acting}
          refusal={refusal}
          onClose={() => !acting && setDeciding(null)}
          onSubmit={async (body) => {
            setActing(true);
            setRefusal(null);
            try {
              const decided = await approvePsfApplication(sel.id, body);
              setDeciding(null);
              onDecided(decided, `${sel.businessName} is approved. They pay to become a member.`);
            } catch (error) {
              setRefusal(refusalField(error)?.message ?? humanError(error));
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
              const decided = await declinePsfApplication(sel.id, body);
              setDeciding(null);
              onDecided(decided, `${sel.businessName}'s application was declined.`);
            } catch (error) {
              setRefusal(humanError(error));
            } finally {
              setActing(false);
            }
          }}
        />
      )}
    </>
  );
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-2xs font-bold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={cn("text-sm text-ink", strong && "pms-num text-base font-bold")}>{value}</p>
    </div>
  );
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

/**
 * Approve: PSF's membership number, and the amount only where it is PSF's to
 * name (a tier PSF prices itself, or an application filed before businesses
 * declared amounts). Otherwise the business's own amount stands, and is shown.
 */
function ApproveDialog({
  application,
  acting,
  refusal,
  onClose,
  onSubmit,
}: {
  application: PsfOfficerApplication;
  acting: boolean;
  refusal: string | null;
  onClose: () => void;
  onSubmit: (body: { membershipNumber: string; feeRwf?: number }) => void;
}) {
  const declared = application.declaredFeeRwf ?? (application.quotedPriceKind === "fixed" ? application.quotedFeeRwf : null);
  const needsFee = declared === null;
  const [membershipNumber, setMembershipNumber] = useState("");
  const [fee, setFee] = useState("");
  const feeNumber = Number(fee.replace(/[\s,]/g, ""));
  const ready = membershipNumber.trim().length > 0 && (!needsFee || (Number.isInteger(feeNumber) && feeNumber > 0));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-panel-bd bg-panel sm:max-w-narrow">
        <DialogHeader>
          <DialogTitle className="pms-display text-lg font-bold text-ink">Approve {application.businessName}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            The business is told, and pays the fee from its portal. Its membership starts the day it pays, for a year.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className={cn(surfaceClass, "grid grid-cols-2 gap-3 p-3")}>
            <Figure label="Membership" value={application.requestedTierName} />
            <Figure label="They will pay" value={declared !== null ? `${formatPrice(declared)} a year` : "You name it"} strong />
          </div>
          <label className="text-sm font-semibold text-ink">
            PSF membership number
            <Input
              className="pms-num mt-1"
              placeholder="PSF/KIC/2026/0001"
              value={membershipNumber}
              onChange={(e) => setMembershipNumber(e.target.value)}
            />
          </label>
          {needsFee && (
            <label className="text-sm font-semibold text-ink">
              Annual fee (RWF)
              <Input className="pms-num mt-1" inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value)} />
            </label>
          )}
          {refusal && <p className="text-xs text-bad">{refusal}</p>}
        </div>
        <DialogFooter>
          <ActionButton onClick={onClose} disabled={acting}>
            Cancel
          </ActionButton>
          <ActionButton
            variant="primary"
            disabled={!ready || acting}
            onClick={() => onSubmit({ membershipNumber: membershipNumber.trim(), ...(needsFee ? { feeRwf: feeNumber } : {}) })}
          >
            {acting ? "Approving" : "Approve"}
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
            <select className={cn(selectClass, "mt-1")} value={reason} onChange={(e) => setReason(e.target.value as PsfDeclineReason)}>
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
          <ActionButton variant="primary" disabled={!ready || acting} onClick={() => onSubmit({ reason, ...(note.trim() ? { note: note.trim() } : {}) })}>
            {acting ? "Recording" : "Decline"}
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
