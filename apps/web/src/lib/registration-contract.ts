/**
 * The agreement a registrant signs at the end of business registration, and the
 * printable document that agreement is downloaded as.
 *
 * IT HAS NO IMPORTS, ON PURPOSE. Two things depend on that. The wizard step is
 * a `"use client"` component and this module is pulled into that bundle, so a
 * transitive import of anything server-only would break the build; and a module
 * with no imports can be driven directly under Node's type stripping, which is
 * how the clause text and the generated document are checked without a browser.
 * The consequence is that every value it prints arrives ALREADY FORMATTED — the
 * fee comes in as the string `formatRwf` produced, the identity document as the
 * string the register screens already show — so money and identity are formatted
 * in exactly one place each and this file never invents a second spelling.
 *
 * WHAT THIS IS NOT. Nothing here is filed with RDB, RRA or a district office,
 * nobody counter-signs it on Injishi's behalf, and no copy of it leaves the
 * browser that generated it. What DOES leave is the fact of acceptance: the
 * wizard sends the version accepted, and the server records it with the
 * accepting account and the time (ADR-049, AC-R8). The drawn mark never leaves. Clause 9 says so inside the document itself rather
 * than only on the screen, because the download is the artifact that outlives
 * the screen — a person who keeps the file and reads it a month later must find
 * the disclaimer in the file, not remember a notice they scrolled past.
 */

// ---------------------------------------------------------------------------
// The document
// ---------------------------------------------------------------------------

/**
 * Everything the contract names about this particular registration.
 *
 * The nullable fields are the ones a RESUMING registrant may not have retyped:
 * somebody who created a registration last week and came back to sign has a
 * legal name, a reference and the invoiced amount from the server, and no
 * business draft in memory. A row whose value
 * is null is omitted from the document rather than printed as an em dash,
 * because a contract that names "TIN —" states something false about what was
 * agreed, while a contract that does not mention the TIN simply does not.
 */
export interface RegistrationContractInput {
  /** The person signing, as the three name boxes were composed at submit. */
  registrantName: string;
  /** "National ID 1 1998 7 0012345 6 7 8" or "Passport PC1234567", already grouped. */
  registrantIdLabel: string | null;
  registrantPhone: string | null;
  /** The business as the server recorded it, never as the draft spells it. */
  businessName: string;
  /** "Guest House", "Bar & Restaurant", "Residence". */
  businessKindLabel: string;
  /** "RRA TIN 123456789" for a hospitality org, "UPI 1/02/03/04/1234" for a residence. */
  businessIdLabel: string | null;
  /** The town or sector the business sits in, as one line. */
  businessAddressLabel: string | null;
  /**
   * The fee actually invoiced, through `formatRwf`.
   *
   * The contract is signed BEFORE paying (ADR-049), which is exactly while
   * `RegistrationSummary.amountDueRwf` is reported, so this is the amount the
   * registrant is about to be charged. Still nullable, for an invoice the server
   * could not name; then the clause names no amount rather than quoting a
   * published price nobody was billed.
   */
  feeLabel: string | null;
  /** The registration this agreement belongs to. */
  reference: string;
  /**
   * `OPERATOR_CONTRACT_VERSION` from `@injishi/contracts`, passed in rather than
   * imported so this module keeps importing nothing. It is the version the
   * server is told was accepted and the one printed on the document.
   */
  contractVersion: string;
}

export interface ContractClause {
  number: number;
  heading: string;
  body: string[];
}

/** A signature that has been captured, and the act of signing around it. */
export interface ContractSignature {
  /** A PNG data URL — dark ink, transparent ground, ready to sit on paper. */
  dataUrl: string;
  /** The name the signer confirmed they were signing under. */
  signedName: string;
  /** ISO 8601, taken in the press handler and never during a render. */
  signedAt: string;
  /**
   * Drawn with a pointer, or set from a typed name for somebody who cannot
   * draw one. The document says which, because a reader is entitled to know
   * whether the mark above the line is a hand or a typeface.
   */
  method: "drawn" | "typed";
}

export const CONTRACT_TITLE = "Injishi Operator Registration Agreement";

/** The counterparty, named the way the footer names it. */
export const CONTRACT_OPERATOR = "Injishi, operated by Hangaa Softwares";

