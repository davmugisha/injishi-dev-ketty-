"use client";

import { Heart } from "lucide-react";
import { Button } from "@injishi/ui";
import { cn } from "@injishi/utils";
import { useSavedStays } from "@/hooks/use-saved-stays";

/**
 * "Add to Saved".
 *
 * Sits inside the listing card's link, so it stops propagation — clicking the
 * heart must not navigate to the property.
 *
 * TWO APPEARANCES, because the control sits on two different grounds.
 *
 * `labelled` is the page-action form: the shared ghost `Button`, a heart and a
 * word, the same control the property page's Share sits beside it as. It was
 * a dark pill with a white square holding a grey heart — three surfaces for
 * one small action, and none of them a variant the button has. The word is
 * kept here because the row reads as words: Share, Save.
 *
 * `circle` is the card form and the default. A white disc with a red heart in
 * it, no word, pinned to the top right of the photograph. The word is gone on
 * purpose: a card is scanned rather than read, the heart is the one icon every
 * booking site puts in that corner, and the label was the worst-contrast
 * element on the explore page. The accessible name is unchanged and still
 * announces which way the toggle will go, so nothing is lost to a screen
 * reader — only to the eye that did not need it.
 *
 * The disc is what makes the colour safe. Red on white holds its contrast
 * whatever the photograph behind the card happens to be, which is the same
 * reason the Verified mark sits on a white plate rather than in a scrim. The
 * heart is red in both forms, filled once the stay is saved: one mark, one
 * meaning, wherever it appears.
 */
export function SaveStayButton({
  slug,
  label = "Add to Saved",
  size = "md",
  appearance = "circle",
  className,
}: {
  slug: string;
  /** Only read by the `labelled` appearance. The circle has no visible word. */
  label?: string;
  size?: "sm" | "md";
  appearance?: "circle" | "labelled";
  className?: string;
}) {
  const { isSaved, toggle } = useSavedStays();
  const saved = isSaved(slug);

  const onToggle = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    toggle(slug);
  };

  const accessibleName = saved ? "Remove from saved" : "Add to saved";

  if (appearance === "circle") {
    return (
      <Button
        variant="ghost"
        aria-pressed={saved}
        aria-label={accessibleName}
        onClick={onToggle}
        className={cn(
          "grid place-items-center rounded-full bg-white p-0 shadow-sm transition-transform duration-quick hover:bg-white active:scale-[0.92]",
          size === "sm" ? "size-9" : "size-10",
          className,
        )}
      >
        <Heart
          className={cn("text-danger", size === "sm" ? "size-5" : "size-[22px]")}
          strokeWidth={2.2}
          fill={saved ? "currentColor" : "none"}
          aria-hidden
        />
      </Button>
    );
  }

  // No `aria-label` and no `aria-pressed` here: the visible word IS the name,
  // and it already changes with the state ("Save" / "Saved"). A name that
  // does not start with the word on the button fails a speech-input user
  // saying "click Save", and a state-changing name plus `aria-pressed` is the
  // same fact announced twice.
  return (
    <Button
      variant="ghost"
      size={size}
      shape="rounded"
      onClick={onToggle}
      className={cn("text-page-fg underline underline-offset-4", className)}
    >
      <Heart
        className="size-4 shrink-0 text-danger"
        strokeWidth={2.2}
        fill={saved ? "currentColor" : "none"}
        aria-hidden
      />
      {saved ? "Saved" : label}
    </Button>
  );
}
