/**
 * The register wizard reads the stored profile only when it is COMPLETE.
 *
 * WHY THIS FILE EXISTS. `/me/profile` never answers null: a new account gets
 * an object with every field null and `complete: false` (`ProfileService.read`).
 * So "is there a profile?" is the wrong question, and asking it blanks what the
 * person just typed. That is what the ADR-056 PSF step did on 2026-09-27: it
 * built its draft from `profile && !editingProfile`, so a first time registrant
 * reached the PSF form with their name, gender, phone, ID number and date of
 * birth all empty, although About you had just collected every one of them.
 *
 * WHAT IT CHECKS. Every decision in the wizard between the stored profile and
 * the typed answers (every line that reads `!editingProfile`) asks
 * `profile?.complete === true` on the same line. It reads the source rather
 * than rendering the wizard, because the wizard is one large client component
 * with a live API behind every step; the check that it is the RIGHT question
 * belongs to the browser run in `/check verify`.
 *
 * Run: pnpm --filter @injishi/web test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const WIZARD = resolve(here, "../src/app/(app)/(entry)/register/register-wizard.tsx");

/** The lines that choose between the stored profile and the typed answers, and any that ask the wrong question. */
function storedProfileDecisions(src) {
  const lines = src.split(/\r?\n/);
  const decisions = lines
    .map((text, i) => ({ line: i + 1, text: text.trim() }))
    .filter(({ text }) => text.includes("!editingProfile"));
  const wrong = decisions.filter(({ text }) => !text.includes("profile?.complete === true"));
  return { decisions, wrong };
}

describe("the register wizard's stored profile", () => {
  test("every decision asks whether the profile is complete", () => {
    const { decisions, wrong } = storedProfileDecisions(readFileSync(WIZARD, "utf8"));
    assert.ok(decisions.length >= 5, `expected the wizard's five stored profile decisions, found ${decisions.length}`);
    assert.deepEqual(
      wrong,
      [],
      "a decision reads the stored profile without asking `profile?.complete === true`, which blanks a new account's answers",
    );
  });

  test("the check catches the line that shipped the bug", () => {
    const shipped = "const personalNow = profile && !editingProfile ? personalFromProfile(profile, personal) : personal;";
    assert.equal(storedProfileDecisions(shipped).wrong.length, 1);
  });
});
