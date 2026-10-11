CREATE TYPE "public"."hr_attendance_source" AS ENUM('supervisor', 'self');--> statement-breakpoint
CREATE TYPE "public"."hr_attendance_status" AS ENUM('open', 'closed', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."hr_catalog_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."hr_contract_status" AS ENUM('scheduled', 'active', 'ended');--> statement-breakpoint
CREATE TYPE "public"."hr_contract_type" AS ENUM('permanent', 'fixed_term', 'casual');--> statement-breakpoint
CREATE TYPE "public"."hr_employee_status" AS ENUM('active', 'offboarded');--> statement-breakpoint
CREATE TYPE "public"."hr_id_document_type" AS ENUM('national_id', 'passport');--> statement-breakpoint
CREATE TYPE "public"."hr_leave_accrual" AS ENUM('yearly_upfront', 'monthly', 'none');--> statement-breakpoint
CREATE TYPE "public"."hr_leave_end_half" AS ENUM('full', 'first_half');--> statement-breakpoint
CREATE TYPE "public"."hr_leave_entry_kind" AS ENUM('accrual', 'taken', 'reversal', 'carry_forward', 'expiry', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."hr_leave_request_status" AS ENUM('requested', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."hr_leave_start_half" AS ENUM('full', 'second_half');--> statement-breakpoint
CREATE TYPE "public"."hr_pay_run_status" AS ENUM('draft', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."hr_roster_status" AS ENUM('scheduled', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."hr_sex" AS ENUM('female', 'male');--> statement-breakpoint
CREATE TYPE "public"."hr_wage_basis" AS ENUM('monthly', 'daily', 'hourly');--> statement-breakpoint
ALTER TYPE "public"."audit_subject_type" ADD VALUE 'employee';--> statement-breakpoint
ALTER TYPE "public"."audit_subject_type" ADD VALUE 'pay_run';--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"roster_entry_id" uuid,
	"work_date" date NOT NULL,
	"clock_in_at" timestamp with time zone NOT NULL,
	"clock_out_at" timestamp with time zone,
	"source" "hr_attendance_source" NOT NULL,
	"recorded_by_user_id" uuid,
	"validated" boolean DEFAULT false NOT NULL,
	"validated_by_user_id" uuid,
	"status" "hr_attendance_status" DEFAULT 'open' NOT NULL,
	"supersedes_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_records_times_ck" CHECK ("attendance_records"."clock_out_at" IS NULL OR "attendance_records"."clock_out_at" > "attendance_records"."clock_in_at")
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"org_membership_id" uuid,
	"employee_number" text NOT NULL,
	"legal_name" text NOT NULL,
	"preferred_name" text,
	"phone" text,
	"email" text,
	"date_of_birth" date,
	"sex" "hr_sex",
	"id_document_type" "hr_id_document_type",
	"id_document_number" text,
	"rssb_number" text,
	"work_property_id" uuid,
	"job_position_id" uuid,
	"reporting_manager_id" uuid,
	"hired_on" date NOT NULL,
	"status" "hr_employee_status" DEFAULT 'active' NOT NULL,
	"offboarded_on" date,
	"offboard_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employees_number_uk" UNIQUE("org_id","employee_number"),
	CONSTRAINT "employees_offboarded_ck" CHECK (("employees"."status" = 'offboarded') = ("employees"."offboarded_on" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "employment_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"contract_type" "hr_contract_type" NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"wage_basis" "hr_wage_basis" NOT NULL,
	"wage_rwf" bigint NOT NULL,
	"status" "hr_contract_status" NOT NULL,
	"end_reason" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employment_contracts_wage_ck" CHECK ("employment_contracts"."wage_rwf" > 0),
	CONSTRAINT "employment_contracts_dates_ck" CHECK ("employment_contracts"."ends_on" IS NULL OR "employment_contracts"."ends_on" >= "employment_contracts"."starts_on"),
	CONSTRAINT "employment_contracts_fixed_term_ck" CHECK ("employment_contracts"."contract_type" <> 'fixed_term' OR "employment_contracts"."ends_on" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "hr_counters" (
	"org_id" uuid PRIMARY KEY NOT NULL,
	"next_employee_number" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"title" text NOT NULL,
	"department_category" "department_category",
	"status" "hr_catalog_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"kind" "hr_leave_entry_kind" NOT NULL,
	"days" numeric(5, 1) NOT NULL,
	"effective_on" date NOT NULL,
	"period_key" text,
	"leave_request_id" uuid,
	"reverses_id" uuid,
	"reason" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_ledger_period_ck" CHECK ("leave_ledger_entries"."kind" NOT IN ('accrual', 'carry_forward', 'expiry') OR "leave_ledger_entries"."period_key" IS NOT NULL),
	CONSTRAINT "leave_ledger_reversal_ck" CHECK (("leave_ledger_entries"."kind" = 'reversal') = ("leave_ledger_entries"."reverses_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"start_half" "hr_leave_start_half" DEFAULT 'full' NOT NULL,
	"end_half" "hr_leave_end_half" DEFAULT 'full' NOT NULL,
	"days" numeric(5, 1) NOT NULL,
	"reason" text,
	"status" "hr_leave_request_status" DEFAULT 'requested' NOT NULL,
	"routed_to_employee_id" uuid,
	"requested_by_user_id" uuid,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_requests_dates_ck" CHECK ("leave_requests"."ends_on" >= "leave_requests"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "leave_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"paid" boolean NOT NULL,
	"yearly_entitlement_days" numeric(5, 1),
	"accrual" "hr_leave_accrual" NOT NULL,
	"carry_forward_max_days" numeric(5, 1) DEFAULT 0 NOT NULL,
	"needs_approval" boolean DEFAULT true NOT NULL,
	"config_entry_id" uuid,
	"status" "hr_catalog_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_types_code_uk" UNIQUE("org_id","code")
);
--> statement-breakpoint
CREATE TABLE "pay_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"status" "hr_pay_run_status" DEFAULT 'draft' NOT NULL,
	"computed_at" timestamp with time zone NOT NULL,
	"rule_versions" jsonb NOT NULL,
	"confirmed_at" timestamp with time zone,
	"confirmed_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pay_runs_period_uk" UNIQUE("org_id","period_start"),
	CONSTRAINT "pay_runs_period_start_ck" CHECK (extract(day from "pay_runs"."period_start") = 1)
);
--> statement-breakpoint
CREATE TABLE "payslips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"pay_run_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"payable_days" numeric(6, 2) NOT NULL,
	"gross_rwf" bigint NOT NULL,
	"paye_rwf" bigint NOT NULL,
	"employee_contributions_rwf" bigint NOT NULL,
	"employer_contributions_rwf" bigint NOT NULL,
	"other_deductions_rwf" bigint DEFAULT 0 NOT NULL,
	"net_rwf" bigint NOT NULL,
	"lines" jsonb NOT NULL,
	"status" "hr_pay_run_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payslips_run_employee_uk" UNIQUE("pay_run_id","employee_id"),
	CONSTRAINT "payslips_net_ck" CHECK ("payslips"."net_rwf" = "payslips"."gross_rwf" - "payslips"."paye_rwf" - "payslips"."employee_contributions_rwf" - "payslips"."other_deductions_rwf")
);
--> statement-breakpoint
CREATE TABLE "roster_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"shift_template_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"department_id" uuid,
	"work_date" date NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "hr_roster_status" DEFAULT 'scheduled' NOT NULL,
	"cancel_reason" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roster_entries_times_ck" CHECK ("roster_entries"."ends_at" > "roster_entries"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "shift_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"department_id" uuid,
	"name" text NOT NULL,
	"starts_at" time NOT NULL,
	"ends_at" time NOT NULL,
	"break_minutes" integer DEFAULT 0 NOT NULL,
	"status" "hr_catalog_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shift_templates_times_ck" CHECK ("shift_templates"."starts_at" <> "shift_templates"."ends_at"),
	CONSTRAINT "shift_templates_break_ck" CHECK ("shift_templates"."break_minutes" >= 0)
);
--> statement-breakpoint
ALTER TABLE "department_members" ALTER COLUMN "org_membership_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "department_members" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "department_members" ADD COLUMN "employee_id" uuid;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_roster_entry_id_roster_entries_id_fk" FOREIGN KEY ("roster_entry_id") REFERENCES "public"."roster_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_validated_by_user_id_users_id_fk" FOREIGN KEY ("validated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_supersedes_id_attendance_records_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."attendance_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_org_membership_id_org_memberships_id_fk" FOREIGN KEY ("org_membership_id") REFERENCES "public"."org_memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_work_property_id_properties_id_fk" FOREIGN KEY ("work_property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_job_position_id_job_positions_id_fk" FOREIGN KEY ("job_position_id") REFERENCES "public"."job_positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_reporting_manager_id_employees_id_fk" FOREIGN KEY ("reporting_manager_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_contracts" ADD CONSTRAINT "employment_contracts_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_contracts" ADD CONSTRAINT "employment_contracts_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_contracts" ADD CONSTRAINT "employment_contracts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_counters" ADD CONSTRAINT "hr_counters_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_positions" ADD CONSTRAINT "job_positions_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_ledger_entries" ADD CONSTRAINT "leave_ledger_entries_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_ledger_entries" ADD CONSTRAINT "leave_ledger_entries_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_ledger_entries" ADD CONSTRAINT "leave_ledger_entries_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_ledger_entries" ADD CONSTRAINT "leave_ledger_entries_leave_request_id_leave_requests_id_fk" FOREIGN KEY ("leave_request_id") REFERENCES "public"."leave_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_ledger_entries" ADD CONSTRAINT "leave_ledger_entries_reverses_id_leave_ledger_entries_id_fk" FOREIGN KEY ("reverses_id") REFERENCES "public"."leave_ledger_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_ledger_entries" ADD CONSTRAINT "leave_ledger_entries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_routed_to_employee_id_employees_id_fk" FOREIGN KEY ("routed_to_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_runs" ADD CONSTRAINT "pay_runs_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_runs" ADD CONSTRAINT "pay_runs_confirmed_by_user_id_users_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_pay_run_id_pay_runs_id_fk" FOREIGN KEY ("pay_run_id") REFERENCES "public"."pay_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_contract_id_employment_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."employment_contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_entries" ADD CONSTRAINT "roster_entries_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_entries" ADD CONSTRAINT "roster_entries_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_entries" ADD CONSTRAINT "roster_entries_shift_template_id_shift_templates_id_fk" FOREIGN KEY ("shift_template_id") REFERENCES "public"."shift_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_entries" ADD CONSTRAINT "roster_entries_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_entries" ADD CONSTRAINT "roster_entries_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_entries" ADD CONSTRAINT "roster_entries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_templates" ADD CONSTRAINT "shift_templates_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_templates" ADD CONSTRAINT "shift_templates_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_templates" ADD CONSTRAINT "shift_templates_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_records_one_open_uk" ON "attendance_records" USING btree ("employee_id") WHERE "attendance_records"."status" = 'open';--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_records_supersedes_uk" ON "attendance_records" USING btree ("supersedes_id") WHERE "attendance_records"."supersedes_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "attendance_records_employee_date_idx" ON "attendance_records" USING btree ("employee_id","work_date");--> statement-breakpoint
CREATE INDEX "attendance_records_org_date_idx" ON "attendance_records" USING btree ("org_id","work_date");--> statement-breakpoint
CREATE UNIQUE INDEX "employees_membership_uk" ON "employees" USING btree ("org_membership_id") WHERE "employees"."org_membership_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "employees_id_document_uk" ON "employees" USING btree ("org_id","id_document_type","id_document_number") WHERE "employees"."id_document_number" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "employees_org_status_idx" ON "employees" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "employees_work_property_idx" ON "employees" USING btree ("work_property_id");--> statement-breakpoint
CREATE INDEX "employees_reporting_manager_idx" ON "employees" USING btree ("reporting_manager_id");--> statement-breakpoint
CREATE UNIQUE INDEX "employment_contracts_one_active_uk" ON "employment_contracts" USING btree ("employee_id") WHERE "employment_contracts"."status" = 'active';--> statement-breakpoint
CREATE INDEX "employment_contracts_employee_idx" ON "employment_contracts" USING btree ("employee_id","starts_on");--> statement-breakpoint
CREATE INDEX "employment_contracts_org_dates_idx" ON "employment_contracts" USING btree ("org_id","starts_on");--> statement-breakpoint
CREATE UNIQUE INDEX "job_positions_title_uk" ON "job_positions" USING btree ("org_id",lower("title")) WHERE "job_positions"."status" = 'active';--> statement-breakpoint
CREATE INDEX "leave_ledger_employee_type_idx" ON "leave_ledger_entries" USING btree ("employee_id","leave_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "leave_ledger_period_uk" ON "leave_ledger_entries" USING btree ("employee_id","leave_type_id","kind","period_key") WHERE "leave_ledger_entries"."kind" IN ('accrual', 'carry_forward', 'expiry');--> statement-breakpoint
CREATE UNIQUE INDEX "leave_ledger_reverses_uk" ON "leave_ledger_entries" USING btree ("reverses_id") WHERE "leave_ledger_entries"."reverses_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "leave_requests_org_status_idx" ON "leave_requests" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "leave_requests_employee_idx" ON "leave_requests" USING btree ("employee_id","starts_on");--> statement-breakpoint
CREATE INDEX "payslips_employee_idx" ON "payslips" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "roster_entries_property_date_idx" ON "roster_entries" USING btree ("property_id","work_date");--> statement-breakpoint
CREATE INDEX "roster_entries_employee_date_idx" ON "roster_entries" USING btree ("employee_id","work_date");--> statement-breakpoint
CREATE UNIQUE INDEX "shift_templates_name_uk" ON "shift_templates" USING btree ("property_id",lower("name")) WHERE "shift_templates"."status" = 'active';--> statement-breakpoint
ALTER TABLE "department_members" ADD CONSTRAINT "department_members_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "department_members_employee_idx" ON "department_members" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "department_members_active_employee_uk" ON "department_members" USING btree ("department_id","employee_id") WHERE "department_members"."status" = 'active' AND "department_members"."employee_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "department_members" ADD CONSTRAINT "department_members_person_ck" CHECK ("department_members"."employee_id" IS NOT NULL OR "department_members"."org_membership_id" IS NOT NULL);--> statement-breakpoint
-- ADR-058, the first HR thread. Everything above was generated from the schema;
-- everything below is written by hand, because Drizzle cannot declare it.
--
-- btree_gist lets a GiST index compare a uuid with `=`, which is what an
-- EXCLUDE over (person, time range) needs. It is a trusted extension, so the
-- database owner may create it without a superuser.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
-- AC-T2: two scheduled shifts of one person may not overlap in time. Held by the
-- database, so two requests that race are refused too, not only the second one
-- a read happened to see. A cancelled entry is out of the way.
ALTER TABLE "roster_entries" ADD CONSTRAINT "roster_entries_no_overlap" EXCLUDE USING gist ("employee_id" WITH =, tstzrange("starts_at", "ends_at") WITH &&) WHERE ("status" = 'scheduled');--> statement-breakpoint
-- AC-L5: two open requests (requested or approved) of one person may not
-- overlap. Inclusive at both ends, because a leave's last day is taken.
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_no_overlap" EXCLUDE USING gist ("employee_id" WITH =, daterange("starts_on", "ends_on", '[]') WITH &&) WHERE ("status" IN ('requested', 'approved'));--> statement-breakpoint
-- AC-P5: one file for every ACTIVE, NON OWNER membership, linked to it. An owner
-- is often not on payroll, so an owner gets a file only by adding one.
--
-- The legal name and phone come from the user record (the proved phone, E.164,
-- or nothing), the hire date is the day the membership was created in Kigali,
-- and the statutory fields are left empty: nobody typed them, so the file says
-- so (`detailsMissing`) until someone does. Numbers are minted per business in
-- the order the memberships were created, `0001` first.
INSERT INTO "employees" ("org_id", "org_membership_id", "employee_number", "legal_name", "phone", "email", "hired_on")
SELECT
  om."org_id",
  om."id",
  lpad(row_number() OVER (PARTITION BY om."org_id" ORDER BY om."created_at", om."id")::text, 4, '0'),
  coalesce(nullif(btrim(u."name"), ''), u."email"),
  u."phone_number",
  lower(u."email"),
  (om."created_at" AT TIME ZONE 'Africa/Kigali')::date
FROM "org_memberships" om
JOIN "users" u ON u."id" = om."user_id"
WHERE om."status" = 'active' AND om."org_role" <> 'owner';--> statement-breakpoint
-- The counter carries on from the last number the backfill minted.
INSERT INTO "hr_counters" ("org_id", "next_employee_number")
SELECT "org_id", count(*) + 1 FROM "employees" GROUP BY "org_id";--> statement-breakpoint
-- The department roster of those people points at their file, so the roster and
-- the HR file answer "who works where" from one row (cross child contract 5).
UPDATE "department_members" dm
SET "employee_id" = e."id"
FROM "employees" e
WHERE e."org_membership_id" = dm."org_membership_id";
