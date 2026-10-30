import { countryName } from "@injishi/contracts";

import type { BusinessDraft } from "./business-draft";

/*
 * The franchise answer (ADR-075 O-7, AC-8) as the wizard holds it and as the
 * contract reads it. Its own module, with nothing but types from the draft,
 * so a test can run it against the contract without the components behind the
 * draft.
 */

/**
 * The `franchise` block the contract reads (`FranchiseDeclaration`), or
 * undefined for No and for no answer yet. A count that is not whole digits is
 * sent as NaN, so the contract words it rather than this guessing.
 */
export function franchiseCandidate(d: BusinessDraft): unknown {
  if (d.franchiseRole === "franchisee") {
    return {
      role: "franchisee",
      brandName: d.franchiseBrand,
      franchisorLegalName: d.franchisorLegalName,
      franchisorCountry: d.franchisorCountry,
    };
  }
  if (d.franchiseRole === "franchisor") {
    const typed = d.franchisedLocations.trim();
    return {
      role: "franchisor",
      brandName: d.franchiseBrand,
      franchisedLocations: /^\d+$/.test(typed) ? Number(typed) : Number.NaN,
    };
  }
  return undefined;
}

/** The franchise answer in one line, for the section once it is done and for Review. */
export function franchiseLine(d: BusinessDraft): string {
  const brand = d.franchiseBrand.trim();
  if (d.franchiseRole === "franchisee") {
    const country = d.franchisorCountry ? countryName(d.franchisorCountry) : "";
    return `Runs ${brand} under licence from ${d.franchisorLegalName.trim()}${country ? `, ${country}` : ""}`;
  }
  if (d.franchiseRole === "franchisor") {
    const n = d.franchisedLocations.trim();
    return `Owns the ${brand} brand · ${n} franchised ${n === "1" ? "location" : "locations"}`;
  }
  return "Not part of a franchise";
}
