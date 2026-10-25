import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { PlanView } from "@/features/broker/PlanView";
import { NotABroker } from "@/features/broker/shared";
import { requirePersona } from "@/lib/session";
import { brokerPlan, brokerScope } from "@/server/broker/client";

export const metadata: Metadata = { title: screens.BrokerPlan.pageTitle };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The broker's plan; `?payment=` (back from the card page) opens that payment's wait. */
export default async function BrokerPlanPage({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  await requirePersona("BrokerPlan");
  if (!(await brokerScope())) return <NotABroker title="Plan" />;
  const [data, { payment }] = await Promise.all([brokerPlan(), searchParams]);
  return <PlanView data={data} openPaymentId={payment && UUID.test(payment) ? payment : null} />;
}

export const dynamic = "force-dynamic";
