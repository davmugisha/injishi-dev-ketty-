import { screens } from "@injishi/data";
import type { InboxFigure, InboxNotification, InboxTask } from "@injishi/data/fixtures/shared";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { NotificationsView } from "@/features/shared/NotificationsView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.Notifications.pageTitle };

/** Notification inbox. The drawer opens on All; each person only sees notes addressed to them. */
export default async function NotificationsPage() {
  const persona = await requirePersona("Notifications");
  const [figures, tasks, notes] = await Promise.all([
    getCollection<InboxFigure>("shared.inboxFigures"),
    getCollection<InboxTask>("shared.inboxTasks"),
    getCollection<InboxNotification>("shared.inboxNotifications"),
  ]);
  return (
    <NotificationsView
      persona={persona}
      data={{ figures, tasks, notes: notes.filter((n) => n.recipients.includes(persona.id)) }}
    />
  );
}
