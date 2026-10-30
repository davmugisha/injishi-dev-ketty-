ALTER TYPE "public"."identity_adapter_mode" ADD VALUE 'sandbox' BEFORE 'live';--> statement-breakpoint
ALTER TABLE "identity_scans" ALTER COLUMN "front_object_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "identity_scans" ADD COLUMN "check_kind" text DEFAULT 'document_scan' NOT NULL;--> statement-breakpoint
ALTER TABLE "identity_scans" ADD CONSTRAINT "identity_scans_check_kind_ck" CHECK ("identity_scans"."check_kind" in ('document_scan', 'national_id_registry'));--> statement-breakpoint
ALTER TABLE "identity_scans" ADD CONSTRAINT "identity_scans_front_shape" CHECK (("identity_scans"."check_kind" = 'document_scan') = ("identity_scans"."front_object_key" is not null) and ("identity_scans"."check_kind" = 'document_scan' or "identity_scans"."document_type" = 'national_id'));