CREATE TYPE "public"."org_certificate_status" AS ENUM('requested', 'on_file');--> statement-breakpoint
ALTER TABLE "org_certificates" ADD COLUMN "property_id" uuid;--> statement-breakpoint
ALTER TABLE "org_certificates" ADD COLUMN "status" "org_certificate_status" DEFAULT 'on_file' NOT NULL;--> statement-breakpoint
ALTER TABLE "org_certificates" ADD COLUMN "follow_up" text;--> statement-breakpoint
ALTER TABLE "org_invitations" ADD COLUMN "invitee_name" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "branch_code" text;--> statement-breakpoint
ALTER TABLE "org_certificates" ADD CONSTRAINT "org_certificates_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "org_certificates_property_idx" ON "org_certificates" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "properties_org_branch_code_uk" ON "properties" USING btree ("org_id","branch_code") WHERE "properties"."branch_code" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_branch_code_ck" CHECK ("properties"."branch_code" ~ '^[A-Z]{2,4}$');