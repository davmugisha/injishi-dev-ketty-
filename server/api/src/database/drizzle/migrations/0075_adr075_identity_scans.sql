-- ADR-075 A1, the identity scan (AC-4 to AC-6). The ID is scanned, front then a selfie, for a National ID and a
-- passport alike; no code is sent to any phone, so the SMS lookup's challenges go (AC-4). Every attempt is kept,
-- photos and all, for the PSF officer (D-n), and the draft counts the tries in a column only the server writes
-- (D-m).
--
-- Written by hand, as 0074 was: generating would also drop the waitlist drift 0074 describes.
CREATE TYPE "public"."identity_scan_outcome" AS ENUM('machine_passed', 'machine_failed', 'manual_needed');--> statement-breakpoint
CREATE TYPE "public"."identity_adapter_mode" AS ENUM('mock', 'live', 'off');--> statement-breakpoint
CREATE TABLE "identity_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"document_type" "document_type" NOT NULL,
	"front_object_key" text NOT NULL,
	"selfie_object_key" text NOT NULL,
	"outcome" "identity_scan_outcome" NOT NULL,
	"reason" text,
	"adapter_mode" "identity_adapter_mode" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "identity_scans_document_type_ck" CHECK ("identity_scans"."document_type" in ('national_id', 'passport')),
	CONSTRAINT "identity_scans_reason_shape" CHECK (("identity_scans"."outcome" = 'machine_failed') = ("identity_scans"."reason" is not null))
);
--> statement-breakpoint
ALTER TABLE "identity_scans" ADD CONSTRAINT "identity_scans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "identity_scans_user_created_idx" ON "identity_scans" USING btree ("user_id","created_at");--> statement-breakpoint
-- A draft row may now hold only the server's checks, before the browser saved anything.
ALTER TABLE "registration_drafts" ALTER COLUMN "payload" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "registration_drafts" ADD COLUMN "checks" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
DROP TABLE "identity_challenges" CASCADE;
