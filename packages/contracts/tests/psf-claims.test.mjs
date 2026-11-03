import assert from "node:assert/strict";
import { test } from "node:test";

import { looksLikePsfNumber, normalizePsfNumber, PSF_STANDING_LABEL } from "../dist/index.js";

// A typed PSF membership number is a claim until PSF confirms it (0121, 2026-10-30).
test("a number PSF prints reads as one", () => {
  for (const n of ["PSF/KIC/2026/0009", "PSF-123-456", "psf 2024 77", "RW-PSF-0012"]) {
    assert.equal(looksLikePsfNumber(n), true, n);
  }
});

test("half-typed or made-of-nothing values do not", () => {
  for (const n of ["", "PSF-", "PSF", "PSF-1", "----", "PSF/KIC/", "12", "PSF!123"]) {
    assert.equal(looksLikePsfNumber(n), false, JSON.stringify(n));
  }
});

test("a number is kept the way PSF prints it", () => {
  assert.equal(normalizePsfNumber("  psf/kic/2026/0009 "), "PSF/KIC/2026/0009");
  assert.equal(normalizePsfNumber("psf   123  456"), "PSF 123 456");
});

test("a claim has a standing of its own, not member", () => {
  // A card holder (2026-11-02): an old PSF card, waiting for PSF to confirm it.
  assert.equal(PSF_STANDING_LABEL.claimed, "Card holder, waiting for PSF");
});
