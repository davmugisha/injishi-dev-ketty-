"use client";

import { useState } from "react";
import { type IdentityStatus, type MyProfile, type VerifiedPerson, countryName } from "@injishi/contracts";
import { Checkbox, Button } from "@injishi/ui";
import { CircleCheck, Smartphone, TriangleAlert } from "lucide-react";

import { confirmNationalId, lookupNationalId } from "@/data/identity";
import { apiResultMessage } from "@/lib/api";
import { formatNationalId, nationalIdError } from "@/lib/rwanda-id";

import { AddressPicker } from "./address-picker";
import { PassportScanner, VerifiedIdentityCard } from "./identity-verifier";
import { PhoneInput } from "./phone-input";
import type { RegisterPath } from "./register-steps";
import { Callout } from "./register-shell";
import { PersonalForm, type PersonalDraft } from "./step-about-you";
import { CodeBoxes, Field, TextInput } from "./wizard-ui";

/**
 * You and the company / Your identity (Register.dc.html, step two).
 *
 * The artboard checks the ID and texts a code to the phone held for it. Here
 * that is the API's identity check (ADR-060): a National ID is looked up in the
 * population register, which sends a code to the phone it holds; typing the
 * code back proves the ID is the registrant's, and only then do the name, date
 * of birth and phone come back. A passport is read from a photo of its photo
 * page and a selfie. The artboard names GT Bank as the checker; this API's
 * checker is the population register, so that is what the screen says.
 *
 * WHAT THE REGISTER DOES NOT RETURN IS STILL ASKED, because the API refuses to
 * create a registration for an account without it: the home address, and a
 * phone for a passport holder. A complete profile answers both and nothing is
 * asked.
 *
 * On the owner's path the section ends with the director check: the API
 * refuses an owner the company register does not list as a director, so the
 * screen says so first and offers the helper's path instead.
 */

type Phase = "ask" | "code" | "photo";

