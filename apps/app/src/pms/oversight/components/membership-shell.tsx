"use client";

/**
 * The PSF Membership console's frame (ADR-056).
 *
 * The same frame the verifier and approver consoles wear (`ConsoleFrame`), fed
 * from the officer's own posting as `GET /api/v1/me/oversight` returned it,
 * not from the registration store: membership is not a registration gate and
 * has none of that store's data.
 */
import type { ReactNode } from "react";

import type { QueuedToast } from "../../lib/toast-queue";
import { membershipNav } from "../lib/nav";
import { ConsoleFrame } from "./console-shell";
import { useOfficerAccess } from "./officer-boundary";

export function MembershipShell({
  title,
  queued,
  toasts,
  children,
}: {
  title: string;
  /** How many applications wait in the queue, for the nav pill. */
  queued: number | null;
  toasts: readonly QueuedToast[];
  children: ReactNode;
}) {
  const grant = useOfficerAccess()?.membership ?? null;
  return (
    <ConsoleFrame
      title={title}
      seal="var(--accent)"
      officerTitle={grant?.title ?? "PSF membership officer"}
      bodyName={grant?.bodyName ?? grant?.bodyCode ?? "Private Sector Federation"}
      scope={grant?.scopeLabel ?? "Rwanda"}
      sections={membershipNav(queued)}
      toasts={toasts}
    >
      {children}
    </ConsoleFrame>
  );
}
