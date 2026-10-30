import {
  REGISTRATION_DRAFT_DONE,
  REGISTRATION_DRAFT_STEPS,
  type RegistrantCapacity,
  type RegistrationDraft,
  type RegistrationDraftDone,
  type RegistrationDraftStep,
} from "@injishi/contracts";

import type { AddressDraft } from "./address-picker";
import type { BranchDraft, BusinessDraft, DocumentDraft } from "./business-draft";
import type { PersonalDraft } from "./step-about-you";

/**
 * The wizard's answers, kept ON THE SERVER as they are typed (ADR-060, ADR-075
 * S9), and in a device copy beside them (`lib/register-device-copy.ts`), so a
 * person can close the tab, lose the connection, or come back another day on
 * another device, and reopen the step they left with the same answers (AC-9).
 * The draft holds which step was open, how far they got, and what they marked
 * done; the checks behind it (the TIN answer, the ID scan) are the server's to
 * write (D-m) and are never asked twice.
 *
 * NEVER AN ID NUMBER, and structurally so: `RegistrationDraft`'s personal block
 * has no document number field and is strict, the intended owner carries no
 * National ID, and the contract refuses a draft with sixteen digits anywhere in
 * it. This module drops both numbers before saving, and shortens a sixteen
 * digit run in a document's file name, so the wizard never trips that refusal
 * by itself. A scanned or typed identity needs no number in the draft: the
 * server keeps the document. The owner's National ID, on the helper path, is
 * asked again after a refresh, and the wizard says so.
 *
 * No React here, so `tests/register-draft.test.mjs` runs it as it is.
 */

export interface WizardAnswers {
  openStep: RegistrationDraftStep;
  reached: RegistrationDraftStep;
  done: RegistrationDraftDone[];
  kind: string | null;
  capacity: RegistrantCapacity;
  typedPersonal: boolean;
  personal: PersonalDraft;
  intendedOwner: { name: string; nationalId: string; email: string };
  business: BusinessDraft;
  branches: BranchDraft[];
  documents: DocumentDraft[];
}

/** A file name with any run of sixteen or more digits cut to its last four, the way an ID is named in passing. */
export function unnumbered(filename: string): string {
  return filename.replace(/\d{16,}/g, (run) => `…${run.slice(-4)}`).slice(0, 200);
}

/** The answers in the server's shape, with both ID numbers dropped. */
export function toServerDraft(answers: WizardAnswers): RegistrationDraft {
  const { documentNumber: _number, ...personal } = answers.personal;
  void _number;
  const {
    franchiseRole,
    franchiseBrand,
    franchisorLegalName,
    franchisorCountry,
    franchisedLocations,
    address,
    ...business
  } = answers.business;
  const done = new Set(answers.done);
  return {
    v: 1,
    openStep: answers.openStep,
    reached: answers.reached,
    done: REGISTRATION_DRAFT_DONE.filter((d) => done.has(d)),
    kind: answers.kind,
    capacity: answers.capacity,
    typedPersonal: answers.typedPersonal,
    personal: { ...personal, address: { ...personal.address } },
    intendedOwner: { name: answers.intendedOwner.name, email: answers.intendedOwner.email },
    business: { ...business, address: { ...address } } as RegistrationDraft["business"],
    branches: answers.branches.map((b) => ({ name: b.name, address: { ...b.address } })),
    franchise: {
      role: franchiseRole,
      brandName: franchiseBrand,
      franchisorLegalName,
      franchisorCountry,
      franchisedLocations,
    },
    documents: answers.documents.map((d) => ({
      kind: d.kind,
      objectKey: d.objectKey,
      filename: unnumbered(d.filename),
      sizeBytes: d.sizeBytes,
    })),
  };
}

