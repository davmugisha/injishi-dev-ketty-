import { createContext, type ReactNode, useContext } from "react";
import { ScopedTheme, useUniwind } from "uniwind";

/**
 * The ground a kit part paints, as the text drawn on it needs to know it. React Native has no
 * cascade, so a `bg-warning-soft` box colours none of the words inside; the words name their own
 * colour. A tinted kit part (a `Card` tone, a `Banner`, a `Bubble`) therefore says which ink is
 * its pair, and a `Text` or `Icon` inside that keeps the default tone draws in it: the palette's
 * measured pair (D-c) without every caller spelling `text-warning-soft-foreground`.
 *
 * `solid` grounds (a filled accent card) also dim `muted` text to the pair at 78%, the prototype's
 * `.card.accent .muted`, because the page's `muted` is not legible on a fill.
 */
export type Ground = {
  /** The pair's class, `text-<role>`. */
  text: string;
  /** The pair's palette role, for an icon's fill or a ring's stroke. */
  role: string;
  solid: boolean;
};

const GroundContext = createContext<Ground | null>(null);

/** The ground the nearest tinted kit part paints, or null on a neutral surface. */
export function useGround(): Ground | null {
  return useContext(GroundContext);
}

/**
 * Sets the ground for everything inside. `null` resets it: a neutral surface (a list, a sheet)
 * drawn inside a tinted one takes the page's ink again.
 */
export function OnGround({ ground, children }: { ground: Ground | null; children: ReactNode }) {
  return <GroundContext.Provider value={ground}>{children}</GroundContext.Provider>;
}

/** How dim `muted` words draw on a solid ground (`.card.accent .muted`). */
export const MUTED_ON_SOLID = 0.78;

/**
 * Content over a photograph. Words and marks on a photo stay light in both themes, so they draw in
 * the dark theme's roles: its `foreground` is the light ink, its `backdrop` the dark glass. A token
 * in a fixed theme, never a hex or Tailwind's `white`.
 */
export function OnPhoto({ children }: { children: ReactNode }) {
  return (
    <ScopedTheme theme="dark">
      <OnGround ground={null}>{children}</OnGround>
    </ScopedTheme>
  );
}

/**
 * The other theme's roles, for the prototype's inverted grounds (`.toast`, `.offline`, a selected
 * `.fchip`, an active `.pin`: `background: var(--fg); color: var(--bg)`). The other theme's
 * `surface` and `foreground` are that pair, measured, so nothing inverts by hand.
 */
export function Inverse({ children }: { children: ReactNode }) {
  const { theme } = useUniwind();
  return (
    <ScopedTheme theme={theme === "dark" ? "light" : "dark"}>
      <OnGround ground={null}>{children}</OnGround>
    </ScopedTheme>
  );
}

/** Light-theme roles in both themes: a QR code's quiet zone and modules must not invert. */
export function FixedLight({ children }: { children: ReactNode }) {
  return (
    <ScopedTheme theme="light">
      <OnGround ground={null}>{children}</OnGround>
    </ScopedTheme>
  );
}
