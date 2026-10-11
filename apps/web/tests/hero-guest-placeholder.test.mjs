/**
 * The hero search must not answer a question nobody asked, and must not change
 * what a search does in the process.
 *
 * WHERE and WHEN both had an empty reading — "Anywhere in Rwanda", "Any week" —
 * because both of their shapes have an empty value. `GuestCounts` had none, so
 * WHO printed `DEFAULT_GUESTS` and a visitor who had just landed was told "2
 * guests" about their own trip. The fix is a form state that can say "not
 * asked" (`StaySearch.guests === null`), and the trap in it is the other half:
 * the party a search SUBMITS must stay the default, or a display change
 * silently becomes a filter change and every kept `/explore` link means
 * something new.
 *
 * So this pins both halves against the real modules — `lib/stay-search.ts` and
 * `lib/search-params.ts`, loaded through `ts-source-hook.mjs` with their whole
 * dependency tree, down to the `pluralize` that produces the words.
 *
 * Run: pnpm --filter @injishi/web test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./ts-source-hook.mjs", import.meta.url);

const {
  DEFAULT_GUESTS,
  EMPTY_SEARCH,
  GUESTS_PLACEHOLDER,
  guestSummary,
  partyOf,
  searchGuestSummary,
  searchHref,
  toIntent,
} = await import("@/lib/stay-search");
const { parseIntent } = await import("@/lib/search-params");

/** The query half of a href, as something with a `get`. */
const paramsOf = (href) => new URLSearchParams(href.split("?")[1] ?? "");

describe("the WHO field before anybody has answered it", () => {
  test("a freshly landed search holds no party at all", () => {
    assert.equal(EMPTY_SEARCH.guests, null);
  });

  test("so the field has no summary to print, the same way an unpicked date range has none", () => {
    assert.equal(searchGuestSummary(EMPTY_SEARCH), null);
  });

  test("the placeholder that stands in its place names no number", () => {
    assert.equal(typeof GUESTS_PLACEHOLDER, "string");
    assert.ok(GUESTS_PLACEHOLDER.trim().length > 0, "the placeholder is empty");
    // The bug being fixed was a COUNT in a field nobody had filled. A
    // placeholder carrying a digit would be the same bug in a quieter voice.
    assert.doesNotMatch(
      GUESTS_PLACEHOLDER,
      /\d/,
      `the placeholder states a count: ${GUESTS_PLACEHOLDER}`,
    );
  });
});

describe("the WHO field once somebody has answered it", () => {
  const withParty = (guests) => ({ ...EMPTY_SEARCH, guests });

  test("one adult reads as one guest", () => {
    assert.equal(
      searchGuestSummary(withParty({ ...DEFAULT_GUESTS, adults: 1 })),
      "1 guest",
    );
  });

  test("children count towards the party and infants are named separately", () => {
    assert.equal(
      searchGuestSummary(
        withParty({ adults: 2, children: 1, infants: 1, pets: false }),
      ),
      "3 guests, 1 infant",
    );
  });

  test("pets are named too", () => {
    assert.equal(
      searchGuestSummary(withParty({ ...DEFAULT_GUESTS, pets: true })),
      "2 guests, pets",
    );
  });

  test("a party chosen AT the default is still a chosen party", () => {
    // The distinction the null carries. Comparing counts against the default
    // — which is how the panel's Reset button used to decide — cannot tell a
    // party of two somebody picked from a party of two nobody did, and would
    // print the placeholder over a real answer.
    assert.equal(searchGuestSummary(withParty({ ...DEFAULT_GUESTS })), "2 guests");
  });

  test("the summary is the same function the rest of the funnel words a party with", () => {
    const party = { adults: 4, children: 2, infants: 0, pets: true };
    assert.equal(searchGuestSummary(withParty(party)), guestSummary(party));
  });
});

describe("what an untouched search actually submits", () => {
  test("the default party, so the stays returned are unchanged", () => {
    assert.deepEqual(partyOf(EMPTY_SEARCH), DEFAULT_GUESTS);
    assert.deepEqual(toIntent(EMPTY_SEARCH).guests, DEFAULT_GUESTS);
  });

  test("a bare /explore, with no guest parameter of any kind", () => {
    const href = searchHref(EMPTY_SEARCH);
    assert.equal(href, "/explore");
    for (const param of ["adults", "children", "infants", "pets", "guests"]) {
      assert.equal(paramsOf(href).get(param), null, `${param} was written`);
    }
  });

  test("and that bare URL still reads back as the default party", () => {
    // The round trip is the point: `/explore` with no guest parameter has
    // always meant the default party, and this change must not make it mean
    // something else. A kept link keeps its results.
    assert.deepEqual(parseIntent(paramsOf(searchHref(EMPTY_SEARCH))).guests, DEFAULT_GUESTS);
  });

  test("a party that WAS chosen still reaches the URL", () => {
    const href = searchHref({
      ...EMPTY_SEARCH,
      guests: { adults: 3, children: 1, infants: 2, pets: true },
    });
    const params = paramsOf(href);
    assert.equal(params.get("adults"), "3");
    assert.equal(params.get("children"), "1");
    assert.equal(params.get("infants"), "2");
    assert.equal(params.get("pets"), "1");
  });
});
