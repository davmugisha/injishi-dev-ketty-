import { TabStack } from "@/proto/app-stack";

// Deep links into this tab keep its root underneath, so back lands on the tab, not out of the app.
export const unstable_settings = { anchor: "index" };

export default TabStack;
