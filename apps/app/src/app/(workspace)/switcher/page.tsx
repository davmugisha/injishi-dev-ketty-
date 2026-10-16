import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { BusinessSwitcher } from "@/components/shell/BusinessSwitcher";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.BusinessSwitcher.pageTitle };

/** The business and branch switcher on its own (artifact: BusinessSwitcher.dc.html), open by default. */
export default async function SwitcherPage() {
  const persona = await requirePersona("BusinessSwitcher");
  return (
    <div className="p-4">
      <BusinessSwitcher persona={persona} defaultOpen inline />
    </div>
  );
}
