"use client";

import { useState } from "react";
import {
  TypedIdentityRequest,
  type AccountDocumentType,
  type IdentityScanResult,
  type IdentityStatus,
} from "@injishi/contracts";
import { Button } from "@injishi/web-ui";
import { TriangleAlert } from "lucide-react";

import { putTypedIdentity } from "@/data/identity";
import { apiResultMessage } from "@/lib/api";

import { AddressPicker } from "./address-picker";
import { IdentityCard, IdScanner } from "./identity-verifier";
import { PhoneInput } from "./phone-input";
import { Callout } from "./register-shell";
import { TypedIdentityFields, composeFullName, type PersonalDraft } from "./step-about-you";
import { Field, Offline } from "./wizard-ui";

/**
 * You and the company / Your identity (ADR-075 S4): a Rwandan National ID is
 * checked by its number and a selfie against NIDA's register, through GTBank
 * (2026-10-30), and a passport by its photo page and a selfie through Smile
 * ID. Where the NIDA check is off, the card is scanned instead. No code is
 * sent to any phone (AC-4).
 *
 * Three faces, in the order a person meets them:
 * - The scanner, until something is on file. A refused try says what went
 *   wrong and how to fix it; after 3 tries on this draft the person may carry
 *   on, and the case is flagged for a manual check (AC-5).
 * - The details as printed, typed when the scan read nothing: no checker here
 *   (D-a), or the tries ran out. Stored `pending`, for PSF to hold against the
 *   photos.
 * - The identity on file, "Checked" only after a machine check passed,
 *   otherwise "PSF will check your ID" (AC-6).
 *
 * Nothing about the business is asked or said here: whether RRA ties this ID
 * to the business is answered on the Business step (`SectionTin`).
 *
 * WHAT AN ID DOES NOT SHOW IS STILL ASKED, because the API refuses to create a
 * registration for an account without it: a phone, and the home address. A
 * complete profile answers both and nothing is asked.
 */
