"use client";

/**
 * A button that asks once before doing something that cannot be taken back.
 *
 * NOT a dialog. The desk is seconds, not minutes: a modal over check-in or
 * check-out would cost every operator a second on every guest to protect the
 * rare mistake, and the fast path is the product. So the weight goes only on
 * the acts that move money or end a tenancy — a decline that refunds, ending a
 * lease, settling a deposit, recording a month's rent, passing a registration
 * gate — and it is the lightest weight that still stops a stray press.
 *
 * The first press ARMS the button: it keeps its place, keeps its focus, and
 * says what will actually happen ("Yes, decline and refund"), with a way back
 * beside it. The second press does it. It disarms itself after four seconds, or
 * the moment focus leaves, so nothing stays armed behind somebody's back.
 *
 * TWO THINGS THAT LOOK LIKE DETAIL AND ARE NOT:
 *
 *  - The same button element carries both states. Rendering a different
 *    component when armed would unmount the control under the finger that just
 *    pressed it, and a keyboard user would lose focus to the body.
 *  - A press within `SETTLE_MS` of arming is ignored. Without it a double click
 *    — which is how half the world presses a button — would arm and confirm in
 *    the same gesture, which is exactly the accident this exists to prevent.
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "@injishi/ui";

import { cn } from "@/lib/utils";
import { actionButtonClass } from "./ui";

/** How long an armed button waits before going back to rest. */
const DISARM_MS = 4_000;

/** How long after arming a press is read as part of the FIRST press. */
const SETTLE_MS = 450;

export function ConfirmAction({
  children,
  confirmLabel,
  keepLabel = "Keep it",
  onConfirm,
  variant = "secondary",
  tone = "danger",
  deniedReason,
  disabled,
  pending,
  fullWidth,
  className,
  style,
}: {
  /** The resting label. Word it for the wait when `pending` is true. */
  children: ReactNode;
  /** What the armed button says — the consequence, in full. */
  confirmLabel: string;
  /** The way back. */
  keepLabel?: string;
  onConfirm: () => void;
  variant?: "primary" | "secondary";
  /** `danger` for a thing that is undone by hand; `primary` for weight alone. */
  tone?: "danger" | "primary";
  /** Why this action is unavailable. Omit when it is available. */
  deniedReason?: string;
  /** Not ready to be pressed — a form above it does not add up yet. */
  disabled?: boolean;
  /** The confirmed work is under way. */
  pending?: boolean;
  /** Fill the row, for a card footer or a panel. */
  fullWidth?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const [armedAt, setArmedAt] = useState<number | null>(null);
  const armed = armedAt !== null;
  const trigger = useRef<HTMLButtonElement>(null);
  const denied = Boolean(deniedReason);

  const disarm = useCallback(() => setArmedAt(null), []);

  // Four seconds, unless the pointer is resting on it — somebody reading the
  // sentence should not have it withdrawn mid-read.
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    if (!armed || hovered) return;
    const timer = setTimeout(disarm, DISARM_MS);
    return () => clearTimeout(timer);
  }, [armed, hovered, disarm]);

  function press() {
    if (denied || disabled || pending) return;
    if (armedAt === null) {
      setArmedAt(Date.now());
      return;
    }
    if (Date.now() - armedAt < SETTLE_MS) return;
    setArmedAt(null);
    onConfirm();
  }

  return (
    <span
      className={cn("inline-flex items-center gap-2", fullWidth && "flex w-full")}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onBlur={(e) => {
        // Focus moving between the two buttons is not leaving.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) disarm();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && armed) {
          disarm();
          trigger.current?.focus();
        }
      }}
    >
      <Button
        ref={trigger}
        type="button"
        onClick={press}
        aria-disabled={denied || undefined}
        disabled={disabled}
        title={deniedReason}
        pending={pending}
        variant={armed ? (tone === "danger" ? "danger" : "primary") : variant === "primary" ? "primary" : "outline"}
        size="sm"
        shape="rounded"
        style={style}
        className={cn(
          actionButtonClass(variant, denied),
          armed && "border-transparent",
          fullWidth && "flex-1",
          className,
        )}
      >
        {armed ? confirmLabel : children}
      </Button>
      {/* Always mounted, so it is a region the screen reader already knows
          about when the sentence arrives. A label that changes on the focused
          button is not reliably read out. */}
      <span className="sr-only" aria-live="polite">
        {armed ? `${confirmLabel}. Press again to confirm, or ${keepLabel}.` : ""}
      </span>
      {armed && (
        <Button
          type="button"
          onClick={() => {
            disarm();
            trigger.current?.focus();
          }}
          variant="outline"
          size="sm"
          shape="rounded"
          className={actionButtonClass("secondary")}
        >
          {keepLabel}
        </Button>
      )}
    </span>
  );
}
