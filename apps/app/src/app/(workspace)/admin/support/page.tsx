import { screens } from "@injishi/data";
import type {
  Announcement,
  Dispute,
  ModerationReport,
  SupportTicket,
  TicketMessage,
  TranscriptMessage,
} from "@injishi/data/fixtures/admin";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { AdminSupportView } from "@/features/admin/AdminSupportView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.AdminSupport.pageTitle };

export default async function AdminSupportPage() {
  const persona = await requirePersona("AdminSupport");
  const [tickets, messages, transcripts, reports, disputes, announcements] = await Promise.all([
    getCollection<SupportTicket>("admin.tickets"),
    getCollection<TicketMessage>("admin.ticketMessages"),
    getCollection<TranscriptMessage>("admin.handoffTranscripts"),
    getCollection<ModerationReport>("admin.moderationReports"),
    getCollection<Dispute>("admin.disputes"),
    getCollection<Announcement>("admin.announcements"),
  ]);
  return (
    <AdminSupportView persona={persona} data={{ tickets, messages, transcripts, reports, disputes, announcements }} />
  );
}
