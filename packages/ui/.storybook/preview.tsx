/// <reference types="vite/client" />
import type { Decorator, Preview } from "@storybook/react-vite";
import { withThemeByClassName } from "@storybook/addon-themes";
import { cn } from "@injishi/utils";
import "./preview.css";

/**
 * Candidate palettes (ADR-045 decision 11). Each is generated from a HeroUI
 * theme-builder URL by `palettes/derive.mjs` and overrides the roles only under
 * `[data-palette="<name>"]`, so "Current" is always exactly what the apps
 * render. A candidate is a proposal under review, never the product: one that
 * wins is adopted in `packages/design-tokens/src/heroui.ts`.
 */
import.meta.glob("./palettes/*.css", { eager: true });
type Candidate = { name: string; title: string };
const CANDIDATES = Object.values(
  import.meta.glob<Candidate>("./palettes/*.json", { eager: true, import: "default" }),
).sort((a, b) => a.name.localeCompare(b.name));

const withPalette: Decorator = (Story, { globals }) => {
  const palette = globals.palette as string | undefined;
  const root = document.documentElement;
  if (palette && palette !== "current") root.dataset.palette = palette;
  else delete root.dataset.palette;
  return <Story />;
};

/**
 * The surface a story sits on. Four real grounds from the product, chosen
 * because a component that is only ever reviewed on page white is a component
 * whose dark-mode and fixed-ground behaviour nobody has looked at.
 *
 * `canvas` and `ink` are FIXED grounds (ADR-028): they do not invert with the
 * theme. The rule in ui-rules.md says a fixed ground re-pins the theme inside
 * itself, but that pin ships only in `injishi-tokens.css`, which no app loads
 * (the 2026-09-11 audit). This preview loads what the apps load, so text on
 * `canvas` in dark mode renders here exactly as badly as it does in the
 * marketplace. That is the point: it is the review surface for the fix, not a
 * place to paper over it.
 */
const GROUND = {
  page: "bg-background text-foreground",
  card: "bg-card text-card-foreground",
  canvas: "bg-canvas",
  ink: "bg-ink",
} as const;

type Ground = keyof typeof GROUND;

const withGround: Decorator = (Story, { globals }) => {
  const ground = (globals.ground as Ground | undefined) ?? "page";
  return (
    <div className={cn("min-h-screen p-block", GROUND[ground])}>
      <Story />
    </div>
  );
};

const preview: Preview = {
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    controls: { expanded: true },
    // Report violations in the panel without failing the run: every existing
    // component is reviewed first, then this moves to "error".
    a11y: { test: "todo" },
  },
  globalTypes: {
    ground: {
      description: "The surface the story sits on",
      toolbar: {
        title: "Ground",
        icon: "paintbrush",
        dynamicTitle: true,
        items: [
          { value: "page", title: "Page (theme-following)" },
          { value: "card", title: "Card (theme-following)" },
          { value: "canvas", title: "Canvas (fixed light)" },
          { value: "ink", title: "Ink (fixed dark)" },
        ],
      },
    },
    palette: {
      description: "Palette: the product's, or a candidate under review",
      toolbar: {
        title: "Palette",
        icon: "mirror",
        dynamicTitle: true,
        items: [
          { value: "current", title: "Current (product, hue 208)" },
          ...CANDIDATES.map((c) => ({ value: c.name, title: c.title })),
        ],
      },
    },
  },
  initialGlobals: { ground: "page", palette: "current" },
  decorators: [
    withGround,
    withPalette,
    // `.light` / `.dark` on <html>: the classes `heroui.css` and every app's
    // `@custom-variant dark` read.
    withThemeByClassName({
      themes: { light: "light", dark: "dark" },
      defaultTheme: "light",
      parentSelector: "html",
    }),
  ],
};

export default preview;
