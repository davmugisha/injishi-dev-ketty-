import type { MyHr } from "@injishi/data/fixtures/shared";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ScanClock } from "@/features/me/ScanClock";
import { requireScreen } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: "Clock in", robots: { index: false, follow: false } };

/**
 * /clock?c=…: where a phone lands after scanning the code on an entrance tablet (clock-in rules).
 * The code is good for 90 seconds, so somebody who has to sign in first comes back here without it
 * and is asked to scan again.
 */
export default async function ClockPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  if (!(await requireScreen("MyHr"))) redirect(`/sign-in?next=${encodeURIComponent("/clock")}`);
  const [data] = await getCollection<MyHr>("shared.myHr");
  const { c } = await searchParams;
  return <ScanClock code={c?.trim() ?? ""} data={data ?? null} />;
}
