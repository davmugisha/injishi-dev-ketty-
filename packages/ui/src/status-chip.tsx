import { Chip } from "@heroui/react";
import type { ReactNode } from "react";
import { type StatusKind, type StatusTone, statusLabel, statusTone } from "./status.ts";
import { toneColor } from "./tone.ts";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type StatusChipProps = {
  /** "sm" in tables and lists (the default), "md" in a record's header. */
  size?: "sm" | "md";
  className?: string;
} & (
  | {
      /** A rentals status: the tone and the words come from the one status map. */
      kind: StatusKind;
      status: string;
      /** Other words for the same state, e.g. "Due 5th" for an open charge. The tone stays the map's. */
      children?: ReactNode;
      tone?: never;
    }
  | {
      /** A state outside the rentals maps: say the tone and the words. */
      tone: StatusTone;
      children: ReactNode;
      kind?: never;
      status?: never;
    }
);

/**
 * A status as the feature screens show one: a small soft `Chip` in the status's tone. The tone and the
 * words come from the one status map, never from the screen.
 *
 * ```tsx
 * <StatusChip kind="lease" status={lease.status} />
 * <StatusChip kind="charge" status="open">Due 5th</StatusChip>
 * ```
 */
export function StatusChip(props: StatusChipProps) {
  const { size = "sm", className } = props;
  const tone: StatusTone = props.kind ? statusTone(props.kind, props.status) : props.tone;
  const words = props.children ?? (props.kind ? statusLabel(props.kind, props.status) : null);
  return (
    <Chip size={size} variant="soft" color={toneColor(tone)} className={cx("whitespace-nowrap", className)}>
      {words}
    </Chip>
  );
}
