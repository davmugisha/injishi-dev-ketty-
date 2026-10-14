/**
 * Government oversight demo data — the business registration pipeline as the
 * two officer workspaces see it.
 *
 * Registration and oversight are one pipeline seen from two ends: acting here
 * advances the registrant's tracker. The rules the dataset is shaped to prove:
 *
 *  - **Scope is a boundary, not a filter.** O6 (Karongi) and O8 (Kicukiro) must
 *    never appear in a Gasabo officer's queue.
 *  - **Separation of duties.** O3 was field-verified by Claudine Mukamana so the
 *    approver workspace hits the block on her own work.
 *  - **A rejection is recoverable.** O9 carries a reason code, a note, and the
 *    stage to return to — never a dead end.
 *
 * Content owner: mfp-demo.md § Registration pipeline.
 */

import type { OversightData, PerfRow, RegOrg, RejectReason } from "./types";

/*
 * `OFFICERS` USED TO BE HERE, AND IS DELETED (ADR-053, AC-G5).
 *
 * It was two invented officers — a name, an issuing body, a job title and a
 * district each — rendered onto a government console above a queue of real
 * businesses. `GET /api/v1/me/oversight` returns all of that now, and
 * `data/officer.ts` builds the officer from the grant. Do not reintroduce a
 * table of people here: the only identity this console may show is whoever is
 * signed in.
 */

/** Reason codes the API accepts (`RegistrationRejectionReason`). */
export const REJECT_REASONS: RejectReason[] = [
  ["tin_not_found", "TIN not found", "We could not find this TIN at RRA."],
  ["tin_mismatch", "TIN does not match", "The TIN does not match the business name on record."],
  ["premises_not_found", "Premises not found", "The verifier could not find the business at this address."],
  ["documents_invalid", "Documents invalid", "One or more certificates could not be accepted."],
  ["documents_expired", "Documents expired", "One or more certificates have expired."],
  ["not_operating", "Not operating", "The business was not operating when the verifier visited."],
  ["ownership_unclear", "Ownership unclear", "We could not confirm who owns this business."],
  ["duplicate_business", "Already registered", "This business is already registered on Injishi."],
];

/** Accommodation and residence classification labels, keyed by code. */
export const CLASS_LABEL: Record<string, string> = {
  town_hotel: "Town Hotel",
  vacation_hotel_resort: "Vacation Hotel & Resort",
  lodge: "Lodge",
  tented_camp: "Tented Camp",
  serviced_apartment: "Serviced Apartment",
  villa: "Villa",
  cottage: "Cottage",
  motel: "Motel",
  residential_landlord: "Residential landlord",
  residential_property_manager: "Property manager",
};

/** Defaults every file carries, so each row below states only what is distinct. */
function mkOrg(o: Partial<RegOrg> & Pick<RegOrg, "id" | "biz" | "type" | "registrant" | "tin" | "cls" | "district" | "sector" | "address" | "stage" | "submittedTs">): RegOrg {
  return {
    obo: false,
    tinOk: true,
    ageH: 6,
    // These fixtures predate documents on the wire, and none of them names a
    // certificate. Zero is the honest default: the live queue counts real rows.
    documentCount: 0,
    uncheckedDocumentCount: 0,
    fieldVerifiedBy: null,
    approvedBy: null,
    rejectReason: null,
    rejectNote: "",
    prevStage: null,
    ...o,
  };
}

