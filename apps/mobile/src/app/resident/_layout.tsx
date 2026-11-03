import { AppStack } from "@/proto/app-stack";

// A deep link to a screen or sheet of this app keeps the tabs underneath, so back stays in the app.
export const unstable_settings = { anchor: "(tabs)" };

/** The resident app: its tabs, the screens that cover the tab bar, and its sheets. */
export default function ResidentLayout() {
  return <AppStack app="resident" />;
}
