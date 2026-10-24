import { strict as assert } from "node:assert";
import { describe, test } from "node:test";

import { SetPsfTierFeeRequest, resolvePsfTierFee } from "../dist/index.js";

describe("what a PSF band costs in a district (2026-10-20)", () => {
  test("the district's own price wins, then the national one, then the band's start", () => {
    assert.deepEqual(resolvePsfTierFee(25_000, 22_000, 20_000), { amountRwf: 25_000, source: "district" });
    assert.deepEqual(resolvePsfTierFee(null, 22_000, 20_000), { amountRwf: 22_000, source: "national" });
    assert.deepEqual(resolvePsfTierFee(null, null, 20_000), { amountRwf: 20_000, source: "band" });
  });

  test("a band nobody priced, with no start of its own, is not offered", () => {
    assert.deepEqual(resolvePsfTierFee(null, null, null), { amountRwf: null, source: "band" });
  });

  test("a price is set above zero, or cleared with null", () => {
    assert.equal(SetPsfTierFeeRequest.safeParse({ tierCode: "indatwa_20k", districtId: 102, amountRwf: 0 }).success, false);
    assert.equal(SetPsfTierFeeRequest.safeParse({ tierCode: "indatwa_20k", districtId: null, amountRwf: null }).success, true);
  });
});
