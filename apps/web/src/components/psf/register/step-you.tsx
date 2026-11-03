"use client";

import { useState } from "react";
import { BadgeCheck, MessageSquareText, ShieldCheck } from "lucide-react";
import { PSF_CONTACT_ROLE_LABEL, type PsfContactRole } from "@injishi/contracts";
import { Button, Checkbox } from "@injishi/web-ui";

import { PhoneInput } from "@/app/(app)/(entry)/register/phone-input";
import { Field, Notice, SelectField, TextInput } from "@/app/(app)/(entry)/register/wizard-ui";
import { confirmPsfIdentity, lookupPsfIdentity } from "@/data/psf";
import { apiResultMessage } from "@/lib/api";
import { formatNationalId, nationalIdError } from "@/lib/rwanda-id";

import type { Errors, PsfDraft } from "./draft";

/**
 * Step 1, You: one number, checked once.
 *
 * The National ID is looked up in the population register, which sends a code
 * to the phone IT holds; typing the code back proves the ID is yours, and only
 * then does the register's answer (name, birth date) come back. Nothing about
 * the person shows before the code, so a stranger's number reveals nobody.
 *
 * What the register does not give, the step asks: how to reach you, and your
 * role in the business.
 */
export function StepYou({
  draft,
  onChange,
  errors,
}: {
  draft: PsfDraft;
  onChange: (next: Partial<PsfDraft>) => void;
  errors: Errors;
}) {
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<"id" | "code">("id");
  const [checkId, setCheckId] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  /** The API handed the code over: no text really went (a test setup). */
  const [filledIn, setFilledIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const idProblem = draft.nid ? nationalIdError(draft.nid) : null;

  const lookup = async () => {
    setProblem(null);
    if (nationalIdError(draft.nid)) {
      setProblem(nationalIdError(draft.nid));
      return;
    }
    if (!consent) {
      setProblem("Tick the box so we can check the number with the national register.");
      return;
    }
    setBusy(true);
    const res = await lookupPsfIdentity({ documentNumber: draft.nid.replace(/\s/g, ""), consent: true });
    setBusy(false);
    if (res.status !== "ok") return setProblem(apiResultMessage(res));
    if (res.data.status !== "code_sent") return setProblem(res.data.message);
    setCheckId(res.data.checkId);
    setSentTo(res.data.sentTo);
    setCode(res.data.demoCode ?? "");
    setFilledIn(Boolean(res.data.demoCode));
    setPhase("code");
  };

  const confirm = async () => {
    if (!checkId) return;
    setProblem(null);
    setBusy(true);
    const res = await confirmPsfIdentity({ checkId, code });
    setBusy(false);
    if (res.status !== "ok") {
      const field = res.status === "refused" ? res.issues?.find((i) => i.path.join(".") === "code")?.message : undefined;
      return setProblem(field ?? apiResultMessage(res));
    }
    const person = res.data;
    onChange({
      applicant: person,
      gender: draft.gender || person.gender || "",
      phone: draft.phone || person.phoneE164 || "",
    });
    setPhase("id");
  };

  const restart = () => {
    onChange({ applicant: null });
    setPhase("id");
    setCode("");
    setCheckId(null);
  };

  const person = draft.applicant;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">About you</h2>
        <p className="mt-1.5 text-muted-foreground">
          We read your name and date of birth from the national register, so you type one number.
        </p>
      </header>

      {person ? (
        <div className="flex flex-col gap-4 rounded-card border border-accent-brand/40 bg-accent-brand/5 p-5 sm:flex-row sm:items-center">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-brand text-lg font-semibold text-accent-brand-foreground">
            {person.firstName[0]}
            {person.lastName[0]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold">{person.fullName}</p>
            <p className="text-sm text-muted-foreground">
              Born {new Date(`${person.dateOfBirth}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
              {" · "}National ID {person.documentNumberMasked}
            </p>
            {person.generated ? (
              <p className="mt-1 text-xs text-muted-foreground">Demo: no real register is connected, so these details were made up.</p>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-brand/15 px-3 py-1 text-xs font-semibold text-accent-text">
              <BadgeCheck size={14} aria-hidden /> Verified with NIDA
            </span>
            <button type="button" onClick={restart} className="text-sm font-medium text-accent-text underline-offset-4 hover:underline">
              Change
            </button>
          </div>
        </div>
      ) : phase === "id" ? (
        <div className="flex flex-col gap-4">
          <Field label="National ID number" hint="16 digits, as printed on your ID card." error={idProblem ?? errors.nid}>
            <div className="flex flex-col gap-2 sm:flex-row">
              <TextInput
                id="psf-nid"
                className="w-full font-mono tracking-wider sm:max-w-tile"
                inputMode="numeric"
                placeholder="1 1990 7 0123456 7 89"
                value={draft.nid}
                onChange={(e) => onChange({ nid: formatNationalId(e.target.value) })}
              />
              <Button variant="primary" onClick={() => void lookup()} pending={busy} disabled={busy}>
                <ShieldCheck size={16} aria-hidden /> Check my ID
              </Button>
            </div>
          </Field>
          <Checkbox isSelected={consent} onChange={(on: boolean) => setConsent(on)} className="items-start gap-3" controlClassName="mt-0.5">
            <span className="text-sm">
              I agree to a check of this number against the national register.
              <span className="block text-xs text-muted-foreground">Only your name, date of birth, gender and registered phone come back.</span>
            </span>
          </Checkbox>
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-card border border-border bg-secondary/60 p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-accent-text ring-1 ring-border">
              <MessageSquareText size={18} aria-hidden />
            </span>
            <div>
              <p className="font-semibold">We sent a code to {sentTo}</p>
              <p className="text-sm text-muted-foreground">
                {filledIn
                  ? "Texts are not sent on this test setup, so we filled the code in for you."
                  : "That is the phone the register holds for this ID. Type the 6 digits to prove it is yours."}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <TextInput
              id="psf-code"
              aria-label="Code from the SMS"
              className="w-full font-mono text-lg tracking-[0.4em] sm:max-w-tile"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
            <Button variant="primary" onClick={() => void confirm()} pending={busy} disabled={busy || code.length !== 6}>
              Confirm
            </Button>
            <Button variant="ghost" onClick={() => setPhase("id")}>
              Use another number
            </Button>
          </div>
        </div>
      )}

      {problem ? <Notice tone="danger">{problem}</Notice> : null}

      <section className={person ? "flex flex-col gap-5" : "pointer-events-none flex flex-col gap-5 opacity-50"} aria-disabled={!person}>
        <div className="border-t border-border pt-6">
          <h3 className="text-base font-semibold">You in the business</h3>
        </div>
        {/* Two plain selects with no hint, so the boxes sit on one line. */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Your role in the business" required error={errors["contact.role"]}>
            <SelectField
              id="psf-role"
              value={draft.role}
              onChange={(v) => onChange({ role: v as PsfContactRole })}
              options={Object.entries(PSF_CONTACT_ROLE_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </Field>
          <Field label="Gender" required error={errors["contact.gender"]}>
            <SelectField
              id="psf-gender"
              value={draft.gender}
              placeholder="Choose"
              onChange={(v) => onChange({ gender: v as PsfDraft["gender"] })}
              options={[
                { value: "female", label: "Female" },
                { value: "male", label: "Male" },
              ]}
            />
          </Field>
        </div>
        <div className="border-t border-border pt-6">
          <h3 className="text-base font-semibold">How PSF reaches you</h3>
          <p className="text-sm text-muted-foreground">
            We text your docID and every decision to this phone. Email is optional, for a copy.
          </p>
        </div>
        <Field label="Phone" required error={errors["contact.phoneE164"]}>
          <PhoneInput id="psf-phone" value={draft.phone} onChange={(v) => onChange({ phone: v })} invalid={Boolean(errors["contact.phoneE164"])} />
        </Field>
        <Field label="Email (optional)" error={errors["contact.email"]}>
          <TextInput
            id="psf-email"
            type="email"
            className="w-full"
            placeholder="you@example.rw"
            value={draft.email}
            onChange={(e) => onChange({ email: e.target.value })}
          />
        </Field>
      </section>
    </div>
  );
}
