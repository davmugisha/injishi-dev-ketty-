import { screens } from "@injishi/data";
import type {
  SalesEventsBeoFigure,
  SalesEventsBeoNote,
  SalesEventsDeposit,
  SalesEventsHandoffStep,
  SalesEventsLead,
  SalesEventsQuoteLine,
  SalesEventsSeller,
  SalesEventsSpace,
  SalesEventsSpaceBooking,
  SalesEventsStage,
  SalesEventsTiming,
} from "@injishi/data/fixtures/commercial";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { SalesEventsView } from "@/features/commercial/SalesEventsView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.SalesEvents.pageTitle };

export default async function SalesEventsPage() {
  const persona = await requirePersona("SalesEvents");
  const [stages, leads, spaces, bookings, timings, beoFigures, beoNotes, quoteLines, sellers, deposits, handoffSteps] =
    await Promise.all([
      getCollection<SalesEventsStage>("commercial.salesEventsStages"),
      getCollection<SalesEventsLead>("commercial.salesEventsLeads"),
      getCollection<SalesEventsSpace>("commercial.salesEventsSpaces"),
      getCollection<SalesEventsSpaceBooking>("commercial.salesEventsSpaceBookings"),
      getCollection<SalesEventsTiming>("commercial.salesEventsTimings"),
      getCollection<SalesEventsBeoFigure>("commercial.salesEventsBeoFigures"),
      getCollection<SalesEventsBeoNote>("commercial.salesEventsBeoNotes"),
      getCollection<SalesEventsQuoteLine>("commercial.salesEventsQuoteLines"),
      getCollection<SalesEventsSeller>("commercial.salesEventsSellers"),
      getCollection<SalesEventsDeposit>("commercial.salesEventsDeposits"),
      getCollection<SalesEventsHandoffStep>("commercial.salesEventsHandoffSteps"),
    ]);
  return (
    <SalesEventsView
      persona={persona}
      data={{
        stages,
        leads,
        spaces,
        bookings,
        timings,
        beoFigures,
        beoNotes,
        quoteLines,
        sellers,
        deposits,
        handoffSteps,
      }}
    />
  );
}
