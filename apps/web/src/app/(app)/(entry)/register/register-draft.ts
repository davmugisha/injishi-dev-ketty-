import type { RegistrantCapacity, RegistrationDraft } from "@injishi/contracts";
import { REGISTRATION_DRAFT_PHASES } from "@injishi/contracts";

import type { AddressDraft } from "./address-picker";
import type { BranchDraft, BusinessDraft } from "./business-draft";
import type { PersonalDraft } from "./step-about-you";

/**
 * The wizard's answers, kept ON THE SERVER between steps (ADR-060), so a person
 * can close the tab and come back another day, on another device, to the step
 * they left. It began in `sessionStorage` (ADR-059), which died with the
 * browser; the server keeps it until the registration is created, which clears
 * it (`RegistrationService.create`).
 *
 * NEVER AN ID NUMBER, and structurally so: `RegistrationDraft`'s personal block
 * has no document number field and is strict, the intended owner carries no
 * National ID, and the server refuses a draft with sixteen digits anywhere in
 * it. This module drops both numbers before sending, so the wizard never trips
 * that refusal. A verified identity needs no number anyway: the server keeps
 * the verified document. A typed-but-unverified one owes it again on return,
 * and every draft resumes on step two, where it is asked (`resumeStep` in
 * `register-steps.ts`).
 */

type DraftPhase = RegistrationDraft["phase"];


export function isDraftPhase(phase: string): phase is DraftPhase {
  return (REGISTRATION_DRAFT_PHASES as readonly string[]).includes(phase);
}

interface WizardAnswers {
  phase: DraftPhase;
  kind: string | null;
  capacity: RegistrantCapacity;
  typedPersonal: boolean;
  personal: PersonalDraft;
  intendedOwner: { name: string; nationalId: string; email: string };
  business: BusinessDraft;
  branches: BranchDraft[];
}

/** The answers in the server's shape, with both ID numbers dropped. */
export function toServerDraft(answers: WizardAnswers): RegistrationDraft {
  const { documentNumber: _dropped, ...personal } = answers.personal;
  void _dropped;
  return {
    v: 1,
    phase: answers.phase,
    kind: answers.kind,
    capacity: answers.capacity,
    typedPersonal: answers.typedPersonal,
    personal: { ...personal, address: { ...personal.address } },
    intendedOwner: { name: answers.intendedOwner.name, email: answers.intendedOwner.email },
    business: { ...answers.business, address: { ...answers.business.address } } as RegistrationDraft["business"],
    branches: answers.branches.map((b) => ({ name: b.name, address: { ...b.address } })),
  };
}

/** The server's draft back into the wizard's shape; missing fields take the empty value. */
export function fromServerDraft(
  draft: RegistrationDraft,
  empty: { personal: PersonalDraft; business: BusinessDraft; address: AddressDraft },
  mintBranch: () => BranchDraft,
): WizardAnswers {
  const personal = draft.personal;
  return {
    phase: draft.phase,
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
  };
}

