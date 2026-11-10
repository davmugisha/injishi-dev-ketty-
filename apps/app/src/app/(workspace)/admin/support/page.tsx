import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { Refused } from "@/features/admin/people/Refused";
import { type SupportTab, SupportView } from "@/features/admin/support/support-view";
import { requirePersona } from "@/lib/session";
import { type Search, wordOf } from "@/server/admin/list";
import { compliance, moderation } from "@/server/admin/support";
import { ApiError } from "@/server/api";

export const metadata: Metadata = { title: screens.AdminSupport.pageTitle };

const TABS = ["tickets", "escalations", "reviews", "privacy"] as const;

/** A read this staffer's role may not make shows its tab as refused rather than failing the page. */
const maybe = <T,>(read: Promise<T>): Promise<T | null> =>
  read.catch((error) => {
    if (error instanceof ApiError && error.forbidden) return null;
    throw error;
  });

/** Support (2026-11-09, real records): tickets, escalations, reviews to moderate, privacy requests. */
export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePersona("AdminSupport");
  const sp = await searchParams;
  const tab: SupportTab = wordOf(sp.tab, TABS) ?? "tickets";
  try {
    const [mod, comp] = await Promise.all([
      tab === "privacy" ? Promise.resolve(null) : maybe(moderation()),
      tab === "privacy" ? maybe(compliance()) : Promise.resolve(null),
    ]);
    return <SupportView tab={tab} moderation={mod} compliance={comp} />;
  } catch (error) {
    if (error instanceof ApiError && error.forbidden) return <Refused code={error.code} />;
    throw error;
  }
}

export const dynamic = "force-dynamic";
