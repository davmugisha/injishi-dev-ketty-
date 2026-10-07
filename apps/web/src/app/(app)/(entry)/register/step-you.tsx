"use client";

import { useRef, useState } from "react";
import {
  type IdentityStatus,
  type MyProfile,
  type VerifiedPerson,
  countryName,
  isRwandanAddress,
} from "@injishi/contracts";
import { Alert } from "@heroui/react";
import { Avatar, AvatarFallback, Badge, Button, Checkbox } from "@injishi/ui";

import { confirmNationalId, lookupNationalId } from "@/data/identity";
import { apiResultMessage } from "@/lib/api";
import { formatNationalId, nationalIdError } from "@/lib/rwanda-id";

import { AddressPicker } from "./address-picker";
import { PassportScanner } from "./identity-verifier";
import { PhoneInput } from "./phone-input";
import { StepCard } from "./register-shell";
import { PersonalForm, type PersonalDraft } from "./step-about-you";
import { Field, Notice, TextInput } from "./wizard-ui";

/**
 * You (RegisterIA board): one number, checked once.
 *
 * ONE FIELD, ITS TYPE READ FROM ITS SHAPE. Sixteen digits is a Rwandan National
 * ID; letters then digits is a passport. The old step asked "Which document do
 * you have?" first, and the PSF step asked it again; the number already says.
 *
 * A NATIONAL ID is looked up in the population register, which sends a code to
 * the phone it holds for that ID; typing the code back proves the ID is yours,
 * and only then does the register's answer (name, date of birth, gender, phone)
 * come back and fill the form, locked (`identity-verifier.tsx` explains why the
 * lookup alone reveals nobody). A PASSPORT is not on the register, so it is read
 * from a photo of its photo page and a selfie by the document verifier.
 *
 * WHAT THE REGISTER DOES NOT GIVE BACK IS STILL ASKED, honestly. The board reads
 * the home address from the register too; the register this API talks to
 * returns no address (`VerifiedPerson`), and `PersonalDetails` requires one, so
 * once the ID is verified the step asks where you live, and a phone for a
 * passport holder, whose register holds none.
 *
 * Where no check can run here (`modes` off), the typed form stays, as ADR-060
 * keeps it: a check nobody can run cannot be required.
 */

type IdPhase = "none" | "code" | "photo";

