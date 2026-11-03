import {
  registrationDocumentRows,
  type BusinessKind,
  type OrgCertificateKind,
  type RegistrantCapacity,
  type RegistrantRole,
} from "@injishi/contracts";

/**
 * The registration's steps and sections, decided in one place (ADR-075 A1, the
 * owner's five steps, O-3).
 *
 * FIVE STEPS FOR EVERY KIND: Business · You · Documents · Review · Pay (AC-3).
 * Business comes first (the owner's call, 2026-11-02): the TIN is the first
 * thing asked. Business is the business and only the business: the TIN (a
 * residence: its property and UPI), who is registering it, the owner on the
 * helper path, the location, and the branches and PSF. You is the person and
 * only the person: the ID, a selfie, a phone and a home address. Whether RRA
 * lists the owner's ID among the TIN's directors needs the ID, so it is asked
 * again once the ID is on file and answered on You. A kind that did not
 * arrive is asked before either ("What kind of business?"). Review shows
 * the answers and the fee with no agreement and no signature: the agreement
 * moved to after approval (O-10). The first Pay press creates the registration
 * (D-l). The six step wizard this replaces (ADR-071) is superseded whole.
 *
 * A STEP'S SECTIONS SHOW IN ORDER: each appears once the one before it is done,
 * so a person always sees where they are and nothing past what has been
 * checked. No padlocks, and no "Opens after the TIN check" placeholders.
 *
 * Pure functions with no React, so `tests/register-steps.test.mjs` runs them as
 * they are.
 */

export type StepId = "business" | "you" | "documents" | "review" | "pay";

/**
 * Who is walking it. `helper` is "For the owner": the API's
 * `capacity: on_behalf_of`, which names the owner, who claims the business once
 * it is approved (ADR-053).
 */
export type RegisterPath = "owner" | "helper" | "landlord";

export const STEP_TITLE: Readonly<Record<StepId, string>> = {
  business: "Business",
  you: "You",
  documents: "Documents",
  review: "Review",
  pay: "Pay",
};

/** The path a role and a capacity put a person on. A broker has no steps here. */
export function pathFor(role: RegistrantRole | null, capacity: RegistrantCapacity): RegisterPath {
  if (role === "landlord") return "landlord";
  return capacity === "on_behalf_of" ? "helper" : "owner";
}

/** Every path walks the same five steps, in this order (AC-3): the business, then the person. */
export const STEP_ORDER: readonly StepId[] = ["business", "you", "documents", "review", "pay"];

export function stepOrder(): StepId[] {
  return [...STEP_ORDER];
}

// ---------------------------------------------------------------------------
// The sections of Business and You
// ---------------------------------------------------------------------------

export type SectionId =
  /** Business name and TIN, checked with RRA, then who is registering it and, for the owner, the director check. */
  | "tin"
  /** Your identity: the ID check, a phone and a home address. Nothing about the business. */
  | "id"
  /** The owner, on the helper path: who the claim link goes to. */
  | "intended"
  /** Classification: the kind, in RDB's words. Never asks anything. */
  | "cls"
  /** Location: province to village, and a street or landmark. */
  | "loc"
  /** Franchise: part of one, and how (ADR-075 O-7). A business with a TIN only. */
  | "fr"
  /** The property: its name, its UPI and how it is held. */
  | "upi";

/**
 * Business's sections, in order: what the business is and who registers it, on the helper path whose it
 * is, and where it is. The franchise question (S3, "fr") is not asked for now (2026-11-03, the owner:
 * it confused people); its section stays in the code, to come back.
 */
export function businessSections(path: RegisterPath): SectionId[] {
  if (path === "landlord") return ["upi", "loc"];
  if (path === "helper") return ["tin", "intended", "cls", "loc"];
  return ["tin", "cls", "loc"];
}

/** You's one section, on every path: the person's identity. */
export function youSections(_path: RegisterPath): SectionId[] {
  return ["id"];
}

/** The sections a step carries; Documents, Review and Pay have none. */
export function sectionOrder(path: RegisterPath, step: StepId): SectionId[] {
  if (step === "business") return businessSections(path);
  if (step === "you") return youSections(path);
  return [];
}

export type SectionState = "done" | "open" | "locked";

/**
 * Open, done or locked, for each section: everything before the first section
 * not yet satisfied is done, that one is open, and the rest wait. A locked
 * section is not drawn (AC-3: no padlocks); it appears once it opens.
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

// ---------------------------------------------------------------------------
// The progress: which steps can be opened
// ---------------------------------------------------------------------------

/**
 * The furthest step that can be opened: every step up to and including the
 * first one not yet complete. A step that WAS complete and is not any more (a
 * TIN changed after the documents) closes what follows it again, so nobody
 * pays for a review built on an answer that changed underneath it.
 */
