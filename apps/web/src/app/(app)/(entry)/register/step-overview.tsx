"use client";

import { useState } from "react";
import { Button } from "@injishi/web-ui";
import { ChevronDown, FileText } from "lucide-react";
import { cn } from "@injishi/utils";

import {
  CONTRACT_OPERATOR,
  CONTRACT_TITLE,
  registrationContractClauses,
  type RegistrationContractInput,
} from "@/lib/registration-contract";

import type { StepId } from "./register-steps";
import { SignaturePad, type SignatureCapture } from "./signature-pad";
import { formatRwf } from "./wizard-ui";

/**
 * Step 5, Overview (Register.dc.html): every answer once, each with an Edit
 * that lands on the step that asked it; the registration fee, stated here
 * because this is the screen that commits to it; and the Injishi agreement,
 * folded away but one press from being read, with the signature under it.
 *
 * "Sign and continue" (the step's primary action, in the wizard) creates the
 * registration and accepts the agreement, the server's own order (ADR-053
 * AC-R8). From then on these details are locked: an officer sends the
 * registration back if something needs fixing. The server records which
 * version was accepted, by whom and when; the drawn mark stays in this
 * browser, for the signed copy offered for download (`step-contract.tsx`).
 */

export interface ReviewRow {
  title: string;
  value: string;
  /** The step that asked, or null when nothing can change it any more. */
  step: StepId | null;
}

export function StepOverview({
  rows,
  locked,
  onEdit,
  kindLabel,
  fee,
  feeNote,
  agreeText,
  contractInput,
  accepted,
  signature,
  onSignature,
  signerName,
  signLine,
}: {
  rows: ReviewRow[];
  /** The registration exists: no Edit, and the agreement is already accepted or about to be. */
  locked: boolean;
  onEdit: (step: StepId) => void;
  kindLabel: string;
  fee: number | null;
  feeNote: string;
  agreeText: string;
  contractInput: RegistrationContractInput;
  /** The agreement was accepted on the server. */
  accepted: boolean;
  signature: SignatureCapture | null;
  onSignature: (next: SignatureCapture | null) => void;
  signerName: string;
  signLine: string;
}) {
  const [reading, setReading] = useState(false);
  const clauses = registrationContractClauses(contractInput);

  return (
    <>
      <dl className="flex flex-col divide-y divide-border rounded-card bg-secondary">
        {rows.map((row) => (
          <div key={row.title} className="flex items-center gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <dt className="text-sm font-semibold">{row.title}</dt>
              <dd className="break-words text-sm text-muted-foreground">{row.value}</dd>
            </div>
            {row.step && !locked ? (
              <Button variant="ghost" size="sm" onClick={() => onEdit(row.step!)}>
                Edit<span className="sr-only"> {row.title}</span>
              </Button>
            ) : null}
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-1 rounded-card bg-secondary px-4 py-4">
        <span className="text-sm text-muted-foreground">Registration fee for a {kindLabel}</span>
        <span className="text-2xl font-semibold tabular-nums">{fee === null ? "Not available yet" : formatRwf(fee)}</span>
        <span className="text-xs text-muted-foreground">{feeNote}</span>
      </div>

      <section aria-labelledby="register-agreement-title" className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="register-agreement-title" className="text-base font-semibold">
            The Injishi agreement
          </h3>
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={reading}
            aria-controls="register-agreement-text"
            onClick={() => setReading(!reading)}
          >
            <FileText size={16} aria-hidden />
            {reading ? "Hide the agreement" : "Read the agreement"}
            <ChevronDown size={16} aria-hidden className={cn("transition-transform", reading && "rotate-180")} />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{agreeText}</p>
        {reading ? (
          <div
            id="register-agreement-text"
            role="region"
            aria-label={`${CONTRACT_TITLE}, version ${contractInput.contractVersion}`}
            tabIndex={0}
            className="max-h-80 overflow-y-auto rounded-card bg-secondary p-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <p className="font-semibold">
              {CONTRACT_TITLE} · Version {contractInput.contractVersion}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Between {CONTRACT_OPERATOR} and you. Injishi records that you accepted this version and when; the copy you
              can download afterwards carries your signature.
            </p>
            <ol className="mt-4 flex flex-col gap-4">
              {clauses.map((clause) => (
                <li key={clause.number}>
                  <h4 className="font-semibold">
                    <span className="tabular-nums text-muted-foreground">{clause.number}.</span> {clause.heading}
                  </h4>
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

        {accepted ? (
          <p className="text-sm">{signLine}</p>
        ) : (
          <>
            <SignaturePad value={signature} onChange={onSignature} signerName={signerName} disabled={locked && accepted} />
            <span className="text-xs text-muted-foreground">{signLine}</span>
          </>
        )}
      </section>
    </>
  );
}
