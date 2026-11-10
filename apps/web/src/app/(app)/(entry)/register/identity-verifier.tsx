"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  countryName,
  type AccountDocumentType,
  type IdentityAdapterMode,
  type IdentityOnFile,
  type IdentityScanResult,
} from "@injishi/contracts";
import { Button, Checkbox, Tabs, TabsList, TabsTrigger } from "@injishi/web-ui";
import { BadgeCheck, Camera, Clock, IdCard, ScanFace, TriangleAlert } from "lucide-react";

import { checkNationalId, scanIdentity } from "@/data/identity";
import { uploadIdPhoto } from "@/data/uploads";
import { apiResultMessage } from "@/lib/api";
import { nationalIdError } from "@/lib/rwanda-id";

import { COUNTRY_OPTIONS } from "./country-options";
import { Callout } from "./register-shell";
import { Field, Offline, SelectField, TextInput } from "./wizard-ui";

/**
 * Proving who you are on the You step. No code is sent to any phone (ADR-075 AC-4).
 *
 * - A RWANDAN NATIONAL ID is checked by its number against NIDA's register,
 *   through GTBank: type the 16 digits. Since 2026-11-02 (the owner's call) no
 *   selfie is taken: NIDA's details fill the form and the document reviewer
 *   confirms the ID. Where that check is switched off (`nationalIdMode` `off`)
 *   the card is scanned instead, front then selfie, as before.
 * - A PASSPORT is checked by Smile ID: the country that issued it, the photo
 *   page, then a selfie.
 *
 * Every photo goes up as `id_photo` and is kept for the PSF officer whatever
 * the checker makes of it (D-n). The server records the identity before this
 * component hears of it; `onScanned` only tells the step what happened.
 */
