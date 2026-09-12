"use client";

import { AppShell } from "@/pms/components/app-shell";
import { Tickets } from "@/pms/screens/tickets";
import { usePms } from "@/pms/store";

/**
 * Maintenance, in both workspaces (ADR-018, AC-13).
 *
 * The hospitality side called this `tickets`, which named the artifact rather
 * than the work, while the residence side already said Maintenance. One word and
 * one route now, over what was always one work order model (D16).
 */
export default function Page() {
  const { state } = usePms();
  return (
    <AppShell title="Maintenance">
      <Tickets landlord={state.ws === "landlord"} />
    </AppShell>
  );
}
