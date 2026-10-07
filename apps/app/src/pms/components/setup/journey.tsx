"use client";

/**
 * Where the owner stands in the four stages of opening a business on Injishi:
 * register, review, set up and publish, open (Journey board, "seven become
 * four"; Onboarding board's rail).
 *
 * HeroUI Pro's `Stepper`, because here the ORDER IS THE STATE: nobody reaches
 * set-up without having been approved, and a stage is finished exactly when the
 * next has begun. The first two are always done on this screen, since it only
 * opens for a business the approver activated (`listing.manage`, D20). Set up
 * and publish finishes when the listing is published, which is how the Journey
 * board defines that stage (listing draft to published).
 *
 * Status only. It is not a navigation: the stages before set-up have no screen
 * in this app, and a button that does nothing is worse than no button.
 */

import { Stepper } from "@injishi/ui/stepper";

export function Journey({
  requiredDone,
  requiredTotal,
  published,
  openDone,
  openTotal,
}: {
  requiredDone: number;
  requiredTotal: number;
  published: boolean;
  /** First-week tasks finished, once live. */
  openDone: number;
  openTotal: number;
}) {
  const stages = [
    { title: "Register", description: "Registered and paid" },
    { title: "In review", description: "Approved and activated" },
    {
      title: "Set up and publish",
      description: published ? "Live on Injishi" : `${requiredDone} of ${requiredTotal} required done`,
    },
    {
      title: "Open for business",
      description: published ? `${openDone} of ${openTotal} first-week tasks` : "After publishing",
    },
  ];

  return (
    <nav aria-label="Your journey" className="rounded-card border border-panel-bd bg-card px-3 py-3.5 sm:px-4">
      <Stepper
        currentStep={published ? 3 : 2}
        size="md"
        // Pro paints a finished stage in `--color-accent`, which this app's
        // shadcn bridge maps to the hover wash (globals.css), so the ticks came
        // out pale grey. Its own three variables, pointed at the green roles.
        className="[--stepper-active-color:var(--accent-text)] [--stepper-complete-color:var(--accent)] [--stepper-complete-fg:var(--accent-ink)]"
      >
        {stages.map((stage) => (
          <Stepper.Step key={stage.title}>
            <Stepper.Indicator />
            <Stepper.Content>
              <Stepper.Title>{stage.title}</Stepper.Title>
              {/* On a phone four titles fit across; the details would not. */}
              <Stepper.Description className="hidden sm:block">{stage.description}</Stepper.Description>
            </Stepper.Content>
            <Stepper.Separator />
          </Stepper.Step>
        ))}
      </Stepper>
    </nav>
  );
}
