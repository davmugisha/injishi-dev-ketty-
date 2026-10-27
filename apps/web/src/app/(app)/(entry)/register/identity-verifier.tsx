"use client";

import { useState } from "react";
import { countryName, type AccountDocumentType, type IdentityOnFile, type IdentityScanResult } from "@injishi/contracts";
import { Button, Checkbox } from "@injishi/web-ui";
import { BadgeCheck, Camera, Clock, IdCard, ScanFace, TriangleAlert } from "lucide-react";

import { scanIdentity } from "@/data/identity";
import { uploadIdPhoto } from "@/data/uploads";
import { apiResultMessage } from "@/lib/api";

import { Callout } from "./register-shell";
import { Offline } from "./wizard-ui";

/**
 * The ID scan (ADR-075 S4): the front of a National ID or a passport's photo
 * page, then a selfie, for both documents alike (O-4). No code is sent to any
 * phone (AC-4).
 *
 * The two photos go up as `id_photo`, then to `POST /me/identity/scan`, which
 * keeps them for the PSF officer whatever the checker makes of them (D-n). The
 * server records the identity before this component hears of it; `onScanned`
 * only tells the step what happened.
 */
export function IdScanner({
  documentType,
  onDocumentTypeChange,
  mode,
  onScanned,
  online = true,
}: {
  documentType: AccountDocumentType;
  onDocumentTypeChange: (next: AccountDocumentType) => void;
  /** The device has a network: the photos upload, and nothing is scanned without one. */
  online?: boolean;
  /** The document verifier's mode: `mock` on the demo, `off` where nothing reads the photos. */
  mode: "mock" | "live" | "off";
  onScanned: (result: IdentityScanResult) => void;
}) {
  const [front, setFront] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const passport = documentType === "passport";

  const scan = async () => {
    if (!front || !selfie || !consent) return;
    setBusy(true);
    setProblem(null);
    const [frontKey, selfieKey] = await Promise.all([
      uploadIdPhoto(front, crypto.randomUUID()),
      uploadIdPhoto(selfie, crypto.randomUUID()),
    ]);
    if (frontKey.status !== "ok" || selfieKey.status !== "ok") {
      setBusy(false);
      const failed = frontKey.status !== "ok" ? frontKey : selfieKey;
      setProblem(failed.status === "ok" ? null : `${apiResultMessage(failed)} The upload needs a connection.`);
      return;
    }
    const res = await scanIdentity(documentType, frontKey.data.objectKey, selfieKey.data.objectKey);
    setBusy(false);
    if (res.status !== "ok") {
      setProblem(apiResultMessage(res));
      return;
    }
    // A refused try is retaken from fresh photos: the old ones are on file already.
    if (res.data.outcome === "machine_failed") {
      setFront(null);
      setSelfie(null);
    }
    onScanned(res.data);
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Type of ID" className="inline-flex self-start rounded-full bg-secondary p-1">
        {(
          [
            ["national_id", "National ID"],
            ["passport", "Passport"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={documentType === id}
            onClick={() => {
              onDocumentTypeChange(id);
              setFront(null);
              setProblem(null);
            }}
            className={
              documentType === id
                ? "min-h-9 rounded-full bg-card px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                : "min-h-9 rounded-full px-4 text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <PhotoSlot
          id="register-id-front"
          step={1}
          label={passport ? "Your passport's photo page" : "The front of your ID card"}
          hint={passport ? "Flat, in good light, the whole page in view." : "Flat, in good light, the whole card in view."}
          icon={passport ? <Camera size={16} aria-hidden /> : <IdCard size={16} aria-hidden />}
          capture="environment"
          file={front}
          onFile={setFront}
        />
        <PhotoSlot
          id="register-id-selfie"
          step={2}
          label="A selfie"
          hint="Face the camera, nothing covering your face."
          icon={<ScanFace size={16} aria-hidden />}
          capture="user"
          file={selfie}
          onFile={setSelfie}
        />
      </div>

      {mode === "mock" ? (
        <p className="text-xs text-muted-foreground">
          Demo: nothing is read from the photos. The demo makes up the details, so use any two different pictures,
          never a real ID.
        </p>
      ) : mode === "off" ? (
        <p className="text-xs text-muted-foreground">
          Your photos are kept for PSF. You type your details next, and PSF compares them with the photos before
          approving.
        </p>
      ) : null}

      <Checkbox
        isSelected={consent}
        onChange={(on: boolean) => setConsent(on)}
        className="items-start gap-3"
        controlClassName="mt-0.5"
      >
        <span className="text-sm font-medium">I agree to Injishi checking my ID.</span>
      </Checkbox>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Button
          onClick={() => void scan()}
          pending={busy}
          disabled={!front || !selfie || !consent || !online}
          aria-describedby={online ? undefined : "register-scan-offline"}
        >
          {busy ? "Checking your photos…" : "Scan my ID"}
        </Button>
        {online ? null : <Offline id="register-scan-offline">You're offline. Connect to scan your ID.</Offline>}
      </div>

      {problem ? (
        <Callout tone="danger" icon={<TriangleAlert size={16} aria-hidden />} title="That did not go through">
          {problem}
        </Callout>
      ) : null}
    </div>
  );
}

function PhotoSlot({
  id,
  step,
  label,
  hint,
  icon,
  capture,
  file,
  onFile,
}: {
  id: string;
  step: number;
  label: string;
  hint: string;
  icon: React.ReactNode;
  capture?: "user" | "environment";
  file: File | null;
  onFile: (file: File | null) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-w-0 cursor-pointer items-center gap-3 rounded-card border border-dashed border-border p-4 text-sm hover:bg-secondary focus-within:ring-2 focus-within:ring-ring"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">
          {step}. {label}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{file ? file.name : hint}</span>
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

/**
 * The identity on file, shown back, with the one status the record supports
 * (AC-6): "Checked" only after a machine check passed, otherwise "PSF will
 * check your ID".
 */
export function IdentityCard({ person }: { person: IdentityOnFile }) {
  const doc =
    person.documentType === "passport"
      ? `Passport ${person.documentNumberMasked}, ${countryName(person.issuingCountry)}`
      : `National ID ${person.documentNumberMasked}`;
  return (
    <div
      className={
        person.checked
          ? "rounded-card border border-success/40 bg-success/10 p-4"
          : "rounded-card border border-border bg-secondary p-4"
      }
    >
      <p className="flex items-center gap-2 text-sm font-semibold">
        {person.checked ? (
          <BadgeCheck size={16} aria-hidden className="text-success" />
        ) : (
          <Clock size={16} aria-hidden className="text-muted-foreground" />
        )}
        {person.checked ? "Checked" : "PSF will check your ID"}
      </p>
      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <Pair label="Name" value={person.fullName} />
        <Pair label="Date of birth" value={person.dateOfBirth} />
        <Pair label="ID" value={doc} />
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">
        {person.generated
          ? "Demo details: the demo made these up. Nothing was read from a document."
          : person.checked
            ? "Read from your ID. If one is wrong, contact support."
            : "You typed these. PSF compares them with your photos before approving."}
      </p>
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
