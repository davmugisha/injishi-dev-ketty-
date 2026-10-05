CREATE TYPE "public"."hr_audience" AS ENUM('all', 'targeted');--> statement-breakpoint
CREATE TYPE "public"."hr_disciplinary_kind" AS ENUM('warning', 'suspension', 'dismissal');--> statement-breakpoint
CREATE TYPE "public"."hr_document_status" AS ENUM('requested', 'submitted', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."hr_document_version_status" AS ENUM('submitted', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."hr_length_unit" AS ENUM('days', 'hours');--> statement-breakpoint
CREATE TYPE "public"."hr_marital_status" AS ENUM('single', 'married', 'divorced', 'widowed');--> statement-breakpoint
CREATE TYPE "public"."hr_pay_account_kind" AS ENUM('bank', 'momo');--> statement-breakpoint
CREATE TYPE "public"."hr_pay_account_status" AS ENUM('active', 'retired');--> statement-breakpoint
CREATE TYPE "public"."hr_publish_status" AS ENUM('published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."hr_tag_tone" AS ENUM('neutral', 'info', 'ok', 'warn', 'bad');--> statement-breakpoint
ALTER TYPE "public"."stored_object_kind" ADD VALUE 'staff_photo';--> statement-breakpoint
ALTER TYPE "public"."stored_object_kind" ADD VALUE 'staff_document';--> statement-breakpoint
ALTER TYPE "public"."stored_object_kind" ADD VALUE 'hr_attachment';--> statement-breakpoint
CREATE TABLE "employee_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" "hr_catalog_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disciplinary_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"type_id" uuid NOT NULL,
	"description" text NOT NULL,
	"unit" "hr_length_unit",
	"length" integer,
	"starts_on" date NOT NULL,
	"file_key" text,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "disciplinary_actions_length_ck" CHECK (("disciplinary_actions"."unit" IS NULL) = ("disciplinary_actions"."length" IS NULL) AND ("disciplinary_actions"."length" IS NULL OR "disciplinary_actions"."length" > 0))
);
--> statement-breakpoint
CREATE TABLE "disciplinary_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"title" text NOT NULL,
	"kind" "hr_disciplinary_kind" NOT NULL,
	"status" "hr_catalog_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"formats" text[] NOT NULL,
	"max_mb" integer NOT NULL,
	"due_on" date,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_requests_max_mb_ck" CHECK ("document_requests"."max_mb" BETWEEN 1 AND 10),
	CONSTRAINT "document_requests_formats_ck" CHECK (cardinality("document_requests"."formats") >= 1 AND "document_requests"."formats" <@ ARRAY['pdf','jpg','png','heic']::text[])
);
--> statement-breakpoint
CREATE TABLE "employee_document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"file_key" text NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "hr_document_version_status" DEFAULT 'submitted' NOT NULL,
	"reject_reason" text,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "employee_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"request_id" uuid,
	"title" text NOT NULL,
	"status" "hr_document_status" DEFAULT 'requested' NOT NULL,
	"reject_reason" text,
	"issued_on" date,
	"expires_on" date,
	"remind_days_before" integer,
	"reminded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employee_documents_remind_ck" CHECK ("employee_documents"."remind_days_before" IS NULL OR "employee_documents"."remind_days_before" BETWEEN 0 AND 365),
	CONSTRAINT "employee_documents_dates_ck" CHECK ("employee_documents"."issued_on" IS NULL OR "employee_documents"."expires_on" IS NULL OR "employee_documents"."expires_on" >= "employee_documents"."issued_on"),
	CONSTRAINT "employee_documents_reject_ck" CHECK (("employee_documents"."status" = 'rejected') = ("employee_documents"."reject_reason" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "employee_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"body" text NOT NULL,
	"file_keys" text[] DEFAULT '{}'::text[] NOT NULL,
	"author_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_pay_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"kind" "hr_pay_account_kind" NOT NULL,
	"bank_name" text,
	"account_number" text,
	"branch_name" text,
	"momo_phone" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"status" "hr_pay_account_status" DEFAULT 'active' NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employee_pay_accounts_kind_ck" CHECK (("employee_pay_accounts"."kind" = 'bank' AND "employee_pay_accounts"."bank_name" IS NOT NULL AND "employee_pay_accounts"."account_number" IS NOT NULL AND "employee_pay_accounts"."momo_phone" IS NULL)
        OR ("employee_pay_accounts"."kind" = 'momo' AND "employee_pay_accounts"."momo_phone" IS NOT NULL AND "employee_pay_accounts"."bank_name" IS NULL AND "employee_pay_accounts"."account_number" IS NULL)),
	CONSTRAINT "employee_pay_accounts_primary_active_ck" CHECK (NOT ("employee_pay_accounts"."is_primary" AND "employee_pay_accounts"."status" = 'retired'))
);
--> statement-breakpoint
CREATE TABLE "employee_tag_links" (
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employee_tag_links_pk" PRIMARY KEY("employee_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "employee_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"title" text NOT NULL,
	"tone" "hr_tag_tone" DEFAULT 'neutral' NOT NULL,
	"status" "hr_catalog_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_settings" (
	"org_id" uuid PRIMARY KEY NOT NULL,
	"employee_number_prefix" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_settings_prefix_ck" CHECK ("hr_settings"."employee_number_prefix" IS NULL OR "hr_settings"."employee_number_prefix" ~ '^[A-Z0-9-]{1,8}$')
);
--> statement-breakpoint
CREATE TABLE "staff_announcement_audiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"announcement_id" uuid NOT NULL,
	"department_id" uuid,
	"job_position_id" uuid,
	"employee_id" uuid,
	CONSTRAINT "staff_announcement_audiences_one_ck" CHECK (num_nonnulls("staff_announcement_audiences"."department_id", "staff_announcement_audiences"."job_position_id", "staff_announcement_audiences"."employee_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "staff_announcement_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"announcement_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_announcement_views" (
	"org_id" uuid NOT NULL,
	"announcement_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_announcement_views_pk" PRIMARY KEY("announcement_id","employee_id")
);
--> statement-breakpoint
CREATE TABLE "staff_announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"file_keys" text[] DEFAULT '{}'::text[] NOT NULL,
	"audience" "hr_audience" DEFAULT 'all' NOT NULL,
	"expires_on" date,
	"comments_allowed" boolean DEFAULT true NOT NULL,
	"status" "hr_publish_status" DEFAULT 'published' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"file_keys" text[] DEFAULT '{}'::text[] NOT NULL,
	"audience" "hr_audience" DEFAULT 'all' NOT NULL,
	"status" "hr_publish_status" DEFAULT 'published' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_policy_audiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"department_id" uuid,
	"job_position_id" uuid,
	"employee_id" uuid,
	CONSTRAINT "staff_policy_audiences_one_ck" CHECK (num_nonnulls("staff_policy_audiences"."department_id", "staff_policy_audiences"."job_position_id", "staff_policy_audiences"."employee_id") = 1)
);
--> statement-breakpoint
DROP INDEX "employees_membership_uk";--> statement-breakpoint
DROP INDEX "employees_id_document_uk";--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "photo_key" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "marital_status" "hr_marital_status";--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "children_count" integer;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "village_id" integer;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "street" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "emergency_name" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "emergency_phone" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "emergency_relation" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "qualification" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "prior_experience_years" integer;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "employee_type_id" uuid;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "previous_employee_id" uuid;--> statement-breakpoint
-- By hand: a NOT NULL column cannot be added to a table with rows, so it is added,
-- backfilled from the hire date, then made NOT NULL. Regenerating this file
-- writes the single NOT NULL statement again; put these three back.
ALTER TABLE "employees" ADD COLUMN "service_from" date;--> statement-breakpoint
UPDATE "employees" SET "service_from" = "hired_on";--> statement-breakpoint
ALTER TABLE "employees" ALTER COLUMN "service_from" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_types" ADD CONSTRAINT "employee_types_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disciplinary_actions" ADD CONSTRAINT "disciplinary_actions_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disciplinary_actions" ADD CONSTRAINT "disciplinary_actions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disciplinary_actions" ADD CONSTRAINT "disciplinary_actions_type_id_disciplinary_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."disciplinary_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disciplinary_actions" ADD CONSTRAINT "disciplinary_actions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disciplinary_types" ADD CONSTRAINT "disciplinary_types_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_document_versions" ADD CONSTRAINT "employee_document_versions_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_document_versions" ADD CONSTRAINT "employee_document_versions_document_id_employee_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."employee_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_document_versions" ADD CONSTRAINT "employee_document_versions_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_document_versions" ADD CONSTRAINT "employee_document_versions_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_request_id_document_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."document_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_notes" ADD CONSTRAINT "employee_notes_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_notes" ADD CONSTRAINT "employee_notes_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_notes" ADD CONSTRAINT "employee_notes_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_pay_accounts" ADD CONSTRAINT "employee_pay_accounts_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_pay_accounts" ADD CONSTRAINT "employee_pay_accounts_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_pay_accounts" ADD CONSTRAINT "employee_pay_accounts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_tag_links" ADD CONSTRAINT "employee_tag_links_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_tag_links" ADD CONSTRAINT "employee_tag_links_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_tag_links" ADD CONSTRAINT "employee_tag_links_tag_id_employee_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."employee_tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_tags" ADD CONSTRAINT "employee_tags_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_settings" ADD CONSTRAINT "hr_settings_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_announcement_audiences" ADD CONSTRAINT "staff_announcement_audiences_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_announcement_audiences" ADD CONSTRAINT "staff_announcement_audiences_announcement_id_staff_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."staff_announcements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_announcement_audiences" ADD CONSTRAINT "staff_announcement_audiences_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_announcement_audiences" ADD CONSTRAINT "staff_announcement_audiences_job_position_id_job_positions_id_fk" FOREIGN KEY ("job_position_id") REFERENCES "public"."job_positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_announcement_audiences" ADD CONSTRAINT "staff_announcement_audiences_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_announcement_comments" ADD CONSTRAINT "staff_announcement_comments_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_announcement_comments" ADD CONSTRAINT "staff_announcement_comments_announcement_id_staff_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."staff_announcements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_announcement_comments" ADD CONSTRAINT "staff_announcement_comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_announcement_views" ADD CONSTRAINT "staff_announcement_views_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_announcement_views" ADD CONSTRAINT "staff_announcement_views_announcement_id_staff_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."staff_announcements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_announcement_views" ADD CONSTRAINT "staff_announcement_views_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_announcements" ADD CONSTRAINT "staff_announcements_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_announcements" ADD CONSTRAINT "staff_announcements_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_policies" ADD CONSTRAINT "staff_policies_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_policies" ADD CONSTRAINT "staff_policies_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_policy_audiences" ADD CONSTRAINT "staff_policy_audiences_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_policy_audiences" ADD CONSTRAINT "staff_policy_audiences_policy_id_staff_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."staff_policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_policy_audiences" ADD CONSTRAINT "staff_policy_audiences_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_policy_audiences" ADD CONSTRAINT "staff_policy_audiences_job_position_id_job_positions_id_fk" FOREIGN KEY ("job_position_id") REFERENCES "public"."job_positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_policy_audiences" ADD CONSTRAINT "staff_policy_audiences_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "employee_types_title_uk" ON "employee_types" USING btree ("org_id",lower("title")) WHERE "employee_types"."status" = 'active';--> statement-breakpoint
CREATE INDEX "disciplinary_actions_employee_idx" ON "disciplinary_actions" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "disciplinary_types_title_uk" ON "disciplinary_types" USING btree ("org_id",lower("title")) WHERE "disciplinary_types"."status" = 'active';--> statement-breakpoint
CREATE INDEX "employee_document_versions_document_idx" ON "employee_document_versions" USING btree ("document_id","uploaded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_documents_request_uk" ON "employee_documents" USING btree ("request_id","employee_id") WHERE "employee_documents"."request_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "employee_documents_employee_idx" ON "employee_documents" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "employee_documents_expiry_idx" ON "employee_documents" USING btree ("expires_on") WHERE "employee_documents"."reminded_at" IS NULL;--> statement-breakpoint
CREATE INDEX "employee_notes_employee_idx" ON "employee_notes" USING btree ("employee_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_pay_accounts_primary_uk" ON "employee_pay_accounts" USING btree ("employee_id") WHERE "employee_pay_accounts"."is_primary" AND "employee_pay_accounts"."status" = 'active';--> statement-breakpoint
CREATE INDEX "employee_pay_accounts_employee_idx" ON "employee_pay_accounts" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "employee_tag_links_tag_idx" ON "employee_tag_links" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_tags_title_uk" ON "employee_tags" USING btree ("org_id",lower("title")) WHERE "employee_tags"."status" = 'active';--> statement-breakpoint
CREATE INDEX "staff_announcement_audiences_announcement_idx" ON "staff_announcement_audiences" USING btree ("announcement_id");--> statement-breakpoint
CREATE INDEX "staff_announcement_comments_announcement_idx" ON "staff_announcement_comments" USING btree ("announcement_id","created_at");--> statement-breakpoint
CREATE INDEX "staff_policy_audiences_policy_idx" ON "staff_policy_audiences" USING btree ("policy_id");--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_village_id_villages_id_fk" FOREIGN KEY ("village_id") REFERENCES "public"."villages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_employee_type_id_employee_types_id_fk" FOREIGN KEY ("employee_type_id") REFERENCES "public"."employee_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_previous_employee_id_employees_id_fk" FOREIGN KEY ("previous_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "employees_membership_uk" ON "employees" USING btree ("org_membership_id") WHERE "employees"."org_membership_id" IS NOT NULL AND "employees"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "employees_id_document_uk" ON "employees" USING btree ("org_id","id_document_type","id_document_number") WHERE "employees"."id_document_number" IS NOT NULL AND "employees"."status" = 'active';--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_children_ck" CHECK ("employees"."children_count" IS NULL OR "employees"."children_count" BETWEEN 0 AND 30);--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_experience_ck" CHECK ("employees"."prior_experience_years" IS NULL OR "employees"."prior_experience_years" BETWEEN 0 AND 60);--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_service_from_ck" CHECK ("employees"."service_from" <= "employees"."hired_on");