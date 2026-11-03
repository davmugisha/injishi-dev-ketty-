// Rwandan francs as the prototype writes them, under `node --test`.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { rwf } from "./money.ts";

describe("money", () => {
  test("francs as the prototype writes them", () => {
    assert.equal(rwf(186000), "RWF 186,000");
    assert.equal(rwf(1250000), "RWF 1,250,000");
    assert.equal(rwf(950), "RWF 950");
    assert.equal(rwf(0), "RWF 0");
    assert.equal(rwf(-5000), "RWF -5,000");
    assert.equal(rwf(1999.6), "RWF 2,000");
  });
});
