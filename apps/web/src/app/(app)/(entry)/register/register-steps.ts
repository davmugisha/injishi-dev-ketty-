import type { OrgCertificateKind, RegistrantCapacity, RegistrantRole } from "@injishi/contracts";

/**
 * The registration's steps and sections, decided in one place
 * (Register.dc.html, the "Business registration · six steps" artboard,
 * 2026-10-19).
 *
 * SIX STEPS FOR A BUSINESS. Business type; TIN and licences; Branches and PSF;
 * Documents; Overview, where the agreement is signed and the registration is
 * created; Pay. A residence walks five: its second step is Property and owner,
 * and it has no branches or PSF (the API refuses both on a residence). A kind
 * carried in from the `/host` chooser is not asked again, so Business type drops
 * out of the rail until Change is pressed.
 *
 * STEP TWO IS SECTIONS THAT UNLOCK IN ORDER. Each is open, done or locked, and
 * the next opens only when the one before is satisfied, so a person always sees
 * where they are and nothing past what has been checked. The artboard's
 * "Code to the company's contact" section is NOT here: the API has no endpoint
 * that sends a code to a contact RRA holds (the TIN check returns no contacts),
 * so drawing it would be a check that checks nothing. It is an owner decision,
 * recorded in progress-tracker.md, not a gap this file hides.
 *
 * Pure functions with no React, so `tests/register-steps.test.mjs` runs them as
 * they are.
 */

export type StepId = "type" | "tin" | "property" | "branches" | "documents" | "overview" | "pay";

/**
 * Who is walking it. `helper` is the artboard's "I'm registering it for the
 * owner": the API's `capacity: on_behalf_of`, which names the owner, who claims
 * the business once it is approved (ADR-053).
 */
export type RegisterPath = "owner" | "helper" | "landlord";

export const STEP_TITLE: Readonly<Record<StepId, string>> = {
  type: "Business type",
  tin: "TIN and licences",
  property: "Property and owner",
  branches: "Branches and PSF",
  documents: "Documents",
  overview: "Overview",
  pay: "Pay",
};

/** The path a role and a capacity put a person on. A broker has no steps here. */
export function pathFor(role: RegistrantRole | null, capacity: RegistrantCapacity): RegisterPath {
  if (role === "landlord") return "landlord";
  return capacity === "on_behalf_of" ? "helper" : "owner";
}

/** Every step of a path, in order, less Business type while the kind is the one that arrived. */
export function stepOrder(path: RegisterPath, carried: boolean): StepId[] {
  const ids: StepId[] =
    path === "landlord"
      ? ["type", "property", "documents", "overview", "pay"]
      : ["type", "tin", "branches", "documents", "overview", "pay"];
  return carried ? ids.filter((id) => id !== "type") : ids;
}

/** Step two's id on a path. */
export function proofStep(path: RegisterPath): "tin" | "property" {
  return path === "landlord" ? "property" : "tin";
}

/** "Six", for "Six short steps." */
export function countWord(n: number): string {
  return ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven"][n] ?? String(n);
}

// ---------------------------------------------------------------------------
// Step two's sections
// ---------------------------------------------------------------------------

export type SectionId =
  /** Business name and TIN, checked with RRA, then who is registering it. */
  | "tin"
  /** You and the company: your ID, checked, and whether RRA lists you as a director. */
  | "owner"
  /** Your identity, for a helper or a residence: the ID check alone. */
  | "id"
  /** The owner, on the helper path: who the claim link goes to. */
  | "intended"
  /** Classification: the kind, in RDB's words. Never asks anything. */
  | "cls"
  /** Location: province to village, and a street or landmark. */
  | "loc"
  /** The property: its name, its UPI and how it is held. */
  | "upi";

export function sectionOrder(path: RegisterPath): SectionId[] {
  if (path === "landlord") return ["upi", "id", "loc"];
  if (path === "helper") return ["tin", "id", "intended", "cls", "loc"];
  return ["tin", "owner", "cls", "loc"];
}

export type SectionState = "done" | "open" | "locked";

/**
 * Open, done or locked, for each section: everything before the first section
 * not yet satisfied is done, that one is open, and the rest wait.
 */
