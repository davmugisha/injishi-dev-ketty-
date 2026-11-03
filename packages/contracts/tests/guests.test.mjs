import { test } from "node:test";
import assert from "node:assert/strict";

import {
  AppointOfficerRequest,
  GUEST_RELATIONSHIPS,
  GuestReportQuery,
  LEADER_ROLES,
  LEADER_ROLE_SCOPE,
  LandlordGuestRequest,
  OVERSIGHT_ROLE_SCOPES,
  OversightRole,
  TenantGuestRequest,
  addDays,
  guestChainFor,
  guestIdOf,
  guestIdProblem,
  guestNights,
  guestStayOn,
  isLeaderRole,
  kigaliToday,
  normaliseGuestPhone,
  oversightConsoleFor,
} from "../dist/index.js";

const today = kigaliToday();
const base = {
  fullName: "Grace Mutoni",
  phone: "0788 123 456",
  relationship: "friend",
  origin: { kind: "country", countryCode: "KE" },
  nationality: "KE",
  arrivalOn: addDays(today, 1),
  departureOn: addDays(today, 4),
};

test("the chain: every guest goes up local government; a guest from abroad also up DGIE", () => {
  const local = ["village_leader", "cell_executive", "district_officer"];
  assert.deepEqual(guestChainFor(false), local);
  assert.deepEqual(guestChainFor(true), [...local, "dgie_village", "dgie_cell", "district_immigration"]);
  for (const role of LEADER_ROLES) {
    assert.ok(isLeaderRole(role));
    assert.deepEqual(OVERSIGHT_ROLE_SCOPES[role], [LEADER_ROLE_SCOPE[role]]);
    assert.equal(oversightConsoleFor(role), "guests");
  }
  assert.equal(isLeaderRole("business_approver"), false);
  assert.deepEqual(Object.keys(OVERSIGHT_ROLE_SCOPES).sort(), [...OversightRole.options].sort());
});

test("a guest's phone: a Rwandan mobile however spaced, or a number with its country code", () => {
  assert.equal(normaliseGuestPhone("0788 123 456"), "+250788123456");
  assert.equal(normaliseGuestPhone("+256 772-123-456"), "+256772123456");
  assert.equal(normaliseGuestPhone("00256772123456"), "+256772123456");
  assert.equal(normaliseGuestPhone("+250 712 345 678"), null);
  assert.equal(normaliseGuestPhone("12345"), null);
});

test("the ID is optional; a national ID is 16 digits and for Rwandans only; a passport 5 to 20 letters or digits", () => {
  assert.equal(guestIdProblem({ nationality: "KE" }), null);
  assert.deepEqual(guestIdOf({ nationality: "KE", idNumber: "  " }), { idKind: null, idNumber: null });
  assert.deepEqual(guestIdOf({ nationality: "KE", idNumber: "pa 1234-5" }), { idKind: "passport", idNumber: "PA12345" });
  assert.deepEqual(guestIdOf({ nationality: "RW", idNumber: "1 1990 8 0012345 0 12" }), { idKind: "national_id", idNumber: "1199080012345012" });
  assert.equal(guestIdProblem({ nationality: "KE", idKind: "national_id", idNumber: "1199080012345012" })?.path, "idKind");
  assert.equal(guestIdProblem({ nationality: "RW", idNumber: "1234" })?.message, "A Rwandan ID number has 16 digits.");
  assert.equal(guestIdProblem({ nationality: "KE", idNumber: "AB1" })?.message, "A passport number is 5 to 20 letters or digits.");
});

