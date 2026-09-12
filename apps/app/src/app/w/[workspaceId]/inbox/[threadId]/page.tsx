import { AppShell } from "@/pms/components/app-shell";
import { Inbox } from "@/pms/screens/inbox";

/**
 * One conversation, at its own address.
 *
 * A thread is a record, so it gets a URL: a duty manager can send a colleague
 * the conversation rather than describing where it is. The list and the thread
 * sit side by side, so this renders the same screen with the thread selected
 * once `Conversation` reads the param.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  await params;
  return (
    <AppShell title="Inbox">
      <Inbox />
    </AppShell>
  );
}
