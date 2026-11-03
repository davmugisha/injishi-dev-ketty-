import { type PhoneAppId, type PhoneTab, screenByPath, screenHref, tabbars } from "@injishi/data";
import { Redirect, Slot, usePathname } from "expo-router";
import { View } from "react-native";
import { useSession } from "@/lib/session";
import { type TabItem, TabBar } from "./phone";

const APP_LABEL: Record<PhoneAppId, string> = {
  housekeeper: "Staff app",
  supervisor: "Supervisor app",
  technician: "Technician app",
  guest: "Guest app",
};

/**
 * Layout of one staff phone app: requires a signed-in persona and a session that has passed the step up,
 * renders the screen and the app's tab bar.
 * The tab bar follows the persona's own app (a supervisor sees supervisor tabs in /staff), otherwise `fallback`.
 * Its tabs still come from `@injishi/data` until each staff feature moves them into the app (mobile spec
 * 0005, D-am); the guest shell has its own layout.
 */
export function AppShell({ fallback }: { fallback: PhoneAppId }) {
  const { status, persona, stepUpOwed } = useSession();
  const pathname = usePathname();
  if (status === "loading") return null;
  // The start route decides: the welcome for a signed out phone, sign in from there (mobile spec 0005, D-b).
  if (!persona) return <Redirect href="/" />;
  // The emailed step up comes first, once per session (mobile spec 0003, AC-1).
  if (stepUpOwed) return <Redirect href="/two-factor" />;
  const app = persona.app.kind === "phone" ? persona.app.app : fallback;
  const bar: PhoneTab[] = tabbars[app];
  const tabs: TabItem[] = bar.map((t) => ({ key: t.board, label: t.label, icon: t.icon, href: screenHref(t.board) }));
  const screen = screenByPath(pathname);
  const current = (bar.some((t) => t.board === screen?.board) ? screen?.board : screen?.tabCurrent) ?? undefined;
  return (
    <View className="flex-1 bg-background">
      <View className="flex-1">
        <Slot />
      </View>
      <TabBar label={APP_LABEL[app]} tabs={tabs} current={current} />
    </View>
  );
}
