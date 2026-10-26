"use client";

/**
 * The prototype's toast, as a real implementation.
 *
 * This used to be a thin `window.Injishi?.toast?.()` call that delegated to
 * public/shared/js/injishi-state.js. That script is gone, so the behaviour lives
 * here now — same markup, same 2.6s dwell, one toast voice across the app, and
 * no dependency on a global that a page may or may not have loaded.
 *
 * Deliberately not a React portal: the callers are plain event handlers spread
 * across capture-derived pages, and a function they can import beats threading a
 * provider through markup nobody has rewritten yet.
 */
/**
 * How long this message stays, in milliseconds.
 *
 * It used to be 2.6s for everything. That is fine for "Link copied" and far
 * too short for the two-line sentences these callers actually pass, which a
 * person is still reading when the pill disappears. So the time follows the
 * words: a floor for a short one, about a quarter second per word above it,
 * and a ceiling so nothing overstays. Same rule as `toastDwellMs` in
 * `@injishi/ui`, which the operator and admin consoles use.
 */
const dwellFor = (msg: string) =>
  Math.min(10_000, Math.max(3_000, 1500 + msg.trim().split(/\s+/).filter(Boolean).length * 250));

/** Matches `animate-leave` in `@injishi/web-ui/styles.css`. */
const LEAVE_MS = 180;

export const toast = (msg: string) => {
  if (typeof document === "undefined") return;
  const el = document.createElement("div");
  el.setAttribute("role", "status");
  el.className =
    // Centred by margin, not by `-translate-x-1/2`: the arrival animation ends
    // at `transform: none` and would cancel a transform that positions it.
    "fixed inset-x-0 bottom-6 z-[70] mx-auto w-fit animate-settle-in rounded-card bg-ramp-1 " +
    "max-w-form px-5 py-3 text-sm font-medium text-ramp-6 shadow-xl";
  el.textContent = msg;
  document.body.appendChild(el);
  // It leaves rather than blinking out: shorter than it arrived, because by
  // then the person has moved on.
  setTimeout(() => {
    el.classList.remove("animate-settle-in");
    el.classList.add("animate-leave");
    setTimeout(() => el.remove(), LEAVE_MS);
  }, dwellFor(msg));
};
