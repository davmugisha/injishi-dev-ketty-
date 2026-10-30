/**
 * How the PSF console words an application's facts: dates, the registration
 * it was filed under, its yearly amount. Shared by the queue, the decision
 * log, the register and the application page so one fact reads one way.
 */
import {
  COUNTRIES,
  ENTERPRISE_REGISTRATION_KIND_LABEL,
  REGISTRATION_TYPE_SHORT,
  type PsfOfficerApplication,
} from "@injishi/contracts";
import { formatPrice } from "@injishi/utils";

import { CONSOLE_BASE } from "../lib/nav";

export function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Kigali" }).format(
    new Date(iso),
  );
}

export function countryName(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

/** The registration a form was filed under, in words. */
export function registrationOf(app: Pick<PsfOfficerApplication, "form">): string {
  const { registrationType, registrationNumber } = app.form;
  if (registrationType === "none" || !registrationNumber) return ENTERPRISE_REGISTRATION_KIND_LABEL.none;
  return `${REGISTRATION_TYPE_SHORT[registrationType] ?? "Registration"} ${registrationNumber}`;
}

/** The yearly amount an application carries: the business's own, or the price shown. */
export function amountOf(app: PsfOfficerApplication): string {
  if (app.approvedFeeRwf !== null) return `${formatPrice(app.approvedFeeRwf)} a year`;
  if (app.declaredFeeRwf !== null) return `${formatPrice(app.declaredFeeRwf)} a year`;
  if (app.quotedPriceKind === "fixed" && app.quotedFeeRwf !== null) return `${formatPrice(app.quotedFeeRwf)} a year`;
  return "PSF names the price";
}

export function initialsOf(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}

/**
 * The application page's address. `from` names the list it was opened from,
 * so its back link returns there; the place switcher's choice rides along.
 */
export function psfApplicationHref(applicationId: string, from: "queue" | "decisions" | "businesses", place: URLSearchParams | string = ""): string {
  const p = new URLSearchParams(typeof place === "string" ? place : place.toString());
  for (const k of [...p.keys()]) if (k !== "district" && k !== "province") p.delete(k);
  p.set("from", from);
  // WorkspaceShell portal (same chrome as /officer), not the legacy membership console.
  return `/psf/${applicationId}?${p.toString()}`;
}

/** A business's own page in the console; the place switcher's choice rides along. */
export function psfBusinessHref(orgId: string, place: URLSearchParams | string = ""): string {
  const p = new URLSearchParams(typeof place === "string" ? place : place.toString());
  for (const k of [...p.keys()]) if (k !== "district" && k !== "province") p.delete(k);
  const q = p.toString();
  return `/psf/register${q ? `?${q}` : ""}`;
}
