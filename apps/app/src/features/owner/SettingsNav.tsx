"use client";

import { Hierarchy, PlugConnection, ShieldCheck, Sliders } from "@gravity-ui/icons";
import { Tabs } from "@heroui/react";
import { type BoardId, screenHref } from "@injishi/data";

const SECTIONS = [
  { board: "SettingsBusiness", label: "Business structure", Icon: Hierarchy },
  { board: "SettingsPolicies", label: "Policies", Icon: Sliders },
  { board: "Integrations", label: "Integrations", Icon: PlugConnection },
  { board: "AuditLog", label: "Audit log", Icon: ShieldCheck },
] as const satisfies readonly { board: BoardId; label: string; Icon: unknown }[];

export type SettingsSection = (typeof SECTIONS)[number]["board"];

/** Settings sub-navigation shared by the four settings screens (artifact: nav.ij-tabs-line "Settings sections"). */
export function SettingsNav({ current }: { current: SettingsSection }) {
  return (
    <nav aria-label="Settings sections">
      <Tabs variant="secondary" selectedKey={current} className="w-full">
        <Tabs.ListContainer>
          <Tabs.List aria-label="Settings sections" className="justify-start">
            {SECTIONS.map(({ board, label, Icon }) => (
              <Tabs.Tab
                key={board}
                id={board}
                href={screenHref(board)}
                aria-current={board === current ? "page" : undefined}
                className="w-auto gap-1.5 px-3"
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
    </nav>
  );
}
