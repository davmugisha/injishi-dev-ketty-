"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@injishi/ui";
import { formatNationalId, nationalIdError } from "@/lib/rwanda-id";
import {
  readTraining,
  setEnrolment,
  type TrainingEnrolment,
} from "@/lib/training-store";
import { PhoneField, countryOf, nationalLength } from "./phone-field";

/**
 * The enrolment form: the one client island on `/training/enroll`.
 *
 * It writes through `setEnrolment` in `lib/training-store.ts` and holds no
 * store of its own, which is the whole reason the certificate screen three
 * routes away can print a name this form collected.
 *
 * HYDRATION. The draft starts empty in `useState`, so the server render and
 * the first client render agree; `readTraining()` is called in an effect,
 * never during render, because it reads `localStorage` and returns the empty
 * state on the server. Everything derived from a stored enrolment — the
 * "you enrolled on…" line, the prefilled fields — therefore appears on the
 * pass after mount rather than in the markup.
 *
 * IT DOES NOT SUBSCRIBE TO THE STORE. `subscribeTraining` exists and every
 * other training screen uses it, but this one is the only writer of an
 * enrolment, and a write from a second tab arriving mid-sentence would replace
 * what somebody is typing here with what they typed there. So the store is read
 * ONCE, on mount, and the form owns the draft from that point on.
 *
 * VALIDATION IS SHOWN, NOT ENFORCED IN SILENCE. Every field says what is wrong
 * with it, in its own words, under the control it is about — a single "check
 * your details" at the top of a four-field form makes a person re-read four
 * correct answers looking for the wrong one. The National ID rule is
 * `nationalIdError` from `lib/rwanda-id.ts` rather than a regex written here:
 * that function is what the registration wizard and `@injishi/contracts` both
 * ask, and a fifth copy of "sixteen digits" is a fifth thing to get wrong.
 */

/** The four values the form holds. `enrolledAt` is stamped by the store. */
type Draft = Omit<TrainingEnrolment, "enrolledAt">;

type FieldName = keyof Draft;

const EMPTY_DRAFT: Draft = {
  fullName: "",
  email: "",
  phone: "",
  nationalId: "",
};

const FIELD_ORDER: FieldName[] = ["fullName", "email", "phone", "nationalId"];

/**
 * Why this name is not usable, or `null`.
 *
 * Two parts rather than one, because the certificate prints this string and a
 * certificate reading "Uwase" names half the population of a district. It does
 * NOT try to judge which part is the family name: Rwandan names put it first
 * and the diaspora forms put it last, and a form that guesses gets it wrong for
 * one of them.
 */
function nameError(value: string): string | null {
  const parts = value.trim().split(/\s+/).filter((part) => part.length > 0);
  if (parts.length === 0) {
    return "Enter your name as it appears on your National ID.";
  }
  if (parts.length < 2 || parts.some((part) => part.length < 2)) {
    return "Enter both of your names — the certificate is printed with exactly what you type here.";
  }
  return null;
}

/**
 * Why this e-mail address is not usable, or `null`.
 *
 * Deliberately loose. The only address this demo can prove is deliverable is
 * one it sends to, and it sends nothing; a stricter pattern would refuse real
 * addresses (a `+tag`, a long new suffix) to catch typos it cannot see anyway.
 * So it checks the shape a person can check themselves — one `@`, a dot after
 * it — and says which half looks wrong.
 */
function emailError(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "Enter the e-mail address the certificate should be sent to.";
  }
  if (!/^[^\s@]+@[^\s@]+$/.test(trimmed)) {
    return "That is missing the @ — an address looks like uwase@example.rw.";
  }
  if (!/\.[A-Za-z]{2,}$/.test(trimmed)) {
    return "The part after the @ needs a domain ending, like .rw or .com.";
  }
  return null;
}

/**
 * Why this phone number is not usable, or `null`.
 *
 * The length is checked against the country the number names, and the message
 * says the country, because "that number is too short" is unanswerable to
 * somebody who has just typed a number they know is right — they need to be
 * told which plan it was measured against so they can see the dropdown is on
 * the wrong row.
 */
