/**
 * The downloadable registration agreement, checked without a browser.
 *
 * `lib/registration-contract.ts` has always claimed in its header that it can
 * be driven under Node's type stripping, "which is how the clause text and the
 * generated document are checked without a browser". Nothing was checking it.
 * This is that check, added when the document was restyled, because a restyle
 * is exactly the change that can quietly reword a contract nobody re-reads.
 *
 * It is organised into five named groups, and the names are load bearing: the
 * gate ledger runs each group by `--test-name-pattern`, so renaming a group
 * silently narrows what is verified.
 *
 *   content   the agreement still says what it said
 *   omission  a null optional field leaves no trace
 *   escaping  a typed value cannot become markup
 *   design    the reference layout is present, and painted only from tokens
 *   print     the document survives a printer
 *
 * Run: pnpm --filter @injishi/web test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { fixed, ink, green } from "@injishi/design-tokens";

// Registered before the first dynamic import, so the module under test is read
// as the source on disk rather than as a build artefact.
register("./ts-source-hook.mjs", import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));

const {
  CONTRACT_TITLE,
  CONTRACT_OPERATOR,
  contractDocumentHtml,
  registrationContractClauses,
} = await import("../src/lib/registration-contract.ts");

/**
 * The agreement as it read before the document was restyled.
 *
 * This is a deliberate lock on WORDING, not on layout. A change to any clause
 * fails here on purpose: the text is what a registrant is bound by, and the
 * last change to it was made on the owner's instruction. To change it, change
 * the clauses and update this fixture in the same commit, so the diff shows a
 * person decided rather than a refactor drifted.
 */
const BASELINE = JSON.parse(
  readFileSync(
    resolve(here, "fixtures/registration-contract-clauses.json"),
    "utf8",
  ),
);

/** The registration the baseline was captured against. */
const BASELINE_INPUT = {
  registrantName: "Baseline Registrant",
  registrantIdLabel: "National ID 1 1998 7 0012345 6 7 8",
  registrantPhone: "+250 788 000 000",
  businessName: "Baseline Guest House",
  businessKindLabel: "Guest House",
  businessIdLabel: "RRA TIN 123456789",
  businessAddressLabel: "Kacyiru, Gasabo, Kigali",
  reference: "REG-BASELINE-0001",
  contractVersion: "v1",
};

/** Every optional field absent: the shape a resuming registrant produces. */
const SPARSE_INPUT = {
  ...BASELINE_INPUT,
  registrantIdLabel: null,
  registrantPhone: null,
  businessIdLabel: null,
  businessAddressLabel: null,
};

const SIGNATURE = {
  dataUrl: "data:image/png;base64,AAAA",
  signedName: "Baseline Registrant",
  signedAt: "2026-09-21T09:24:00.000Z",
  method: "drawn",
};

const full = contractDocumentHtml(BASELINE_INPUT, SIGNATURE);
const sparse = contractDocumentHtml(SPARSE_INPUT, SIGNATURE);

/** Count non-overlapping occurrences of a literal. */
function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

