-- Rentals P3.4: messages between a landlord and a tenant.
--
-- `threads_lease_uk`: one conversation per lease. `messages.maintenance_ticket_id`: the fault a line is
-- about. `message_attachments.filename` and `position`: a document's name and the order files were sent
-- in. The voice note cap goes from 60 to 120 seconds. `thread_digests`: the unread-message emails, one
-- row per conversation and side, so a reader gets one email for what waits, never one per message.
-- Nothing here uses a value an ALTER TYPE ... ADD VALUE of this run added.
CREATE TABLE "thread_digests" (
	"thread_id" uuid NOT NULL,
	"side" text NOT NULL,
	"notified_through" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	CONSTRAINT "thread_digests_thread_id_side_pk" PRIMARY KEY("thread_id","side"),
	CONSTRAINT "thread_digests_side" CHECK ("thread_digests"."side" IN ('landlord', 'tenant'))
);
--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_voice_duration_cap";--> statement-breakpoint
ALTER TABLE "message_attachments" ADD COLUMN "filename" text;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "maintenance_ticket_id" uuid;--> statement-breakpoint
ALTER TABLE "thread_digests" ADD CONSTRAINT "thread_digests_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_maintenance_ticket_id_maintenance_tickets_id_fk" FOREIGN KEY ("maintenance_ticket_id") REFERENCES "public"."maintenance_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_thread_created_idx" ON "messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "threads_lease_uk" ON "threads" USING btree ("lease_id") WHERE "threads"."lease_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_voice_duration_cap" CHECK ("messages"."voice_duration_s" IS NULL OR "messages"."voice_duration_s" BETWEEN 1 AND 120);
