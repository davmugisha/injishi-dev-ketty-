import { screens } from "@injishi/data";
import type {
  AccessRequest,
  PreregisteredVisitor,
  ResidenceUnit,
  ServiceTicket,
  VisitorLogEntry,
} from "@injishi/data/fixtures/residence";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { ResidenceServiceView } from "@/features/residence/ResidenceServiceView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.ResidenceService.pageTitle };

export default async function ResidenceServicePage() {
  const persona = await requirePersona("ResidenceService");
  const [tickets, requests, visitors, log, units] = await Promise.all([
    getCollection<ServiceTicket>("residence.tickets"),
    getCollection<AccessRequest>("residence.accessRequests"),
    getCollection<PreregisteredVisitor>("residence.visitors"),
    getCollection<VisitorLogEntry>("residence.visitorLog"),
    getCollection<ResidenceUnit>("residence.units"),
  ]);
  return <ResidenceServiceView persona={persona} data={{ tickets, requests, visitors, log, units }} />;
}
