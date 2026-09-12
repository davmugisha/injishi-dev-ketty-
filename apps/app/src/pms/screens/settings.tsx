"use client";

/**
 * Settings, with Plan and billing folded in (ADR-018, AC-12, AC-13).
 *
 * `plan` was a nav leaf that read as a schedule and meant subscription billing.
 * It is a lens here, beside the other things an owner changes once and rarely.
 *
 * **An owner and a manager both reach this page, and only the owner sees every
 * lens.** Integrations is where the RRA EBM account is connected, and
 * `ebm.manage` is held by both (ADR-041, D-o), so the leaf is theirs. Plan and
 * billing is the business's subscription, which stays the owner's: hidden from
 * a manager's lenses and refused when its URL is typed, because the nav only
 * guards the `settings` segment, not the lens beneath it.
 */

import { EmptyState } from "../components/ui";
import { LensPage, type LensLink } from "../components/lens-page";
import { Placeholder } from "../components/placeholder";
import { useWorkspaceId } from "../data/capability";
import { workspaceBase } from "../lib/nav";
import { usePms } from "../store";
import { EbmIntegration } from "./ebm-integration";

export function Settings({ lens }: { lens: string }) {
  const workspaceId = useWorkspaceId();
  const { state } = usePms();
  const base = `${workspaceBase(workspaceId)}/settings`;
  const owner = state.role === "owner";

  const lenses: LensLink[] = [
    { key: "property", label: "Property", href: base },
    { key: "policies", label: "Policies", href: `${base}/policies` },
    ...(owner ? [{ key: "plan", label: "Plan and billing", href: `${base}/plan` }] : []),
    { key: "integrations", label: "Integrations", href: `${base}/integrations` },
  ];

  return (
    <LensPage lenses={lenses} active={lens}>
      {/*
        Integrations is the first lens on real data: the business's RRA EBM
        account (ADR-041). The other three are still placeholders — no data,
        never invented data.
      */}
      {lens === "integrations" ? (
        <EbmIntegration />
      ) : lens === "plan" && !owner ? (
        <EmptyState style={{ padding: 26, fontSize: 13.5 }}>
          Plan and billing is the owner&apos;s. Ask the owner to change the subscription or payment method.
        </EmptyState>
      ) : (
        <Placeholder screenKey={lens === "policies" || lens === "plan" ? lens : "settings"} />
      )}
    </LensPage>
  );
}