describe("content: the agreement still says what it said", () => {
  test("content: the nine clauses are identical to the baseline", () => {
    assert.deepEqual(
      registrationContractClauses(BASELINE_INPUT),
      BASELINE.clauses,
    );
  });

  test("content: the title and the counterparty are unchanged", () => {
    assert.equal(CONTRACT_TITLE, BASELINE.title);
    assert.equal(CONTRACT_OPERATOR, BASELINE.operator);
  });

  test("content: every clause paragraph reaches the document", () => {
    let paragraphs = 0;
    for (const clause of BASELINE.clauses) {
      for (const body of clause.body) {
        paragraphs += 1;
        // The document escapes as it prints, so compare against the escaped
        // form rather than the raw sentence.
        const printed = body
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
        assert.ok(
          full.includes(printed),
          `clause ${clause.number} lost a paragraph: ${body.slice(0, 60)}`,
        );
      }
    }
    assert.equal(paragraphs, 25);
  });

  test("content: the clause numbers survive, in order", () => {
    // The numbers are the handle three different people refer to the same
    // paragraph by, so losing them is a content failure and not a visual one.
    const numerals = [...full.matchAll(/<span class="n">(\d+)<\/span>/g)].map(
      (m) => Number(m[1]),
    );
    assert.deepEqual(numerals, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test("content: every clause heading is printed", () => {
    for (const clause of BASELINE.clauses) {
      assert.ok(
        full.includes(clause.heading),
        `missing heading: ${clause.heading}`,
      );
    }
    assert.equal(BASELINE.clauses.length, 9);
  });
});

describe("omission: a null optional field leaves no trace", () => {
  test("omission: a null identity document and phone drop their party lines", () => {
    assert.equal(count(full, 'class="party-line"'), 2);
    assert.equal(count(sparse, 'class="party-line"'), 0);
  });

  test("omission: a null business identifier and address drop their fact rows", () => {
    assert.equal(count(full, 'class="fact"'), 5);
    assert.equal(count(sparse, 'class="fact"'), 3);
  });

  test("omission: the dropped labels are absent entirely, not printed empty", () => {
    for (const label of ["Business identifier", "Address"]) {
      assert.ok(full.includes(label), `${label} should appear when present`);
      assert.ok(!sparse.includes(label), `${label} should vanish when null`);
    }
  });

  test("omission: no null, undefined or placeholder dash reaches the page", () => {
    const body = sparse.slice(sparse.indexOf("<body>"));
    for (const leak of [">null<", ">undefined<", "<dd>—</dd>", "<dd></dd>"]) {
      assert.ok(!body.includes(leak), `leaked ${leak}`);
    }
  });
});

describe("escaping: a typed value cannot become markup", () => {
  test("escaping: a business name carrying markup is escaped everywhere", () => {
    const html = contractDocumentHtml(
      { ...BASELINE_INPUT, businessName: "Chez <b>Alice</b>" },
      SIGNATURE,
    );
    assert.ok(html.includes("Chez &lt;b&gt;Alice&lt;/b&gt;"));
    assert.ok(!html.includes("Chez <b>Alice"));
  });

  test("escaping: a quote in the signer name cannot break out of the alt", () => {
    const html = contractDocumentHtml(BASELINE_INPUT, {
      ...SIGNATURE,
      signedName: 'A" onerror="x',
    });
    assert.ok(!html.includes('onerror="x"'));
    assert.ok(html.includes("&quot; onerror=&quot;x"));
  });

  test("escaping: an ampersand in an address is escaped once", () => {
    const html = contractDocumentHtml(
      { ...BASELINE_INPUT, businessAddressLabel: "Bar & Grill Road" },
      SIGNATURE,
    );
    assert.ok(html.includes("Bar &amp; Grill Road"));
    assert.ok(!html.includes("&amp;amp;"));
  });
});

describe("design: the reference layout, painted only from tokens", () => {
  /**
   * Every six-digit colour the document paints with, which is the whole set a
   * reader can ever see: the file loads no stylesheet and no image.
   */
  const painted = new Set(full.match(/#[0-9A-Fa-f]{6}/g) ?? []);

  test("design: every colour in the document is a design-token value", () => {
    const allowed = new Set([
      ...Object.values(ink),
      ...Object.values(green),
      fixed.ink,
      fixed.white,
    ]);
    for (const colour of painted) {
      assert.ok(
        allowed.has(colour),
        `${colour} is painted into the contract but is not a token value`,
      );
    }
    // A document that painted nothing would pass the loop above vacuously.
    assert.ok(painted.size >= 6, `only ${painted.size} colours found`);
  });

  test("design: the head band is the green-950 step, folded with green-900", () => {
    assert.ok(full.includes(`background-color: ${green[950]}`));
    assert.equal(count(full, green[900]), 2, "the fold is two hard-stopped gradients");
    assert.ok(full.includes('<header class="band">'));
  });

  test("design: the accent is the step that clears AA on white", () => {
    // green-600 is the brand accent on screen and fails on white (2.98:1), so
    // its appearance here would be a real contrast regression.
    assert.ok(full.includes(green[800]));
    assert.ok(!painted.has(green[600]));
  });

  test("design: both parties are drawn, A the registrant and B the operator", () => {
    assert.ok(full.includes("Party A · The registrant"));
    assert.ok(full.includes("Party B · The operator"));
    assert.equal(count(full, 'class="pair"'), 2, "parties and signatures");
  });

  test("design: Party B is given no empty counter-signature rule", () => {
    // One signature slot, and it belongs to the registrant. A second ruled slot
    // would draw a document waiting to be executed, which clause 9 denies.
    assert.equal(count(full, 'class="slot"'), 1);
    assert.equal(count(full, 'class="slot slot-open"'), 1);
    assert.ok(full.includes("Not counter-signed"));
  });

  test("design: the type stack names Figtree first and fetches no font", () => {
    assert.ok(full.includes("font-family: Figtree, ui-sans-serif"));
    assert.ok(!full.includes("fonts.googleapis"));
    assert.ok(!full.includes("@import"));
  });
});

describe("print: the document survives a printer", () => {
  test("print: background colour is forced to print", () => {
    // Without this the browser drops the band, and the band is the one part of
    // the document that is a background rather than ink.
    assert.ok(full.includes("print-color-adjust: exact"));
    assert.ok(full.includes("-webkit-print-color-adjust: exact"));
  });

  test("print: clauses and the signature block are kept off page breaks", () => {
    assert.ok(full.includes("break-inside: avoid"));
    assert.ok(full.includes("break-after: avoid"));
  });

  test("print: the screen-only hint is hidden on paper", () => {
    assert.ok(full.includes('class="print-hint"'));
    assert.ok(/@media print\b[\s\S]*\.print-hint \{ display: none; \}/.test(full));
  });

  test("print: a page margin is declared", () => {
    assert.ok(full.includes("@page { margin: 14mm; }"));
  });
});
