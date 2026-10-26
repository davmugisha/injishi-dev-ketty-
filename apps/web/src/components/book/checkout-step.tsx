"use client";

import { Button } from "@injishi/web-ui";
import { useEffect, useRef, type ReactNode } from "react";
import type { CheckoutStepMeta, CheckoutStepState } from "@/lib/checkout-steps";

/**
 * One numbered section: `1. Choose when to pay`, `2. Add a payment method`,
 * `3. Review your reservation`.
 *
 * The number is the step's position in `CHECKOUT_STEPS`, never written out by
 * hand — a fourth step inserted later gets its number for free and nothing
 * here has to change.
 *
 * `active` renders `children` (the step's own form). `done` renders `summary`
 * instead, with a `Change` button that reopens it. `todo` renders nothing but
 * the title, exactly as capture 1 shows steps 2 and 3 before step 1 is
 * answered — collapsed to a heading with no body and no action.
 *
 * ## Why a `todo` step is no longer dimmed with `opacity`
 *
 * It used to carry `opacity-60` on the whole `<section>`, and `opacity`
 * composites the ELEMENT, background and border included. The card's own
 * `border-input` is a control boundary that measures 3.89:1 on the checkout
 * surface; run through a 60% wrapper it lands at **2.09:1 light and 2.18:1
 * dark**, under the 3:1 that WCAG 1.4.11 binds at — and it did that to the two
 * steps every guest sees on arrival. Worse, it multiplied with the
 * `text-page-fg-70` inside it, so secondary copy compounded to 42% alpha.
 *
 * Dimming is a STATE, and a state is expressed by a role, not by an opacity
 * that lands on whatever happens to be inside. Only the heading quietens, onto
 * `text-muted-foreground` — the role already measured for secondary text — and
 * the boundary keeps its full contrast.
 *
 * ## Why focus moves
 *
 * Pressing `Next` unmounts the button that was focused: the step collapses and
 * `children` stops rendering. Focus then falls to `<body>`, so a keyboard or
 * screen-reader user restarts from the top of the document at every step —
 * three times, on the screen that takes their money. `CheckoutConfirmed`
 * already solved this for the end of the flow by moving focus to the news; this
 * does the same at each transition, and announces the step it landed on.
 */
export function CheckoutStep({
  step,
  index,
  state,
  summary,
  onChange,
  children,
}: {
  step: CheckoutStepMeta;
  index: number;
  state: CheckoutStepState;
  /** Shown next to the title once the step is `done`. */
  summary?: ReactNode;
  /** Reopen this step. Present only once it is `done`. */
  onChange?: () => void;
  children?: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  /*
   * Focus follows the step that just became active — but never on first paint.
   * Stealing focus to the top of the page as it loads is its own bug, and it
   * would also scroll a guest arriving mid-page back to step 1.
   */
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (state === "active") heading.current?.focus();
  }, [state]);

  return (
    <section
      className="rounded-card border border-input bg-card p-6 lg:p-8"
      aria-current={state === "active" ? "step" : undefined}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2
            ref={heading}
            tabIndex={-1}
            className={`text-lg font-semibold outline-none lg:text-xl ${
              state === "todo" ? "text-muted-foreground" : "text-page-fg"
            }`}
          >
            {index + 1}. {step.title}
          </h2>
          {state === "done" && summary ? (
            <p className="mt-1 text-sm text-page-fg-70">{summary}</p>
          ) : null}
        </div>

        {state === "done" && onChange ? (
          <Button variant="outline" size="sm" onClick={onChange} className="shrink-0">
            Change
            <span className="sr-only"> {step.title}</span>
          </Button>
        ) : null}
      </div>

      {state === "active" && children ? <div className="mt-6">{children}</div> : null}
    </section>
  );
}
