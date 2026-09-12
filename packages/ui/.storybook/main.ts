import { defineMain } from "@storybook/react-vite/node";
import tailwindcss from "@tailwindcss/vite";

/**
 * Storybook for `@injishi/ui` (ADR-045).
 *
 * It lives in the package, not in an app, because the package deliberately does
 * not depend on Next (`Breadcrumbs` takes `linkAs` for exactly that reason), so
 * a Next-flavoured Storybook would add an assumption the library avoids. Vite is
 * the builder; nothing here reaches `pnpm build`.
 *
 * Stories sit in `../stories`, OUTSIDE `src/`, and that is load-bearing twice
 * over. The export map publishes `./src/components/*.tsx`, so a story in `src/`
 * would become an importable path; and every consuming app's Tailwind scans
 * `src/` through the `@source` in `styles.css`, so a story's classes would be
 * generated into all three apps' CSS.
 */
export default defineMain({
  framework: "@storybook/react-vite",
  // Storybook reports usage to its own servers by default. Nothing about this
  // workspace leaves it without someone deciding so.
  core: { disableTelemetry: true },
  stories: ["../stories/**/*.stories.tsx"],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-themes",
  ],
  // The same six binaries every web app mounts. `apps/web` owns them; this is a
  // read, never a second copy.
  staticDirs: [{ from: "../../../apps/web/public/shared/fonts", to: "/fonts" }],
  async viteFinal(config) {
    return {
      ...config,
      plugins: [...(config.plugins ?? []), tailwindcss()],
    };
  },
});
