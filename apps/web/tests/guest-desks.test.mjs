/**
 * What `/inbox` offers a guest who wants to write to a hotel.
 *
 * THE BUG THIS PINS. The desks panel rendered only when `currentStay()` found
 * an OPEN stay, so a guest who had booked and not yet arrived was offered no
 * desk at all — on the screen the demo's own "Guest booking a stay" persona is
 * told to visit in order to message the hotel. He had eight conversations, all
 * `reservation`, all with no department and no messages, and nothing to press.
 *
 * `GET /me/departments` answers for a stay and a booking alike, and
 * `deskOffer` turns that payload into the section. The decision lives in
 * `src/lib/guest-desks.ts` rather than inside the JSX precisely so this file
 * can exercise it: a rule embedded in a component can only be checked by
 * rendering, and nothing here renders.
 *
 * THIS TEST RUNS THE REAL FUNCTION, the way `safe-redirect.test.mjs` does: the
 * source is read, transpiled and evaluated. It imports nothing at runtime — the
 * only import in the module is `import type`, which TypeScript erases — so
 * there is nothing to stub and nothing that could drift from the real thing.
 * A test that re-stated the rule would be checking itself.
 *
 * NOT TESTED HERE, and deliberately: that a CANCELLED booking is absent. The
 * payload this module reads never contains one — which bookings are live is
 * resolved in the API (`MessagingService.myDepartments`, gated by leaf-1.1:G5),
 * and asserting it from a fixture would be asserting that the fixture was
 * written correctly.
 *
 * Run: pnpm --filter @injishi/web test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ts = require("typescript");

async function loadGuestDesks() {
  const path = resolve(here, "../src/lib/guest-desks.ts");
  const src = readFileSync(path, "utf8");

  // The loader can only evaluate this file while every import is type-only.
  // If a value import ever lands here, this assertion says so instead of the
  // module failing to resolve `@injishi/contracts` with a confusing stack.
  const valueImports = [...src.matchAll(/^import\s+(?!type\b)/gm)];
  assert.equal(
    valueImports.length,
    0,
    "guest-desks.ts gained a runtime import; this loader evaluates it standalone and must be taught to stub that import.",
  );

  const { outputText } = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const { deskOffer, standingLabel, desksLeadTheInbox } = await loadGuestDesks();

/** A fixed "now" so a date sentence does not change meaning overnight. */
const NOW = new Date(2026, 8, 16, 10, 0, 0); // 16 Sep 2026, local

const desk = (over = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Housekeeping",
  departmentCategory: "housekeeping",
  phone: null,
  threadId: null,
  unreadCount: 0,
  lastMessageAt: null,
  ...over,
});

/** A place the guest is checked in at. */
const stayPlace = (over = {}) => ({
  propertyId: "aaaaaaaa-0000-4000-8000-000000000001",
  propertyName: "Amahoro Boutique Hotel",
  context: "stay",
  subjectId: "55555555-0000-4000-8000-000000000001",
  bookingReference: "INJ-4821",
  checkIn: "2026-09-15T14:30:00.000Z",
  inHouse: true,
  departments: [desk({ name: "Front desk", unreadCount: 2 }), desk({ id: "22222222-2222-4222-8222-222222222222" })],
  ...over,
});

/** A place the guest has booked and not yet arrived at. */
const bookingPlace = (over = {}) => ({
  propertyId: "bbbbbbbb-0000-4000-8000-000000000002",
  propertyName: "Lake Kivu Serena",
  context: "booking",
  subjectId: "66666666-0000-4000-8000-000000000002",
  bookingReference: "INJ-9007",
  checkIn: "2026-10-14",
  inHouse: false,
  departments: [desk({ id: "33333333-3333-4333-8333-333333333333", name: "Concierge" })],
  ...over,
});

describe("deskOffer: the empty answer", () => {
  test("a guest staying nowhere and booked nowhere gets no section at all", () => {
    // Not an error and not an empty box: `/inbox`'s own empty state covers
    // this person, and a heading over nothing is the classic wrong.
    assert.deepEqual(deskOffer([], NOW), { kind: "nowhere" });
  });
});

describe("deskOffer: a stay place", () => {
  const offer = deskOffer([stayPlace()], NOW);

  test("it is offered", () => {
    assert.equal(offer.kind, "places");
    assert.equal(offer.places.length, 1);
  });

  test("it says the guest is checked in, and never borrows the arrival wording", () => {
    assert.equal(offer.places[0].standing, "You're checked in");
    assert.equal(offer.places[0].inHouse, true);
    assert.ok(
      !/Arriving/.test(offer.places[0].standing),
      "an in-house place must not tell somebody in room 204 that they arrive later",
    );
  });

  test("its desks come through, and the unread count is the property's total", () => {
    assert.deepEqual(
      offer.places[0].departments.map((d) => d.name),
      ["Front desk", "Housekeeping"],
    );
    assert.equal(offer.places[0].unread, 2);
  });
});

describe("deskOffer: a booking place", () => {
  const offer = deskOffer([bookingPlace()], NOW);

  test("a guest who has only BOOKED is offered the desks too", () => {
    // The whole point. This person had nothing before: no stay, so no panel.
    assert.equal(offer.kind, "places");
    assert.deepEqual(
      offer.places[0].departments.map((d) => d.name),
      ["Concierge"],
    );
  });

  test("the arrival date is what makes the row make sense", () => {
    assert.equal(offer.places[0].standing, "Arriving 14 Oct");
    assert.equal(offer.places[0].inHouse, false);
  });

  test("the booking reference is carried, because that is what a guest recognises", () => {
    assert.equal(offer.places[0].bookingReference, "INJ-9007");
  });
});