/** The server's draft back into the wizard's shape; missing fields take the empty value. */
export function fromServerDraft(
  draft: RegistrationDraft,
  empty: { personal: PersonalDraft; business: BusinessDraft; address: AddressDraft },
  mintBranch: () => BranchDraft,
): WizardAnswers {
  const personal = draft.personal;
  const openStep = draft.openStep ?? "business";
  const franchise = draft.franchise;
  return {
    openStep,
    reached: furthest(openStep, draft.reached ?? openStep),
    done: draft.done ?? [],
    kind: draft.kind,
    capacity: draft.capacity,
    typedPersonal: draft.typedPersonal,
    personal: {
      ...empty.personal,
      ...personal,
      documentNumber: "",
      address: { ...empty.address, ...personal.address },
    } as PersonalDraft,
    intendedOwner: { name: draft.intendedOwner.name, email: draft.intendedOwner.email, nationalId: "" },
    business: {
      ...empty.business,
      ...(draft.business as Partial<BusinessDraft>),
      ...(franchise
        ? {
            franchiseRole: franchise.role,
            franchiseBrand: franchise.brandName,
            franchisorLegalName: franchise.franchisorLegalName,
            franchisorCountry: franchise.franchisorCountry,
            franchisedLocations: franchise.franchisedLocations,
          }
        : {}),
      address: {
        ...empty.address,
        ...((draft.business.address as Partial<AddressDraft> | undefined) ?? {}),
      },
    },
    branches: draft.branches.map((b) => ({
      ...mintBranch(),
      name: b.name,
      address: { ...empty.address, ...b.address } as AddressDraft,
    })),
    documents: (draft.documents ?? []).map((d) => ({
      kind: d.kind,
      kindOther: "",
      objectKey: d.objectKey,
      filename: d.filename,
      sizeBytes: d.sizeBytes,
    })),
  };
}

/** The later of two steps, in the wizard's order. */
export function furthest(a: RegistrationDraftStep, b: RegistrationDraftStep): RegistrationDraftStep {
  return REGISTRATION_DRAFT_STEPS.indexOf(b) > REGISTRATION_DRAFT_STEPS.indexOf(a) ? b : a;
}

// ---------------------------------------------------------------------------
// The save status in the header (ADR-075 S9, AC-10): always true
// ---------------------------------------------------------------------------

export type SaveState =
  /** Nothing typed since the wizard opened, and nothing saved behind it: nothing to say. */
  | "idle"
  /** Typed, and on its way to the server or waiting out the pause after typing. */
  | "saving"
  /** The server holds exactly what is on screen. */
  | "saved"
  /** The server could not be reached; this browser's copy holds what is on screen. */
  | "offline"
  /** Neither holds it: the server refused it, or this browser would not keep a copy. */
  | "failed";

/** What the header says for each. "Not saved" is followed by its Retry button. */
export const SAVE_STATE_TEXT: Readonly<Record<Exclude<SaveState, "idle">, string>> = {
  saving: "Saving…",
  saved: "✓ Saved",
  offline: "Offline, saved on this phone",
  failed: "Not saved,",
};

/** The pause after the last key before the answers are sent: one save for a burst of typing. */
export const SAVE_DEBOUNCE_MS = 800;
/** The longest typing goes unsaved while someone types without a pause. */
export const SAVE_MAX_WAIT_MS = 5_000;
/** How long before an unreachable or busy server is asked again, without a press. */
export const SAVE_RETRY_MS = 15_000;

/**
 * What a save that came back says: saved; unreachable, which the device copy
 * covers if this browser kept one; or refused, which nothing covers until it
 * is fixed or retried.
 */
export function saveStateAfter(outcome: "ok" | "unreachable" | "refused", deviceKept: boolean): SaveState {
  if (outcome === "ok") return "saved";
  if (outcome === "unreachable") return deviceKept ? "offline" : "failed";
  return "failed";
}

/** What the header says while an answer waits to be sent: on its way, or on this phone only. */
export function saveStateWhileTyping(online: boolean, deviceKept: boolean): SaveState {
  if (online) return "saving";
  return deviceKept ? "offline" : "failed";
}