test("a tenant's guest request: phone normalised, Other asks for words, Rwanda is a village not a country", () => {
  const ok = TenantGuestRequest.parse(base);
  assert.equal(ok.phone, "+250788123456");
  assert.equal(ok.nationality, "KE");
  const other = TenantGuestRequest.safeParse({ ...base, relationship: "other", relationshipOther: "" });
  assert.equal(other.success, false);
  assert.deepEqual(other.error.issues[0].path, ["relationshipOther"]);
  const rwanda = TenantGuestRequest.safeParse({ ...base, origin: { kind: "country", countryCode: "RW" } });
  assert.deepEqual(rwanda.error.issues[0].path, ["origin"]);
  const unknown = TenantGuestRequest.safeParse({ ...base, nationality: "ZZ" });
  assert.equal(unknown.success, false);
  assert.ok(TenantGuestRequest.parse({ ...base, nationality: undefined }).nationality === "RW");
});

test("the stay: from today, departure on or after arrival, at most 90 days", () => {
  const past = TenantGuestRequest.safeParse({ ...base, arrivalOn: addDays(today, -1) });
  assert.deepEqual(past.error.issues[0].path, ["arrivalOn"]);
  const before = TenantGuestRequest.safeParse({ ...base, departureOn: base.arrivalOn, arrivalOn: addDays(today, 3) });
  assert.deepEqual(before.error.issues[0].path, ["departureOn"]);
  const long = TenantGuestRequest.safeParse({ ...base, departureOn: addDays(base.arrivalOn, 91) });
  assert.equal(long.error.issues[0].message, "A stay can be at most 90 days.");
  assert.equal(TenantGuestRequest.safeParse({ ...base, departureOn: addDays(base.arrivalOn, 90) }).success, true);
  assert.equal(guestNights("2026-10-01", "2026-10-01"), 0);
  assert.equal(guestStayOn("2026-10-05", "2026-10-01", "2026-10-05"), "staying");
  assert.equal(guestStayOn("2026-10-06", "2026-10-01", "2026-10-05"), "left");
});

test("a landlord's guest names a building", () => {
  assert.equal(LandlordGuestRequest.safeParse(base).success, false);
  assert.equal(LandlordGuestRequest.safeParse({ ...base, propertyId: "3f0c1a52-3d0e-4d8e-9b8e-0c6f4a1d2e31" }).success, true);
});

test("appointing: the area at the level the role covers", () => {
  const leader = { email: "A@B.RW", role: "dasso", governmentBodyCode: "MINALOC", governmentTitle: "DASSO", scopeLevel: "sector", sectorId: 11, reason: "Took office" };
  assert.equal(AppointOfficerRequest.parse(leader).email, "a@b.rw");
  assert.equal(AppointOfficerRequest.safeParse({ ...leader, scopeLevel: "district", districtId: 1 }).success, false);
  assert.equal(AppointOfficerRequest.safeParse({ ...leader, sectorId: null }).success, false);
  // A PSF District Manager is appointed to a district: that is the manager who decides.
  assert.equal(AppointOfficerRequest.safeParse({ ...leader, role: "psf_membership_officer", scopeLevel: "district", districtId: 1, sectorId: null }).success, true);
  assert.equal(AppointOfficerRequest.safeParse({ ...leader, role: "psf_membership_officer", scopeLevel: "village", villageId: 1, sectorId: null }).success, false);
});

test("a report period: the end not before the start, at most two years", () => {
  assert.equal(GuestReportQuery.safeParse({ from: "2026-10-01", to: "2026-09-30" }).success, false);
  assert.equal(GuestReportQuery.safeParse({ from: "2024-01-01", to: "2026-10-01" }).success, false);
  assert.equal(GuestReportQuery.safeParse({ from: "2026-01-01", to: "2026-10-01", sectorId: "11" }).data.sectorId, 11);
});

test("the relationships end with Other, which asks for words", () => {
  const last = GUEST_RELATIONSHIPS.at(-1);
  assert.deepEqual(last, { code: "other", label: "Other", needsDetail: true });
  assert.equal(new Set(GUEST_RELATIONSHIPS.map((r) => r.code)).size, GUEST_RELATIONSHIPS.length);
});