export function sectionStates(
  ids: readonly SectionId[],
  satisfied: (id: SectionId) => boolean,
): { states: Record<string, SectionState>; open: SectionId | null; allDone: boolean } {
  const openIndex = ids.findIndex((id) => !satisfied(id));
  const states: Record<string, SectionState> = {};
  ids.forEach((id, i) => {
    states[id] = openIndex < 0 || i < openIndex ? "done" : i === openIndex ? "open" : "locked";
  });
  return { states, open: openIndex < 0 ? null : (ids[openIndex] ?? null), allDone: openIndex < 0 };
}

/** What a locked section says it is waiting for. */
export function lockedReason(path: RegisterPath, id: SectionId): string {
  switch (id) {
    case "owner":
    case "id":
      return path === "landlord" ? "Opens after the property" : "Opens after the TIN check";
    case "intended":
      return "Opens after your identity";
    case "cls":
      return path === "helper" ? "Opens after the owner" : "Opens after ownership";
    case "loc":
      return path === "owner" ? "Opens after ownership" : path === "helper" ? "Opens after the owner" : "Opens after your identity";
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// The rail: which steps can be opened
// ---------------------------------------------------------------------------

/**
 * The furthest step that can be opened: every step up to and including the
 * first one not yet complete. A step that WAS complete and is not any more (a
 * TIN changed after the documents) locks what follows it again, so nobody signs
 * an overview built on an answer that changed underneath it.
 */
export function openableThrough(order: readonly StepId[], complete: (id: StepId) => boolean): number {
  const first = order.findIndex((id) => !complete(id));
  return first < 0 ? order.length - 1 : first;
}

// ---------------------------------------------------------------------------
// Drafts (ADR-060): which phase a step saves as, and where a draft resumes
// ---------------------------------------------------------------------------

/**
 * The server's draft knows four phases (`REGISTRATION_DRAFT_PHASES`). Business
 * type saves as `place`, Documents as `documents`, and the steps in between as
 * `business`. Overview and Pay are never saved: by then the registration
 * exists, and creating it clears the draft.
 */
export function draftPhaseFor(step: StepId): "place" | "business" | "documents" | null {
  if (step === "type") return "place";
  if (step === "documents") return "documents";
  if (step === "overview" || step === "pay") return null;
  return "business";
}

/**
 * Where a person opening `/register` begins: Business type when the kind is
 * not known, step two when it arrived answered.
 */
export function openingStep(path: RegisterPath, kindKnown: boolean): StepId {
  return kindKnown ? proofStep(path) : "type";
}

/**
 * Where a saved draft resumes: step two whenever the draft knows the kind,
 * whatever phase it was saved at. The checks step two carries (the TIN with
 * RRA, the ID) are never kept in a draft, so a later step could not be trusted
 * until they are asked again there, one press each.
 */
export function resumeStep(path: RegisterPath, kindKnown: boolean): StepId {
  return kindKnown ? proofStep(path) : "type";
}

/** Whether leaving `from` for `to` saves the draft: a step saves when it is left, never on opening. */
export function savesOnLeave(from: StepId | null, to: StepId): boolean {
  if (from === null || from === to) return false;
  return draftPhaseFor(from) !== null;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export interface DocumentRow {
  kind: OrgCertificateKind;
  label: string;
  required: boolean;
}

/**
 * The artboard's rows, in its order. One required document per path: the RDB
 * certificate for a business, the land title for a residence. The server keeps
 * every document optional (an officer can ask for one at the visit), so the
 * requirement is this wizard's, recorded as such.
 */
export function documentRows(path: RegisterPath): DocumentRow[] {
  if (path === "landlord") {
    return [
      { kind: "land_title", label: "Land title", required: true },
      { kind: "other", label: "Other", required: false },
    ];
  }
  return [
    { kind: "rdb_certificate", label: "RDB certificate", required: true },
    { kind: "tourism_license", label: "Tourism licence", required: false },
    { kind: "rdb_grade", label: "Grading certificate (RDB, EAC criteria)", required: false },
    { kind: "tax_clearance", label: "Tax clearance", required: false },
    { kind: "fire_safety", label: "Fire safety", required: false },
    { kind: "health_inspection", label: "Health inspection", required: false },
    { kind: "psf_certificate", label: "PSF certificate", required: false },
    { kind: "other", label: "Other", required: false },
  ];
}

/** The rows still needed before Documents can be left. */
export function missingRequired(path: RegisterPath, uploaded: ReadonlySet<string>): DocumentRow[] {
  return documentRows(path).filter((r) => r.required && !uploaded.has(r.kind));
}
