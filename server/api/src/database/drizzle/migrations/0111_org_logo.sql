-- A BUSINESS LOGO (2026-10-23). Optional, given on the public PSF form and
-- printed on the membership certificate. A new stored object kind, and the
-- key on the business.
ALTER TYPE "public"."stored_object_kind" ADD VALUE IF NOT EXISTS 'org_logo';--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "logo_object_key" text;--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_logo_object_key_stored_objects_object_key_fk" FOREIGN KEY ("logo_object_key") REFERENCES "public"."stored_objects"("object_key") ON DELETE no action ON UPDATE no action;