function orgs(): RegOrg[] {
  return [
    mkOrg({
      id: "ME", biz: "Umurage Serviced Apartments", type: "host", registrant: "me",
      tin: "102 938 471", cls: "serviced_apartment", tourismLic: "TR-2026-04512", rha: true, star: 0,
      district: "Gasabo", sector: "Remera", address: "KG 11 Ave, Remera",
      stage: "tin_verified", ageH: 3, submittedTs: "Today 08:20",
    }),
    mkOrg({
      id: "O2", biz: "Nyarutarama Homes", type: "landlord", registrant: "other", owner: "Diane Uwase",
      tin: "108 552 903", cls: "residential_landlord", upi: "3/04/09/02/1487",
      district: "Gasabo", sector: "Nyarutarama", address: "KG 9 Ave, Nyarutarama",
      stage: "field_verified", ageH: 20, fieldVerifiedBy: "Jean-Bosco Nkurunziza", submittedTs: "Yesterday 14:02",
    }),
    // Field-verified by the approver herself — the separation-of-duties case.
    mkOrg({
      id: "O3", biz: "Kacyiru Apartments Mgmt", type: "landlord", registrant: "other", owner: "Eric Manzi",
      tin: "111 204 668", cls: "residential_property_manager", upi: "3/04/07/01/0932",
      district: "Gasabo", sector: "Kacyiru", address: "KG 7 Ave, Kacyiru",
      stage: "field_verified", ageH: 30, fieldVerifiedBy: "Claudine Mukamana", submittedTs: "2 days ago",
    }),
    mkOrg({
      id: "O4", biz: "Gasabo Stay Motel", type: "host", registrant: "other", owner: "Patrick Habimana",
      tin: "104 771 220", cls: "motel", tourismLic: "TR-2026-04781", rha: true, star: 0,
      district: "Gasabo", sector: "Kinyinya", address: "KG 200 St, Kinyinya",
      stage: "tin_verified", ageH: 12, submittedTs: "Yesterday 22:10",
    }),
    // Registered by an agent: payouts stay locked until the owner claims it.
    mkOrg({
      id: "O5", biz: "Remera Garden Lofts", type: "landlord", registrant: "other", owner: "Aline Keza",
      tin: "109 883 415", cls: "residential_landlord", upi: "3/04/09/05/2201",
      district: "Gasabo", sector: "Remera", address: "KG 11 Ave, Remera",
      stage: "tin_verified", ageH: 40, submittedTs: "2 days ago", obo: true,
    }),
    // Karongi — outside a Gasabo officer's jurisdiction entirely.
    mkOrg({
      id: "O6", biz: "Kivu Breeze Resort", type: "host", registrant: "other", owner: "Serge Ntwari",
      tin: "106 220 947", cls: "vacation_hotel_resort", tourismLic: "TR-2026-03990", rha: true, star: 4,
      district: "Karongi", sector: "Bwishyura", address: "Lake Kivu shore, Karongi",
      stage: "field_verified", ageH: 26, fieldVerifiedBy: "Yvette Mukamana (Karongi)", submittedTs: "Yesterday 09:30",
    }),
    // Missing its tourism license and not an RHA member — the flagged row, and
    // at 52 h the oldest thing in the queue.
    mkOrg({
      id: "O7", biz: "Kimironko Suites", type: "host", registrant: "other", owner: "Josiane Iradukunda",
      tin: "107 118 350", cls: "town_hotel", tourismLic: "TR-2026-04820", rha: false, star: 0,
      district: "Gasabo", sector: "Kimironko", address: "KG 27 Ave, Kimironko",
      stage: "tin_verified", ageH: 52, submittedTs: "3 days ago",
    }),
    mkOrg({
      id: "O8", biz: "Gikondo Residences", type: "landlord", registrant: "other", owner: "Fabrice Niyonzima",
      tin: "110 447 118", cls: "residential_landlord", upi: "2/03/07/04/0771",
      district: "Kicukiro", sector: "Gikondo", address: "KK 15 Ave, Gikondo",
      stage: "field_verified", ageH: 18, fieldVerifiedBy: "Alice Uwimana (Kicukiro)", submittedTs: "Yesterday 11:00",
    }),
    mkOrg({
      id: "O9", biz: "Isange Lodge", type: "host", registrant: "other", owner: "Claude Bizimana",
      tin: "105 900 244", cls: "lodge", tourismLic: "TR-2026-00099", rha: true, star: 0,
      district: "Gasabo", sector: "Gisozi", address: "KG 55 St, Gisozi",
      stage: "rejected", prevStage: "tin_verified", rejectReason: "license_invalid",
      rejectNote: "The license number is not in the RDB register — check the digits on your certificate.",
      ageH: 48, submittedTs: "2 days ago",
    }),
  ];
}

/**
 * Gasabo as the district overview sees it. Performance settles from platform
 * activity — bookings for hospitality, let units for residence. A closed
 * business stays registered; its license state does not change.
 */
function perf(): PerfRow[] {
  return [
    { biz: "Umurage Serviced Apartments", type: "host", sector: "Remera", open: true, metric: "38 bookings", occ: 81, mom: ["+6%", "ok"] },
    { biz: "Kacyiru Apartments Mgmt", type: "landlord", sector: "Kacyiru", open: true, metric: "31 units let", occ: 90, mom: ["+2%", "ok"] },
    { biz: "Nyarutarama Homes", type: "landlord", sector: "Nyarutarama", open: true, metric: "12 units let", occ: 92, mom: ["flat", "neutral"] },
    { biz: "Gasabo Stay Motel", type: "host", sector: "Kinyinya", open: true, metric: "22 bookings", occ: 64, mom: ["+11%", "ok"] },
    { biz: "Remera Garden Lofts", type: "landlord", sector: "Remera", open: true, metric: "9 units let", occ: 88, mom: ["+4%", "ok"] },
    { biz: "Jali Hills Guesthouse", type: "host", sector: "Jali", open: true, metric: "14 bookings", occ: 57, mom: ["−3%", "warn"] },
    { biz: "Kimironko Suites", type: "host", sector: "Kimironko", open: false, note: "Closed for renovation since 02 Jul", metric: "0 bookings", occ: 0, mom: ["—", "neutral"] },
    { biz: "Isange Lodge", type: "host", sector: "Gisozi", open: false, note: "Registration rejected — license not found", metric: "0 bookings", occ: 0, mom: ["—", "neutral"] },
  ];
}

export function oversight(): OversightData {
  return {
    orgs: orgs(),
    perf: perf(),
    rejectReasons: REJECT_REASONS,
    decisions: [],
  };
}
