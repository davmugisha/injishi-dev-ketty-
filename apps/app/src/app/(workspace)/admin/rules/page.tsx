import { screens } from "@injishi/data";
import type {
  Catalog,
  FeatureFlag,
  LocaleString,
  MessageTemplate,
  PlatformSetting,
  PricePlan,
} from "@injishi/data/fixtures/platformops";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { AdminRulesView } from "@/features/platformops/AdminRulesView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.AdminRules.pageTitle };

export default async function AdminRulesPage() {
  await requirePersona("AdminRules");
  const [catalogs, flags, plans, strings, templates, config] = await Promise.all([
    getCollection<Catalog>("platformops.catalogs"),
    getCollection<FeatureFlag>("platformops.flags"),
    getCollection<PricePlan>("platformops.pricePlans"),
    getCollection<LocaleString>("platformops.strings"),
    getCollection<MessageTemplate>("platformops.templates"),
    getCollection<PlatformSetting>("platformops.config"),
  ]);
  return <AdminRulesView data={{ catalogs, flags, plans, strings, templates, config }} />;
}
