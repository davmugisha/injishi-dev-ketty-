// heroui-ok: typography helpers for public page headings and the pricing placeholder (no interactive UI).
import { type BoardId, screenHref } from "@injishi/data";
import type { ReactNode } from "react";
import type { DemoLinks } from "./links";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Placeholder the artifact prints wherever Injishi's prices still await approval. */
export const PRICING_PENDING = "[PRICING PENDING APPROVAL]";

/** The pricing placeholder, set in monospace as on the artboards. */
export function Pending({ className }: { className?: string }) {
  return <span className={cx("font-mono", className)}>{PRICING_PENDING}</span>;
}

/** Link target for a demo screen (see demoLinks), falling back to the screen itself. */
export function linkTo(links: DemoLinks | undefined, board: BoardId): string {
  return links?.[board] ?? screenHref(board);
}

/** Heading + muted subtitle of a public page section (artifact: .ij-stack with an h2 and .ij-sub). */
export function SectionHeading({
  id,
  title,
  sub,
  size = "lg",
  className,
}: {
  id: string;
  title: ReactNode;
  sub?: ReactNode;
  /** lg = 24px section titles, md = 20px card titles. */
  size?: "lg" | "md";
  className?: string;
}) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-[4px]", className)}>
      <h2
        id={id}
        className={size === "lg" ? "text-[24px] leading-[32px] font-[650]" : "text-[20px] leading-[28px] font-[650]"}
      >
        {title}
      </h2>
      {sub ? <p className="text-[14px] leading-[20px] text-muted">{sub}</p> : null}
    </div>
  );
}
