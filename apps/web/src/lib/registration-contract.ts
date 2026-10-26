/**
 * The agreement a registrant signs at the end of business registration, and the
 * printable document that agreement is downloaded as.
 *
 * IT IMPORTS ONE THING, AND NOTHING ELSE MAY BE ADDED. Two constraints decide
 * that. The wizard step is a `"use client"` component and this module is pulled
 * into that bundle, so a transitive import of anything server-only would break
 * the build; and the module is driven directly under Node's type stripping,
 * which is how the clause text and the generated document are checked without a
 * browser (`apps/web/tests/contract-document.test.mjs`). Both survive a single
 * import of `@injishi/design-tokens` — a pure value package with no
 * dependencies of its own, which `global-error.tsx`, `global-not-found.tsx` and
 * `manifest.ts` already import for exactly this reason: a surface that renders
 * outside the app's stylesheet has to carry the token VALUES, and the only
 * alternative is hex literals the palette can no longer move.
 *
 * The rest of the rule is unchanged, and it is the reason this file stays thin:
 * every value it prints arrives ALREADY FORMATTED — the fee comes in as the
 * string `formatRwf` produced, the identity document as the string the register
 * screens already show — so money and identity are formatted in exactly one
 * place each and this file never invents a second spelling.
 *
 * WHAT THIS IS NOT. Nothing here is filed with RDB, RRA or a district office,
 * nobody counter-signs it on Injishi's behalf, and no copy of it leaves the
 * browser that generated it. What DOES leave is the fact of acceptance: the
 * wizard sends the version accepted, and the server records it with the
 * accepting account and the time (ADR-053, AC-R8). The drawn mark never leaves. Clause 9 says so inside the document itself rather
 * than only on the screen, because the download is the artifact that outlives
 * the screen — a person who keeps the file and reads it a month later must find
 * the disclaimer in the file, not remember a notice they scrolled past.
 */

import { fixed, green, ink } from "@injishi/design-tokens";

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
  /** The registration this agreement belongs to. */
  reference: string;
  /**
   * `OPERATOR_CONTRACT_VERSION` from `@injishi/contracts`, passed in rather than
   * imported so this module keeps importing nothing. It is the version the
   * server is told was accepted and the one printed on the document.
   */
  contractVersion: string;
}

interface ContractClause {
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
        // No figure, on the owner's instruction (2026-09-21): no screen and no
        // document in the registration flow states the amount.
        "The registration fee for this business is the amount on its invoice, charged once, and you pay it after accepting this agreement.",
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
 * The document's palette, resolved in TypeScript because the document leaves
 * the app.
 *
 * WHY NOT `var(--accent)`. The download is opened where the app's stylesheet
 * was never loaded: a downloads folder, a mail client, a copy shop's machine.
 * Every custom property resolves to nothing there, so a document styled through
 * them arrives unstyled at exactly the moment nobody is left to notice.
 * `global-error.tsx` is in the same bind for the same reason, and this follows
 * the answer recorded there (ADR-010 supporting call 6b): read the ramps from
 * `@injishi/design-tokens` and let the build inline the values, rather than
 * writing hex literals that regenerating the palette can no longer reach.
 *
 * Each constant names the step it takes and the measurement that chose it, so a
 * later reader can tell a considered contrast from a colour somebody liked.
 */

/** green-950. The head band. White on it measures about 10:1. */
const BAND = green[950];
/**
 * green-900, one step up. The fold across the band has to read as the same
 * green turned toward the light, not as a second colour, which is why it is the
 * neighbouring step and not a hue of its own.
 */
const BAND_FOLD = green[900];
/**
 * green-800. `semantic.ts` records this as the green that clears AA on white,
 * which is why the section rules and the clause numerals are this step and not
 * the brand green-600: white on green-600 is 2.98:1 and fails.
 */
const ACCENT = green[800];
/** ink-950, through its fixed role. The body text; pure black never ships. */
const TEXT = fixed.ink;
/** ink-600. `semantic.ts`: muted text on white is this step, and never lighter. */
const MUTED = ink[600];
/** ink-200. The hairline between one printed fact and the next. */
const HAIRLINE = ink[200];
/** ink-50. The tint under the party and signature panels. */
const TINT = ink[50];
/** The paper, and the text on the band. */
const PAPER = fixed.white;

/**
 * The type stack.
 *
 * Figtree is the platform face (`ui-tokens.md` § Typography) and is named FIRST
 * so a reader who has it installed gets it. Everything after it is already on
 * the machine: this document cannot ship a font file and must never fetch one,
 * because a contract that needs the network to look like itself is a contract
 * that looks wrong in the archive it was saved to.
 */
const TYPE_STACK =
  'Figtree, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

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
 * HOW IT IS LAID OUT, AND WHY THAT IS NOT DECORATION. A contract is read in a
 * fixed order — who is bound, over what, on what terms, and signed by whom —
 * so the document is built in that order and each part is given its own block,
 * which is what lets a reader find one of them without reading the others. The
 * banded head carries the three facts that identify this particular copy, where
 * a printed or filed page is scanned for them. The parties sit side by side
 * because there are exactly two of them, and the asymmetry between the two
 * columns is the substance rather than the styling: only one of them has signed.
 *
 * WHAT IS DELIBERATELY NOT DRAWN. There is no empty counter-signature rule in
 * Party B's column. A ruled, unfilled slot is the shape of a document waiting
 * to be executed, and clause 9 says this one never will be, so drawing one
 * would make the file look half-finished rather than honestly one-sided. The
 * column states the fact instead, and the note under it explains why.
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

