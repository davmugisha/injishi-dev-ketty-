/**
 * The list of PSF reports, shared by the report page (a server component) and the report screen: a
 * module of its own, because a server component reads a client module's exports as references only.
 */
/** The PSF District Manager's reports, one page each (2026-10-30). */
export const PSF_REPORTS = [
  {
    id: "overview",
    title: "Overview",
    blurb: "What waits on you, and the headline of every report.",
  },
  {
    id: "membership",
    title: "Membership activity",
    blurb: "What happened over the period you pick: applications to PSF, the decisions on them and the fees they brought.",
  },
  {
    id: "approvals",
    title: "Business approvals",
    blurb: "Businesses registering on Injishi in your region: where each stands and every decision taken.",
  },
  {
    id: "economy",
    title: "District economy",
    blurb: "What Injishi's own records show: the businesses open, and the stays they sold.",
  },
  {
    id: "members",
    title: "Member register",
    blurb: "Where things stand today, whatever the period: PSF's members, their tiers, and the renewals coming up.",
  },
] as const;
export type PsfReportId = (typeof PSF_REPORTS)[number]["id"];
