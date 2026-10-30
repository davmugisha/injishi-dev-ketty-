"use client";

import { Tabs } from "@heroui/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Overview + Find homes share one Homes desk: page tabs (not separate sidebar items).
 * `tab=homes` opens Find homes; anything else is Overview.
 */
export function BrokerDeskTabs({ tab, children }: { tab: "overview" | "homes"; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const go = (next: "overview" | "homes") => {
    if (next === tab) return;
    if (next === "overview") {
      router.push("/broker");
      return;
    }
    const q = new URLSearchParams(params.toString());
    q.set("tab", "homes");
    // Prefer staying on /broker with ?tab=homes; /broker/homes still works via redirect.
    const base = pathname.startsWith("/broker/homes") ? "/broker" : pathname;
    router.push(`${base}?${q.toString()}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        selectedKey={tab}
        onSelectionChange={(key) => go(key === "homes" ? "homes" : "overview")}
        className="w-full"
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Homes desk" className="w-full max-w-md gap-1 rounded-full bg-default p-1">
            <Tabs.Tab
              id="overview"
              className="flex-1 rounded-full px-4 py-2 text-sm font-medium data-[selected=true]:bg-surface data-[selected=true]:shadow-sm"
            >
              Overview
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab
              id="homes"
              className="flex-1 rounded-full px-4 py-2 text-sm font-medium data-[selected=true]:bg-surface data-[selected=true]:shadow-sm"
            >
              Find homes
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
      {children}
    </div>
  );
}
