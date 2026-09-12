CREATE TYPE "public"."identity_document_status" AS ENUM('active', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."kyc_status" AS ENUM('unverified', 'pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."oversight_role" AS ENUM('tax_compliance_officer', 'business_field_verifier', 'business_approver');--> statement-breakpoint
CREATE TYPE "public"."oversight_scope_level" AS ENUM('country', 'province', 'district');--> statement-breakpoint
ALTER TYPE "public"."org_registration_status" ADD VALUE 'field_verified' BEFORE 'active';--> statement-breakpoint
ALTER TYPE "public"."org_registration_status" ADD VALUE 'approved' BEFORE 'active';--> statement-breakpoint
CREATE TABLE "government_bodies" (
	"code" text PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_rw" text NOT NULL,
	"abbreviation" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"document_type" "document_type" NOT NULL,
	"document_number" text NOT NULL,
	"issuing_country" char(2) DEFAULT 'RW' NOT NULL,
	"status" "identity_document_status" DEFAULT 'active' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "identity_documents_type_number_country_uk" UNIQUE("document_type","document_number","issuing_country"),
	CONSTRAINT "identity_documents_account_type_shape" CHECK ("identity_documents"."document_type" IN ('national_id', 'passport'))
);
--> statement-breakpoint
CREATE TABLE "oversight_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"oversight_role" "oversight_role" NOT NULL,
	"government_body_code" text NOT NULL,
	"government_title" text,
	"scope_level" "oversight_scope_level" NOT NULL,
	"province_id" integer,
	"district_id" integer,
	"assigned_by_user_id" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "oversight_assignments_scope_shape" CHECK (("oversight_assignments"."scope_level" = 'country' AND "oversight_assignments"."province_id" IS NULL AND "oversight_assignments"."district_id" IS NULL)
          OR ("oversight_assignments"."scope_level" = 'province' AND "oversight_assignments"."province_id" IS NOT NULL AND "oversight_assignments"."district_id" IS NULL)
          OR ("oversight_assignments"."scope_level" = 'district' AND "oversight_assignments"."district_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "verified_identities" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"kyc_status" "kyc_status" DEFAULT 'unverified' NOT NULL,
	"legal_full_name" text,
	"dob" date,
	"verified_method" text,
	"verified_by_user_id" uuid,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Decision B: rename the enum value in place (data-safe). drizzle-kit's default
-- drop/recreate strategy would fail the USING cast on any existing 'local_gov'
-- row; RENAME VALUE preserves data and reaches the same end state recorded in
-- the 0001 snapshot.
ALTER TYPE "public"."global_role" RENAME VALUE 'local_gov' TO 'gov_oversight';--> statement-breakpoint
ALTER TABLE "identity_documents" ADD CONSTRAINT "identity_documents_identity_id_verified_identities_user_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."verified_identities"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oversight_assignments" ADD CONSTRAINT "oversight_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oversight_assignments" ADD CONSTRAINT "oversight_assignments_government_body_code_government_bodies_code_fk" FOREIGN KEY ("government_body_code") REFERENCES "public"."government_bodies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oversight_assignments" ADD CONSTRAINT "oversight_assignments_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oversight_assignments" ADD CONSTRAINT "oversight_assignments_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oversight_assignments" ADD CONSTRAINT "oversight_assignments_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verified_identities" ADD CONSTRAINT "verified_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verified_identities" ADD CONSTRAINT "verified_identities_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "identity_documents_identity_idx" ON "identity_documents" USING btree ("identity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "identity_documents_primary_uk" ON "identity_documents" USING btree ("identity_id") WHERE "identity_documents"."is_primary";--> statement-breakpoint
CREATE INDEX "oversight_assignments_user_idx" ON "oversight_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oversight_assignments_body_idx" ON "oversight_assignments" USING btree ("government_body_code");--> statement-breakpoint
CREATE UNIQUE INDEX "oversight_assignments_active_uk" ON "oversight_assignments" USING btree ("user_id","oversight_role","scope_level","province_id","district_id") WHERE "oversight_assignments"."revoked_at" IS NULL;