export function openableThrough(order: readonly StepId[], complete: (id: StepId) => boolean): number {
  const first = order.findIndex((id) => !complete(id));
  return first < 0 ? order.length - 1 : first;
}

/**
 * Why a step on the rail cannot be opened, or null when it can (2026-10-30).
 *
 * - Paid: only Pay, where the receipt is, opens. Changes go through support.
 * - Created on the first Pay press but not paid: the registration exists on the
 *   server and no route changes its answers, so only Review and Pay open, and
 *   the rail says why rather than greying the step out with nothing said.
 * - Otherwise every step up to the one on screen opens (Back is never refused),
 *   and a step ahead opens once reached and everything before it is complete.
 */
export function railLock(
  order: readonly StepId[],
  id: StepId,
  at: { current: StepId; openable: number; reached: number; created: boolean; paid: boolean },
): string | null {
  if (at.paid) return id === "pay" ? null : "Paid. Changes go through support.";
  if (at.created) return id === "review" || id === "pay" ? null : "Created when you pressed Pay. Changes go through support.";
  const i = order.indexOf(id);
  if (i <= order.indexOf(at.current)) return null;
  if (i > at.reached) return "Not reached yet";
  return i <= at.openable ? null : "Finish the steps before it first";
}

/**
 * The section Back reopens from an open section: the one before it, passing over
 * Classification, which asks nothing. Null on a step's first section, whose Back
 * is the step's own.
 */
export function previousSection(ids: readonly SectionId[], id: SectionId): SectionId | null {
  const i = ids.indexOf(id);
  for (let j = i - 1; j >= 0; j--) {
    if (ids[j] !== "cls") return ids[j] ?? null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Drafts (ADR-075 S9): where a person begins, and where a draft reopens
// ---------------------------------------------------------------------------

/** Where a person opening `/register` begins: always Business. A kind not yet known is asked before it. */
export function openingStep(): StepId {
  return "business";
}

/**
 * Where a saved draft reopens (AC-9): the step that was open, with the checks
 * it finished kept (the server writes them, D-m). A draft saved before ADR-075
 * knows no step and reopens on Business. The wizard still opens no step past
 * the first one whose answers are not complete (`openableThrough`): an answer
 * the draft cannot keep, such as the owner's National ID, is asked there.
 */
export function resumeStep(openStep: StepId | undefined): StepId {
  return openStep ?? openingStep();
}

/**
 * The step a draft may reopen on, given which steps can be opened now: the one
 * it names, or the first one still owing an answer when that comes before it.
 */
export function clampToOpenable(order: readonly StepId[], wanted: StepId, openable: number): StepId {
  const i = order.indexOf(wanted);
  return i < 0 || i <= openable ? wanted : (order[openable] ?? openingStep());
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export interface DocumentRow {
  kind: OrgCertificateKind;
  label: string;
  required: boolean;
}

/** What each row is called on the Documents step. */
const DOCUMENT_LABEL: Readonly<Record<OrgCertificateKind, string>> = {
  rdb_certificate: "RDB certificate",
  tourism_license: "Tourism licence",
  rdb_grade: "Grading certificate (RDB, EAC criteria)",
  tax_clearance: "Tax clearance",
  fire_safety: "Fire safety",
  health_inspection: "Health inspection",
  psf_certificate: "PSF certificate",
  land_title: "Land title",
  franchise_agreement: "Franchise agreement",
  other: "Other",
};

/**
 * The rows for a business kind, in order (ADR-075 S5): a stay's seven, a
 * venue's five, a residence's land title, and a franchisee's agreement added
 * to its kind's. Which kinds, and which one is required, come from
 * `registrationDocumentRows` in `@injishi/contracts`, the table the API refuses
 * a registration from (AC-11); only the labels are this screen's. Nothing
 * before the kind is known.
 */
export function documentRows(kind: BusinessKind | null, options: { franchisee?: boolean } = {}): DocumentRow[] {
  if (kind === null) return [];
  return registrationDocumentRows(kind, options).map((row) => ({ ...row, label: DOCUMENT_LABEL[row.kind] }));
}

/** The rows still needed before Documents can be left. */
export function missingRequired(kind: BusinessKind | null, uploaded: ReadonlySet<string>): DocumentRow[] {
  return documentRows(kind).filter((r) => r.required && !uploaded.has(r.kind));
}
