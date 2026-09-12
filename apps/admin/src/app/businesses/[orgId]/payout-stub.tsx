"use client";

import { Button } from "@injishi/ui";
import type { ReactNode } from "react";

import { useStubAction } from "@/lib/store";

/**
 * A payout row's not built action, as a client island.
 *
 * `OrgRecord` renders on the server, and a Server Component cannot hand the
 * shared `Button` an `onClick`, so the one kind of row action there that toasts
 * its contract lives here. Deliberately narrow and kept beside the one screen
 * that needs it: it is not a second button primitive. ADR-040 deleted the last
 * one of those (`StubButton`), and a general wrapper here would be the next.
 */
export function PayoutStub({
  contract,
  variant,
  children,
}: {
  contract: string;
  variant: "outline" | "ghost";
  children: ReactNode;
}) {
  const stubAction = useStubAction();
  return (
    <Button variant={variant} size="sm" className="shrink-0" onClick={stubAction(contract)}>
      {children}
    </Button>
  );
}
