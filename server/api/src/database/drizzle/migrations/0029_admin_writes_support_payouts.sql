ALTER TYPE "public"."audit_subject_type" ADD VALUE 'broker';--> statement-breakpoint
ALTER TYPE "public"."audit_subject_type" ADD VALUE 'guest_stay';--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "settled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "failure_reason" text;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "message" text;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "contact_name" text;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "contact_phone" text;