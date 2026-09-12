"use client";

/**
 * One console, resolved from the URL.
 *
 * The segment names the FUNCTION — `/oversight/verifier/*` or
 * `/oversight/approver/*` — because a verifier and an approver do different jobs
 * against the same pipeline, and a person may legitimately hold both. It does
 * not name a workspace and cannot: `workspaces.kind` is
 * `business | broker | personal`, and an officer's authority is an assignment
 * against a district, so `/w/[workspaceId]` could not address this console even
 * in principle. That reason survives ADR-029 intact — it is why these screens
 * sit beside the operator app rather than inside a workspace, even now that they
 * share its process and its session.
 *
 * A segment naming no function is a 404, the same answer a made up URL gets.
 * `OfficerBoundary` then refuses a console this person does not hold, and
 * `OversightGuard` on the API refuses the request itself. Only the last of those
 * three is the boundary, and since ADR-029 it is the only one that stands
 * between a marketplace session and an approval queue.
 */

import { notFound, useParams } from "next/navigation";
import type { ReactNode } from "react";

import { OfficerBoundary } from "@/pms/oversight/components/officer-boundary";
import { officerKeyFromSegment } from "@/pms/oversight/lib/nav";
import { ConsoleProvider } from "@/pms/oversight/store";

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ console: string }>();
  const segment = typeof params.console === "string" ? params.console : "";
  const officerKey = officerKeyFromSegment(segment);

  if (!officerKey) notFound();

  return (
    <OfficerBoundary requires={officerKey}>
      <ConsoleProvider officerKey={officerKey}>{children}</ConsoleProvider>
    </OfficerBoundary>
  );
}
