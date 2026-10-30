/**
 * The Injishi staff sidebar (2026-10-30): only the screens that read real records, as few items as can
 * be, with the pages that belong together as tabs. A staffer whose role cannot read a page is refused by
 * the API; hiding an item is presentation only.
 */
import type { NavGroup } from "@injishi/data";

export function adminNav(): NavGroup[] {
  return [
    {
      label: null,
      items: [
        { id: "businesses", label: "Businesses", icon: "Briefcase", board: "AdminBusinesses" },
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
      ],
    },
  ];
}
