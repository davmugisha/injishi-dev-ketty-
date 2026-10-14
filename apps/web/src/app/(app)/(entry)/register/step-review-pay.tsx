"use client";

import { useState } from "react";
import { CERTIFICATE_KIND_LABEL, type RegistrationSummary } from "@injishi/contracts";
import { Alert } from "@heroui/react";
import { Button } from "@injishi/ui";
import { ChevronDown } from "lucide-react";
import { cn } from "@injishi/utils";

import {
  CONTRACT_OPERATOR,
  CONTRACT_TITLE,
  registrationContractClauses,
  type ContractSignature,
  type RegistrationContractInput,
} from "@/lib/registration-contract";

import { EMPTY_ADDRESS, useAddressLine, type AddressDraft } from "./address-picker";
import type { DocumentDraft } from "./business-documents";
import { StepCard } from "./register-shell";
import { SignaturePad, type SignatureCapture } from "./signature-pad";
import type { BranchDraft } from "./step-branches";
import { Notice, formatRwf } from "./wizard-ui";

/**
 * Check, sign and pay (RegisterIA board): one last look, the fee, the
 * agreement and the payment, on one screen.
 *
 * The read back is one row per answer with a Change link that lands on the
 * step that asked, so nothing is lost by changing something here. Then the fee,
 * which this screen states because this is the screen that charges it (owner
 * decision 2026-09-27); then the agreement, folded away but one press from
 * being read; then the signature, under the name the register verified rather
 * than a name typed again (the audit's "shown, not asked"). One press, "Sign
 * and pay", runs the server's own order: create, accept the contract, pay
 * (ADR-053 AC-R8), each skipped once it has happened.
 *
 * THE PAYMENT IS NOT MOBILE MONEY YET, and the screen says so rather than
 * drawing an MTN or Airtel choice that goes nowhere. `POST /registrations/:id/pay`
 * is the stand-in for the payment provider until F-S08: it records the fee as
 * paid and sends no prompt to any phone.
 */

export interface ReadBackRow {
  label: string;
  value: string;
  /** The step that asked, or null when it can no longer change. */
  change: "about" | "business" | "place" | null;
}

