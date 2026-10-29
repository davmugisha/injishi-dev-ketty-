/**
 * Setup for the `dom` project: Testing Library's matchers on `expect` (`toBeInTheDocument`,
 * `toHaveAttribute` and the rest), an empty document again after every test, and the one browser API
 * this app's providers need that jsdom does not implement.
 *
 * Testing Library unmounts by itself only where `afterEach` is a global, and Vitest's are not, so the
 * cleanup is registered here.
 */
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

// jsdom has no `matchMedia`, and next-themes asks it on mount even with `enableSystem={false}`, as
// `src/app/providers.tsx` sets. Every query answers "no match", the way a browser with no preference
// set does, so a test that needs a dark system preference says so itself.
if (typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
