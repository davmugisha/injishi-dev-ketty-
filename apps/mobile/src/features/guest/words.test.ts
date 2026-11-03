// The guest's money and rule words (mobile spec 0005), under `node --test`.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  BOOKING_STATUS_WORDS,
  bookingWords,
  countWords,
  dayWords,
  initials,
  priceWords,
  ratingWords,
  rwf,
  stayWords,
  tierRefundWords,
} from "./words.ts";

describe("rwf", () => {
  test("groups thousands", () => {
    assert.equal(rwf(140000), "RWF 140,000");
    assert.equal(rwf(1234567), "RWF 1,234,567");
    assert.equal(rwf(500), "RWF 500");
    assert.equal(rwf(0), "RWF 0");
  });
});

describe("priceWords", () => {
  test("says what the figure covers, never multiplying it", () => {
    assert.equal(priceWords(70000, "person_night"), "RWF 70,000 a person, a night");
    assert.equal(priceWords(280000, "party_night", 2), "RWF 280,000 a night for 2");
    assert.equal(priceWords(450000, "month"), "RWF 450,000 a month");
  });

  test("a room priced per room reads a night, never a person, a night (D-j, AC-33)", () => {
    assert.equal(priceWords(140000, "unit_night"), "RWF 140,000 a night");
    assert.equal(priceWords(90000, "party_night", 1), "RWF 90,000 a night for 1");
  });

  test("an unpriced property or room asks", () => {
    assert.equal(priceWords(null, "person_night"), "Price on request");
    assert.equal(priceWords(140000, null), "Price on request");
  });
});

describe("bookingWords", () => {
  test("instant, request with its window, and homes", () => {
    assert.equal(bookingWords("instant_book", null), "Instant booking");
    assert.equal(bookingWords("request_to_book", 24), "Replies in about 24 h");
    assert.equal(bookingWords(null, null), null);
  });
});

describe("tierRefundWords", () => {
  test("words every tier from the shared table", () => {
    assert.equal(tierRefundWords("flexible"), "Free cancellation until 24 hours before check in");
    assert.equal(tierRefundWords("moderate"), "Free cancellation until 5 days before check in, then 50% back");
    assert.equal(tierRefundWords("limited"), "50% back if you cancel 7 days or more before check in");
    assert.equal(tierRefundWords("firm"), "50% back if you cancel 30 days or more before check in");
    assert.equal(tierRefundWords(null), tierRefundWords("flexible"));
  });
});

describe("small words", () => {
  test("rating or New", () => {
    assert.equal(ratingWords(4.6, 128), "4.6 (128)");
    assert.equal(ratingWords(5, 1), "5.0 (1)");
    assert.equal(ratingWords(null, 0), "New");
  });

  test("counts", () => {
    assert.equal(countWords(1, "stays"), "1 stay");
    assert.equal(countWords(24, "stays"), "24 stays");
    assert.equal(countWords(2, "homes"), "2 homes");
  });

  test("initials", () => {
    assert.equal(initials("Isangano Lakeside Hotel"), "IL");
    assert.equal(initials("kivu"), "K");
    assert.equal(initials("  "), "?");
  });
});

describe("dates", () => {
  test("a day and a stay", () => {
    assert.equal(dayWords("2026-10-14"), "14 Oct");
    assert.equal(stayWords("2026-10-14", "2026-10-16"), "14 to 16 Oct");
    assert.equal(stayWords("2026-10-30", "2026-11-02"), "30 Oct to 2 Nov");
  });

  test("every booking status has words", () => {
    for (const status of ["pending_approval", "confirmed", "declined", "cancelled", "no_show"]) {
      assert.ok(BOOKING_STATUS_WORDS[status], status);
    }
  });
});
