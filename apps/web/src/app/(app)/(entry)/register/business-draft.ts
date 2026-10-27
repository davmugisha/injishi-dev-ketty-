import type { OrgCertificateKind, RegistryBusiness, TinCheckResult } from "@injishi/contracts";

import { EMPTY_ADDRESS, type AddressDraft } from "./address-picker";

/**
 * The wizard's answers about the business, as the DOM produces them (strings),
 * and the small rules that read them. One module, because the steps, the draft
 * and the overview all read the same shapes.
 */

export interface BusinessDraft {
  legalName: string;
  accommodationClass: string;
  accommodationClassOther: string;
  residenceClass: string;
  tin: string;
  upi: string;
  /** Kept so drafts saved before the licence became a document still parse; never asked. */
  tourismLicenseNumber: string;
  /** Null until answered on drafts kept before; read as No. Never asked by the artboard. */
  chamberOfTourismMember: boolean | null;
  /** The PSF question: Yes, No, or not answered (null). */
  psfMember: boolean | null;
  /** On a No: apply now (true), not now (false), or not answered (null). */
  psfApply: boolean | null;
  psfMembershipNumber: string;
  /** Kept so drafts saved before still parse; the artboard asks no grade. */
  eacStarGrade: string;
  address: AddressDraft;
  /** Part of a franchise? Empty until answered, then No (`none`), a franchisee or a franchisor (ADR-075 O-7). */
  franchiseRole: "" | "none" | "franchisee" | "franchisor";
  franchiseBrand: string;
  /** A franchisee's franchisor: its registered name and its country (ISO 3166 alpha 2). */
  franchisorLegalName: string;
  franchisorCountry: string;
  /** A franchisor's count of locations under its brand, as typed. */
  franchisedLocations: string;
}

export const EMPTY_BUSINESS: BusinessDraft = {
  legalName: "",
  accommodationClass: "",
  accommodationClassOther: "",
  residenceClass: "residential_landlord",
  tin: "",
  upi: "",
  tourismLicenseNumber: "",
  chamberOfTourismMember: null,
  psfMember: null,
  psfApply: null,
  psfMembershipNumber: "",
  eacStarGrade: "",
  address: { ...EMPTY_ADDRESS },
  franchiseRole: "",
  franchiseBrand: "",
  franchisorLegalName: "",
  franchisorCountry: "",
  franchisedLocations: "",
};

/** RRA's answer, kept against the TIN it answered for. */
export type TinCheck = { tin: string; verdict: TinCheckResult } | null;

/** The TIN as the contract reads it: spaces dropped. */
export function normalizeTin(raw: string): string {
  return raw.replace(/\s+/g, "");
}

/** `100000001` as `100 000 001`, the way the certificate prints it. */
export function formatTin(raw: string): string {
  const t = normalizeTin(raw);
  return /^\d{9}$/.test(t) ? `${t.slice(0, 3)} ${t.slice(3, 6)} ${t.slice(6)}` : raw;
}

/** The register's address as the picker's draft: province, district and sector. */
export function registryAddressDraft(found: RegistryBusiness): AddressDraft | null {
  if (!found.address) return null;
  return {
    ...EMPTY_ADDRESS,
    country: "RW",
    provinceId: String(found.address.provinceId),
    districtId: String(found.address.districtId),
    sectorId: String(found.address.sectorId),
    street: found.address.street ?? "",
  };
}

/** Two names the same once case, spacing and punctuation are set aside. */
export function sameName(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return norm(a) === norm(b);
}

/** One branch: a site under the same TIN (ADR-054). */
export interface BranchDraft {
  /** A stable React key. Never sent: the server mints the property id. */
  key: string;
  name: string;
  address: AddressDraft;
}

let nextBranchKey = 0;

/** A new, empty branch, starting in the head office's province and district (ADR-059). */
export function newBranchDraft(headOffice?: AddressDraft): BranchDraft {
  nextBranchKey += 1;
  return {
    key: `branch-${nextBranchKey}`,
    name: "",
    address: {
      ...EMPTY_ADDRESS,
      ...(headOffice?.country === "RW" ? { provinceId: headOffice.provinceId, districtId: headOffice.districtId } : {}),
    },
  };
}

/** A branch is ready to add once it is named and placed to the sector. */
export function branchReady(b: BranchDraft): boolean {
  return b.name.trim().length > 0 && Boolean(b.address.provinceId && b.address.districtId && b.address.sectorId);
}

/** One uploaded document, filed under the row it belongs to. */
export interface DocumentDraft {
  kind: OrgCertificateKind;
  /** Required by the contract when `kind` is `other`. */
  kindOther: string;
  objectKey: string;
  filename: string;
  sizeBytes: number;
}

/** `+250788300412` as `078•••412`, the way a phone is named in passing. */
export function maskedPhone(e164: string | null | undefined): string | null {
  if (!e164) return null;
  const digits = e164.replace(/\D/g, "");
  if (e164.startsWith("+250") && digits.length === 12) {
    const local = `0${digits.slice(3)}`;
    return `${local.slice(0, 3)}•••${local.slice(-3)}`;
  }
  return `${e164.slice(0, 4)}•••${e164.slice(-3)}`;
}