describe("deskOffer: a place that opened no desk to guests", () => {
  test("it is left out rather than rendered as an empty property", () => {
    const offer = deskOffer([stayPlace(), bookingPlace({ departments: [] })], NOW);
    assert.equal(offer.kind, "places");
    assert.deepEqual(
      offer.places.map((p) => p.propertyName),
      ["Amahoro Boutique Hotel"],
    );
  });

  test("when it is the only one, the section says so and names it", () => {
    const offer = deskOffer([bookingPlace({ departments: [] })], NOW);
    assert.equal(offer.kind, "no-desks");
    assert.deepEqual(offer.properties, ["Lake Kivu Serena"]);
  });

  test("two of them are both named — the guest should know which hotels", () => {
    const offer = deskOffer(
      [stayPlace({ departments: [] }), bookingPlace({ departments: [] })],
      NOW,
    );
    assert.equal(offer.kind, "no-desks");
    assert.deepEqual(offer.properties, ["Amahoro Boutique Hotel", "Lake Kivu Serena"]);
  });
});

describe("deskOffer: the order places come in", () => {
  test("in house before booked, whatever order the server sent them in", () => {
    const offer = deskOffer([bookingPlace(), stayPlace()], NOW);
    assert.deepEqual(
      offer.places.map((p) => p.propertyName),
      ["Amahoro Boutique Hotel", "Lake Kivu Serena"],
    );
  });

  test("bookings run soonest arrival first", () => {
    const soon = bookingPlace({
      propertyId: "cccccccc-0000-4000-8000-000000000003",
      propertyName: "Nyungwe Lodge",
      checkIn: "2026-09-20",
    });
    const offer = deskOffer([bookingPlace(), soon], NOW);
    assert.deepEqual(
      offer.places.map((p) => p.propertyName),
      ["Nyungwe Lodge", "Lake Kivu Serena"],
    );
  });

  test("two open stays put the most recent arrival first, as `currentStay` does", () => {
    const earlier = stayPlace({
      propertyId: "dddddddd-0000-4000-8000-000000000004",
      propertyName: "Kigali Heights Suites",
      checkIn: "2026-09-12T11:00:00.000Z",
    });
    const offer = deskOffer([earlier, stayPlace()], NOW);
    assert.deepEqual(
      offer.places.map((p) => p.propertyName),
      ["Amahoro Boutique Hotel", "Kigali Heights Suites"],
    );
  });
});

describe("desksLeadTheInbox: where the desks sit", () => {
  test("an account with nothing to read leads with the desks", () => {
    assert.equal(desksLeadTheInbox([]), true);
  });

  test("eight EMPTY reservation threads still lead with the desks", () => {
    // This is the guest the whole feature exists for. Every booking opens a
    // `reservation` thread at sale, so he arrives holding eight conversations
    // in which nothing has ever been said. Ranking that list above the desks
    // would be the original bug wearing a different hat.
    const threads = Array.from({ length: 8 }, () => ({ messageCount: 0 }));
    assert.equal(desksLeadTheInbox(threads), true);
  });

  test("one conversation with something in it puts the list first", () => {
    // An inbox with replies in it is for reading them; a compose picker that
    // pushes the replies below the fold has the priority backwards.
    assert.equal(desksLeadTheInbox([{ messageCount: 0 }, { messageCount: 3 }]), false);
  });
});

describe("standingLabel", () => {
  test("today and tomorrow are said in words, not as a date", () => {
    assert.equal(standingLabel(bookingPlace({ checkIn: "2026-09-16" }), NOW), "Arriving today");
    assert.equal(standingLabel(bookingPlace({ checkIn: "2026-09-17" }), NOW), "Arriving tomorrow");
  });

  test("a check-in already past does not claim the guest arrives later", () => {
    // A live booking whose check-in day has gone: they are due and have not
    // been checked in. Telling somebody in the lobby they arrive next week is
    // the kind of small lie that makes a screen untrustworthy.
    //
    // The month's own spelling is ICU's and is not asserted — en-GB abbreviates
    // September as "Sept" on a current CLDR and "Sep" on an older one, and
    // which one a runtime ships is not a decision this module makes.
    const label = standingLabel(bookingPlace({ checkIn: "2026-09-10" }), NOW);
    assert.match(label, /^Booked from 10 Sept?/);
    assert.doesNotMatch(label, /Arriving/);
  });

  test("another year is named, so a 2027 trip is not read as next month", () => {
    assert.equal(standingLabel(bookingPlace({ checkIn: "2027-02-03" }), NOW), "Arriving 3 Feb 2027");
  });

  test("this year's date carries no year, which would be noise", () => {
    assert.doesNotMatch(standingLabel(bookingPlace({ checkIn: "2026-10-14" }), NOW), /2026/);
  });

  test("a YYYY-MM-DD check-in is that calendar day, not UTC midnight", () => {
    // `new Date("2026-10-14")` is midnight UTC, which formats as the 13th for
    // any reader west of Greenwich. A check-in is a DAY the property chose, so
    // the day number must survive whatever zone the reader is in.
    assert.equal(standingLabel(bookingPlace({ checkIn: "2026-10-14" }), NOW), "Arriving 14 Oct");
  });

  test("no date at all still says something true", () => {
    assert.equal(standingLabel(bookingPlace({ checkIn: null }), NOW), "Booked");
  });

  test("an unreadable date falls back rather than printing Invalid Date", () => {
    assert.equal(standingLabel(bookingPlace({ checkIn: "not-a-date" }), NOW), "Booked");
  });
});