function phoneError(value: string): string | null {
  if (value.trim().length === 0) {
    return "Enter the phone number you will pay the fee from.";
  }
  const country = countryOf(value);
  const digits = nationalLength(value);
  if (country === null) {
    return "Pick a country from the list beside the number.";
  }
  if (digits < country.nationalDigits) {
    return `That is ${digits} digits after ${country.dial}. A ${country.name} number has ${country.nationalDigits}.`;
  }
  return null;
}

const VALIDATE: Record<FieldName, (value: string) => string | null> = {
  fullName: nameError,
  email: emailError,
  phone: phoneError,
  nationalId: nationalIdError,
};

export function EnrolForm() {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  /** The enrolment already on this device, found on mount. */
  const [existing, setExisting] = useState<TrainingEnrolment | null>(null);
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [attempted, setAttempted] = useState(false);
  /** Set between the write and the navigation, so the button cannot be pressed twice. */
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const { enrolment } = readTraining();
    if (enrolment === null) return;
    setExisting(enrolment);
    setDraft({
      fullName: enrolment.fullName,
      email: enrolment.email,
      phone: enrolment.phone,
      nationalId: enrolment.nationalId,
    });
  }, []);

  const errors: Partial<Record<FieldName, string>> = {};
  for (const field of FIELD_ORDER) {
    const problem = VALIDATE[field](draft[field]);
    if (problem !== null) errors[field] = problem;
  }
  const valid = Object.keys(errors).length === 0;

  /** An error is shown once the person has left the field, or once they submit. */
  const shownError = (field: FieldName): string | undefined =>
    attempted || touched[field] ? errors[field] : undefined;

  const submit = () => {
    setAttempted(true);
    if (!valid) {
      // Put the caret on the first thing that is wrong rather than leaving the
      // person to find it. Four fields fit on a phone screen; forty would not,
      // and the habit is worth keeping either way.
      const first = FIELD_ORDER.find((field) => errors[field]);
      if (first) document.getElementById(first)?.focus();
      return;
    }
    setSaving(true);
    setEnrolment({
      fullName: draft.fullName.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      // Stored grouped the way `formatNationalId` prints it — six groups of
      // 1/4/1/7/2/1 — so the payment notice and the certificate read it back in
      // the shape the person would read it off the document rather than as
      // sixteen unbroken digits nobody can check by eye.
      nationalId: formatNationalId(draft.nationalId),
    });
    router.push("/training/pay");
  };

  return (
    <form
      className="flex flex-col gap-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {existing ? (
        <ResumeNotice enrolment={existing} onContinue={() => router.push("/training/pay")} />
      ) : null}

      <Field
        htmlFor="fullName"
        label="Full name"
        hint="As printed on your National ID. This is what the certificate will say."
        error={shownError("fullName")}
      >
        <Input
          id="fullName"
          name="fullName"
          type="text"
          autoComplete="name"
          placeholder="Uwase Mukamana Claudine"
          value={draft.fullName}
          aria-invalid={shownError("fullName") ? true : undefined}
          aria-describedby={describedBy("fullName", shownError("fullName"))}
          onChange={(event) =>
            setDraft((current) => ({ ...current, fullName: event.target.value }))
          }
          onBlur={() => setTouched((t) => ({ ...t, fullName: true }))}
        />
      </Field>

      <Field
        htmlFor="email"
        label="E-mail address"
        hint="The certificate is sent here the moment you pass."
        error={shownError("email")}
      >
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="uwase@example.rw"
          value={draft.email}
          aria-invalid={shownError("email") ? true : undefined}
          aria-describedby={describedBy("email", shownError("email"))}
          onChange={(event) =>
            setDraft((current) => ({ ...current, email: event.target.value }))
          }
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
        />
      </Field>

      <Field
        htmlFor="phone"
        label="Phone number"
        hint="Pay the fee from this line so the MoMo reference and the enrolment match."
        error={shownError("phone")}
      >
        <div onBlur={() => setTouched((t) => ({ ...t, phone: true }))}>
          <PhoneField
            id="phone"
            value={draft.phone}
            invalid={shownError("phone") !== undefined}
            describedBy={describedBy("phone", shownError("phone"))}
            onChange={(next) =>
              setDraft((current) => ({ ...current, phone: next }))
            }
          />
        </div>
      </Field>

      <Field
        htmlFor="nationalId"
        label="National ID"
        hint="Sixteen digits. Type it with the spacing on the card if that is easier."
        error={shownError("nationalId")}
      >
        <Input
          id="nationalId"
          name="nationalId"
          type="text"
          inputMode="numeric"
          /* Sixteen digits, in the six groups `formatNationalId` prints.
             `lib/rwanda-id.ts` and the registration wizard once carried
             `1 1995 8 0012345 6 7`, which is FIFTEEN — it drops a digit from the
             origin group — so a person copying the shape of the placeholder was
             told their own correct number was one digit short. All of them read
             the same sixteen-digit example now, and `check-validators.mjs`
             drives every worked example in these files through
             `nationalIdError`, so an example the field would refuse fails the
             build rather than reaching a person. */
          placeholder="1 1995 8 0012345 12 3"
          value={draft.nationalId}
          aria-invalid={shownError("nationalId") ? true : undefined}
          aria-describedby={describedBy("nationalId", shownError("nationalId"))}
          onChange={(event) =>
            setDraft((current) => ({ ...current, nationalId: event.target.value }))
          }
          onBlur={() => setTouched((t) => ({ ...t, nationalId: true }))}
        />
      </Field>

      <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
        <Button type="submit" size="lg" disabled={saving}>
          {existing ? "Save and go to payment" : "Enrol and go to payment"}
        </Button>
        <p className="text-sm text-page-fg-70">
          Nothing is charged on this screen.
        </p>
      </div>
    </form>
  );
}

