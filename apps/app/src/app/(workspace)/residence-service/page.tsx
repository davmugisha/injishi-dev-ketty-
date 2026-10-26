import { screens } from "@injishi/data";
import type {
  AccessRequest,
  PreregisteredVisitor,
  ResidenceBlock,
  ResidenceUnit,
  ServiceTicket,
  VisitorLogEntry,
} from "@injishi/data/fixtures/residence";
import type { Metadata } from "next";
import { ResidenceServiceView } from "@/features/residence/ResidenceServiceView";
import { requirePersona } from "@/lib/session";
import { getCollection, requestContext } from "@/server/data";
import { residenceBuilding } from "@/server/sources/residence";

export const metadata: Metadata = { title: screens.ResidenceService.pageTitle };

export default async function ResidenceServicePage() {
  const persona = await requirePersona("ResidenceService");
  const [tickets, requests, visitors, log, units, blocks] = await Promise.all([
    getCollection<ServiceTicket>("residence.tickets"),
    getCollection<AccessRequest>("residence.accessRequests"),
    getCollection<PreregisteredVisitor>("residence.visitors"),
    getCollection<VisitorLogEntry>("residence.visitorLog"),
    getCollection<ResidenceUnit>("residence.units"),
    getCollection<ResidenceBlock>("residence.blocks"),
  ]);
  const building = residenceBuilding(await requestContext());
  return (
    <ResidenceServiceView
      persona={persona}
      data={{ tickets, requests, visitors, log, units, blocks }}
      building={building}
    />
  );
}
