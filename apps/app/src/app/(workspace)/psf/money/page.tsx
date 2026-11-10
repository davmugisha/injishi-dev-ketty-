import type { PsfMoneyView } from "@injishi/contracts";
import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { PsfMoneyScreen } from "@/features/oversight/psf-money-view";
import { requirePersona } from "@/lib/session";
import { requestContext } from "@/server/data";

export const metadata: Metadata = { title: screens.PsfMoney.pageTitle };

const isDay = (v: string | undefined): v is string => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));

/** Who PSF's fees are for: the headquarters share, and each region's and district's. */
export default async function PsfMoneyPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requirePersona("PsfMoney");
  const { from, to } = await searchParams;
  const query = new URLSearchParams();
  if (isDay(from)) query.set("from", from);
  if (isDay(to)) query.set("to", to);
  const ctx = await requestContext();
  const view = await ctx.api.get<PsfMoneyView>(`/api/v1/oversight/psf/money${query.size ? `?${query}` : ""}`);
  return <PsfMoneyScreen view={view} />;
}
