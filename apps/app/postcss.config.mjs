/**
 * Tailwind v4 build-time compilation for the PMS operator shell. Mirrors
 * apps/web / apps/admin so the operator screens ship real CSS in <head> instead
 * of compiling Tailwind in the browser.
 *
 * Only src/app/globals.css triggers Tailwind (it is the sole file with
 * `@import "tailwindcss"`); it also carries the shadcn → Injishi token bridge.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
