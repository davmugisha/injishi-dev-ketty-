import { redirect } from "next/navigation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Plan lives on Account as a dialog (`?plan=1`), Cursor-style. */
export default async function BrokerPlanRedirect({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const { payment } = await searchParams;
  const q = new URLSearchParams({ plan: "1" });
  if (payment && UUID.test(payment)) q.set("payment", payment);
  redirect(`/account?${q.toString()}`);
}
