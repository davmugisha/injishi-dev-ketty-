import type { PhoneAppId } from "@injishi/data";
import { Redirect, Slot } from "expo-router";
import { View } from "react-native";
import { useSession } from "@/lib/session";
import { TabBar } from "./phone";

/**
 * Layout of one phone app: requires a signed-in persona and a session that has passed the step up, renders
 * the screen and the app's tab bar.
 * The tab bar follows the persona's own app (a supervisor sees supervisor tabs in /staff), otherwise `fallback`.
 */
export function AppShell({ fallback }: { fallback: PhoneAppId }) {
  const { status, persona, stepUpOwed } = useSession();
  if (status === "loading") return null;
  if (!persona) return <Redirect href="/sign-in" />;
  // The emailed step up comes first, once per session (mobile spec 0003, AC-1).
  if (stepUpOwed) return <Redirect href="/two-factor" />;
  const app = persona.app.kind === "phone" ? persona.app.app : fallback;
  return (
    <View className="flex-1 bg-background">
      <View className="flex-1">
        <Slot />
      </View>
      <TabBar app={app} />
    </View>
  );
}
