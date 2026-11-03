import { AppStack } from "@/proto/app-stack";

// A deep link to a screen or sheet of this app keeps the tabs underneath, so back stays in the app.
export const unstable_settings = { anchor: "(tabs)" };

/** The maintenance technician app: its tabs, the screens that cover the tab bar, and its sheets. */
export default function TechnicianLayout() {
  return <AppStack app="technician" />;
}
