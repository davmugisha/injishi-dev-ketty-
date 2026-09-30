/**
 * The shapes a guest reaches a department through, before they have arrived
 * (ADR-050 D-q).
 *
 * These are the wire contract of `POST /api/v1/me/threads` and
 * `GET /api/v1/me/departments`, so every case below is one a real client can
 * send: the happy payload, and each way of getting it wrong. The refusals
 * matter more than the acceptance — `.strict()` and the length bounds are the
 * only thing standing between the API and a body that names its own stay, and
 * a schema nobody tests is a schema whose `.strict()` can be dropped in a
 * refactor without a single test going red.
 *
 * It tests the BUILT module (`dist/`), like every other test in this folder.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  GUEST_MESSAGE_MAX,
  GuestDeskPlace,
  GuestThread,
  MyDepartments,
  OpenThreadRequest,
} = require("../dist/index.js");

const DEPARTMENT = "de300000-0000-4000-8000-000000000701";
const PROPERTY = "de300000-0000-4000-8000-000000000401";
const SUBJECT = "de300000-0000-4000-8000-000000000901";

describe("OpenThreadRequest", () => {
  test("accepts a department and a first message, with no subject", () => {
    const parsed = OpenThreadRequest.parse({
      departmentId: DEPARTMENT,
      body: "  Could you hold a cot for us?  ",
    });
    assert.equal(parsed.departmentId, DEPARTMENT);
    // Trimmed on the way in, so a body of spaces cannot become a message.
    assert.equal(parsed.body, "Could you hold a cot for us?");
    assert.equal(parsed.subject, undefined);
  });

  test("accepts an optional subject", () => {
    const parsed = OpenThreadRequest.parse({
      departmentId: DEPARTMENT,
      subject: "Early check-in",
      body: "We land at 06:00.",
    });
    assert.equal(parsed.subject, "Early check-in");
  });

  test("refuses a body with no department to send it to", () => {
    assert.equal(OpenThreadRequest.safeParse({ body: "hello" }).success, false);
  });

  test("refuses a department id that is not a uuid", () => {
    assert.equal(
      OpenThreadRequest.safeParse({ departmentId: "housekeeping", body: "hello" }).success,
      false,
    );
  });

  test("refuses an empty first message, whitespace included", () => {
    // A thread with nothing in it is a row the desk reads as a guest who
    // wanted something and did not say what.
    for (const body of ["", "   ", "\n\t "]) {
      assert.equal(
        OpenThreadRequest.safeParse({ departmentId: DEPARTMENT, body }).success,
        false,
        `expected ${JSON.stringify(body)} to be refused`,
      );
    }
  });

  test("refuses a message longer than a conversation's ceiling", () => {
    assert.equal(
      OpenThreadRequest.safeParse({
        departmentId: DEPARTMENT,
        body: "x".repeat(GUEST_MESSAGE_MAX + 1),
      }).success,
      false,
    );
    assert.equal(
      OpenThreadRequest.safeParse({
        departmentId: DEPARTMENT,
        body: "x".repeat(GUEST_MESSAGE_MAX),
      }).success,
      true,
    );
  });

  test("refuses a subject longer than a list row can carry", () => {
    assert.equal(
      OpenThreadRequest.safeParse({
        departmentId: DEPARTMENT,
        subject: "x".repeat(121),
        body: "hello",
      }).success,
      false,
    );
  });

  test("refuses a body that names its own stay, booking or workspace", () => {
    // `.strict()`: the server decides which record the conversation hangs off.
    // A field it does not read is a field a client will eventually believe in.
    for (const extra of [
      { stayId: SUBJECT },
      { bookingId: SUBJECT },
      { workspaceId: PROPERTY },
      { propertyId: PROPERTY },
    ]) {
      assert.equal(
        OpenThreadRequest.safeParse({
          departmentId: DEPARTMENT,
          body: "hello",
          ...extra,
        }).success,
        false,
        `expected ${Object.keys(extra)[0]} to be refused`,
      );
    }
  });
});

describe("GuestDeskPlace and MyDepartments", () => {
  const place = (over = {}) => ({
    propertyId: PROPERTY,
    propertyName: "Amahoro Boutique Hotel",
    context: "booking",
    subjectId: SUBJECT,
    bookingReference: "BK-DEMO-001",
    checkIn: "2026-09-18",
    inHouse: false,
    departments: [
      {
        id: DEPARTMENT,
        name: "Housekeeping",
        departmentCategory: "rooms",
        phone: null,
        threadId: null,
        unreadCount: 0,
        lastMessageAt: null,
      },
    ],
    ...over,
  });

  test("parses a booked place and an in-house one", () => {
    assert.equal(GuestDeskPlace.parse(place()).inHouse, false);
    const inHouse = GuestDeskPlace.parse(
      place({ context: "stay", inHouse: true, bookingReference: null, checkIn: null }),
    );
    assert.equal(inHouse.context, "stay");
    assert.equal(inHouse.bookingReference, null);
  });

  test("refuses a context that is neither a stay nor a booking", () => {
    for (const context of ["lease", "trip", "", null]) {
      assert.equal(
        GuestDeskPlace.safeParse(place({ context })).success,
        false,
        `expected context ${JSON.stringify(context)} to be refused`,
      );
    }
  });

  test("refuses a place with no property to name", () => {
    assert.equal(GuestDeskPlace.safeParse(place({ propertyId: null })).success, false);
    assert.equal(GuestDeskPlace.safeParse(place({ propertyName: null })).success, false);
  });

  test("keeps the department shape the stay surface already answers with", () => {
    // `StayDepartment` is imported rather than redeclared, so a desk reads the
    // same on both routes; a fork here is what would make them drift.
    assert.equal(
      GuestDeskPlace.safeParse(
        place({ departments: [{ id: DEPARTMENT, name: "Housekeeping" }] }),
      ).success,
      false,
    );
  });

  test("a person with nowhere to write to is an empty list, never a refusal", () => {
    assert.deepEqual(MyDepartments.parse({ places: [] }), { places: [] });
  });

  test("MyDepartments carries the places whole", () => {
    const parsed = MyDepartments.parse({ places: [place()] });
    assert.equal(parsed.places[0].departments[0].name, "Housekeeping");
  });
});

describe("GuestThread", () => {
  const thread = (over = {}) => ({
    id: "de300000-0000-4000-8000-000000001501",
    scope: "booking",
    subjectId: SUBJECT,
    kind: "reservation",
    status: "active",
    propertyId: PROPERTY,
    propertyName: "Amahoro Boutique Hotel",
    departmentName: null,
    lastMessageAt: null,
    lastMessagePreview: null,
    messageCount: 0,
    unreadCount: 0,
    ...over,
  });

  test("carries the property as an id, so a screen can ask what is orderable there", () => {
    assert.equal(GuestThread.parse(thread()).propertyId, PROPERTY);
  });

  test("allows a thread whose property cannot be resolved", () => {
    // A lease thread whose unit has no property row is still a conversation.
    const parsed = GuestThread.parse(thread({ propertyId: null, propertyName: null }));
    assert.equal(parsed.propertyId, null);
  });

  test("refuses a thread with no propertyId key at all", () => {
    const { propertyId: _dropped, ...without } = thread();
    assert.equal(GuestThread.safeParse(without).success, false);
  });

  test("refuses a propertyId that is not a uuid", () => {
    assert.equal(GuestThread.safeParse(thread({ propertyId: "amahoro" })).success, false);
  });
});
