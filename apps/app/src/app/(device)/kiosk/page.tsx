import { type PersonaId, personas, screens } from "@injishi/data";
import type { Kiosk, StaffProfile } from "@injishi/data/fixtures/staff";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AttendanceKioskView, type KioskScreen } from "@/features/staff/AttendanceKioskView";
import { requireScreen } from "@/lib/session";
import { getCollection, getDocument } from "@/server/data";

export const metadata: Metadata = { title: screens.AttendanceKiosk.pageTitle };

const SCREENS: readonly KioskScreen[] = ["pin", "qr", "confirm", "done"];

export default async function AttendanceKioskPage({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string; offline?: string }>;
}) {
  await requireScreen("AttendanceKiosk");
  const [kiosk] = await getCollection<Kiosk>("staff.kiosks");
  if (!kiosk) notFound();
  const profile = await getDocument<StaffProfile>("staff.profiles", kiosk.demoStaff);
  const person = personas[kiosk.demoStaff as PersonaId];
  if (!profile || !person) notFound();
  const { screen, offline } = await searchParams;
  const initialScreen = SCREENS.find((s) => s === screen) ?? "pin";
  return (
    <AttendanceKioskView
      kiosk={kiosk}
      staff={{ name: person.name, firstName: person.firstName, profile }}
      initialScreen={initialScreen}
      offline={offline === "1"}
    />
  );
}
