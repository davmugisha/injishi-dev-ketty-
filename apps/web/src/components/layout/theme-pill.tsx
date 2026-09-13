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
 *
 * `tone` says which ground the pill sits on. `band` is the footer's dark band it
 * was drawn for. `page` is the ordinary page ground, painted from surface and
 * page foreground tokens so it reads in both themes; the waitlist header is its
 * one caller (ADR-048 copy.md §8 keeps the theme control in the header).
 */
const TONES = {
  band: {
    group: "bg-white/5 ring-1 ring-inset ring-white/10",
    focus: "focus-visible:ring-white/70 focus-visible:ring-offset-black",
    light: "bg-white/10 text-white dark:bg-transparent dark:text-white/40 dark:hover:text-white/70",
    dark: "bg-transparent text-white/40 hover:text-white/70 dark:bg-white/10 dark:text-white dark:hover:text-white",
  },
  page: {
    group: "bg-surface-secondary",
    focus: "focus-visible:ring-ring focus-visible:ring-offset-background",
    light: "bg-surface-tertiary text-page-fg dark:bg-transparent dark:text-page-fg-70 dark:hover:text-page-fg",
    dark: "bg-transparent text-page-fg-70 hover:text-page-fg dark:bg-surface-tertiary dark:text-page-fg",
  },
} as const;

export function ThemePill({ tone = "band" }: { tone?: keyof typeof TONES }) {
  const colours = TONES[tone];
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const dark = resolvedTheme === "dark";

  return (
    <div
      role="group"
      aria-label="Theme"
      className={cn("flex items-center gap-1 rounded-full p-1", colours.group)}
    >
      <Segment
        label="Light theme"
        pressed={mounted ? !dark : undefined}
        onClick={() => setTheme("light")}
        focus={colours.focus}
        className={colours.light}
      >
        <SunIcon className="size-4" />
      </Segment>
      <Segment
        label="Dark theme"
        pressed={mounted ? dark : undefined}
        onClick={() => setTheme("dark")}
        focus={colours.focus}
        className={colours.dark}
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
  focus,
  className,
  children,
}: {
  label: string;
  pressed: boolean | undefined;
  onClick: () => void;
  focus: string;
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
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        focus,
        className,
      )}
    >
      {children}
    </button>
  );
}
