"use client";

import { CircleInfo } from "@gravity-ui/icons";
import { Card } from "@heroui/react";
import type { TeamRolesRoleId } from "@injishi/data/fixtures/owner";
import type { ReactNode } from "react";
import { TeamRolesManager, type TeamRolesTab } from "@/features/owner/TeamRolesManager";
import type { TeamRolesData } from "@/features/owner/TeamRolesModel";

/**
 * A bar or restaurant has no front desk and no housekeeping, so Setup does not offer those two roles to invite or
 * grant. Anyone already holding one is still listed under it.
 */
const NOT_FOR_A_VENUE: readonly TeamRolesRoleId[] = ["frontdesk", "staff"];

/**
 * Team management inside the point of sale's Setup: the business's own team manager (the one Settings → Team draws),
 * so every member, invitation, role change, cancelled invite, access request and role preset is read from and written
 * to the same team API. Only the frame is the POS's: a heading with the Invite and Transfer buttons, in a POS card.
 */
export function TeamStep({
  data,
  tab,
  onTab,
}: {
  data: TeamRolesData | null;
  tab: TeamRolesTab;
  onTab: (tab: TeamRolesTab) => void;
}) {
  if (!data) {
    return (
      <Card className="flex flex-col gap-1 p-4" data-ui="team-unavailable">
        <div className="flex items-center gap-2 text-[13px] font-medium">
          <CircleInfo className="size-4 text-muted" /> The team could not be loaded
        </div>
        <p className="text-[13px] text-muted">Injishi did not answer with your team just now. Reload the page.</p>
      </Card>
    );
  }
  const header = (actions: ReactNode) => (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-[18px] border border-separator bg-surface p-4">
      <div className="min-w-0 flex-[1_1_320px]">
        <h3 className="text-[15px] font-semibold">{tab === "members" ? "Your team" : "Roles and permissions"}</h3>
        <p className="text-[13px] text-muted">
          {tab === "members"
            ? "Invite waiters, cashiers, bartenders, kitchen staff and managers, change a person's role or the branches they cover, and cancel an invitation. A person gets access when they accept the email invitation and sign in."
            : "What each role may do across the business. A change applies to everyone holding the role and is recorded in the audit log."}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
  return (
    <div data-ui="setup-team" className="flex flex-col gap-4">
      <TeamRolesManager
        data={data}
        renderHeader={header}
        tab={tab}
        onTabChange={onTab}
        hideRoles={NOT_FOR_A_VENUE}
        compact
      />
    </div>
  );
}
