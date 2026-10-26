import { screens } from "@injishi/data";
import type {
  BulkRoom,
  EvidenceLine,
  MakerCheckerRequest,
  PaymentStateCard,
  StateCopy,
  SubmissionStep,
  WriteOffReason,
} from "@injishi/data/fixtures/shared";
import type { Metadata } from "next";
import { StatesGalleryView } from "@/features/shared/StatesGalleryView";
import { requireScreen } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.StatesGallery.pageTitle };

/** Public gallery of payment, fiscal, submission, write-off, maker-checker and bulk states. */
export default async function StatesGalleryPage() {
  await requireScreen("StatesGallery");
  const [payments, fiscal, steps, outcomes, evidence, reasons, requests, rooms] = await Promise.all([
    getCollection<PaymentStateCard>("shared.paymentStates"),
    getCollection<StateCopy>("shared.fiscalStates"),
    getCollection<SubmissionStep>("shared.submissionSteps"),
    getCollection<StateCopy>("shared.submissionOutcomes"),
    getCollection<EvidenceLine>("shared.checkoutEvidence"),
    getCollection<WriteOffReason>("shared.writeOffReasons"),
    getCollection<MakerCheckerRequest>("shared.makerCheckerRequests"),
    getCollection<BulkRoom>("shared.bulkRooms"),
  ]);
  return <StatesGalleryView data={{ payments, fiscal, steps, outcomes, evidence, reasons, requests, rooms }} />;
}
