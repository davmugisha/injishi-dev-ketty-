import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { StaysCalendarView } from "@/features/pms/stays/StaysCalendarView";
import { requirePersona } from "@/lib/session";
import { staysActivity } from "@/server/stays/client";

export const metadata: Metadata = { title: screens.StaysCalendar.pageTitle };

/** Every booking and walk in of a stay business on one calendar, from last January to six weeks ahead. */
export default async function StaysCalendarPage() {
  await requirePersona("StaysCalendar");
  return <StaysCalendarView activity={await staysActivity()} />;
}

export const dynamic = "force-dynamic";
