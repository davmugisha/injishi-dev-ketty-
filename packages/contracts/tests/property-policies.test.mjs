/**
 * What a stay tells its guests (0117): the one guest price rule every charge reads, the beds a room sleeps,
 * and the line a guest reads under a room.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { bedsLine, bedsSleep, computeBreakdown, nightlyRateFor, PropertyPolicyEdit, RoomBeds, RoomTypeDetailEdit, SetStarGradeRequest } from "../dist/index.js";

test("one guest in a room priced per room pays the one guest price", () => {
  const room = { nightlyRateRwf: 60000, singleGuestPriceRwf: 45000, priceBasis: "per_unit" };
  assert.equal(nightlyRateFor(room, 1), 45000);
  assert.equal(nightlyRateFor(room, 2), 60000);
  // The party never multiplies a per room price.
  assert.equal(computeBreakdown({ nightlyRateRwf: nightlyRateFor(room, 2), nights: 2, nonRefundable: false, guests: 2, priceBasis: "per_unit" }).grossRwf, 120000);
});

test("a one guest price never applies per person, never when absent, never above the room", () => {
  assert.equal(nightlyRateFor({ nightlyRateRwf: 30000, singleGuestPriceRwf: 20000, priceBasis: "per_person" }, 1), 30000);
  assert.equal(nightlyRateFor({ nightlyRateRwf: 60000, singleGuestPriceRwf: null, priceBasis: "per_unit" }, 1), 60000);
  assert.equal(nightlyRateFor({ nightlyRateRwf: 60000, singleGuestPriceRwf: 70000, priceBasis: "per_unit" }, 1), 60000);
});

test("beds say how many they sleep, and read as a guest says them", () => {
  const twin = [{ type: "single", count: 2 }];
  const family = [
    { type: "queen", count: 1 },
    { type: "single", count: 2 },
  ];
  assert.equal(bedsSleep(twin), 2);
  assert.equal(bedsSleep(family), 4);
  assert.equal(bedsLine(twin), "2 single beds");
  assert.equal(bedsLine(family), "1 queen bed and 2 single beds");
  assert.equal(RoomBeds.safeParse([{ type: "king", count: 1 }, { type: "king", count: 1 }]).success, false);
});

test("policies are choices: an answer no list holds is refused", () => {
  assert.equal(PropertyPolicyEdit.safeParse({ frontDesk: "24h", languages: ["rw", "en"], petsPolicy: "on_request" }).success, true);
  assert.equal(PropertyPolicyEdit.safeParse({ petsPolicy: "sometimes" }).success, false);
  assert.equal(PropertyPolicyEdit.safeParse({ languages: ["de"] }).success, false);
  assert.equal(PropertyPolicyEdit.safeParse({ minCheckInAge: 12 }).success, false);
});

test("cribs, extra beds and a star grade are choices too (0118)", () => {
  assert.equal(PropertyPolicyEdit.safeParse({ cribs: "charged", cribPriceRwf: 5000 }).success, true);
  assert.equal(PropertyPolicyEdit.safeParse({ cribs: "sometimes" }).success, false);
  assert.equal(RoomTypeDetailEdit.safeParse({ extraBedsMax: 2, extraBedPriceRwf: 10000 }).success, true);
  assert.equal(RoomTypeDetailEdit.safeParse({ extraBedsMax: 9 }).success, false);
  const ws = "11111111-1111-4111-8111-111111111111";
  assert.equal(SetStarGradeRequest.safeParse({ workspaceId: ws, grade: 3 }).success, true);
  assert.equal(SetStarGradeRequest.safeParse({ workspaceId: ws, grade: null }).success, true);
  assert.equal(SetStarGradeRequest.safeParse({ workspaceId: ws, grade: 6 }).success, false);
});