function idTypeOf(raw: string): "nid" | "passport" | "" {
  const v = raw.replace(/\s+/g, "");
  if (/^\d{16}$/.test(v)) return "nid";
  if (/^[A-Za-z0-9]{6,12}$/.test(v) && /[A-Za-z]/.test(v)) return "passport";
  return "";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

/** `+250788300412` as `078•••412`, the way the board names a phone in passing. */
export function maskedPhone(e164: string | null | undefined): string | null {
  if (!e164) return null;
  const digits = e164.replace(/\D/g, "");
  if (e164.startsWith("+250") && digits.length === 12) {
    const local = `0${digits.slice(3)}`;
    return `${local.slice(0, 3)}•••${local.slice(-3)}`;
  }
  return `${e164.slice(0, 4)}•••${e164.slice(-3)}`;
}

function bornOn(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? date
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function StepYou({
  identity,
  profile,
  showStored,
  onEditProfile,
  draft,
  onDraftChange,
  onVerified,
  errors,
  formError,
  busy,
  demo,
  email,
  nextLabel,
  onNext,
  onBack,
}: {
  identity: IdentityStatus | null;
  profile: MyProfile | null;
  /** A complete profile on file, confirmed rather than retyped. */
  showStored: boolean;
  onEditProfile: () => void;
  draft: PersonalDraft;
  onDraftChange: (next: PersonalDraft) => void;
  onVerified: (person: VerifiedPerson) => void;
  errors: Record<string, string>;
  formError: string;
  busy: boolean;
  demo: boolean;
  email: string | null;
  nextLabel: string;
  onNext: () => void;
  onBack?: () => void;
}) {
  /**
   * Verified, and by what. A seeded or hand-checked identity (`method: manual`)
   * is verified with no register answer behind it (`verified: null`), so the
   * card falls back to the profile's own name and number, and the date of
   * birth the register would have given is asked.
   */
  const isVerified = identity?.kycStatus === "verified";
  const person = isVerified ? identity?.verified ?? null : null;
  const verifiedName = person?.fullName ?? profile?.fullName ?? ([draft.firstName, draft.middleName, draft.lastName].filter((x) => x.trim()).join(" ") || "Verified");
  const verifiedDoc = person
    ? `${person.documentType === "passport" ? `Passport ${person.documentNumberMasked} · ${countryName(person.issuingCountry)}` : `National ID ${person.documentNumberMasked}`}`
    : profile?.document
      ? `${profile.document.documentType === "passport" ? "Passport" : "National ID"} ${profile.document.documentNumberMasked}`
      : null;
  /** Set when the register's own phone filled the draft: shown, not asked. */
  const [phoneFromRegister, setPhoneFromRegister] = useState(false);
  const canVerify = Boolean(identity && (identity.available.nationalId || identity.available.passport));

  const [idNo, setIdNo] = useState("");
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<IdPhase>("none");
  const [challenge, setChallenge] = useState<{ id: string; sentTo: string } | null>(null);
  const [phoneCode, setPhoneCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [localError, setLocalError] = useState("");
  const codeField = useRef<HTMLInputElement>(null);

  const idType = idTypeOf(idNo);
  const digits = idNo.replace(/\s+/g, "");
  const idKind =
    idType === "nid"
      ? "National ID, 16 digits."
      : idType === "passport"
        ? "Passport, read from a photo of its photo page."
        : "16 digits for a National ID, or your passport number.";

  const restart = () => {
    setPhase("none");
    setChallenge(null);
    setPhoneCode("");
    setLocalError("");
  };

  async function check() {
    setLocalError("");
    if (idType === "") {
      setLocalError(
        /^\d+$/.test(digits) && digits.length > 0
          ? (nationalIdError(digits) ?? "Enter a 16-digit National ID or a passport number.")
          : "Enter a 16-digit National ID or a passport number.",
      );
      return;
    }
    if (!consent) {
      setLocalError("Tick the box so we can check the number.");
      return;
    }
    if (idType === "passport") {
      if (!identity?.available.passport) {
        setLocalError("Passports cannot be checked here yet. Use a Rwandan National ID.");
        return;
      }
      setPhase("photo");
      return;
    }
    if (!identity?.available.nationalId) {
      setLocalError("National IDs cannot be checked here yet.");
      return;
    }
    const problem = nationalIdError(digits);
    if (problem) {
      setLocalError(problem);
      return;
    }
    setChecking(true);
    const res = await lookupNationalId(digits);
    setChecking(false);
    if (res.status !== "ok") {
      setLocalError(apiResultMessage(res));
      return;
    }
    if (res.data.status === "code_sent") {
      setChallenge({ id: res.data.challengeId, sentTo: res.data.sentTo });
      setPhoneCode(demo ? "123456" : "");
      setPhase("code");
      window.setTimeout(() => codeField.current?.focus(), 50);
      return;
    }
    setLocalError(res.data.message);
  }

  async function confirm() {
    if (!challenge) return;
    if (!/^\d{6}$/.test(phoneCode)) {
      setLocalError("Enter the 6 digits from the SMS.");
      return;
    }
    setChecking(true);
    setLocalError("");
    const res = await confirmNationalId(challenge.id, phoneCode);
    setChecking(false);
    if (res.status === "ok") {
      restart();
      if (res.data.phoneE164) setPhoneFromRegister(true);
      onVerified(res.data);
      return;
    }
    setLocalError(apiResultMessage(res));
    // A spent or replaced code cannot be retried; the person asks for a new one.
    if (res.status === "refused" && res.httpStatus === 410) restart();
  }

  /** Continue, but never past an ID nobody checked where a check can run. */
  function next() {
    if (canVerify && identity?.required && !isVerified) {
      setLocalError(
        phase === "code"
          ? "Confirm the code from the SMS first."
          : phase === "photo"
            ? "Take the photos of your passport first."
            : "Check your ID first.",
      );
      return;
    }
    setLocalError("");
    onNext();
  }

  const phoneFromDraft = maskedPhone(draft.phoneE164);
  const shownError = localError || formError;

  return (
    <StepCard
      id="register-you"
      title="About you"
      lead={
        canVerify
          ? "We read your name and date of birth from the national register, so you type one number."
          : "A business belongs to the person who registers it, so we need to know who that is."
      }
      footer={
        <>
          <span className="text-sm text-muted-foreground">
            {onBack ? (
              <Button variant="ghost" onClick={onBack} className="mr-2">
                Back
              </Button>
            ) : null}
            {email ? <>Signed in as {email}</> : null}
          </span>
          <Button onClick={next} pending={busy}>
            {busy ? "Working…" : nextLabel}
          </Button>
        </>
      }
    >
      {isVerified ? (
        <div className="flex flex-wrap items-center gap-3.5 rounded-card bg-secondary p-4">
          <Avatar className="size-11">
            <AvatarFallback className="bg-accent-brand/15 font-semibold text-accent-text">
              {initials(verifiedName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-base font-semibold">{verifiedName}</span>
            <span className="text-sm tabular-nums text-muted-foreground">
              {[
                person ? `Born ${bornOn(person.dateOfBirth)}` : null,
                verifiedDoc,
                phoneFromDraft ? `phone ${phoneFromDraft}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            {person?.generated ? (
              <span className="text-xs text-muted-foreground">
                Demo: no real register is connected, so these details were generated.
              </span>
            ) : null}
          </div>
          <Badge variant="success" size="sm">
            {identity?.method === "document_scan"
              ? "Verified from your passport"
              : identity?.method === "registry"
                ? "Verified with NIDA"
                : "Verified"}
          </Badge>
        </div>
      ) : canVerify ? (
        <>
          {phase === "none" ? (
            <>
              <div className="flex flex-wrap items-end gap-2.5">
                <div className="min-w-0 flex-1 basis-64">
                  <Field label="National ID or passport number" hint={idKind}>
                    <TextInput
                      id="you-id-number"
                      className="w-full tabular-nums"
                      autoComplete="off"
                      placeholder="1 1988 8 0123456 0 21"
                      maxLength={24}
                      value={idNo}
                      aria-invalid={localError && idType === "" ? true : undefined}
                      onChange={(e) => {
                        setIdNo(e.target.value);
                        setLocalError("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void check();
                      }}
                    />
                  </Field>
                </div>
                <Button variant="secondary" onClick={() => void check()} pending={checking}>
                  {checking ? "Checking…" : "Check"}
                </Button>
              </div>
              <Checkbox
                isSelected={consent}
                onChange={(on: boolean) => {
                  setConsent(on);
                  setLocalError("");
                }}
                className="items-start gap-3"
                controlClassName="mt-0.5"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    I agree to a check of this number against the national register
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Only your name, date of birth, gender and registered phone come back.
                  </span>
                </span>
              </Checkbox>
            </>
          ) : null}

          {phase === "code" && challenge ? (
            <>
              <Alert status="accent">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>We sent a code to {challenge.sentTo}</Alert.Title>
                  <Alert.Description>
                    That is the phone the register holds for National ID{" "}
                    {formatNationalId(digits)}. It proves the ID is yours.
                    {demo ? " This is the Injishi demo, so the code is 123456 and it is filled in." : ""}
                  </Alert.Description>
                </Alert.Content>
              </Alert>
              <div className="flex flex-wrap items-end gap-2.5">
                <div className="w-full max-w-form sm:w-auto">
                  <Field label="Code from the SMS">
                    <TextInput
                      ref={codeField}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="000000"
                      className="w-full tracking-widest tabular-nums"
                      value={phoneCode}
                      onChange={(e) => {
                        setPhoneCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                        setLocalError("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void confirm();
                      }}
                    />
                  </Field>
                </div>
                <Button variant="secondary" onClick={() => void confirm()} pending={checking}>
                  {checking ? "Confirming…" : "Confirm"}
                </Button>
                <Button variant="ghost" onClick={restart}>
                  Start over
                </Button>
              </div>
            </>
          ) : null}

          {phase === "photo" ? (
            <>
              <Alert status="accent">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Photograph your passport&apos;s photo page</Alert.Title>
                  <Alert.Description>
                    A passport is not on the national register, so we read it from a photo,
                    and a selfie shows it is yours, instead of sending a code.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
              <PassportScanner
                onVerified={(person) => {
                  restart();
                  onVerified(person);
                }}
              />
              <div>
                <Button variant="ghost" onClick={restart}>
                  Start over
                </Button>
              </div>
            </>
          ) : null}
        </>
      ) : showStored ? null : (
        // No check can run on this deployment: the typed form, as before.
        <PersonalForm draft={draft} onChange={onDraftChange} errors={errors} verification={null} />
      )}

      {/* What the register does not hold. Asked once the person is known, or
          shown back when a complete profile already answers it. */}
      {isVerified || !canVerify ? (
        showStored && profile ? (
          <StoredDetails profile={profile} onEdit={onEditProfile} withIdentity={!isVerified} />
        ) : isVerified ? (
          <>
            {person ? null : (
              <Field
                label="Date of birth"
                required
                hint="Your verification did not record it. You must be 18 or over to register a business."
                error={errors["dateOfBirth"]}
              >
                <TextInput
                  type="date"
                  className="w-full max-w-form"
                  value={draft.dateOfBirth}
                  onChange={(e) => onDraftChange({ ...draft, dateOfBirth: e.target.value })}
                />
              </Field>
            )}
            {phoneFromRegister ? null : (
              <Field
                label="Phone"
                required
                hint="Pick your country, then the number as you would dial it at home."
                error={errors["phoneE164"]}
              >
                <PhoneInput
                  id="you-phone"
                  value={draft.phoneE164}
                  invalid={Boolean(errors["phoneE164"])}
                  onChange={(phoneE164) => onDraftChange({ ...draft, phoneE164 })}
                />
              </Field>
            )}
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold">Where you live</p>
              <p className="text-xs text-muted-foreground">
                The register does not give your address back, so give it here. Province,
                district and sector are enough; cell and village help an officer find you.
              </p>
              <div className="mt-3">
                <AddressPicker
                  idPrefix="you"
                  collectVillage
                  draft={draft.address}
                  onChange={(address) => onDraftChange({ ...draft, address })}
                  errors={errors}
                />
              </div>
            </div>
          </>
        ) : null
      ) : null}

      {shownError ? <Notice tone="danger">{shownError}</Notice> : null}
    </StepCard>
  );
}

/** A complete profile, confirmed rather than retyped. */
function StoredDetails({
  profile,
  onEdit,
  withIdentity,
}: {
  profile: MyProfile;
  onEdit: () => void;
  /** False when the verified card above already names the person. */
  withIdentity: boolean;
}) {
  const address = profile.address;
  const addressLine =
    address === null
      ? "Not given"
      : isRwandanAddress(address)
        ? [address.street, "Rwanda"].filter(Boolean).join(" · ")
        : `${address.addressText} · ${countryName(address.country)}`;
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-card border border-border p-4">
      <dl className="grid min-w-0 flex-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {withIdentity ? (
          <>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Name</dt>
          <dd className="font-medium">{profile.fullName ?? "Not given"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Date of birth</dt>
          <dd className="font-medium">{profile.dateOfBirth ? bornOn(profile.dateOfBirth) : "Not given"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">
            {profile.document?.documentType === "passport" ? "Passport" : "National ID"}
          </dt>
          <dd className="font-medium">{profile.document?.documentNumberMasked ?? "Not given"}</dd>
        </div>
          </>
        ) : null}
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Phone</dt>
          <dd className="font-medium">{profile.phoneE164 ?? "Not given"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Address</dt>
          <dd className="font-medium">{addressLine}</dd>
        </div>
      </dl>
      <Button variant="ghost" size="sm" onClick={onEdit}>
        Edit
      </Button>
    </div>
  );
}
