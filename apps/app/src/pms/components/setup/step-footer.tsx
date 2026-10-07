"use client";

/**
 * The one row of controls under every set-up step: Back, Skip for now, Save and
 * continue (Onboarding board).
 *
 * A refusal sits directly above it, in the step's own words, so the person
 * reads why "Save and continue" did not move them before they look for the
 * button again. `role="alert"` so a screen reader hears it too.
 *
 * "Skip for now" exists only on a recommended step: a required one is what
 * stands between the owner and a live listing, and skipping it would only
 * defer the same refusal to the publish screen.
 */

import { Button } from "@injishi/ui";
import { ArrowLeft } from "lucide-react";

export function StepFooter({
  error,
  onBack,
  onSkip,
  onSave,
  submits = false,
  saving = false,
  saveLabel = "Save and continue",
}: {
  error?: string | null;
  /** Omitted on the first step. */
  onBack?: () => void;
  /** Given only when the step may be skipped. */
  onSkip?: () => void;
  /** Omitted on the last step, whose action is the publish screen itself. */
  onSave?: () => void;
  /**
   * The step is a form, and Save and continue is its submit button, so Enter in
   * a field saves the same way the button does. `onSave` is then the form's.
   */
  submits?: boolean;
  saving?: boolean;
  saveLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger-text">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3.5">
        <Button variant="ghost" onClick={onBack} disabled={!onBack} className="gap-1.5">
          <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={2} />
          Back
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {onSkip && (
            <Button variant="ghost" onClick={onSkip}>
              Skip for now
            </Button>
          )}
          {submits ? (
            <Button variant="primary" type="submit" pending={saving}>
              {saveLabel}
            </Button>
          ) : (
            onSave && (
              <Button variant="primary" onClick={onSave} pending={saving}>
                {saveLabel}
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
