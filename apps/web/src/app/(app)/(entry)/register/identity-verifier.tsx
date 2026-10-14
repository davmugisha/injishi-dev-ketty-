"use client";

import type { VerifiedPerson } from "@injishi/contracts";
import { Button } from "@heroui/react";
import { BadgeCheck, Camera, ScanFace } from "lucide-react";
import { useRef, useState } from "react";

import { confirmNationalId, lookupNationalId, verifyPassport } from "@/data/identity";
import { uploadIdPhoto } from "@/data/uploads";
import { apiResultMessage } from "@/lib/api";
import { formatNationalId, nationalIdError } from "@/lib/rwanda-id";

import { Field, Notice, TextInput } from "./wizard-ui";

/**
 * Verify who you are instead of typing it (ADR-060).
 *
 * A NATIONAL ID is typed once and validated: the population register sends a
 * code to the phone it holds for that ID, and typing the code back is what
 * proves the ID is yours. Only then does the register's answer — name, date of
 * birth, gender — come back and fill the form, locked. The lookup alone reveals
 * nobody, so typing somebody else's number teaches the typist nothing.
 *
 * A PASSPORT is scanned: a photo of the photo page and a selfie go to the
 * document verifier, which checks the passport is genuine and the selfie is
 * its holder, and answers with what the passport says.
 *
 * Either way the server records the identity as verified before this component
 * hears about it; `onVerified` only updates the form.
 */
export function NationalIdVerifier({
  documentNumber,
  onDocumentNumberChange,
  onVerified,
  error,
}: {
  documentNumber: string;
  onDocumentNumberChange: (next: string) => void;
  onVerified: (person: VerifiedPerson) => void;
  error?: string;
}) {
  const [challenge, setChallenge] = useState<{ id: string; sentTo: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "danger" | "warning" | "info"; text: string } | null>(null);
  const codeField = useRef<HTMLInputElement>(null);

  const digits = documentNumber.replace(/\s+/g, "");
  const shapeError = digits === "" ? null : nationalIdError(documentNumber);

  const lookup = async () => {
    if (nationalIdError(documentNumber) !== null) return;
    setBusy(true);
    setMessage(null);
    const res = await lookupNationalId(digits);
    setBusy(false);
    if (res.status !== "ok") {
      setMessage({ tone: "danger", text: apiResultMessage(res) });
      return;
    }
    const answer = res.data;
    if (answer.status === "code_sent") {
      setChallenge({ id: answer.challengeId, sentTo: answer.sentTo });
      setCode("");
      window.setTimeout(() => codeField.current?.focus(), 50);
      return;
    }
    setChallenge(null);
    setMessage({ tone: answer.status === "unavailable" ? "warning" : "danger", text: answer.message });
  };

  const confirm = async () => {
    if (!challenge || !/^\d{6}$/.test(code.trim())) return;
    setBusy(true);
    setMessage(null);
    const res = await confirmNationalId(challenge.id, code.trim());
    setBusy(false);
    if (res.status === "ok") {
      onVerified(res.data);
      return;
    }
    setMessage({ tone: "danger", text: apiResultMessage(res) });
    // A spent or replaced code cannot be retried; the person asks for a new one.
    if (res.status === "refused" && res.httpStatus === 410) setChallenge(null);
  };

  return (
    <div className="space-y-4">
      <Field
        label="National ID number"
        required
        hint="16 digits, as printed on your card. We check it with the population register and send a code to the phone it holds for you."
        error={error ?? shapeError ?? undefined}
      >
        <span className="flex gap-2">
          <TextInput
            id="you-document-number"
            className="grow"
            inputMode="numeric"
            autoComplete="off"
            placeholder="1 1995 8 0012345 12 3"
            maxLength={24}
            value={documentNumber}
            disabled={challenge !== null}
            onChange={(e) => onDocumentNumberChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void lookup();
            }}
          />
          {challenge === null ? (
            <Button
              variant="primary"
              onPress={() => void lookup()}
              isDisabled={nationalIdError(documentNumber) !== null}
              isPending={busy}
            >
              {busy ? "Checking…" : "Validate"}
            </Button>
          ) : (
            <Button
              variant="ghost"
              onPress={() => {
                setChallenge(null);
                setMessage(null);
              }}
            >
              Change
            </Button>
          )}
        </span>
      </Field>

      {challenge ? (
        <div className="space-y-3 rounded-card border border-border bg-secondary p-4">
          <p className="text-sm">
            We sent a 6 digit code to <b>{challenge.sentTo}</b>, the phone the
            population register holds for National ID{" "}
            {formatNationalId(digits)}.
          </p>
          <Field label="Code" required>
            <span className="flex gap-2">
              <TextInput
                ref={codeField}
                id="you-identity-code"
                className="grow"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void confirm();
                }}
              />
              <Button
                variant="primary"
                onPress={() => void confirm()}
                isDisabled={!/^\d{6}$/.test(code.trim())}
                isPending={busy}
              >
                {busy ? "Confirming…" : "Confirm"}
              </Button>
            </span>
          </Field>
          <Button variant="ghost" size="sm" onPress={() => void lookup()} isDisabled={busy}>
            Send a new code
          </Button>
        </div>
      ) : null}

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
    </div>
  );
}

