/**
 * The three numbered sections of checkout, and which one is open.
 *
 * The captures show one step open at a time: the others collapse to a title,
 * their answer, and a `Change` button. That is a small state machine — each
 * step is `done` (answered, collapsed), `active` (open, being answered) or
 * `todo` (not reached) — and it lives here as data so `checkout-step.tsx`
 * only has to render three states it is handed, never decide them.
 */

export type CheckoutStepId = "when" | "method" | "review";

export interface CheckoutStepMeta {
  id: CheckoutStepId;
  title: string;
}

/** In the order the capture numbers them: 1, 2, 3. */
export const CHECKOUT_STEPS: readonly CheckoutStepMeta[] = [
  { id: "when", title: "Choose when to pay" },
  { id: "method", title: "Add a payment method" },
  { id: "review", title: "Review your reservation" },
] as const;

export type CheckoutStepState = "done" | "active" | "todo";

/**
 * What a step's card looks like right now.
 *
 * A step is `done` once its own id is in `completed`, `active` once every
 * step before it is done and this one is not, and `todo` otherwise. Only one
 * step is ever `active`, and it is always the first one not yet done — there
 * is no way to jump ahead of an unanswered step.
 */
export function stepState(
  id: CheckoutStepId,
  completed: ReadonlySet<CheckoutStepId>,
): CheckoutStepState {
  if (completed.has(id)) return "done";

  const index = CHECKOUT_STEPS.findIndex((step) => step.id === id);
  const before = CHECKOUT_STEPS.slice(0, index);
  const readyToOpen = before.every((step) => completed.has(step.id));
  return readyToOpen ? "active" : "todo";
}

/** The step a guest is actually looking at: the first one not yet done. */
export function currentStep(
  completed: ReadonlySet<CheckoutStepId>,
): CheckoutStepId {
  const open = CHECKOUT_STEPS.find((step) => !completed.has(step.id));
  return open?.id ?? CHECKOUT_STEPS[CHECKOUT_STEPS.length - 1].id;
}

export function isLastStep(id: CheckoutStepId): boolean {
  return CHECKOUT_STEPS[CHECKOUT_STEPS.length - 1].id === id;
}
