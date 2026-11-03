"use client";

/**
 * Registration oversight consoles (verifier / approver). The PSF membership
 * console lives under `/oversight/membership` and is fully restored; these
 * routes keep the OfficerBoundary so a holder still gets an honest answer, but
 * the queue UI itself is not yet re-mounted on the new app shell.
 */

import { notFound, useParams } from "next/navigation";
import type { ReactNode } from "react";

import { OfficerBoundary } from "@/pms/oversight/components/officer-boundary";
import { officerKeyFromSegment } from "@/pms/oversight/lib/nav";

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ console: string }>();
  const segment = typeof params.console === "string" ? params.console : "";
  const officerKey = officerKeyFromSegment(segment);

  if (!officerKey) notFound();

  return <OfficerBoundary requires={officerKey}>{children}</OfficerBoundary>;
}
