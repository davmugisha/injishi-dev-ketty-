"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@injishi/web-ui";
import { cn } from "@injishi/utils";

/**
 * The round plus/minus control both guest steppers use.
 *
 * The two callers sit on different grounds — the search overlay on the ink
 * palette, the booking widget on the page palette — so the skin and the size
 * are the only things that vary. The markup, the svg geometry and the disabled
 * semantics were identical in both copies and are shared here; each tone below
 * reproduces its caller's appearance exactly as it was when the two steppers
 * owned separate definitions.
 *
 * The minus stroke is always drawn and the plus adds the crossbar, so the two
 * signs share a path and cannot drift apart.
 *
 * The two tones stay as classes rather than becoming HeroUI variants. Neither
 * is a semantic weight — `overlay` sits on a pinned-white sheet and `card` on
 * the page — so a variant name would claim a meaning they do not have. HeroUI
 * supplies the press, focus and disabled behaviour; the tone supplies the
 * ground it has to sit on.
 */
type StepTone = "overlay" | "card";

const TONES = {
  overlay: {
    box: "size-9",
    icon: 14,
    disabled: "border-black/8 text-ink/25",
    enabled: "border-black/15 text-ink hover:border-ink hover:bg-ink hover:text-white",
  },
  card: {
    box: "size-8",
    icon: 12,
    disabled: "border-input text-page-fg-70 opacity-40",
    enabled: "border-page-fg/25 text-page-fg hover:border-page-fg",
  },
} as const;

export function StepButton({
  sign,
  label,
  disabled,
  onClick,
  tone,
}: {
  sign: "minus" | "plus";
  label: string;
  disabled: boolean;
  onClick: () => void;
  tone: StepTone;
}) {
  const skin = TONES[tone];
  return (
    <Button
      variant="outline"
      size="icon-sm"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(skin.box, disabled ? skin.disabled : skin.enabled)}
    >
      {sign === "plus" ? (
        <Plus width={skin.icon} height={skin.icon} strokeWidth={1.6} aria-hidden />
      ) : (
        <Minus width={skin.icon} height={skin.icon} strokeWidth={1.6} aria-hidden />
      )}
    </Button>
  );
}
