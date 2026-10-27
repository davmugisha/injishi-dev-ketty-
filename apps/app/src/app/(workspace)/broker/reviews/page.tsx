import { screenHref } from "@injishi/data";
import { redirect } from "next/navigation";

/** Reviews live on the earnings page now (2026-10-27): an old link opens it at the reviews. */
export default function BrokerReviewsPage() {
  redirect(`${screenHref("BrokerEarnings")}#reviews`);
}
