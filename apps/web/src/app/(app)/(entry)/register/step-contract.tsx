"use client";

import { useState } from "react";

import { SignaturePad, type SignatureCapture } from "@/components/register/signature-pad";
import {
  CONTRACT_OPERATOR,
  CONTRACT_TITLE,
  contractDocumentHtml,
  contractFileName,
  registrationContractClauses,
  type ContractSignature,
  type RegistrationContractInput,
} from "@/lib/registration-contract";

import {
  Field,
  Fieldset,
  Notice,
  StepActions,
  SummaryCard,
  SummaryRow,
  TextInput,
} from "./wizard-ui";

/**
 * Read the agreement and sign it, on the same screen as the read back and the
 * fee (ADR-060, which merged Review, Contract and Pay into one screen).
 *
 * THE SERVER'S ORDER IS UNCHANGED (ADR-053, AC-R8). One press runs create, then
 * accept, then pay, in that order, and `POST /registrations/:id/pay` still
 * refuses a registration whose contract is not accepted. What moved is only
 * the screen: the agreement is read BEFORE the registration exists, so its
 * reference reads "assigned when you submit" here and is filled in on the
 * signed copy, which is built once the server has named it.
 *
 * WHAT IS SENT. Only the fact: the version on screen, to
 * `POST /registrations/:id/contract`, which records it against the account and
 * the time. The drawn signature stays in this browser for the downloaded copy,
 * because a signature image is personal data that would need its own retention
 * for no added evidence.
 *
 * ONE MARK, TWO RENDERINGS. `SignaturePad` hands back a PNG drawn in document
 * ink on a transparent ground — never the pixels that were on screen, which
 * carry this app's theme and would come out invisible on white paper in dark
 * mode. That is the pad's problem and it is solved there.
 *
 * WHAT IT DOES NOT CLAIM. Nothing is filed and nobody counter-signs. The notice
 * below says so on screen and clause 9 says so inside the downloaded file,
 * because the file outlives the screen.
 */
export function ContractSigner({
  input,
  actionLabel,
  busyLabel,
  busy,
  error,
  onBack,
  onSign,
}: {
  input: RegistrationContractInput;
  actionLabel: string;
  busyLabel: string;
  busy: boolean;
  /** The sentence the last attempt ended on, from whichever call refused. */
  error: string;
  onBack?: () => void;
  /** Sign, then create, accept and pay. Resolves once the wizard has moved on or failed. */
  onSign: (signature: ContractSignature) => Promise<void>;
}) {
  const [capture, setCapture] = useState<SignatureCapture | null>(null);
  const [signedName, setSignedName] = useState(input.registrantName);
  const [localError, setLocalError] = useState("");

  const clauses = registrationContractClauses(input);

  const sign = async () => {
    if (capture === null) {
      setLocalError("Draw your signature in the box above before you sign.");
      return;
    }
    if (signedName.trim().length < 2) {
      setLocalError("Type the name you are signing under.");
      return;
    }
    setLocalError("");
    // `toISOString` in the press handler and never during a render: a date read
    // while rendering is a different date on the server and in the browser, and
    // React tears the whole step down over the mismatch.
    await onSign({
      dataUrl: capture.dataUrl,
      method: capture.method,
      signedName: signedName.trim(),
      signedAt: new Date().toISOString(),
    });
  };

  const shown = localError || error;

  return (
    <div className="space-y-4">
      <Notice tone="warning">
        <b>This is a demonstration build.</b> Nothing signed here is filed with
        RDB, RRA or a district office, no officer receives it, and{" "}
        {CONTRACT_OPERATOR} does not counter-sign it. Injishi records that you
        accepted this version and when, and nothing else: the copy you download
        is built in this browser from what you typed and the signature you
        drew. Clause 9 says the same inside the document itself.
      </Notice>

      <SummaryCard title={`${CONTRACT_TITLE} · Version ${input.contractVersion}`}>
        <SummaryRow label="Registration" value={input.reference} />
        <SummaryRow label="Business" value={input.businessName} />
        <SummaryRow label="Kind" value={input.businessKindLabel} />
        {input.businessIdLabel ? (
          <SummaryRow label="Identifier" value={input.businessIdLabel} />
        ) : null}
        {input.businessAddressLabel ? (
          <SummaryRow label="Address" value={input.businessAddressLabel} />
        ) : null}
        <SummaryRow label="Registrant" value={input.registrantName} />
        {input.registrantIdLabel ? (
          <SummaryRow label="ID" value={input.registrantIdLabel} />
        ) : null}
      </SummaryCard>

      {/* Scrollable, focusable and labelled. A long agreement in a fixed box
          that a keyboard cannot scroll is a document a keyboard user cannot
          read, which is the accessibility failure this pattern usually
          ships with. */}
      <div
        role="region"
        aria-label="The agreement, clauses 1 to 9"
        tabIndex={0}
        className="max-h-96 overflow-y-auto rounded-card border border-border bg-card p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ol className="space-y-5">
          {clauses.map((clause) => (
            <li key={clause.number} id={`clause-${clause.number}`}>
              <h3 className="text-sm font-semibold">
                <span className="tabular-nums text-muted-foreground">
                  {clause.number}.
                </span>{" "}
                {clause.heading}
              </h3>
              {clause.body.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 40)}
                  className="mt-2 text-sm leading-relaxed text-muted-foreground"
                >
                  {paragraph}
                </p>
              ))}
            </li>
          ))}
        </ol>
      </div>

      <Fieldset
        legend="Sign here"
        hint="Draw your signature. It is turned into an image and printed on the copy you download."
      >
        <SignaturePad
          value={capture}
          onChange={(next) => {
            setCapture(next);
            if (next !== null) setLocalError("");
          }}
          signerName={input.registrantName}
        />
      </Fieldset>

      <Field
        label="The name you are signing under"
        hint="Change it if the register spells your name differently from the way you typed it."
        required
      >
        <TextInput
          className="w-full"
          value={signedName}
          onChange={(e) => setSignedName(e.target.value)}
        />
      </Field>

      {shown ? <Notice tone="danger">{shown}</Notice> : null}

      <StepActions
        onBack={onBack}
        onNext={() => void sign()}
        nextLabel={busy ? busyLabel : actionLabel}
        busy={busy}
        disabled={capture === null}
      />
    </div>
  );
}

/**
 * Save the signed agreement as one self-contained file.
 *
 * A Blob and an object URL rather than a `data:` href: a contract with a
 * signature in it is a couple of hundred kilobytes of base64, and a `data:`
 * URL that long is refused outright by some browsers and truncated silently by
 * others — which produces a download that appears to work and yields a
 * half-written document.
 */
export function downloadSignedContract(
  input: RegistrationContractInput,
  signed: ContractSignature,
): void {
  const html = contractDocumentHtml(input, signed);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = contractFileName(input, signed.signedAt);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoked late rather than immediately. Releasing the URL in the same tick as
  // the click races the browser's own fetch of it, and the symptom is a
  // download that silently produces a zero byte file on a slow machine.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
