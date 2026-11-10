/**
 * The Injishi staff sidebar (2026-10-30; overview, PSF, roles and audit 2026-11-09): only the screens that read real records, as few items as can
 * be, with the pages that belong together as tabs. A staffer whose role cannot read a page is refused by
 * the API; hiding an item is presentation only.
 */
import type { NavGroup } from "@injishi/data";

export function adminNav(): NavGroup[] {
  return [
    {
      label: null,
      items: [
        { id: "overview", label: "Overview", icon: "House", board: "AdminHome" },
        { id: "businesses", label: "Businesses", icon: "Briefcase", board: "AdminBusinesses" },
        { id: "people", label: "People", icon: "PersonsLock", board: "AdminPeople" },
        {
          id: "government",
          label: "Government",
          icon: "ShieldCheck",
          board: "AdminLeaders",
          tabs: [
            { id: "leaders", label: "Leaders and officers", board: "AdminLeaders" },
            { id: "coverage", label: "Coverage", board: "AdminCoverage" },
          ],
        },
        {
          id: "brokers",
          label: "Brokers",
          icon: "CreditCard",
          board: "AdminBrokerPlans",
          tabs: [
            { id: "subscriptions", label: "Subscriptions", board: "AdminBrokerPlans" },
            { id: "prices", label: "Plan prices", board: "AdminBrokerPrices" },
          ],
        },
        { id: "psf", label: "PSF", icon: "Persons", board: "AdminPsf" },
        { id: "money", label: "Money", icon: "Wallet", board: "AdminMoney" },
        { id: "support", label: "Support", icon: "Envelope", board: "AdminSupport" },
      ],
    },
    {
      label: "Access and records",
      items: [
        { id: "roles", label: "Staff roles", icon: "ShieldKeyhole", board: "AdminRoles" },
        { id: "audit", label: "Audit log", icon: "Clock", board: "AdminAudit" },
        { id: "settings", label: "Settings", icon: "Gear", board: "AdminRules" },
        {
          id: "health",
          label: "Health",
          icon: "AntennaSignal",
          board: "AdminHealth",
          tabs: [
            { id: "system", label: "System health", board: "AdminHealth" },
            { id: "insights", label: "Insights", board: "AdminInsights" },
            { id: "assistant", label: "Assistant usage", board: "AssistantUsage" },
          ],
        },
      ],
    },
  ];
}