/**
 * The banner a returning learner sees.
 *
 * It sits ABOVE the fields rather than replacing them, which is the point: the
 * form is already filled in with what was stored, so somebody who came back to
 * fix a typo can just fix it, and somebody who came back to pay can press the
 * button here without scrolling past four answered questions. Replacing the
 * form with a summary card would make the second person's route shorter and
 * the first person's route a click longer, for no gain.
 */
function ResumeNotice({
  enrolment,
  onContinue,
}: {
  enrolment: TrainingEnrolment;
  onContinue: () => void;
}) {
  return (
    <div
      className="flex flex-col gap-3 rounded-card border border-accent-brand bg-secondary p-5"
      role="status"
    >
      <p className="text-sm text-page-fg">
        <b>You already enrolled on this device</b>
        {enrolment.enrolledAt ? ` on ${enrolledOn(enrolment.enrolledAt)}` : null},
        as <b>{enrolment.fullName}</b>. Your answers are below — change anything
        that is wrong, or carry straight on to the fee.
      </p>
      <div>
        <Button type="button" variant="outline" onClick={onContinue}>
          Continue to payment
        </Button>
      </div>
    </div>
  );
}

/**
 * A stored ISO timestamp as a date a person reads.
 *
 * Only ever called from a branch that renders after mount, so the fixed
 * `en-GB` locale cannot produce a server/client mismatch — it is here because
 * the browser's own locale would make the same demo read differently on two
 * laptops in the same room.
 */
function enrolledOn(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "an earlier visit";
  return when.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** The id of the message a control is described by, or nothing. */
function describedBy(field: FieldName, error: string | undefined): string {
  return error ? `${field}-error` : `${field}-hint`;
}

/** One labelled control, with room for a hint and a validation message. */
function Field({
  htmlFor,
  label,
  hint,
  error,
  children,
}: {
  htmlFor: FieldName;
  label: string;
  hint: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-bold text-page-fg">
        {label}
      </label>
      <p id={`${htmlFor}-hint`} className="text-sm text-page-fg-70">
        {hint}
      </p>
      <div className="mt-0.5">{children}</div>
      {error ? (
        <p
          id={`${htmlFor}-error`}
          role="alert"
          className="text-sm font-medium text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
