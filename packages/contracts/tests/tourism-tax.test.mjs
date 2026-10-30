import assert from "node:assert/strict";
import { test } from "node:test";

import { splitTourismTax, TOURISM_TAX_LABEL, tourismTaxIncludedRwf } from "../dist/index.js";

// Rwanda's 3% tourism tax is included in the room price (owner decision, 2026-10-30): 3/103 of it.
test("the tax inside a room price is 3/103 of it, to the franc", () => {
  assert.equal(tourismTaxIncludedRwf(60000), 1748);
  assert.equal(tourismTaxIncludedRwf(120000), 3495);
  assert.equal(tourismTaxIncludedRwf(103), 3);
});

test("a price splits into room and tax that add back to it", () => {
  for (const price of [60000, 120000, 45500, 1]) {
    const { roomRwf, taxRwf } = splitTourismTax(price);
    assert.equal(roomRwf + taxRwf, price);
  }
});

test("nothing, a negative or a non-number holds no tax", () => {
  assert.equal(tourismTaxIncludedRwf(0), 0);
  assert.equal(tourismTaxIncludedRwf(-500), 0);
  assert.equal(tourismTaxIncludedRwf(Number.NaN), 0);
  assert.equal(TOURISM_TAX_LABEL, "Tourism tax (3%)");
});