export function SectionIdentity({
  path,
  identity,
  profile,
  profileComplete,
  draft,
  onDraftChange,
  onVerified,
  phoneFromRegister,
  needsExtras,
  isDirector,
  directorNames,
  demo,
  errors,
  onPrepareForOwner,
  onEditProfile,
  onNext,
}: {
  path: RegisterPath;
  identity: IdentityStatus | null;
  profile: MyProfile | null;
  /** A complete profile on file: nothing beyond the check is asked. */
  profileComplete: boolean;
  draft: PersonalDraft;
  onDraftChange: (next: PersonalDraft) => void;
  onVerified: (person: VerifiedPerson) => void;
  /** The register's own phone filled the draft: shown, not asked. */
  phoneFromRegister: boolean;
  /** Something the register does not hold is still owed (home address, a phone, a birth date). */
  needsExtras: boolean;
  /** RRA's answer for the owner's path: true, false, or not known. */
  isDirector: boolean | null;
  directorNames: string[];
  demo: boolean;
  errors: Record<string, string>;
  onPrepareForOwner: () => void;
  /** Open a complete profile to change what it holds. */
  onEditProfile: () => void;
  onNext: () => void;
}) {
  const verified = identity?.kycStatus === "verified";
  const person = verified ? (identity?.verified ?? null) : null;
  const canVerify = Boolean(identity && (identity.available.nationalId || identity.available.passport));

  const [idType, setIdType] = useState<"nid" | "passport">("nid");
  const [nid, setNid] = useState("");
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<Phase>("ask");
  const [challenge, setChallenge] = useState<{ id: string; sentTo: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "danger" | "warning"; text: string } | null>(null);

  const digits = nid.replace(/\s+/g, "");
  const intro = idType === "passport"
    ? !identity?.available.passport
      ? "Passport checking is not available on this deployment yet."
      : identity.modes.documents === "mock"
      ? "This demo can create sample passport details from two different images. It does not read or verify a real passport."
      : "A passport check needs a photo of the passport page and a selfie. The document verifier returns the holder's details."
    : path === "owner"
      ? "We check your ID with the population register, which texts a code to the phone it holds for it. Then we check that the ID is one of RRA's directors for this TIN."
      : path === "landlord"
        ? "We check your ID with the population register, which texts a code to the phone it holds for it. The name it returns is the one the registration carries."
        : "We check your own ID with the population register. The owner confirms ownership later, with theirs, when they claim the business.";

  const restart = () => {
    setPhase("ask");
    setChallenge(null);
    setCode("");
    setMessage(null);
  };

  async function check() {
    setMessage(null);
    if (!consent) {
      setMessage({ tone: "danger", text: "Tick the box so we can check the number." });
      return;
    }
    if (idType === "passport") {
      if (!identity?.available.passport) {
        setMessage({ tone: "warning", text: "Passports cannot be checked here yet. Use a Rwandan National ID." });
        return;
      }
      setPhase("photo");
      return;
    }
    const problem = nationalIdError(digits);
    if (problem) {
      setMessage({ tone: "danger", text: problem });
      return;
    }
    if (!identity?.available.nationalId) {
      setMessage({ tone: "warning", text: "National IDs cannot be checked here yet." });
      return;
    }
    setBusy(true);
    const res = await lookupNationalId(digits);
    setBusy(false);
    if (res.status !== "ok") {
      setMessage({ tone: "danger", text: apiResultMessage(res) });
      return;
    }
    if (res.data.status === "code_sent") {
      setChallenge({ id: res.data.challengeId, sentTo: res.data.sentTo });
      setCode(demo ? "123456" : "");
      setPhase("code");
      return;
    }
    setMessage({ tone: res.data.status === "unavailable" ? "warning" : "danger", text: res.data.message });
  }

  async function confirm(entered = code) {
    if (!challenge) return;
    if (!/^\d{6}$/.test(entered)) {
      setMessage({ tone: "danger", text: "Enter the 6 digits from the text message." });
      return;
    }
    setBusy(true);
    setMessage(null);
    const res = await confirmNationalId(challenge.id, entered);
    setBusy(false);
    if (res.status === "ok") {
      restart();
      onVerified(res.data);
      return;
    }
    setMessage({ tone: "danger", text: apiResultMessage(res) });
    // A spent or replaced code cannot be retried; the person asks for a new one.
    if (res.status === "refused" && res.httpStatus === 410) restart();
  }

  // --- No check can run on this deployment: the typed form (ADR-060 keeps it).
  if (!canVerify && !verified) {
    return (
      <>
        {profileComplete ? (
          <OnFile onEdit={onEditProfile} />
        ) : (
          <PersonalForm draft={draft} onChange={onDraftChange} errors={errors} verification={null} />
        )}
        <div>
          <Button onClick={onNext}>Next</Button>
        </div>
      </>
    );
  }

  // --- Verified: who, and what is still owed.
  if (verified) {
    const name = person?.fullName ?? profile?.fullName ?? "Verified";
    const doc = person
      ? person.documentType === "passport"
        ? `Passport ${person.documentNumberMasked}, ${countryName(person.issuingCountry)}`
        : `National ID ending ${person.documentNumberMasked.replace(/\D/g, "")}`
      : profile?.document
        ? `${profile.document.documentType === "passport" ? "Passport" : "National ID"} ${profile.document.documentNumberMasked}`
        : null;
    return (
      <>
        {person ? (
          <VerifiedIdentityCard person={person} method={identity?.method ?? null} />
        ) : (
        <Callout
          tone="success"
          icon={<CircleCheck size={16} aria-hidden />}
          title={`Checked${identity?.method === "document_scan" ? " from your passport" : identity?.method === "registry" ? " by the population register" : ""}: ${name}`}
        >
          {doc ? `${doc}.` : null}
        </Callout>
        )}

        {path === "owner" && isDirector === false ? (
          <>
            <Callout tone="warning" icon={<TriangleAlert size={16} aria-hidden />} title="This ID is not one of RRA's directors for this TIN" role="alert">
              {directorNames.length
                ? `RRA lists ${directorNames.join(" and ")}. `
                : ""}
              You can still prepare the registration for the owner. You name them, and they claim it with their own ID once
              Injishi approves it.
            </Callout>
            <div>
              <Button onClick={onPrepareForOwner}>Prepare it for the owner</Button>
            </div>
          </>
        ) : (
          <>
            {profileComplete ? <OnFile onEdit={onEditProfile} /> : null}
            {needsExtras && !profileComplete ? (
              <div className="flex flex-col gap-4">
                {person ? null : (
                  <Field
                    label="Date of birth"
                    required
                    hint="Your check did not record it. You must be 18 or over to register a business."
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
                  <Field label="Your phone" required composite hint="Pick your country, then the number as you dial it." error={errors["phoneE164"]}>
                    <PhoneInput
                      id="register-you-phone"
                      value={draft.phoneE164}
                      invalid={Boolean(errors["phoneE164"])}
                      onChange={(phoneE164) => onDraftChange({ ...draft, phoneE164 })}
                    />
                  </Field>
                )}
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold">Where you live</p>
                  <p className="text-xs text-muted-foreground">
                    The register does not give your home address back, and your account needs one. Province, district and
                    sector are enough.
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
            ) : null}
            <div>
              <Button onClick={onNext}>Next</Button>
            </div>
          </>
        )}
      </>
    );
  }

  // --- Not verified yet: the check.
  return (
    <>
      <p className="text-sm">{intro}</p>

      {phase === "ask" ? (
        <>
          <div role="group" aria-label="Type of ID" className="inline-flex self-start rounded-full bg-secondary p-1">
            {(
              [
                ["nid", "National ID"],
                ["passport", "Passport"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={idType === id}
                onClick={() => {
                  setIdType(id);
                  setConsent(false);
                  setMessage(null);
                }}
                className={
                  idType === id
                    ? "min-h-9 rounded-full bg-card px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    : "min-h-9 rounded-full px-4 text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                }
              >
                {label}
              </button>
            ))}
          </div>

          {idType === "nid" ? (
            <div className="max-w-form">
              <Field label="National ID number" hint="16 digits, as on your ID card">
                <TextInput
                  id="register-nid"
                  className="w-full tabular-nums"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="1 1990 8 0012345 1 23"
                  maxLength={24}
                  value={nid}
                  disabled={busy}
                  onChange={(e) => {
                    setNid(e.target.value);
                    setMessage(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void check();
                  }}
                />
              </Field>
            </div>
          ) : (
            identity?.available.passport ? (
              <p className="text-sm text-muted-foreground">
                {identity.modes.documents === "mock"
                  ? "The demo creates sample passport details from two different sample images. No passport information is extracted."
                  : "The document verifier checks a photo of the passport page and a selfie."}
              </p>
            ) : (
              <Callout tone="warning" icon={<TriangleAlert size={16} aria-hidden />} title="Passport checking is unavailable here">
                A passport verifier has not been connected to this deployment. You can continue with a Rwandan National ID if you have one.
              </Callout>
            )
          )}

          {idType === "nid" || identity?.available.passport ? <><Checkbox
            isSelected={consent}
            onChange={(on: boolean) => {
              setConsent(on);
              setMessage(null);
            }}
            className="items-start gap-3"
            controlClassName="mt-0.5"
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">
                {idType === "passport"
                  ? "I agree to upload two images for this passport check"
                  : "I agree to a check of this ID against the national register"}
              </span>
              <span className="text-xs text-muted-foreground">
                {idType === "passport"
                  ? identity?.modes.documents === "mock"
                    ? "The images create sample name, birth date, passport number and issuing country; no details are read from a real passport."
                    : "The verifier returns the holder's name, birth date, gender, passport number and issuing country. It does not return a phone number."
                  : "Only your name, date of birth, gender and registered phone come back."}
              </span>
            </span>
          </Checkbox>

          <div>
            <Button onClick={() => void check()} pending={busy}>
              {idType === "nid" ? "Check with the population register" : "Continue to the photos"}
            </Button>
          </div>
          </> : null}
        </>
      ) : null}

      {phase === "code" && challenge ? (
        <>
          <Callout tone="info" icon={<Smartphone size={16} aria-hidden />} title="The population register found your ID">
            We texted a code to {challenge.sentTo}, the phone it holds for National ID {formatNationalId(digits)}.
            {demo ? " This is the Injishi demo, so the code is 123456 and it is filled in." : ""}
          </Callout>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">Code from the text message</legend>
            <CodeBoxes idPrefix="register-id-code" value={code} onChange={setCode} disabled={busy} />
          </fieldset>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button onClick={() => void confirm()} pending={busy} disabled={code.length !== 6}>
              Verify code
            </Button>
            <span className="text-xs text-muted-foreground">It works for 10 minutes and 5 tries.</span>
            <Button variant="ghost" size="sm" onClick={restart}>
              Start over
            </Button>
          </div>
        </>
      ) : null}

      {phase === "photo" ? (
        <>
          <PassportScanner
            sample={identity?.modes.documents === "mock"}
            onVerified={(p) => {
              restart();
              onVerified(p);
            }}
          />
          <div>
            <Button variant="ghost" size="sm" onClick={restart}>
              Start over
            </Button>
          </div>
        </>
      ) : null}

      {message ? (
        <Callout tone={message.tone} icon={<TriangleAlert size={16} aria-hidden />} title={message.tone === "warning" ? "Not available" : "That did not work"}>
          {message.text}
        </Callout>
      ) : null}
    </>
  );
}

/** A complete profile answers what the register does not; it can still be changed. */
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