  /**
   * A line that disappears when it has nothing to say.
   *
   * The rule is the one `RegistrationContractInput` states: a resuming
   * registrant may hold no phone number or TIN in memory, and a contract that
   * prints "TIN —" states something false about what was agreed, while one that
   * omits the row simply does not mention it.
   */
  const optionalLine = (value: string | null, className: string): string =>
    value === null || value === ""
      ? ""
      : `<p class="${className}">${escapeHtml(value)}</p>`;

  const facts: [string, string | null][] = [
    ["Business", input.businessName],
    ["Kind", input.businessKindLabel],
    ["Business identifier", input.businessIdLabel],
    ["Address", input.businessAddressLabel],
    ["Registration reference", input.reference],
  ];

  const factRows = facts
    .filter((row): row is [string, string] => row[1] !== null && row[1] !== "")
    .map(
      ([label, value]) =>
        `<div class="fact"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`,
    )
    .join("\n        ");

  const clauseHtml = clauses
    .map(
      (clause) =>
        `<section class="clause">
          <h3><span class="n">${clause.number}</span><span>${escapeHtml(clause.heading)}</span></h3>
          ${clause.body.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n          ")}
        </section>`,
    )
    .join("\n        ");

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
  /* \`light\` and not \`light dark\`: this is paper. A reader whose browser is in
     dark mode still gets a document that looks like a document and prints like
     one, rather than a dark page with a signature that vanishes into it. */
  :root { color-scheme: light; }

  *, *::before, *::after { box-sizing: border-box; }

