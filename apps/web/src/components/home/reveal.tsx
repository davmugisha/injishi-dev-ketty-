"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@injishi/utils";

/**
 * Fades and lifts its children into place the first time they scroll into
 * view, then stays put.
 *
 * The content is in the server HTML and only its paint is held back, so
 * nothing is hidden from crawlers or from a page that never runs script: the
 * hidden state is set by a class the client adds, not by the markup. Reduced
 * motion keeps the fade and drops the lift (the global rule in
 * `_injishi-app.css` stops transform transitions).
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  /** Milliseconds, for staggering siblings. */
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<"static" | "waiting" | "shown">("static");

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    // Already on screen at hydration: leave it alone rather than blink it.
    if (node.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    setState("waiting");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setState("shown");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={state === "static" ? undefined : { transitionDelay: `${delay}ms` }}
      className={cn(
        state !== "static" && "transition-[opacity,transform] duration-arrive ease-settle",
        state === "waiting" && "translate-y-6 opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
