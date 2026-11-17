"use client";

import { Toast } from "@heroui/react";
import { PageContent } from "@injishi/ui";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { TeamRolesManager } from "./TeamRolesManager";
import type { TeamRolesData } from "./TeamRolesModel";

/**
 * Settings → Team: the team manager inside the workspace page, its Invite and Transfer buttons in the area header.
 * The point of sale's Setup draws the same `TeamRolesManager` inside the POS shell.
 */
export function TeamRolesView({ data }: { data: TeamRolesData }) {
  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <TeamRolesManager data={data} renderHeader={(actions) => <AreaHeader actions={actions} />} />
    </PageContent>
  );
}