  body {
    background: ${PAPER};
    color: ${TEXT};
    font-family: ${TYPE_STACK};
    font-size: 16px;
    line-height: 1.6;
    margin: 0;
    -webkit-font-smoothing: antialiased;
    /* Browsers drop background colour when printing unless this is set, and
       the band is the one part of this document that IS a background. */
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .sheet { margin: 0 auto; max-width: 40rem; padding: 0 1.5rem 3.5rem; }

  /* The head. The fold is two hard-stopped gradients rather than an image, so
     it survives being saved, mailed, opened offline and printed. */
  .band {
    background-color: ${BAND};
    background-image:
      linear-gradient(101deg, ${BAND_FOLD} 0 26%, transparent 26%),
      linear-gradient(101deg, transparent 0 32%, ${BAND_FOLD} 32% 34.5%, transparent 34.5%);
    color: ${PAPER};
    padding: 2.5rem 0 1.75rem;
  }
  .band-inner {
    align-items: flex-start;
    display: flex;
    gap: 2rem;
    justify-content: space-between;
    margin: 0 auto;
    max-width: 40rem;
    padding: 0 1.5rem;
  }
  .band h1 {
    font-size: 1.875rem;
    font-weight: 800;
    letter-spacing: -0.015em;
    line-height: 1.08;
    margin: 0;
    max-width: 20ch;
    text-transform: uppercase;
  }
  .issuer {
    border-left: 1px solid rgba(255, 255, 255, 0.4);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    line-height: 1.65;
    margin: 0.45rem 0 0;
    max-width: 15ch;
    padding-left: 0.85rem;
    text-transform: uppercase;
  }
  .band-foot { margin: 1.75rem auto 0; max-width: 40rem; padding: 0 1.5rem; }
  .band-meta {
    border-top: 1px solid rgba(255, 255, 255, 0.3);
    display: flex;
    flex-wrap: wrap;
    font-size: 0.7rem;
    gap: 0.35rem 1.75rem;
    letter-spacing: 0.08em;
    margin: 0;
    padding-top: 0.85rem;
    text-transform: uppercase;
  }
  .band-meta b { font-weight: 700; }

  .block { margin-top: 2.5rem; }
  .block-title {
    border-bottom: 2px solid ${ACCENT};
    color: ${ACCENT};
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    margin: 0 0 1.1rem;
    padding-bottom: 0.45rem;
    text-transform: uppercase;
  }

  .pair { display: grid; gap: 1rem; grid-template-columns: 1fr 1fr; }
  .panel {
    background: ${TINT};
    border: 1px solid ${HAIRLINE};
    padding: 1.1rem 1.25rem;
  }
  .role {
    color: ${MUTED};
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    margin: 0 0 0.6rem;
    text-transform: uppercase;
  }
  .party-name { font-size: 1.05rem; font-weight: 700; line-height: 1.35; margin: 0; }
  .party-line { color: ${MUTED}; font-size: 0.85rem; margin: 0.35rem 0 0; }

  .facts { margin: 0; }
  .fact {
    border-bottom: 1px solid ${HAIRLINE};
    display: grid;
    gap: 0.2rem 1.5rem;
    grid-template-columns: 13rem 1fr;
    padding: 0.6rem 0;
  }
  .fact:first-child { border-top: 1px solid ${HAIRLINE}; }
  .fact dt {
    color: ${MUTED};
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    margin: 0;
    text-transform: uppercase;
  }
  .fact dd { font-size: 0.92rem; font-weight: 500; margin: 0; }

  .clause { break-inside: avoid; margin: 0 0 1.5rem; }
  .clause h3 {
    align-items: baseline;
    display: flex;
    font-size: 1.02rem;
    font-weight: 700;
    gap: 0.65rem;
    line-height: 1.35;
    margin: 0 0 0.5rem;
  }
  /* The number is the handle a registrant, an officer and a support agent all
     refer to the same paragraph by, so it is given a shape of its own rather
     than set as part of the sentence. */
  .clause .n {
    background: ${ACCENT};
    color: ${PAPER};
    flex: none;
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    height: 1.4rem;
    line-height: 1.4rem;
    text-align: center;
    width: 1.4rem;
  }
  .clause p {
    -webkit-hyphens: auto;
    hyphens: auto;
    margin: 0 0 0.6rem;
    text-align: justify;
  }

  .slot {
    align-items: flex-end;
    border-bottom: 1.5px solid ${TEXT};
    display: flex;
    margin: 0;
    min-height: 4.25rem;
    padding-bottom: 0.4rem;
  }
  .slot img { display: block; height: auto; max-width: 100%; }
  .slot-open {
    border-bottom-color: ${MUTED};
    border-bottom-style: dashed;
    color: ${MUTED};
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .signed-by { color: ${MUTED}; font-size: 0.8rem; margin: 0.65rem 0 0; }
  .signed-by strong { color: ${TEXT}; display: block; font-size: 0.95rem; font-weight: 700; }

  .note {
    border-top: 1px solid ${HAIRLINE};
    color: ${MUTED};
    font-size: 0.8rem;
    margin-top: 1.75rem;
    padding-top: 1rem;
  }
  .print-hint { color: ${MUTED}; font-size: 0.8rem; margin-top: 1.5rem; }

  /* One column on a phone, and the justification goes with it: justified text
     in a narrow measure opens rivers a contract does not need. */
  @media (max-width: 40rem) {
    .band h1 { font-size: 1.55rem; max-width: none; }
    .band-inner { flex-direction: column; gap: 1.1rem; }
    .issuer {
      border-left: 0;
      border-top: 1px solid rgba(255, 255, 255, 0.4);
      max-width: none;
      padding: 0.6rem 0 0;
    }
    .pair { grid-template-columns: 1fr; }
    .fact { grid-template-columns: 1fr; }
    .clause p { text-align: left; }
  }

  @page { margin: 14mm; }

  @media print {
    body { font-size: 10.5pt; }
    /* Only the max-width goes. Every gutter stays 1.5rem, so the title in
       the band and the clauses under it share one left edge; zeroing the
       padding here put the two a gutter apart on paper. */
    .sheet, .band-inner, .band-foot { max-width: none; }
    .sheet { padding-bottom: 0; }
    .band { padding: 1.25rem 0 1rem; }
    .print-hint { display: none; }
    .block-title { break-after: avoid; }
    .clause, .signature, .panel { break-inside: avoid; }
  }
</style>
</head>
<body>
  <header class="band">
    <div class="band-inner">
      <h1>${escapeHtml(CONTRACT_TITLE)}</h1>
      <p class="issuer">${escapeHtml(CONTRACT_OPERATOR)}</p>
    </div>
    <div class="band-foot">
      <p class="band-meta">
        <span>Version <b>${escapeHtml(input.contractVersion)}</b></span>
        <span>Registration <b>${escapeHtml(input.reference)}</b></span>
        <span>Signed <b>${escapeHtml(signedOn)}</b></span>
      </p>
    </div>
  </header>

  <main class="sheet">
    <section class="block">
      <h2 class="block-title">The parties</h2>
      <div class="pair">
        <div class="panel">
          <p class="role">Party A · The registrant</p>
          <p class="party-name">${escapeHtml(input.registrantName)}</p>
          ${optionalLine(input.registrantIdLabel, "party-line")}
          ${optionalLine(input.registrantPhone, "party-line")}
        </div>
        <div class="panel">
          <p class="role">Party B · The operator</p>
          <p class="party-name">${escapeHtml(CONTRACT_OPERATOR)}</p>
        </div>
      </div>
    </section>

    <section class="block">
      <h2 class="block-title">What this agreement covers</h2>
      <dl class="facts">
        ${factRows}
      </dl>
    </section>

    <section class="block">
      <h2 class="block-title">The agreement</h2>
      ${clauseHtml}
    </section>

    <section class="block signature">
      <h2 class="block-title">Signatures</h2>
      <div class="pair">
        <div class="panel">
          <p class="role">Party A · The registrant</p>
          <span class="slot"><img src="${signature.dataUrl}" alt="${escapeHtml(markDescription)}" width="440"></span>
          <p class="signed-by"><strong>${escapeHtml(signature.signedName)}</strong>${escapeHtml(signedOn)}<br>${escapeHtml(howItWasSigned)}</p>
        </div>
        <div class="panel">
          <p class="role">Party B · The operator</p>
          <p class="slot slot-open">Not counter-signed</p>
        </div>
      </div>
      <p class="note">Not counter-signed. ${escapeHtml(CONTRACT_OPERATOR)} has not signed this copy, and clause 9 explains why: this is a demonstration build, and no registry, officer or approver has received this document.</p>
    </section>

    <p class="print-hint">To keep this as a PDF, print this page and choose “Save as PDF”.</p>
  </main>
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