export function StepReviewPay({
  rows,
  whereAddress,
  branches,
  documents,
  amount,
  signerName,
  signerSource,
  payPhone,
  contractInput,
  summary,
  busy,
  error,
  onSignAndPay,
  onBack,
  onChange,
  onStartNew,
}: {
  /** Everything but Where and the documents, which are worded here. */
  rows: ReadBackRow[];
  whereAddress: AddressDraft | null;
  branches: BranchDraft[];
  documents: DocumentDraft[];
  /** The fee to charge, or null when this kind cannot be quoted. */
  amount: number | null;
  signerName: string;
  /** "NIDA" or "passport" when the name was verified; null when typed. */
  signerSource: "NIDA" | "passport" | null;
  payPhone: string | null;
  contractInput: RegistrationContractInput;
  /** Set when the registration already exists and is waiting for its fee. */
  summary: RegistrationSummary | null;
  busy: boolean;
  error: string;
  onSignAndPay: (signature: ContractSignature | null) => Promise<void>;
  onBack: (() => void) | null;
  onChange: (step: "about" | "business" | "place") => void;
  onStartNew: () => void;
}) {
  const [terms, setTerms] = useState(false);
  const [capture, setCapture] = useState<SignatureCapture | null>(null);
  const [localError, setLocalError] = useState("");
  const where = useAddressLine(whereAddress ?? EMPTY_ADDRESS);
  const accepted = summary !== null && summary.contractAcceptedAt !== null;
  const clauses = registrationContractClauses(contractInput);

  const all: ReadBackRow[] = [
    ...rows.slice(0, 2),
    ...(whereAddress ? [{ label: "Where", value: where ?? "Not chosen", change: "business" as const }] : []),
    ...(branches.length
      ? [
          {
            label: "Other locations",
            value: branches.map((b) => b.name.trim() || "Unnamed").join(", "),
            change: "business" as const,
          },
        ]
      : []),
    ...rows.slice(2),
    ...(summary
      ? []
      : [
          {
            label: "Documents",
            value: documents.length
              ? documents
                  .map((d) =>
                    d.kind === "other" ? d.kindOther.trim() || "A document" : d.kind ? CERTIFICATE_KIND_LABEL[d.kind] : d.filename,
                  )
                  .join(", ")
              : "None yet. The verifier asks at the visit.",
            change: "business" as const,
          },
        ]),
  ];

  async function signAndPay() {
    if (amount === null) return;
    if (!accepted && capture === null) {
      setLocalError("Sign the agreement above first.");
      return;
    }
    setLocalError("");
    await onSignAndPay(
      accepted || capture === null
        ? null
        : {
            dataUrl: capture.dataUrl,
            method: capture.method,
            signedName: signerName,
            // In the press handler, never during a render: a date read while
            // rendering differs between server and browser.
            signedAt: new Date().toISOString(),
          },
    );
  }

  const shown = localError || error;

  return (
    <StepCard
      id="register-pay"
      title="Check, sign and pay"
      lead={
        summary
          ? `${summary.legalName} is registered and waiting for its fee. ${accepted ? "Its agreement is signed." : "Sign the agreement, then pay."}`
          : "One last look. Change anything from here without losing the rest."
      }
      footer={
        <>
          {onBack ? (
            <Button variant="ghost" onClick={onBack}>
              Back
            </Button>
          ) : (
            <Button variant="ghost" onClick={onStartNew}>
              Register a different business
            </Button>
          )}
          <Button onClick={() => void signAndPay()} pending={busy} disabled={amount === null}>
            {busy
              ? "Recording the payment…"
              : amount === null
                ? "Sign and pay"
                : accepted
                  ? `Pay ${formatRwf(amount)}`
                  : `Sign and pay ${formatRwf(amount)}`}
          </Button>
        </>
      }
    >
      <dl className="flex flex-col">
        {all.map((row) => (
          <div
            key={row.label}
            className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-border py-3 text-sm first:border-t-0"
          >
            <dt className="w-36 shrink-0 font-medium text-muted-foreground">{row.label}</dt>
            <dd className="min-w-0 flex-1 basis-56">{row.value}</dd>
            {row.change && !summary ? (
              <button
                type="button"
                onClick={() => onChange(row.change!)}
                className="rounded text-sm font-semibold text-accent-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Change<span className="sr-only"> {row.label}</span>
              </button>
            ) : null}
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-card bg-secondary px-4 py-4">
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold">One time registration fee</span>
          <span className="text-xs text-muted-foreground">
            Then a monthly plan once you are live. No commission.
          </span>
        </span>
        <span className="text-2xl font-bold tabular-nums">
          {amount === null ? "Not available" : formatRwf(amount)}
        </span>
      </div>
      {amount === null ? (
        <Notice tone="warning">
          We could not load the fee for this kind of registration, so it cannot be paid yet.
          Try again shortly.
        </Notice>
      ) : null}

      {accepted ? null : (
        <>
          <div>
            <button
              type="button"
              aria-expanded={terms}
              aria-controls="register-terms"
              onClick={() => setTerms(!terms)}
              className="inline-flex items-center gap-1.5 rounded text-sm font-semibold text-accent-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {terms ? "Hide the operator agreement" : "Read the operator agreement"}
              <ChevronDown size={16} aria-hidden className={cn("transition-transform", terms && "rotate-180")} />
            </button>
            {terms ? (
              <div
                id="register-terms"
                role="region"
                aria-label={`${CONTRACT_TITLE}, version ${contractInput.contractVersion}`}
                tabIndex={0}
                className="mt-2.5 max-h-80 overflow-y-auto rounded-card bg-secondary p-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <p className="font-semibold">
                  {CONTRACT_TITLE} · Version {contractInput.contractVersion}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Between {CONTRACT_OPERATOR} and you. Injishi records that you accepted this
                  version and when; the copy you can download afterwards carries your signature.
                </p>
                <ol className="mt-4 flex flex-col gap-4">
                  {clauses.map((clause) => (
                    <li key={clause.number}>
                      <h3 className="font-semibold">
                        <span className="tabular-nums text-muted-foreground">{clause.number}.</span>{" "}
                        {clause.heading}
                      </h3>
                      {clause.body.map((paragraph) => (
                        <p key={paragraph.slice(0, 40)} className="mt-1.5 leading-relaxed text-muted-foreground">
                          {paragraph}
                        </p>
                      ))}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Sign the operator agreement</span>
            <SignaturePad
              value={capture}
              onChange={(next) => {
                setCapture(next);
                if (next !== null) setLocalError("");
              }}
              signerName={signerName}
            />
            <span className="text-xs text-muted-foreground">
              Signing as {signerName || "you"}
              {signerSource === "NIDA"
                ? ", verified with NIDA."
                : signerSource === "passport"
                  ? ", verified from your passport."
                  : ", as on your account."}
            </span>
          </div>
        </>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">
          Pay with mobile money{payPhone ? ` on ${payPhone}` : ""}
        </span>
        <Alert status="default">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Mobile money is not connected yet</Alert.Title>
            <Alert.Description>
              No prompt reaches your phone today. Pressing {accepted ? "Pay" : "Sign and pay"} records
              the fee against this registration and sends it for review; the payment provider
              replaces this step when it is connected.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      </div>

      {shown ? <Notice tone="danger">{shown}</Notice> : null}
    </StepCard>
  );
}
