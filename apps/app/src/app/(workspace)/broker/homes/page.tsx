import { redirect } from "next/navigation";

type Params = Record<string, string | undefined>;

/** Find homes now lives on `/broker?tab=homes` with Overview beside it. */
export default async function BrokerHomesRedirect({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const q = new URLSearchParams();
  q.set("tab", "homes");
  for (const [k, v] of Object.entries(params)) {
    if (v && k !== "tab") q.set(k, v);
  }
  redirect(`/broker?${q.toString()}`);
}
