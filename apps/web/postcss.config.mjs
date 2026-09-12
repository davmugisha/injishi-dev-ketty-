/**
 * Tailwind v4 build-time compilation for the authenticated app / auth /
 * onboarding screens (src/app/_injishi-app.css). Mirrors apps/admin so those
 * screens ship real CSS in <head> instead of compiling Tailwind in the browser
 * with shared/vendor/tailwind-browser.js at runtime (the FOUC-cloak path).
 *
 * Only src/app/_injishi-app.css triggers Tailwind (it is the sole file with
 * `@import "tailwindcss"`); the marketing route groups link their own captured
 * stylesheets from public/ and are untouched by this pipeline.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
