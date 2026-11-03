import { useIsFocused } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ScopedTheme } from "uniwind";
import { AppStack } from "@/proto/app-stack";

// A deep link to a screen or sheet of this app keeps the tabs underneath, so back stays in the app.
export const unstable_settings = { anchor: "(tabs)" };

/**
 * The manager app. It draws dark, as the prototype shows it: its tabs, tab bar and sheets included.
 * The light status bar applies only while it is in front, since it stays mounted under another app.
 */
export default function ManagerLayout() {
  const focused = useIsFocused();
  return (
    <ScopedTheme theme="dark">
      {focused ? <StatusBar style="light" /> : null}
      <AppStack app="manager" />
    </ScopedTheme>
  );
}
