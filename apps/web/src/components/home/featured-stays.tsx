"use client";

import { ChevronRight } from "lucide-react";
import * as React from "react";
import { Button } from "@injishi/ui";

import { SectionHeading } from "@/components/shared/section-heading";
import { CoverflowStayCard } from "@/components/stays/coverflow-stay-card";
import { FEATURED_STAYS } from "@/data/featured-stays";

/**
 * "Featured stays".
 *
 * A coverflow: the stay being read stands square to the reader, its neighbours
 * turn away from it into depth. The section takes an ink band of its own rather
 * than sitting on the page background, because depth needs somewhere to recede
 * into — the same five cards on white read as a row of cut-outs. `dark` on the
 * wrapper is not a theme override, it is how the band tells the theme-following
 * type utilities which ground they are on.
 *
 * The geometry is all in `globals.css`, keyed off each card's `data-depth`.
 * What lives here is only the things geometry cannot know: which card is
 * middle, whether the deck is allowed to advance itself, and what a drag means.
 */

const AUTOPLAY_MS = 6000;
/** How far a drag has to travel before it counts as a slide rather than a tap. */
const DRAG_THRESHOLD = 48;

export function FeaturedStays() {
  const stays = FEATURED_STAYS;
  const total = stays.length;

  const [active, setActive] = React.useState(0);
  const [dragOffset, setDragOffset] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const [paused, setPaused] = React.useState(false);
  const [onScreen, setOnScreen] = React.useState(false);

  const sectionRef = React.useRef<HTMLElement>(null);
  const dragStart = React.useRef<number | null>(null);

  const go = React.useCallback(
    (step: number) => setActive((i) => (i + step + total) % total),
    [total],
  );

  /* Advancing a deck that is scrolled out of view spends frames on something
     nobody is looking at, and worse, a reader who scrolls back finds it on a
     different stay than the one they left. */
  React.useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => setOnScreen(entries[0]?.isIntersecting ?? false),
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (paused || dragging || !onScreen || total <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => go(1), AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [paused, dragging, onScreen, total, go]);

  /* Scoped to the section rather than to `window`. A carousel that binds the
     arrow keys globally takes them away from every other control on the page,
     including the ones a keyboard reader is using to leave it. */
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(-1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      go(1);
    }
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragStart.current = event.clientX;
    setDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (dragStart.current === null) return;
    /* Damped, and capped. The deck should feel attached to the finger without
       a long drag pulling the middle card clear of its own shadow. */
    const raw = event.clientX - dragStart.current;
    setDragOffset(Math.max(-120, Math.min(120, raw * 0.55)));
  };

  const endDrag = (event: React.PointerEvent) => {
    if (dragStart.current === null) return;
    const travelled = event.clientX - dragStart.current;
    dragStart.current = null;
    setDragging(false);
    setDragOffset(0);
    if (Math.abs(travelled) > DRAG_THRESHOLD) go(travelled < 0 ? 1 : -1);
  };

  const current = stays[active];

  return (
    <section
      ref={sectionRef}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Featured stays"
      className="dark section-y relative z-10 flex w-full flex-col items-center gap-8 overflow-hidden bg-black md:gap-14"
    >
      {/* The band's only light. Green rather than white so the ground carries
          the brand instead of reading as an unfinished gradient. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-accent/12 blur-[140px]"
      />

      <div className="container relative z-10">
        <SectionHeading
          lead="Featured "
          emphasis="stays"
          lede="We do not list every accommodation; only verified ones. Hand-picked guesthouses, lodges and serviced apartments across Rwanda's districts."
          action={{ label: "All stays", href: "/explore" }}
        />
      </div>

      <div
        className="coverflow-stage relative z-10 w-full touch-pan-y select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <ul
          className="coverflow-deck"
          data-dragging={dragging || undefined}
          style={dragOffset ? { transform: `translateX(${dragOffset}px)` } : undefined}
        >
          {stays.map((stay, index) => {
            const raw = (index - active + total) % total;
            const signed = raw > total / 2 ? raw - total : raw;
            const depth = Math.abs(signed) <= 2 ? signed : ("hidden" as const);

            return (
              <CoverflowStayCard
                key={stay.slug}
                stay={stay}
                depth={depth}
                priority={index === 0}
                onSelect={() => setActive(index)}
              />
            );
          })}
        </ul>
      </div>

      {/* Announced rather than shown. The counter below carries the same fact
          visually, but it is a glyph pair, not a sentence. */}
      <p className="sr-only" aria-live="polite">
        {current
          ? `Stay ${active + 1} of ${total}: ${current.nameLead} ${current.nameRest}, ${current.location}`
          : null}
      </p>

      {/* The counter sits under the row, not in it.

          Appended to the row it dragged the cluster's visual mass right of the
          deck's own centreline, and balancing it with an empty box of the same
          width only fixed the geometry — three critics still read the group as
          off-centre, because an empty box weighs nothing and ink does. On its
          own line it is symmetrical by construction. */}
      <div className="relative z-10 flex flex-col items-center gap-3">
        <div className="flex items-center gap-5">
          <DeckButton label="Previous stay" onClick={() => go(-1)}>
            <ChevronMark className="rotate-180" />
          </DeckButton>

          <div className="flex items-center gap-2">
            {stays.map((stay, index) => (
              /* The fill is set through `--button-bg`, not `bg-*`. HeroUI's
                 `.button--ghost` declares `background-color: var(--button-bg)`
                 from an unlayered rule, and unlayered beats Tailwind's utility
                 layer — a `bg-accent` class here would never land. */
              <Button
                key={stay.slug}
                variant="ghost"
                onClick={() => setActive(index)}
                aria-label={`Show ${stay.nameLead} ${stay.nameRest}`}
                aria-current={index === active}
                className={
                  index === active
                    ? "h-1.5 min-h-0 w-8 p-0 [--button-bg:var(--accent)] transition-all duration-500"
                    : "h-1.5 min-h-0 w-1.5 p-0 [--button-bg:rgba(255,255,255,0.3)] [--button-bg-hover:rgba(255,255,255,0.6)] transition-all duration-500"
                }
              />
            ))}
          </div>

          <DeckButton label="Next stay" onClick={() => go(1)}>
            <ChevronMark />
          </DeckButton>
        </div>

        {/* /70 and /55, not /45 and /25: on the brand navy those measured
            4.31:1 and 2.24:1 against a 4.5:1 floor. The separator stays the
            quieter of the two, so the hierarchy is unchanged. */}
        <span className="font-display text-sm tabular-nums text-white/70">
          {String(active + 1).padStart(2, "0")}
          <span className="mx-1 text-white/55">/</span>
          {String(total).padStart(2, "0")}
        </span>
      </div>
    </section>
  );
}

function DeckButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    /* `outline-light`, not `outline`: this arrow sits on the section's dark
       photographic ground, where the theme-following outline would be a dark
       edge on a dark field. The accent hover comes from the variant now rather
       than from a hand-picked green-600. */
    <Button
      variant="outline-light"
      size="icon"
      onClick={onClick}
      aria-label={label}
      className="size-11 border-white/20 bg-white/5 hover:bg-accent hover:text-accent-foreground"
    >
      {children}
    </Button>
  );
}

function ChevronMark({ className }: { className?: string }) {
  return (
    <ChevronRight className={`size-4 ${className ?? ""}`} strokeWidth={2} aria-hidden />
  );
}
