import { screens } from "@injishi/data";
import type { Kiosk } from "@injishi/data/fixtures/staff";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AttendanceKioskView, type KioskScreen } from "@/features/staff/AttendanceKioskView";
import { requireScreen } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.AttendanceKiosk.pageTitle };

const SCREENS: readonly KioskScreen[] = ["pin", "qr", "confirm", "done"];

/**
 * The clock-in kiosk. It is not paired with a property yet (see AttendanceKioskView), so it names no hotel and no
 * person: the sample kiosk row gives only its settings (how long it waits before going back to the start).
 */
export default async function AttendanceKioskPage({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string; offline?: string }>;
}) {
  await requireScreen("AttendanceKiosk");
  const [kiosk] = await getCollection<Kiosk>("staff.kiosks");
  if (!kiosk) notFound();
  const { screen, offline } = await searchParams;
  const initialScreen = SCREENS.find((s) => s === screen) ?? "pin";
  return <AttendanceKioskView kiosk={kiosk} initialScreen={initialScreen} offline={offline === "1"} />;
}
