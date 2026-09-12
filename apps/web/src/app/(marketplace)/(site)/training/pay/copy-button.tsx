"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@injishi/ui";

/**
 * Copy one short string — the MoMo code, the amount — to the clipboard.
 *
 * It exists because this page is read off a screen and typed into a handset,
 * and `*182*8*1*123456#` is sixteen characters of punctuation: a person
 * retyping it from a laptop to a phone will get it wrong at least once, and
 * the failure looks like "MoMo is broken" rather than "you typed a 4 for a 1".
 *
 * IT SAYS WHEN IT FAILS. `navigator.clipboard` is absent over plain HTTP and
 * refused outright by some browsers, and the wrong behaviour there is a button
 * that flashes "Copied" while the clipboard still holds whatever it held
 * before — the person then pastes the wrong thing into their handset and has
 * no way to know why. So a refusal says so, and points at the text, which is
 * selectable and always was.
 *
 * The timeout is cleared on unmount, and on a second press, so a fast double
 * press cannot leave an orphaned timer resetting the label of a button that is
 * no longer on the page.
 */
export function CopyButton({
  value,
  label,
}: {
  value: string;
  /** What is being copied, for the screen reader: "Copy the MoMo code". */
  label: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "refused">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const flash = (next: "copied" | "refused") => {
    setState(next);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2500);
  };

  const copy = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      flash("refused");
      return;
    }
    navigator.clipboard.writeText(value).then(
      () => flash("copied"),
      () => flash("refused"),
    );
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={copy}
        aria-label={label}
      >
        {state === "copied" ? (
          <Check width={16} height={16} strokeWidth={1.8} aria-hidden />
        ) : (
          <Copy width={16} height={16} strokeWidth={1.8} aria-hidden />
        )}
        {state === "copied" ? "Copied" : "Copy"}
      </Button>
      {state === "refused" ? (
        <span role="status" className="text-2xs text-page-fg-70">
          This browser refused the clipboard — select the text instead.
        </span>
      ) : null}
    </div>
  );
}
