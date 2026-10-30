import { redirect } from "next/navigation";

import { CONSOLE_BASE } from "@/pms/oversight/lib/nav";

/** The console's bare segment has no screen of its own; the queue is the job. */
export default async function Page({
  params,
}: {
  params: Promise<{ console: string }>;
}) {
  const { console: segment } = await params;
  redirect(`${CONSOLE_BASE}/${segment}/queue`);
}
