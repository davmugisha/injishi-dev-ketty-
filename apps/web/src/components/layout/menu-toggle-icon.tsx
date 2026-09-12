import { cn } from "@injishi/utils";

/**
 * The mobile menu button's icon: three bars that fold into a cross.
 *
 * It replaces the `.menu-btn` rule in `_injishi-public.css`, which drew the
 * same three bars out of three empty `<span>` elements and animated them from
 * a stylesheet the component could not see. The shape and its motion live
 * together here now, so the button that renders it is the only thing that has
 * to know it exists.
 *
 * `<rect>` rather than `<line>`, and that is not cosmetic: the fold rotates
 * each bar about ITS OWN centre, which needs `transform-box: fill-box`, and a
 * line's fill box has zero height. A rect gives the browser a real box to
 * find a centre in, so the two ends of the cross meet.
 *
 * The transform order is the classic one and reads backwards: CSS applies the
 * rightmost function first, so each bar rotates in place and is THEN carried
 * to the middle. Reversing the pair sweeps the bars through an arc instead.
 */
export function MenuToggleIcon({
  open,
  duration = 300,
  className,
}: {
  open: boolean;
  duration?: number;
  className?: string;
}) {
  const motion = {
    transitionDuration: `${duration}ms`,
    transformBox: "fill-box" as const,
    transformOrigin: "center",
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="2"
        rx="1"
        className="transition-transform ease-out"
        style={{ ...motion, transform: open ? "translateY(6px) rotate(45deg)" : undefined }}
      />
      <rect
        x="3"
        y="11"
        width="18"
        height="2"
        rx="1"
        className="origin-center transition-all ease-out"
        style={{ ...motion, opacity: open ? 0 : 1, transform: open ? "scaleX(0)" : undefined }}
      />
      <rect
        x="3"
        y="17"
        width="18"
        height="2"
        rx="1"
        className="transition-transform ease-out"
        style={{ ...motion, transform: open ? "translateY(-6px) rotate(-45deg)" : undefined }}
      />
    </svg>
  );
}
