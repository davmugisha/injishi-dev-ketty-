-- D23/D24 — the types the registration model needs.
--
-- WHY `org_registration_status` IS RECREATED RATHER THAN ALTERED:
-- `ALTER TYPE ... ADD VALUE` is legal inside a transaction, but Postgres then
-- refuses to USE the new value until that transaction commits:
--
--   unsafe use of new value "pending_payment" of enum type org_registration_status
--
-- `drizzle-kit migrate` applies every pending migration in ONE transaction, so
-- splitting the ADD VALUE into its own FILE does not help — 0006's
-- `SET DEFAULT 'pending_payment'` still lands in the same transaction and fails.
-- Renaming the old type and creating a new one sidesteps the rule entirely: a
-- type CREATEd inside a transaction may be used inside it.
--
-- `stored_object_kind` keeps its plain ADD VALUE because nothing writes the
-- literal 'certificate' during these migrations, so the restriction never bites.
CREATE TYPE "public"."gender" AS ENUM('female', 'male', 'other', 'prefer_not_to_say');--> statement-breakpoint
CREATE TYPE "public"."invoice_kind" AS ENUM('registration_fee', 'subscription');--> statement-breakpoint
CREATE TYPE "public"."org_certificate_kind" AS ENUM('rdb_grade', 'tourism_license', 'tax_clearance', 'fire_safety', 'health_inspection', 'other');--> statement-breakpoint
CREATE TYPE "public"."registration_business_type" AS ENUM('hospitality', 'residence', 'broker');--> statement-breakpoint
ALTER TYPE "public"."stored_object_kind" ADD VALUE 'certificate';--> statement-breakpoint
ALTER TABLE "orgs" ALTER COLUMN "registration_status" DROP DEFAULT;--> statement-breakpoint
ALTER TYPE "public"."org_registration_status" RENAME TO "org_registration_status_old";--> statement-breakpoint
CREATE TYPE "public"."org_registration_status" AS ENUM('pending_payment', 'submitted', 'tin_verified', 'field_verified', 'approved', 'active', 'rejected', 'suspended');--> statement-breakpoint
ALTER TABLE "orgs" ALTER COLUMN "registration_status" TYPE "public"."org_registration_status" USING "registration_status"::text::"public"."org_registration_status";--> statement-breakpoint
DROP TYPE "public"."org_registration_status_old";
