"use client";

import {
  contractDocumentHtml,
  contractFileName,
  type ContractSignature,
  type RegistrationContractInput,
} from "@/lib/registration-contract";

/**
 * Save the signed agreement as one self-contained file, offered on In review
 * once the registration exists and carries its reference.
 *
 * The agreement is read and signed on Check, sign and pay
 * (`step-review-pay.tsx`). What reaches the server is only the fact: the
 * version on screen, to `POST /registrations/:id/contract`, recorded against
 * the account and the time (ADR-053). The drawn mark stays in this browser,
 * for this copy, because a signature image is personal data that would need
 * its own retention for no added evidence.
 *
 * A Blob and an object URL rather than a `data:` href: a contract with a
 * signature in it is a couple of hundred kilobytes of base64, and a `data:` URL
 * that long is refused by some browsers and truncated silently by others.
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
  // Revoked late: releasing it in the same tick races the browser's own fetch,
  // and the symptom is a zero byte download on a slow machine.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
