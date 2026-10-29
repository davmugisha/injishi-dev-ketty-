/**
 * The You step scans the ID, front then a selfie, for a National ID and a
 * passport alike, and sends no code to any phone (ADR-075 S4, AC-4 to AC-7).
 *
 * The scan itself is proved over HTTP by `server/api/scripts/verify-adr075-identity.mjs`
 * and in the browser walk. This pins what a reader of the source can check: the
 * SMS path and its words are gone from every file the step is built from, the
 * client calls only the scan and the typed details, and the step says the
 * statuses and the director line the ADR words.
 *
 * Run: pnpm --filter @injishi/web test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const REGISTER = resolve(here, "../src/app/(app)/(entry)/register");
const read = (p) => readFileSync(p, "utf8");
const registerFiles = readdirSync(REGISTER)
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => [f, read(resolve(REGISTER, f))]);
const identityClient = read(resolve(here, "../src/data/identity.ts"));
const scanner = read(resolve(REGISTER, "identity-verifier.tsx"));
const section = read(resolve(REGISTER, "section-identity.tsx"));
// The director line is the business's, under "Who is registering it?", not the person's.
const tinSection = read(resolve(REGISTER, "section-tin.tsx"));

describe("no code is sent to any phone (AC-4)", () => {
  test("no register file names the SMS routes or speaks their words", () => {
    const gone = [
      /national-id\/(lookup|confirm)/,
      /population register/i,
      /text message/i,
      /code to the phone/i,
      /10 minutes and 5 tries/,
      /NationalIdVerifier|lookupNationalId|confirmNationalId/,
    ];
    for (const [file, code] of [...registerFiles, ["data/identity.ts", identityClient]]) {
      for (const word of gone) assert.doesNotMatch(code, word, `${file} still has ${word}`);
    }
  });

  test("the client calls only the scan and the typed details", () => {
    assert.match(identityClient, /"\/api\/v1\/me\/identity\/scan"/);
    assert.match(identityClient, /"\/api\/v1\/me\/identity\/document", \{ method: "PUT"/);
    assert.doesNotMatch(identityClient, /identity\/passport/);
  });
});

describe("the scan (AC-5, AC-6)", () => {
  test("one scanner for both documents: the front or the photo page, then a selfie", () => {
    assert.match(scanner, /"national_id", "National ID"/);
    assert.match(scanner, /"passport", "Passport"/);
    assert.match(scanner, /The front of your ID card/);
    assert.match(scanner, /Your passport's photo page/);
    assert.match(scanner, /label="A selfie"/);
    assert.match(scanner, /I agree to Injishi checking my ID\./);
  });

  test("the status is Checked only when the record says checked, otherwise PSF will check", () => {
    assert.match(scanner, /person\.checked \? "Checked" : "PSF will check your ID"/);
  });

  test("after the tries run out the person may continue, and type what is printed", () => {
    assert.match(section, /Continue, PSF will check it/);
    assert.match(section, /scan\.mayContinue/);
    assert.match(section, /putTypedIdentity/);
  });

  test("demo notes show in demo mode only", () => {
    assert.match(scanner, /mode === "mock" \? \(/);
  });
});

describe("the director line (AC-7)", () => {
  test("the owner learns listed or not, and is pointed to the helper path, never shown the names", () => {
    assert.match(tinSection, /You're listed as a director/);
    assert.match(tinSection, /You're not listed as a director/);
    assert.match(tinSection, /Register it for the owner instead/);
    assert.doesNotMatch(tinSection, /directorNames|RRA lists/);
  });

  test("the identity section is about the person alone: no director line, no TIN", () => {
    assert.doesNotMatch(section, /director|TIN/);
  });

  test("the contract asks for the directors' names only with the helper's capacity", async () => {
    const { TinCheckRequest, SCAN_ATTEMPTS_BEFORE_CONTINUE, TypedIdentityRequest } = await import("@injishi/contracts");
    assert.equal(TinCheckRequest.safeParse({ tin: "999031001", capacity: "on_behalf_of" }).success, true);
    assert.equal(TinCheckRequest.safeParse({ tin: "999031001" }).success, true);
    assert.equal(SCAN_ATTEMPTS_BEFORE_CONTINUE, 3);
    assert.equal(
      TypedIdentityRequest.safeParse({
        fullName: "Grace Uwimana",
        dateOfBirth: "1991-03-04",
        document: { documentType: "national_id", documentNumber: "1 1991 7 0012345 12 3" },
      }).success,
      true,
    );
    assert.equal(
      TypedIdentityRequest.safeParse({
        fullName: "Grace Uwimana",
        dateOfBirth: "1991-03-04",
        document: { documentType: "national_id", documentNumber: "123" },
      }).success,
      false,
    );
  });
});
