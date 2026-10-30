/**
 * The You step checks a Rwandan National ID by its number and a selfie against
 * NIDA (through GTBank, since 2026-10-30), scans a passport's photo page and a
 * selfie, and sends no code to any phone (ADR-075 S4, AC-4 to AC-7).
 *
 * The adapters are proved over HTTP against Injishi Mock APIs by
 * `server/api/src/shared/http/sandbox-adapters.spec.ts`. This pins what a
 * reader of the source can check: the SMS path and its words are gone from
 * every file the step is built from, the client calls only the scan, the
 * National ID check and the typed details, and the step says the statuses and
 * the director line the ADR words.
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

  test("the client calls only the scan, the National ID check and the typed details", () => {
    assert.match(identityClient, /"\/api\/v1\/me\/identity\/scan"/);
    assert.match(identityClient, /"\/api\/v1\/me\/identity\/national-id"/);
    assert.match(identityClient, /"\/api\/v1\/me\/identity\/document", \{ method: "PUT"/);
    assert.doesNotMatch(identityClient, /identity\/passport/);
  });
});

describe("the check (AC-5, AC-6, and NIDA by number since 2026-10-30)", () => {
  test("a National ID is its number and a selfie; a passport its country, photo page and selfie", () => {
    assert.match(scanner, /value="national_id">Rwandan National ID</);
    assert.match(scanner, /value="passport">Passport</);
    assert.match(scanner, /label="Your National ID number"/);
    assert.match(scanner, /label="Country that issued your passport"/);
    assert.match(scanner, /Your passport's photo page/);
    assert.match(scanner, /label="A selfie"/);
    assert.match(scanner, /I agree to Injishi checking my ID with NIDA\./);
  });

  test("the card is still scanned where the NIDA check is off", () => {
    assert.match(scanner, /const byNumber = !passport && nationalIdMode !== "off"/);
    assert.match(scanner, /The front of your ID card/);
  });

  test("the status is Checked only when the record says checked, otherwise PSF will check", () => {
    assert.match(scanner, /person\.checked \? "Checked" : "PSF will check your ID"/);
  });

  test("after the tries run out the person may continue, and type what is printed", () => {
    assert.match(section, /Continue, PSF will check it/);
    assert.match(section, /scan\.mayContinue/);
    assert.match(section, /putTypedIdentity/);
  });

  test("demo notes show in demo and sandbox modes only", () => {
    assert.match(scanner, /demo === "mock" \? \(/);
    assert.match(scanner, /demo === "sandbox" \? \(/);
  });
});

describe("the director line (AC-7)", () => {
  test("the owner learns listed or not, and is pointed to the helper path, never shown the names", () => {
    assert.match(section, /You're listed as a director/);
    assert.match(section, /You're not listed as a director/);
    assert.match(section, /Register it for the owner instead/);
    assert.doesNotMatch(section, /directorNames|RRA lists/);
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
