import type { ReactNode } from "react";

/**
 * The way in: /sign-in, /verify-otp, /activate, /register, /claim-org (ADR-021).
 *
 * Five screens that wear no chrome at all. The group is named for the journey
 * rather than for a session state, because `/register` is walked by someone who
 * has ALREADY proved their email through `RegisterGate` — calling this group
 * "unauthed" would be false on one of its five screens.
 *
 * `min-h-screen bg-background` is the one thing this file adds. Those two
 * classes were the `<body>` class of the old `(onboarding)` root layout, and
 * they are what gives `/register` and `/claim-org` a full-height tinted page.
 * They come down here rather than onto the shared `<body>`, so the six Personal
 * routes keep the plain `antialiased` body they have always had, and so the next
 * entry screen someone adds cannot forget them.
 *
 * These routes are deliberately ABSENT from `PROTECTED_PREFIXES` in
 * `src/middleware.ts` (`/claim-org` excepted, which was always gated). They are
 * steps of signing in, and gating them locks the door from the inside. Sitting
 * in a folder beside gated routes is not a reason to add them.
 */
export default function EntryLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background">{children}</div>;
}
