import { Chip } from "@heroui/react";
import type { ReactNode } from "react";
import { type StatusKind, type StatusTone, statusLabel, statusTone } from "./status.ts";
import { toneBg, toneColor } from "./tone.ts";

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
 * A status as a soft tinted chip with a dot. The dot keeps the state readable without colour (it sits
 * beside the words, never instead of them), and the tint comes from the status map, never the screen.
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
    <Chip
      size={size}
      variant="soft"
      color={toneColor(tone)}
      data-tone={tone}
      className={cx("gap-1.5 whitespace-nowrap", size === "sm" ? "px-2" : "px-2.5", className)}
    >
      <span aria-hidden="true" className={cx("size-1.5 shrink-0 rounded-full", toneBg(tone))} />
      <Chip.Label className="px-0">{words}</Chip.Label>
    </Chip>
  );
}