test("the type of place: a residence for a tenant or landlord, the business kind for a hotel desk", async () => {
  const c = await import("../dist/index.js");
  assert.equal(c.guestPlaceTypeOf("tenant", "residence"), "residence");
  assert.equal(c.guestPlaceTypeOf("landlord", null), "residence");
  assert.equal(c.guestPlaceTypeOf("hotel", "motel"), "hotel");
  assert.equal(c.guestPlaceTypeOf("hotel", "tented_camp"), "lodge");
  assert.equal(c.guestPlaceTypeOf("hotel", "villa"), "apartment");
  assert.equal(c.guestPlaceTypeOf("hotel", "guest_house"), "guest_house");
  assert.equal(c.guestPlaceTypeOf("hotel", null), "other");
  assert.equal(c.guestPlaceKindLabel("hotel", "motel"), "Motel");
  assert.equal(c.guestPlaceKindLabel("tenant", null), "Residence");
});

test("who hosted a guest, in two lines", async () => {
  const c = await import("../dist/index.js");
  const place = { name: "Amani Residences", room: "A-01" };
  assert.deepEqual(c.guestHostLines({ host: { kind: "tenant", name: "Aline" }, place }), { place: "Amani Residences", detail: "Tenant Aline, unit A-01" });
  assert.deepEqual(c.guestHostLines({ host: { kind: "landlord", name: "Emmanuel" }, place: { ...place, room: null } }).detail, "Landlord Emmanuel");
  assert.equal(c.guestHostLines({ host: { kind: "hotel", name: "Umuco" }, place: { name: "Umuco", room: "12" } }).detail, "Room 12");
  assert.equal(c.guestHostLines({ host: { kind: "hotel", name: "Umuco" }, place: { name: "Umuco", room: "Room 4" } }).detail, "Room 4");
});

test("the list's date and stay filters, read from the Kigali day", async () => {
  const c = await import("../dist/index.js");
  assert.deepEqual(c.guestArrivedRange("last_7_days", "2026-11-02"), { from: "2026-10-27", to: "2026-11-02" });
  assert.deepEqual(c.guestArrivedRange("this_month", "2026-11-02"), { from: "2026-11-01", to: "2026-11-02" });
  assert.equal(c.guestLengthHolds("under_3", 2), true);
  assert.equal(c.guestLengthHolds("under_3", 3), false);
  assert.equal(c.guestLengthHolds("week", 7), true);
  assert.equal(c.guestLengthHolds("month", 29), false);
  const q = c.LeaderGuestQuery.parse({ arrived: "today", placeType: "lodge", length: "week", leaving: "next_7_days", presentOn: "2026-10-30" });
  assert.equal(q.tab, "all");
  assert.equal(q.placeType, "lodge");
  assert.equal(c.LeaderGuestQuery.safeParse({ placeType: "castle" }).success, false);
  assert.equal(c.LeaderGuestQuery.safeParse({ arrivedFrom: "2026-10-10", arrivedTo: "2026-10-01" }).success, false);
  assert.equal(GuestReportQuery.safeParse({ from: "2026-10-01", to: "2026-10-31", placeType: "residence", length: "month" }).success, true);
});

test("a console reads as DGIE only when every post is DGIE's", async () => {
  const c = await import("../dist/index.js");
  assert.equal(c.leaderAudienceOf(["dgie_village"]), "dgie");
  assert.equal(c.leaderAudienceOf(["dgie_cell", "district_immigration"]), "dgie");
  assert.equal(c.leaderAudienceOf(["village_leader", "dgie_village"]), "local");
  assert.equal(c.leaderAudienceOf([]), "local");
  assert.equal(c.stayBandOf(0), "same_day");
  assert.equal(c.stayBandOf(30), "month");
  assert.equal(c.reportTimingOf("2026-10-29", "2026-10-30"), "before");
  assert.equal(c.reportTimingOf("2026-10-31", "2026-10-30"), "after");
});
