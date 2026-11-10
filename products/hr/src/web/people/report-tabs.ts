/** The parts of the HR report, in tab order: the page reads `?tab=` against these. */
export const REPORT_TABS = ["attendance", "leave", "staff", "pay", "requests"] as const;
export type ReportTab = (typeof REPORT_TABS)[number];
