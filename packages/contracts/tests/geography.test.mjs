import assert from "node:assert/strict";
import { test } from "node:test";
import { tidyPlaceName } from "../dist/index.js";

test("place names read as people write them", () => {
  assert.equal(tidyPlaceName("EAST"), "Eastern Province");
  assert.equal(tidyPlaceName("KIGALI"), "Kigali City");
  assert.equal(tidyPlaceName("GATUMBA"), "Gatumba");
  assert.equal(tidyPlaceName("Nyakabanda Ii"), "Nyakabanda II");
  assert.equal(tidyPlaceName("Kinini-rusiga"), "Kinini-Rusiga");
  assert.equal(tidyPlaceName("Gasabo"), "Gasabo");
  assert.equal(tidyPlaceName(tidyPlaceName("Rukiri I")), "Rukiri I");
});
