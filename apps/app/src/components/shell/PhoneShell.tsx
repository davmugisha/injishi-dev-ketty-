"use client";

import { type Persona, type PhoneTab, screenByPath, screenHref, tabbars } from "@injishi/data";
import { DeviceFrame, Icon } from "@injishi/ui";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SampleDataPill } from "./SampleData";

/** Bottom tab bar of a phone app (artifact: .ij-tabbar). */
function TabBar({ tabs, current, label }: { tabs: PhoneTab[]; current: string | null | undefined; label: string }) {
  return (
    <nav
      aria-label={label}
      className="flex shrink-0 items-stretch justify-around bg-surface px-2 pt-1.5 pb-[22px] shadow-[0_-1px_0_var(--separator)]"
    >
      {tabs.map((t) => {
        const active = t.board === current;
        return (
          <NextLink
            key={t.board}
            href={screenHref(t.board)}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-[14px] text-[11px] font-medium no-underline ${active ? "text-accent-soft-foreground" : "text-muted"}`}
          >
            <Icon name={t.icon} className={`size-[22px] ${active ? "text-accent" : ""}`} />
            {t.label}
          </NextLink>
        );
      })}
    </nav>
  );
}

/** The phone frame has no top bar, so the sample-data mark sits above the screen. */
function SamplePhoneNote({ board }: { board: string }) {
  return (
    <div className="flex shrink-0 justify-center px-3 pt-2 empty:hidden">
      <SampleDataPill board={board} />
    </div>
  );
}

const APP_LABEL: Record<string, string> = {
  housekeeper: "Staff app",
  supervisor: "Supervisor app",
  technician: "Technician app",
  resident: "Resident portal",
  guest: "Guest app",
};

/**
 * Portrait phone surface: a 390×844 device frame on larger screens, full-bleed on a phone.
 * The tab bar follows the signed-in persona's app; otherwise the screen's own app.
 */
export function PhoneShell({ persona, children }: { persona: Persona | null; children: ReactNode }) {
  const pathname = usePathname();
  const screen = screenByPath(pathname);
  const app = persona?.app.kind === "phone" ? persona.app.app : screen?.phoneApp;
  const tabs = app ? tabbars[app] : [];
  const current = tabs.some((t) => t.board === screen?.board) ? screen?.board : screen?.tabCurrent;
  return (
    <DeviceFrame device="phone" width={390} height={844} label={screen?.title}>
      <div className="flex min-h-0 flex-1 flex-col">
        {screen?.board && <SamplePhoneNote board={screen.board} />}
        {children}
      </div>
      {tabs.length ? <TabBar tabs={tabs} current={current} label={app ? APP_LABEL[app] : "App"} /> : null}
    </DeviceFrame>
  );
}