export function SectionIdentity({
  identity,
  profileComplete,
  draft,
  onDraftChange,
  onIdentity,
  needsExtras,
  errors,
  onEditProfile,
  onNext,
  hideNext = false,
  online = true,
}: {
  identity: IdentityStatus | null;
  /** A complete profile on file: nothing beyond the ID is asked. */
  profileComplete: boolean;
  draft: PersonalDraft;
  onDraftChange: (next: PersonalDraft) => void;
  /** What is on file changed: the new status when it is known, else the step reads it again. */
  onIdentity: (next?: IdentityStatus) => void;
  /** Something an ID does not show is still owed (a phone, the home address). */
  needsExtras: boolean;
  errors: Record<string, string>;
  /** Open a complete profile to change what it holds. */
  onEditProfile: () => void;
  onNext: () => void;
  /** The step after this one is already open below (the broker form): no Next to press again. */
  hideNext?: boolean;
  /**
   * The device has a network. The scan and typed ID details go only to the
   * server, which alone may hold an ID number, so each says when it cannot
   * (ADR-075 S9).
   */
  online?: boolean;
}) {
  const onFile = identity?.onFile ?? null;
  const scan = identity?.scan ?? null;
  const [documentType, setDocumentType] = useState<AccountDocumentType>(scan?.documentType ?? "national_id");
  const [last, setLast] = useState<IdentityScanResult | null>(null);
  const [typing, setTyping] = useState(false);
  const [typedErrors, setTypedErrors] = useState<Record<string, string>>({});
  const [typedProblem, setTypedProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!identity) {
    return <p className="text-sm text-muted-foreground">Reading what is on file…</p>;
  }

  // --- On file: who, and what is still owed.
  if (onFile) {
    return (
      <>
        <IdentityCard person={onFile} />
        {profileComplete ? (
          <OnFile onEdit={onEditProfile} />
        ) : needsExtras ? (
          <Extras draft={draft} onDraftChange={onDraftChange} errors={errors} />
        ) : null}
        {hideNext ? null : (
          <div>
            <Button onClick={onNext}>Next</Button>
          </div>
        )}
      </>
    );
  }

  // --- The details as printed: no checker here, or the tries ran out.
  if (scan && scan.mayContinue && (typing || scan.outcome === "manual_needed")) {
    const typedType = scan.documentType;
    const confirmTyped = async () => {
      setTypedProblem(null);
      const parsed = TypedIdentityRequest.safeParse({
        fullName: composeFullName(draft),
        dateOfBirth: draft.dateOfBirth,
        document:
          typedType === "passport"
            ? { documentType: "passport", documentNumber: draft.documentNumber, issuingCountry: draft.issuingCountry }
            : { documentType: "national_id", documentNumber: draft.documentNumber },
      });
      if (!parsed.success) {
        setTypedErrors(toErrors(parsed.error.issues));
        return;
      }
      setSaving(true);
      const res = await putTypedIdentity(parsed.data);
      setSaving(false);
      if (res.status !== "ok") {
        if (res.status === "refused" && res.issues?.length) setTypedErrors(toErrors(res.issues));
        setTypedProblem(apiResultMessage(res));
        return;
      }
      setTypedErrors({});
      onIdentity(res.data);
    };
    return (
      <>
        <p className="text-sm">
          {scan.outcome === "manual_needed"
            ? "Your photos are saved. Now type your details as they are printed on your ID, and PSF checks them against the photos."
            : "Type your details as they are printed on your ID. PSF checks them against your photos before approving."}
        </p>
        <TypedIdentityFields
          draft={{ ...draft, documentType: typedType, issuingCountry: typedType === "passport" ? draft.issuingCountry : "RW" }}
          onChange={onDraftChange}
          errors={{ ...errors, ...typedErrors }}
        />
        {typedProblem ? (
          <Callout tone="danger" icon={<TriangleAlert size={16} aria-hidden />} title="That did not go through">
            {typedProblem}
          </Callout>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => void confirmTyped()}
            pending={saving}
            disabled={!online}
            aria-describedby={online ? undefined : "register-typed-offline"}
          >
            Confirm
          </Button>
          {online ? null : <Offline id="register-typed-offline">You're offline. Connect to save your ID details.</Offline>}
          {scan.outcome === "machine_failed" ? (
            <Button variant="ghost" onClick={() => setTyping(false)}>
              Scan again
            </Button>
          ) : null}
        </div>
      </>
    );
  }

  // --- The scanner.
  const intro = "Your own ID, whoever owns the business. The name on it is the one the registration carries.";
  const failed = last?.outcome === "machine_failed" ? last : null;
  return (
    <>
      <p className="text-sm text-muted-foreground">{intro}</p>
      <IdScanner
        documentType={documentType}
        onDocumentTypeChange={setDocumentType}
        online={online}
        mode={identity.mode}
        nationalIdMode={identity.nationalIdMode}
        onScanned={(result) => {
          setLast(result);
          onIdentity();
        }}
      />
      {failed ? (
        <Callout tone="danger" icon={<TriangleAlert size={16} aria-hidden />} title="That check did not pass" role="alert">
          {failed.message}
          {failed.mayContinue ? null : " After 3 tries you can carry on, and PSF checks your ID."}
        </Callout>
      ) : null}
      {scan?.outcome === "machine_failed" && scan.mayContinue ? (
        <div>
          <Button variant="secondary" onClick={() => setTyping(true)}>
            Continue, PSF will check it
          </Button>
        </div>
      ) : null}
    </>
  );
}

/** What an ID does not show, and the account needs: a phone, and where the person lives. */
function Extras({
  draft,
  onDraftChange,
  errors,
}: {
  draft: PersonalDraft;
  onDraftChange: (next: PersonalDraft) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Field
        label="Your phone"
        required
        composite
        hint="For PSF to reach you, and for mobile money. Pick your country, then the number as you dial it."
        error={errors["phoneE164"]}
      >
        <PhoneInput
          id="register-you-phone"
          value={draft.phoneE164}
          invalid={Boolean(errors["phoneE164"])}
          onChange={(phoneE164) => onDraftChange({ ...draft, phoneE164 })}
        />
      </Field>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold">Where you live</p>
        <p className="text-xs text-muted-foreground">
          Your ID does not give your home address, and your account needs one. Province, district and sector are
          enough.
        </p>
        <div className="mt-3">
          <AddressPicker
            idPrefix="register-home"
            draft={draft.address}
            onChange={(address) => onDraftChange({ ...draft, address })}
            errors={errors}
          />
        </div>
      </div>
    </div>
  );
}

/** A complete profile answers what an ID does not; it can still be changed. */
function OnFile({ onEdit }: { onEdit: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-card bg-secondary px-4 py-3 text-sm">
      <span>Your phone and home address are on your account.</span>
      <Button variant="ghost" size="sm" onClick={onEdit}>
        Update them
      </Button>
    </div>
  );
}

/** Field refusals keyed by their dotted path, first message wins. */
function toErrors(issues: readonly { path: readonly PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