export function IdScanner({
  documentType,
  onDocumentTypeChange,
  mode,
  nationalIdMode,
  onScanned,
  online = true,
}: {
  documentType: AccountDocumentType;
  onDocumentTypeChange: (next: AccountDocumentType) => void;
  /** The device has a network: the photos upload, and nothing is checked without one. */
  online?: boolean;
  /** The document verifier's mode (passports; National ID cards where the register is off). */
  mode: IdentityAdapterMode;
  /** The National ID register's mode: anything but `off` checks a National ID by its number. */
  nationalIdMode: IdentityAdapterMode;
  onScanned: (result: IdentityScanResult) => void;
}) {
  const t = useTranslations("registerForms.verify");
  const [front, setFront] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [nationalId, setNationalId] = useState("");
  const [country, setCountry] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const passport = documentType === "passport";
  const byNumber = !passport && nationalIdMode !== "off";
  const numberProblem = byNumber && nationalId.trim() !== "" ? nationalIdError(nationalId) : null;
  // A National ID checked by its number needs no photo (2026-11-02): the reviewer confirms it instead.
  const ready =
    consent &&
    online &&
    (byNumber ? nationalId.trim() !== "" && !numberProblem : Boolean(selfie) && Boolean(front) && (!passport || country !== ""));
  const demo = byNumber ? nationalIdMode : mode;

  const reset = () => {
    setFront(null);
    setSelfie(null);
    setProblem(null);
    setTouched(false);
  };

  const check = async () => {
    setTouched(true);
    if (!ready) return;
    setBusy(true);
    setProblem(null);
    if (byNumber) {
      const res = await checkNationalId(nationalId.replace(/\s+/g, ""));
      setBusy(false);
      if (res.status !== "ok") return setProblem(apiResultMessage(res));
      onScanned(res.data);
      return;
    }
    if (!selfie) {
      setBusy(false);
      return;
    }
    const uploads = await Promise.all([
      uploadIdPhoto(selfie, crypto.randomUUID()),
      byNumber || !front ? Promise.resolve(null) : uploadIdPhoto(front, crypto.randomUUID()),
    ]);
    for (const upload of uploads) {
      if (upload && upload.status !== "ok") {
        setBusy(false);
        setProblem(`${apiResultMessage(upload)} ${t("uploadNeedsConnection")}`);
        return;
      }
    }
    const [selfieUpload, frontUpload] = uploads;
    const selfieKey = selfieUpload?.status === "ok" ? selfieUpload.data.objectKey : "";
    const res = await scanIdentity(
      documentType,
      frontUpload?.status === "ok" ? frontUpload.data.objectKey : "",
      selfieKey,
      passport ? country : undefined,
    );
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
      <Tabs
        value={documentType}
        onValueChange={(next) => {
          onDocumentTypeChange(next as AccountDocumentType);
          reset();
        }}
      >
        <TabsList aria-label={t("tabsLabel")} className="self-start">
          <TabsTrigger value="national_id">{t("nationalIdTab")}</TabsTrigger>
          <TabsTrigger value="passport">{t("passportTab")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {byNumber ? (
        <Field
          label={t("idNumber")}
          required
          hint={t("idNumberHint")}
          error={numberProblem ?? (touched && nationalId.trim() === "" ? t("idRequired") : undefined)}
        >
          <TextInput
            id="register-national-id"
            inputMode="numeric"
            autoComplete="off"
            placeholder={t("idPlaceholder")}
            maxLength={24}
            value={nationalId}
            onChange={(e) => setNationalId(e.target.value)}
          />
        </Field>
      ) : null}

      {passport ? (
        <Field
          label={t("passportCountry")}
          required
          error={touched && country === "" ? t("passportCountryRequired") : undefined}
        >
          <SelectField
            id="register-passport-country"
            value={country}
            onChange={setCountry}
            options={COUNTRY_OPTIONS}
            placeholder={t("pickCountry")}
          />
        </Field>
      ) : null}

      {/* A National ID checked by its number takes no photo (2026-11-02); a card scan still takes two. */}
      {byNumber ? null : (
        <div className="grid gap-3 sm:grid-cols-2">
          <PhotoSlot
            id="register-id-front"
            step={1}
            label={passport ? t("frontPassport") : t("frontId")}
            hint={passport ? t("frontPassportHint") : t("frontIdHint")}
            icon={passport ? <Camera size={16} aria-hidden /> : <IdCard size={16} aria-hidden />}
            capture="environment"
            file={front}
            onFile={setFront}
          />
          <PhotoSlot
            id="register-id-selfie"
            step={2}
            label={t("selfie")}
            hint={t("selfieHint")}
            icon={<ScanFace size={16} aria-hidden />}
            capture="user"
            file={selfie}
            onFile={setSelfie}
          />
        </div>
      )}

      {demo === "mock" ? (
        <p className="text-xs text-muted-foreground">
          {byNumber ? t("demoMockNumber") : t("demoMockPhoto")}
        </p>
      ) : demo === "sandbox" ? (
        <p className="text-xs text-muted-foreground">
          {t("demoSandbox", {
            provider: byNumber ? "NIDA" : t("smileId"),
            subject: byNumber ? t("aNationalId") : t("aPersonPhotos"),
          })}
        </p>
      ) : demo === "off" ? (
        <p className="text-xs text-muted-foreground">
          {t("demoOff")}
        </p>
      ) : null}

      <Checkbox
        isSelected={consent}
        onChange={(on: boolean) => setConsent(on)}
        className="items-start gap-3"
        controlClassName="mt-0.5"
      >
        <span className="text-sm font-medium">
          {byNumber ? t("consentNida") : t("consent")}
        </span>
      </Checkbox>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Button
          onClick={() => void check()}
          pending={busy}
          disabled={!ready}
          aria-describedby={online ? undefined : "register-scan-offline"}
        >
          {busy ? t("checking") : byNumber ? t("checkId") : t("scanId")}
        </Button>
        {online ? null : <Offline id="register-scan-offline">{t("offline")}</Offline>}
      </div>

      {problem ? (
        <Callout tone="danger" icon={<TriangleAlert size={16} aria-hidden />} title={t("failedTitle")}>
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
        accept="image/jpeg,image/png,image/webp"
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
  const t = useTranslations("registerForms.verify");
  const doc =
    person.documentType === "passport"
      ? t("docPassport", { number: person.documentNumberMasked, country: countryName(person.issuingCountry) })
      : t("docNationalId", { number: person.documentNumberMasked });
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
        {person.checked ? t("statusChecked") : t("statusPsf")}
      </p>
      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <Pair label={t("name")} value={person.fullName} />
        <Pair label={t("dateOfBirth")} value={person.dateOfBirth} />
        <Pair label={t("id")} value={doc} />
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">{provenance(person, t)}</p>
    </div>
  );
}

/** Where the details came from, in one sentence. */
function provenance(
  person: IdentityOnFile,
  t: ReturnType<typeof useTranslations<"registerForms.verify">>,
): string {
  if (person.generated) return t("provenanceGenerated");
  if (person.source === "registry") {
    return person.checked ? t("provenanceRegistryChecked") : t("provenanceRegistryPending");
  }
  if (person.checked) return t("provenanceRead");
  return t("provenanceTyped");
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