/** A passport page and a selfie, read and matched by the document verifier. */
export function PassportScanner({
  onVerified,
}: {
  onVerified: (person: VerifiedPerson) => void;
}) {
  const [page, setPage] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "danger" | "warning"; text: string } | null>(null);

  const scan = async () => {
    if (!page || !selfie) return;
    setBusy(true);
    setMessage(null);
    const [pageKey, selfieKey] = await Promise.all([
      uploadIdPhoto(page, crypto.randomUUID()),
      uploadIdPhoto(selfie, crypto.randomUUID()),
    ]);
    if (pageKey.status !== "ok" || selfieKey.status !== "ok") {
      setBusy(false);
      const failed = pageKey.status !== "ok" ? pageKey : selfieKey;
      setMessage({ tone: "danger", text: failed.status === "ok" ? "" : apiResultMessage(failed) });
      return;
    }
    const res = await verifyPassport(pageKey.data.objectKey, selfieKey.data.objectKey);
    setBusy(false);
    if (res.status !== "ok") {
      setMessage({ tone: "danger", text: apiResultMessage(res) });
      return;
    }
    if (res.data.status === "verified") {
      onVerified(res.data.person);
      return;
    }
    setMessage({ tone: res.data.status === "unavailable" ? "warning" : "danger", text: res.data.message });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Take two photos: your passport&apos;s photo page, flat and in good light,
        then a selfie. We check the passport is genuine and that the selfie is
        you, and fill in your details from it.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <PhotoSlot
          id="you-passport-page"
          label="Passport photo page"
          icon={<Camera size={16} aria-hidden />}
          capture="environment"
          file={page}
          onFile={setPage}
        />
        <PhotoSlot
          id="you-passport-selfie"
          label="A selfie"
          icon={<ScanFace size={16} aria-hidden />}
          capture="user"
          file={selfie}
          onFile={setSelfie}
        />
      </div>
      <Button
        variant="primary"
        onPress={() => void scan()}
        isDisabled={!page || !selfie}
        isPending={busy}
      >
        {busy ? "Checking your passport…" : "Scan and verify"}
      </Button>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
    </div>
  );
}

function PhotoSlot({
  id,
  label,
  icon,
  capture,
  file,
  onFile,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  capture: "user" | "environment";
  file: File | null;
  onFile: (file: File | null) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-3 rounded-card border border-dashed border-border p-4 text-sm hover:bg-secondary"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {file ? file.name : "Take or choose a photo"}
        </span>
      </span>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        capture={capture}
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

/** The verified person, shown back locked, with where the answer came from. */
export function VerifiedIdentityCard({
  person,
  method,
}: {
  person: Pick<VerifiedPerson, "fullName" | "dateOfBirth" | "gender" | "documentType" | "documentNumberMasked" | "issuingCountry" | "generated">;
  method: "registry" | "document_scan" | string | null;
}) {
  return (
    <div className="rounded-card border border-success/40 bg-success/10 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <BadgeCheck size={16} aria-hidden className="text-success" />
        {method === "document_scan" ? "Verified from your passport" : "Verified with the population register"}
      </p>
      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <Pair label="Name" value={person.fullName} />
        <Pair label="Date of birth" value={person.dateOfBirth} />
        <Pair label="Gender" value={person.gender ? person.gender[0]!.toUpperCase() + person.gender.slice(1) : "Not recorded"} />
        <Pair
          label={person.documentType === "passport" ? "Passport" : "National ID"}
          value={`${person.documentNumberMasked} · ${person.issuingCountry}`}
        />
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">
        These come from the {method === "document_scan" ? "passport" : "register"} and
        cannot be edited here. If one is wrong, it has to be corrected at the
        source.
      </p>
      {person.generated ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Demo: no real register or passport reader is connected, so these
          details were generated for this demonstration.
        </p>
      ) : null}
    </div>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
