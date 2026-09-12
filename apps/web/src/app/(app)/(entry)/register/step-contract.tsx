"use client";

import { useState } from "react";
import { Button } from "@heroui/react";
import { Download, FileSignature, ShieldCheck } from "lucide-react";

import { SignaturePad, type SignatureCapture } from "@/components/register/signature-pad";
import {
  CONTRACT_OPERATOR,
  CONTRACT_TITLE,
  CONTRACT_VERSION,
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
 * The last screen of registration — read the agreement, sign it, take a copy.
 *
 * IT COMES AFTER THE FEE HAS SETTLED, not before, and that ordering is the
 * point rather than an accident of where there was room. Until the payment goes
 * through there is no registration to bind: the server raises the org and its
 * invoice on `POST /registrations` and only `POST /registrations/:id/pay` moves
 * it into the pipeline, so a contract signed a step earlier would name a
 * reference that might never exist and quote a fee that had not been charged.
 * Signing here means every figure in the document is the figure the server
 * actually recorded.
 *
 * ONE MARK, TWO RENDERINGS. `SignaturePad` hands back a PNG drawn in document
 * ink on a transparent ground — never the pixels that were on screen, which
 * carry this app's theme and would come out invisible on white paper in dark
 * mode. That is the pad's problem and it is solved there; this step only ever
 * handles the exported mark.
 *
 * WHAT IT DOES NOT CLAIM. Nothing is filed and nobody counter-signs. The notice
 * below says so on screen and clause 9 says so inside the downloaded file,
 * because the file outlives the screen and a person reading it next year must
 * find the disclaimer in the document rather than remember a banner.
 */
export function StepContract({
  input,
  existing,
  onSigned,
  onContinue,
}: {
  input: RegistrationContractInput;
  /** A signature already recorded for this registration, on the resume path. */
  existing: ContractSignature | null;
  onSigned: (signature: ContractSignature) => void;
  onContinue: () => void;
}) {
  const [capture, setCapture] = useState<SignatureCapture | null>(null);
  const [signedName, setSignedName] = useState(input.registrantName);
  const [signed, setSigned] = useState<ContractSignature | null>(existing);
  const [error, setError] = useState("");

  const clauses = registrationContractClauses(input);

  const sign = () => {
    if (capture === null) {
      setError("Draw your signature in the box above before you sign.");
      return;
    }
    if (signedName.trim().length < 2) {
      setError("Type the name you are signing under.");
      return;
    }
    setError("");
    // `toISOString` in the press handler and never during a render: a date read
    // while rendering is a different date on the server and in the browser, and
    // React tears the whole step down over the mismatch.
    const record: ContractSignature = {
      dataUrl: capture.dataUrl,
      method: capture.method,
      signedName: signedName.trim(),
      signedAt: new Date().toISOString(),
    };
    setSigned(record);
    onSigned(record);
  };

  /**
   * Save the signed agreement as one self-contained file.
   *
   * A Blob and an object URL rather than a `data:` href: a contract with a
   * signature in it is a couple of hundred kilobytes of base64, and a `data:`
   * URL that long is refused outright by some browsers and truncated silently
   * by others — which produces a download that appears to work and yields a
   * half-written document.
   */
  const download = () => {
    if (signed === null) return;
    const html = contractDocumentHtml(input, signed);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = contractFileName(input, signed.signedAt);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Revoked late rather than immediately. Releasing the URL in the same tick
    // as the click races the browser's own fetch of it, and the symptom is a
    // download that silently produces a zero byte file on a slow machine.
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  return (
    <section aria-labelledby="step-contract">
      <div className="flex size-12 items-center justify-center rounded-full bg-accent-brand text-accent-brand-foreground">
        <FileSignature size={24} aria-hidden />
      </div>
      <h2
        id="step-contract"
        className="mt-4 text-xl font-semibold tracking-tight"
      >
        {signed === null
          ? "Read this, then sign it"
          : "Your contract is signed"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {signed === null
          ? `Your fee has settled and ${input.businessName} is in the queue. This is the agreement that covers what happens next.`
          : `Keep a copy. ${input.businessName} carries on through the review either way.`}
      </p>

      <div className="mt-6 space-y-4">
        <Notice tone="warning">
          <b>This is a demonstration build.</b> Nothing signed here is filed with
          RDB, RRA or a district office, no officer receives it, and{" "}
          {CONTRACT_OPERATOR} does not counter-sign it. The copy you download is
          built in this browser from what you typed and the signature you drew,
          and it is kept nowhere else. Clause 9 says the same inside the document
          itself.
        </Notice>

        <SummaryCard title={`${CONTRACT_TITLE} · ${CONTRACT_VERSION}`}>
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
          {input.feeLabel ? (
            <SummaryRow label="Fee charged" value={input.feeLabel} />
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

        {signed === null ? (
          <>
            <Fieldset
              legend="Sign here"
              hint="Draw your signature. It is turned into an image and printed on the copy you download."
            >
              <SignaturePad
                value={capture}
                onChange={(next) => {
                  setCapture(next);
                  if (next !== null) setError("");
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

            {error ? <Notice tone="danger">{error}</Notice> : null}

            <StepActions
              onNext={sign}
              nextLabel="Sign this contract"
              disabled={capture === null}
            />
          </>
        ) : (
          <>
            <div className="rounded-card border border-success/40 bg-success/10 p-5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck size={16} aria-hidden />
                Signed by {signed.signedName}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {signed.method === "drawn"
                  ? "Drawn on this device."
                  : "Set from the name you typed, the alternative offered to anyone who cannot draw a mark."}{" "}
                Your mark is printed above the line on the copy below.
              </p>
              {/* The exported PNG, shown back at the size it will print. It is
                  the same data URL that goes into the file, so what is on
                  screen here is literally what the download carries — a preview
                  redrawn from the strokes could differ from it and nobody would
                  know until they opened the file.

                  `dark:invert` is a filter and not a colour: the exported mark
                  is document ink on a transparent ground, which is correct for
                  the white page it is printed on and invisible on this card in
                  dark mode. Inverting the PREVIEW leaves the exported bytes
                  alone, which is the whole reason the two are separate. */}
              <span className="mt-4 block max-w-tile border-b border-border pb-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={signed.dataUrl}
                  alt={`Signature of ${signed.signedName}`}
                  className="block h-auto w-full dark:invert"
                />
              </span>
              <p className="mt-2 text-xs text-muted-foreground">
                {signed.signedName}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" onPress={download}>
                <Download size={16} aria-hidden />
                Download the signed contract
              </Button>
              <span className="text-xs text-muted-foreground">
                One HTML file with the signature inside it. Open it and print to
                keep it as a PDF.
              </span>
            </div>

            <StepActions
              onBack={() => {
                setSigned(null);
                setCapture(null);
              }}
              backLabel="Sign it again"
              onNext={onContinue}
              nextLabel="See where your registration is"
            />
          </>
        )}
      </div>
    </section>
  );
}
