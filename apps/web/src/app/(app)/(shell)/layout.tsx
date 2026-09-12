import type { ReactNode } from "react";

import { AppShell } from "@/components/app/app-shell";

/**
 * The sidebar and topbar, and nothing else (ADR-021).
 *
 * `<AppShell>` used to sit in `(app)/layout.tsx`, which made the shell
 * unavoidable for every route under `(app)`. Next composes layouts down the
 * segment path and gives no way to opt out of a parent, so a root that renders
 * the shell cannot also host a sign-in screen. The shell therefore moved DOWN
 * into its own group rather than the entry screens moving up.
 *
 * This group is named for the chrome it puts on, which is the rule
 * `(marketplace)/layout.tsx` writes down. Its sibling `(entry)` puts on nothing.
 *
 * There is no `<html>`, no `<body>` and no metadata here on purpose: the one
 * root document for this whole layer is `(app)/layout.tsx`.
 */
export default function ShellLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