/**
 * The clauses, numbered so that a registrant, an officer or a support agent can
 * all refer to the same paragraph by the same number.
 *
 * They are DERIVED from the registration rather than fixed, because the two
 * figures that matter most to the signer — what was charged and which
 * registration this is — belong in the sentence that binds them and not in a
 * header they will skim past.
 */
export function registrationContractClauses(
  input: RegistrationContractInput,
): ContractClause[] {
  return [
    {
      number: 1,
      heading: "Who this agreement is between",
      body: [
        "This agreement is between Injishi, the accommodation marketplace operated in Rwanda by Hangaa Softwares, and the person named above as the registrant, who is signing either as the owner of the business or on the owner's instruction.",
        `It covers one business only, ${input.businessName}, and the registration reference printed at the top of this document.`,
        "You are signing as an individual and you are binding the business you have named, so if you are registering on somebody else's behalf you are confirming that they asked you to, and that they will be shown what you agreed to here before they take the workspace over.",
      ],
    },
    {
      number: 2,
      heading: "The registration fee, and what it buys",
      body: [
        input.feeLabel === null
          ? "The registration fee for this business is the amount on its invoice, charged once."
          : `The registration fee for this business is ${input.feeLabel}, charged once, and you pay it after accepting this agreement.`,
        "It pays for the review that follows rather than for the outcome of that review, so settling it buys your application a place in the queue and buys nothing else, and no amount of it is a deposit against future earnings.",
        "If a verifier or an approver decides against you, the fee is not refunded. If you then correct what they asked you to correct and send the registration back for another look, you are not charged a second time, however many rounds that takes.",
      ],
    },
    {
      number: 3,
      heading: "How your registration is reviewed",
      body: [
        "Once the fee has settled, the tax identifier you gave goes to the Rwanda Revenue Authority for an automatic check, which normally answers within seconds and occasionally takes longer than that.",
        "An officer from your district then visits the premises in person to confirm that the business exists where you say it does, that it is the kind of place you described, and that the certificates you attached belong to it.",
        "A business approver reads that officer's report and makes the decision. Neither the officer nor the approver works for Injishi, so we cannot hurry either of them, we cannot see their working before they publish it, and we cannot overturn what they conclude.",
      ],
    },
    {
      number: 4,
      heading: "Nothing is listed and nothing is sold before approval",
      body: [
        "Until this business is approved and marked active you hold the owner role over it and none of the powers that role normally carries, which means that no room, no venue and no service of yours can be listed, searched, booked or paid for.",
        "Your workspace opens straight away so that you can watch the pipeline move, and that is the only thing it is open for at this stage. Taking a booking outside Injishi and then presenting it as one of ours is the clearest way to lose the registration you have just paid for.",
      ],
    },
    {
      number: 5,
      heading: "Your listing is a promise to the guest",
      body: [
        "A guest reads every listing you publish as a promise about a real room in a real building, so the photographs, the prices, the stated capacity and the amenities must describe what somebody arriving that evening will actually find.",
        "Prices are shown in Rwandan francs and must include the taxes you are obliged to charge. A fee the guest could not have seen before they booked cannot be added on arrival, and asking for one is a dispute you will lose.",
        "When a guest arrives to a room that does not match its page, Injishi decides the dispute on the evidence of what you published, which means a listing you have not kept current is a listing that will be read against you.",
      ],
    },
    {
      number: 6,
      heading: "What Injishi holds about you, and why",
      body: [
        "To register a business we collect and store your identity document, your date of birth and your contact details, together with the tax identifier of the business or, for a residence, the unique parcel identifier of the land it stands on, its address, and any certificates you attach.",
        "Those identifiers are held because a district verifier and a business approver have to be able to check them against the registers they answer to, and they are disclosed to those officers and to the Rwanda Revenue Authority for that purpose and for no other purpose at all.",
        "They are not sold, they are not used to advertise anything to you, and they are never shown to guests, who see the business and never the identity document of the person standing behind it.",
      ],
    },
    {
      number: 7,
      heading: "Who may act for this business",
      body: [
        "Roles are granted inside your workspace, and every action taken there is recorded against the person who took it, so anybody you invite to work on your behalf acts with your authority and you stay answerable for whatever they do with it.",
        "Keep your own sign-in to yourself. A one-time code sent to your email is the whole of your identity on Injishi, and somebody who has that code has your business.",
      ],
    },
    {
      number: 8,
      heading: "How either of us ends this",
      body: [
        "You may end this agreement whenever you like by closing the business workspace, which withdraws your listings from sale immediately. Bookings a guest has already had accepted must still be honoured or refunded before the workspace closes.",
        "We may end it by suspending or removing a business that trades before it is approved, that publishes listings it cannot honour, or that a government officer has ordered off the platform, and we will tell you which of those it was and what we relied on.",
        "Ending this agreement does not return the registration fee, and it does not erase the records a verifier or an approver is required by law to keep.",
      ],
    },
    {
      number: 9,
      heading: "What this document is",
      body: [
        "This is a demonstration build of Injishi. Nothing signed here is filed with any registry, no district officer has received it, and nobody has counter-signed it on Injishi's behalf, so it does not bind anyone and it should not be presented as though it did.",
        "Injishi records that your account accepted this version of the agreement, and when. It does not keep the signature you drew.",
        "The copy you download is generated in your own browser from what you typed and the signature you drew. It never leaves this device unless you send it somewhere yourself, and it is yours to keep as a record of what the finished product would ask you to agree to.",
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// The downloadable copy
// ---------------------------------------------------------------------------

/**
 * The signed agreement as one self-contained HTML file.
 *
 * WHY HTML AND NOT A CANVAS IMAGE OR A PDF. The file has to be readable, and a
 * contract rendered as a picture is a contract nobody can search, copy a clause
 * out of, or paste into an email — and a real PDF means shipping a PDF library
 * into the registration bundle for one button. An HTML file opens in the same
 * browser the person is already holding, prints from Ctrl+P, and saves as a PDF
 * from the print dialog, which is the same three outcomes for none of the cost.
 *
 * WHY IT DECLARES NO COLOURS. This document leaves the app, so the design
 * tokens the rest of the web app is built from do not exist where it is opened.
 * Rather than hardcode a palette here — which the root rules forbid and which
 * would be wrong anyway — it declares only structure and lets the browser paint
 * ink on paper. `color-scheme: light` is the one appearance declaration, and it
 * is there so a reader whose browser is in dark mode still gets a document that
 * looks like a document and prints like one.
 *
 * The signature travels INSIDE the file as a base64 PNG in the `src` of the
 * image below. There is no second request, no linked asset and nothing to lose,
 * so the copy on a memory stick a year from now still carries the mark.
 */
export function contractDocumentHtml(
  input: RegistrationContractInput,
  signature: ContractSignature,
): string {
  const clauses = registrationContractClauses(input);
  const signedOn = formatSignedAt(signature.signedAt);

  const parties: [string, string | null][] = [
    ["Registrant", input.registrantName],
    ["Identity document", input.registrantIdLabel],
    ["Phone", input.registrantPhone],
    ["Business", input.businessName],
    ["Kind", input.businessKindLabel],
    ["Business identifier", input.businessIdLabel],
    ["Address", input.businessAddressLabel],
    ["Registration reference", input.reference],
    ["Registration fee", input.feeLabel],
    ["Counterparty", CONTRACT_OPERATOR],
  ];

  const partyRows = parties
    .filter((row): row is [string, string] => row[1] !== null && row[1] !== "")
    .map(
      ([label, value]) =>
        `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`,
    )
    .join("\n      ");

  const clauseHtml = clauses
    .map(
      (clause) =>
        `<section class="clause">
        <h2><span class="n">${clause.number}.</span> ${escapeHtml(clause.heading)}</h2>
        ${clause.body.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n        ")}
      </section>`,
    )
    .join("\n      ");

  const markDescription =
    signature.method === "drawn"
      ? `Signature drawn by ${signature.signedName}`
      : `Signature set from the typed name of ${signature.signedName}`;

  const howItWasSigned =
    signature.method === "drawn"
      ? "Drawn with a pointer or a fingertip on the signing screen."
      : "Set from the signer's typed name, the accessible alternative offered to anyone who cannot draw a mark.";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(CONTRACT_TITLE)} — ${escapeHtml(input.businessName)}</title>
<style>
  :root { color-scheme: light; }
  body { font-family: Georgia, "Times New Roman", serif; line-height: 1.55; margin: 0 auto; max-width: 44rem; padding: 3rem 1.5rem 5rem; }
  header { border-bottom: 2px solid; padding-bottom: 1rem; }
  h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
  .meta { font-family: system-ui, sans-serif; font-size: .8rem; margin: 0; }
  table { border-collapse: collapse; font-family: system-ui, sans-serif; font-size: .85rem; margin: 1.5rem 0 2rem; width: 100%; }
  th, td { border-bottom: 1px solid; padding: .45rem .5rem; text-align: left; vertical-align: top; }
  th { font-weight: 600; white-space: nowrap; width: 12rem; }
  .clause { margin: 0 0 1.6rem; }
  .clause h2 { font-size: 1.05rem; margin: 0 0 .4rem; }
  .clause .n { font-family: system-ui, sans-serif; }
  .clause p { margin: 0 0 .6rem; }
  .signature { border-top: 2px solid; margin-top: 2.5rem; padding-top: 1.5rem; }
  .signature h2 { font-size: 1.05rem; margin: 0 0 1rem; }
  .mark { border-bottom: 1px solid; display: block; max-width: 22rem; padding-bottom: .25rem; }
  .mark img { display: block; height: auto; max-width: 100%; }
  .signed-by { font-family: system-ui, sans-serif; font-size: .85rem; margin: .5rem 0 0; }
  .note { font-family: system-ui, sans-serif; font-size: .8rem; margin-top: 2rem; }
  .print-hint { font-family: system-ui, sans-serif; font-size: .8rem; margin-top: 2.5rem; }
  @media print {
    body { max-width: none; padding: 0; }
    .print-hint { display: none; }
    .clause { break-inside: avoid; }
    .signature { break-inside: avoid; }
  }
</style>
</head>
<body>
  <header>
    <h1>${escapeHtml(CONTRACT_TITLE)}</h1>
    <p class="meta">Version ${escapeHtml(input.contractVersion)} · Registration ${escapeHtml(input.reference)} · Signed ${escapeHtml(signedOn)}</p>
  </header>

  <table>
    <caption class="meta" style="text-align:left; padding:.75rem 0 0;">The parties and the registration this agreement covers</caption>
    <tbody>
      ${partyRows}
    </tbody>
  </table>

  ${clauseHtml}

  <div class="signature">
    <h2>Signed by the registrant</h2>
    <span class="mark"><img src="${signature.dataUrl}" alt="${escapeHtml(markDescription)}" width="440"></span>
    <p class="signed-by"><strong>${escapeHtml(signature.signedName)}</strong><br>
    ${escapeHtml(signedOn)}<br>
    ${escapeHtml(howItWasSigned)}</p>
    <p class="note">Not counter-signed. ${escapeHtml(CONTRACT_OPERATOR)} has not signed this copy, and clause 9 explains why: this is a demonstration build, and no registry, officer or approver has received this document.</p>
  </div>

  <p class="print-hint">To keep this as a PDF, print this page and choose “Save as PDF”.</p>
</body>
</html>
`;
}

/** What the saved file is called. Business, then date, so a folder sorts well. */
export function contractFileName(
  input: RegistrationContractInput,
  signedAtIso: string,
): string {
  const day = signedAtIso.slice(0, 10);
  const stem = slugify(input.businessName) || "registration";
  return `injishi-registration-contract-${stem}-${day}.html`;
}

// ---------------------------------------------------------------------------
// Small helpers, kept here so this module still imports nothing
// ---------------------------------------------------------------------------

/**
 * The five characters that could otherwise close a tag or an attribute.
 *
 * Everything printed into the document below comes from a form somebody typed
 * into, so this is not decoration: a business called `Chez <b>Alice` must appear
 * in the contract as its own name and not as markup.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** A file-name-safe stem, ASCII only, no runs of dashes. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/**
 * The moment of signing, written out rather than left as an ISO string.
 *
 * Fixed to `en-GB` and to Kigali time instead of the reader's locale, because
 * the document is a record: the same file opened in Kigali and in London has to
 * name the same instant, and a browser-local rendering would quietly move it.
 */
function formatSignedAt(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return iso;
  const date = when.toLocaleDateString("en-GB", {
    timeZone: "Africa/Kigali",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const time = when.toLocaleTimeString("en-GB", {
    timeZone: "Africa/Kigali",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} at ${time} (Kigali)`;
}
