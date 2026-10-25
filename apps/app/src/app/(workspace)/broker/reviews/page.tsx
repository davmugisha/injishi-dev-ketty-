import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { ReviewsView } from "@/features/broker/ReviewsView";
import { NotABroker } from "@/features/broker/shared";
import { requirePersona } from "@/lib/session";
import { brokerReviews, brokerScope } from "@/server/broker/client";

export const metadata: Metadata = { title: screens.BrokerReviews.pageTitle };

export default async function BrokerReviewsPage() {
  await requirePersona("BrokerReviews");
  if (!(await brokerScope())) return <NotABroker title="Reviews" />;
  return <ReviewsView data={await brokerReviews()} />;
}

export const dynamic = "force-dynamic";
