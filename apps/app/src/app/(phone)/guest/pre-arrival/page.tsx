import { screens } from "@injishi/data";
import type {
  ArrivalSlot,
  GuestBooking,
  GuestOption,
  IdDocumentType,
  IdPrivacyPoint,
  PreArrivalForm,
  PreArrivalNextStep,
} from "@injishi/data/fixtures/guest";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuestPreArrivalView, type PreArrivalStep } from "@/features/guest/GuestPreArrivalView";
import { requirePersona } from "@/lib/session";
import { getCollection, getDocument } from "@/server/data";

export const metadata: Metadata = { title: screens.GuestPreArrival.pageTitle };

const STEPS: PreArrivalStep[] = ["id", "arrival", "preferences", "contact", "done"];

export default async function GuestPreArrivalPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const persona = await requirePersona("GuestPreArrival");
  const [form, documents, privacy, slots, travelModes, pillows, diets, countries, next] = await Promise.all([
    getDocument<PreArrivalForm>("guest.preArrival", "BK-20431"),
    getCollection<IdDocumentType>("guest.idDocuments"),
    getCollection<IdPrivacyPoint>("guest.idPrivacy"),
    getCollection<ArrivalSlot>("guest.arrivalSlots"),
    getCollection<GuestOption>("guest.travelModes"),
    getCollection<GuestOption>("guest.pillows"),
    getCollection<GuestOption>("guest.diets"),
    getCollection<GuestOption>("guest.countries"),
    getCollection<PreArrivalNextStep>("guest.preArrivalNext"),
  ]);
  const booking = form ? await getDocument<GuestBooking>("guest.bookings", form.id) : undefined;
  if (!persona || !form || !booking || !documents.length || !slots.length) notFound();
  const { step } = await searchParams;
  return (
    <GuestPreArrivalView
      data={{ booking, form, documents, privacy, slots, travelModes, pillows, diets, countries, next }}
      step={STEPS.includes(step as PreArrivalStep) ? (step as PreArrivalStep) : "id"}
    />
  );
}
