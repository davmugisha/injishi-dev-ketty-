/** Me's tabs, in order. Kept apart from the client view so the server page can read them too. */
export const ME_TABS = ["overview", "pay", "leave", "time", "file"] as const;
export type MeTab = (typeof ME_TABS)[number];
