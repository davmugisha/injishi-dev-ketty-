"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@injishi/utils";
import { MoonIcon, SunIcon } from "@/components/icons";

/**
 * The footer's two-segment theme control.
 *
 * The reference this footer was rebuilt from carries a THIRD segment, "follow
 * my system". It is deliberately absent. `components/layout/theme-provider.tsx`
 * records the invariant: nothing may write the literal `"system"` into
 * `localStorage["injishi-theme"]`, because `ThemeBoot` — the pre-paint script
 * the four signed-in route groups run — reads anything that is not `"dark"` as
 * light, and would pin a visitor who asked to follow the OS to light for good.
 * `tests/theme-invariant.test.mjs` fails the build on a regression. Each button
 * therefore names its own value; neither can produce the third.
 *
 * The ACTIVE segment is painted by the `dark:` variant, not by React state, so
 * the pill is correct on the first paint and never flashes the wrong half
 * while the client catches up. State is read for one thing only: `aria-pressed`
 * has no CSS equivalent, so it stays unset until mount rather than announcing a
 * guess to a screen reader.
 */
export function ThemePill() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const dark = resolvedTheme === "dark";

  return (
    <div
      role="group"
      aria-label="Theme"
      className="flex items-center gap-1 rounded-full bg-white/5 p-1 ring-1 ring-inset ring-white/10"
    >
      <Segment
        label="Light theme"
        pressed={mounted ? !dark : undefined}
        onClick={() => setTheme("light")}
        className="bg-white/10 text-white dark:bg-transparent dark:text-white/40 dark:hover:text-white/70"
      >
        <SunIcon className="size-4" />
      </Segment>
      <Segment
        label="Dark theme"
        pressed={mounted ? dark : undefined}
        onClick={() => setTheme("dark")}
        className="bg-transparent text-white/40 hover:text-white/70 dark:bg-white/10 dark:text-white dark:hover:text-white"
      >
        <MoonIcon className="size-4" />
      </Segment>
    </div>
  );
}

function Segment({
  label,
  pressed,
  onClick,
  className,
  children,
}: {
  label: string;
  pressed: boolean | undefined;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded-full transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
        className,
      )}
    >
      {children}
    </button>
  );
}
