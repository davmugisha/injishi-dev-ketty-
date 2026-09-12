import { InboxScreen } from "@/components/app/inbox-screen";

export const metadata = { title: "Messages" };

/**
 * The guest's inbox (ADR-018, move 4; ADR-032 for the surface).
 *
 * One inbox per app, and this is the GUEST's. An operator's threads stay in the
 * operator app: threads are scoped per workspace, and a receptionist should not
 * be bounced out of their shift to answer a guest. A notification about an
 * operator thread links out rather than rendering here.
 *
 * **It reads real conversations now.** This page was a hardcoded empty state
 * until `GET /api/v1/me/threads` existed; the work is in `<InboxScreen/>`.
 */
export default function Page() {
  return (
    <div className="min-h-0 grow scrollbar overflow-y-auto">
      <InboxScreen />
    </div>
  );
}
