CREATE TYPE "public"."hr_leave_carry" AS ENUM('none', 'carry', 'carry_with_expiry');--> statement-breakpoint
CREATE TYPE "public"."hr_leave_payment" AS ENUM('paid', 'unpaid', 'partial');--> statement-breakpoint
CREATE TYPE "public"."hr_leave_reset" AS ENUM('yearly', 'monthly', 'never');--> statement-breakpoint
CREATE TYPE "public"."hr_leave_allocation_kind" AS ENUM('extra', 'compensatory');--> statement-breakpoint
CREATE TYPE "public"."hr_leave_allocation_status" AS ENUM('requested', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."hr_leave_decision" AS ENUM('approved', 'rejected', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."hr_restricted_type_mode" AS ENUM('all', 'only', 'except');--> statement-breakpoint
ALTER TYPE "public"."hr_leave_entry_kind" ADD VALUE 'encashed';--> statement-breakpoint
CREATE TABLE "leave_allocation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"kind" "hr_leave_allocation_kind" NOT NULL,
	"days" numeric(5, 1) NOT NULL,
	"attendance_record_id" uuid,
	"work_date" date,
	"reason" text NOT NULL,
	"status" "hr_leave_allocation_status" DEFAULT 'requested' NOT NULL,
	"routed_to_employee_id" uuid,
	"requested_by_user_id" uuid,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_allocation_requests_days_ck" CHECK ("leave_allocation_requests"."days" > 0 AND "leave_allocation_requests"."days" <= 366),
	CONSTRAINT "leave_allocation_requests_kind_ck" CHECK (("leave_allocation_requests"."kind" = 'compensatory') = ("leave_allocation_requests"."attendance_record_id" IS NOT NULL AND "leave_allocation_requests"."work_date" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "leave_request_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"step" integer NOT NULL,
	"decision" "hr_leave_decision" NOT NULL,
	"decided_by_user_id" uuid,
	"note" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_request_approvals_step_uk" UNIQUE("request_id","step"),
	CONSTRAINT "leave_request_approvals_step_ck" CHECK ("leave_request_approvals"."step" IN (1, 2)),
	CONSTRAINT "leave_request_approvals_decider_ck" CHECK (("leave_request_approvals"."decision" = 'skipped') = ("leave_request_approvals"."decided_by_user_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "restricted_leave_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"title" text NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"department_id" uuid,
	"type_mode" "hr_restricted_type_mode" DEFAULT 'all' NOT NULL,
	"description" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restricted_leave_periods_dates_ck" CHECK ("restricted_leave_periods"."to_date" >= "restricted_leave_periods"."from_date" AND "restricted_leave_periods"."to_date" - "restricted_leave_periods"."from_date" <= 366)
);
--> statement-breakpoint
CREATE TABLE "restricted_leave_scopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"job_position_id" uuid,
	"leave_type_id" uuid,
	CONSTRAINT "restricted_leave_scopes_one_ck" CHECK (("restricted_leave_scopes"."job_position_id" IS NULL) <> ("restricted_leave_scopes"."leave_type_id" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "leave_ledger_entries" DROP CONSTRAINT "leave_ledger_period_ck";--> statement-breakpoint
ALTER TABLE "attendance_policies" DROP CONSTRAINT "attendance_policies_ranges_ck";--> statement-breakpoint
DROP INDEX "leave_ledger_period_uk";--> statement-breakpoint
ALTER TABLE "leave_ledger_entries" ADD COLUMN "expires_on" date;--> statement-breakpoint
ALTER TABLE "leave_ledger_entries" ADD COLUMN "lot_id" uuid;--> statement-breakpoint
ALTER TABLE "leave_ledger_entries" ADD COLUMN "allocation_request_id" uuid;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "attachment_key" text;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "current_step" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "approval_steps" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "payment" "hr_leave_payment" DEFAULT 'paid' NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "payment_percent" integer;--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "payment" "hr_leave_payment" DEFAULT 'paid' NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "payment_percent" integer;--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "reset" "hr_leave_reset" DEFAULT 'yearly' NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "carry" "hr_leave_carry" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "carry_expires_months" integer;--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "approval_steps" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "needs_attachment" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "counts_weekly_offs" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "counts_holidays" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "eligible_sex" "hr_sex";--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "min_service_months" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "once_per_employment" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "statutory" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "allows_past_requests" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "encashable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "compensatory" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "seniority_every_years" integer;--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "seniority_extra_days" numeric(5, 1);--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "seniority_cap_days" numeric(5, 1);--> statement-breakpoint
ALTER TABLE "attendance_policies" ADD COLUMN "compensation_threshold_minutes" integer DEFAULT 360 NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_allocation_requests" ADD CONSTRAINT "leave_allocation_requests_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_allocation_requests" ADD CONSTRAINT "leave_allocation_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_allocation_requests" ADD CONSTRAINT "leave_allocation_requests_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_allocation_requests" ADD CONSTRAINT "leave_allocation_requests_attendance_record_id_attendance_records_id_fk" FOREIGN KEY ("attendance_record_id") REFERENCES "public"."attendance_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_allocation_requests" ADD CONSTRAINT "leave_allocation_requests_routed_to_employee_id_employees_id_fk" FOREIGN KEY ("routed_to_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_allocation_requests" ADD CONSTRAINT "leave_allocation_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_allocation_requests" ADD CONSTRAINT "leave_allocation_requests_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_request_approvals" ADD CONSTRAINT "leave_request_approvals_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_request_approvals" ADD CONSTRAINT "leave_request_approvals_request_id_leave_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."leave_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_request_approvals" ADD CONSTRAINT "leave_request_approvals_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restricted_leave_periods" ADD CONSTRAINT "restricted_leave_periods_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restricted_leave_periods" ADD CONSTRAINT "restricted_leave_periods_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restricted_leave_periods" ADD CONSTRAINT "restricted_leave_periods_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restricted_leave_scopes" ADD CONSTRAINT "restricted_leave_scopes_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restricted_leave_scopes" ADD CONSTRAINT "restricted_leave_scopes_period_id_restricted_leave_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."restricted_leave_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restricted_leave_scopes" ADD CONSTRAINT "restricted_leave_scopes_job_position_id_job_positions_id_fk" FOREIGN KEY ("job_position_id") REFERENCES "public"."job_positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restricted_leave_scopes" ADD CONSTRAINT "restricted_leave_scopes_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "leave_allocation_requests_compensated_uk" ON "leave_allocation_requests" USING btree ("employee_id","work_date") WHERE "leave_allocation_requests"."kind" = 'compensatory' AND "leave_allocation_requests"."status" IN ('requested', 'approved');--> statement-breakpoint
CREATE INDEX "leave_allocation_requests_open_idx" ON "leave_allocation_requests" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "restricted_leave_periods_org_idx" ON "restricted_leave_periods" USING btree ("org_id","from_date");--> statement-breakpoint
CREATE INDEX "restricted_leave_scopes_period_idx" ON "restricted_leave_scopes" USING btree ("period_id");--> statement-breakpoint
ALTER TABLE "leave_ledger_entries" ADD CONSTRAINT "leave_ledger_entries_lot_id_leave_ledger_entries_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."leave_ledger_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leave_ledger_lot_idx" ON "leave_ledger_entries" USING btree ("lot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "leave_ledger_expiry_lot_uk" ON "leave_ledger_entries" USING btree ("lot_id") WHERE "leave_ledger_entries"."kind" = 'expiry';--> statement-breakpoint
CREATE UNIQUE INDEX "leave_ledger_period_uk" ON "leave_ledger_entries" USING btree ("employee_id","leave_type_id","kind","period_key") WHERE "leave_ledger_entries"."kind" IN ('accrual', 'carry_forward');--> statement-breakpoint
ALTER TABLE "leave_ledger_entries" ADD CONSTRAINT "leave_ledger_lot_ck" CHECK (("leave_ledger_entries"."kind" NOT IN ('accrual', 'carry_forward', 'adjustment') OR "leave_ledger_entries"."lot_id" IS NULL)
        AND ("leave_ledger_entries"."kind" IN ('accrual', 'carry_forward', 'adjustment', 'taken', 'reversal') OR "leave_ledger_entries"."lot_id" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "leave_ledger_entries" ADD CONSTRAINT "leave_ledger_expires_ck" CHECK ("leave_ledger_entries"."expires_on" IS NULL OR "leave_ledger_entries"."kind" IN ('accrual', 'carry_forward', 'adjustment'));--> statement-breakpoint
ALTER TABLE "leave_ledger_entries" ADD CONSTRAINT "leave_ledger_period_ck" CHECK ("leave_ledger_entries"."kind" NOT IN ('accrual', 'carry_forward') OR "leave_ledger_entries"."period_key" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_steps_ck" CHECK ("leave_requests"."approval_steps" BETWEEN 0 AND 2 AND "leave_requests"."current_step" BETWEEN 1 AND 2);--> statement-breakpoint
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_payment_ck" CHECK (("leave_types"."payment" = 'partial') = ("leave_types"."payment_percent" IS NOT NULL)
        AND ("leave_types"."payment_percent" IS NULL OR "leave_types"."payment_percent" BETWEEN 0 AND 100));--> statement-breakpoint
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_carry_ck" CHECK (("leave_types"."carry" <> 'carry_with_expiry' OR "leave_types"."carry_expires_months" IS NOT NULL)
        AND ("leave_types"."carry_expires_months" IS NULL OR "leave_types"."carry_expires_months" BETWEEN 1 AND 12)
        AND ("leave_types"."reset" = 'yearly' OR "leave_types"."carry" = 'none'));--> statement-breakpoint
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_steps_ck" CHECK ("leave_types"."approval_steps" BETWEEN 0 AND 2);--> statement-breakpoint
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_service_ck" CHECK ("leave_types"."min_service_months" BETWEEN 0 AND 600);--> statement-breakpoint
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_seniority_ck" CHECK (("leave_types"."seniority_every_years" IS NULL) = ("leave_types"."seniority_extra_days" IS NULL)
        AND ("leave_types"."seniority_every_years" IS NULL OR "leave_types"."seniority_every_years" BETWEEN 1 AND 50));--> statement-breakpoint
ALTER TABLE "attendance_policies" ADD CONSTRAINT "attendance_policies_ranges_ck" CHECK ("attendance_policies"."grace_in_minutes" BETWEEN 0 AND 240 AND "attendance_policies"."grace_out_minutes" BETWEEN 0 AND 240
        AND ("attendance_policies"."overtime_cutoff_minutes" IS NULL OR "attendance_policies"."overtime_cutoff_minutes" BETWEEN 0 AND 1440)
        AND "attendance_policies"."overtime_min_minutes" BETWEEN 0 AND 1440
        AND "attendance_policies"."link_window_minutes" BETWEEN 0 AND 720
        AND "attendance_policies"."stale_open_hours" BETWEEN 1 AND 72
        AND "attendance_policies"."default_shift_minutes" BETWEEN 30 AND 1440
        AND "attendance_policies"."compensation_threshold_minutes" BETWEEN 30 AND 1440);--> statement-breakpoint
-- ADR-058, leave in full (slice 5). Hand written, below this marker: drizzle cannot declare the
-- allocation foreign key without making people.ts and people-leave.ts import
-- each other, and it does not write data. Regenerating this migration drops
-- this block, so append it again (the session script lv-0058-hand.mjs did).
--
-- Slice 1's three columns become the new rules (AC-LV1): `paid` is the payment,
-- `needs_approval` one step or none, a carry maximum carries (only where a
-- balance is kept, since a type with none never resets). Migration 0059 drops
-- the old columns once this has read them. `encashed` is not named here: the
-- value was added above, and Postgres refuses it in the same transaction.
UPDATE "leave_types" SET
  "payment" = CASE WHEN "paid" THEN 'paid'::"hr_leave_payment" ELSE 'unpaid'::"hr_leave_payment" END,
  "approval_steps" = CASE WHEN "needs_approval" THEN 1 ELSE 0 END,
  "reset" = CASE WHEN "yearly_entitlement_days" IS NULL THEN 'never'::"hr_leave_reset" ELSE 'yearly'::"hr_leave_reset" END,
  "carry" = CASE
    WHEN "carry_forward_max_days" > 0 AND "yearly_entitlement_days" IS NOT NULL THEN 'carry'::"hr_leave_carry"
    ELSE 'none'::"hr_leave_carry"
  END;--> statement-breakpoint
-- A request carries the terms it was made under (AC-LV1): those of its type now.
UPDATE "leave_requests" r SET
  "payment" = t."payment",
  "payment_percent" = t."payment_percent",
  "approval_steps" = t."approval_steps"
FROM "leave_types" t
WHERE t."id" = r."leave_type_id";--> statement-breakpoint
ALTER TABLE "leave_ledger_entries" ADD CONSTRAINT "leave_ledger_entries_allocation_request_id_fk" FOREIGN KEY ("allocation_request_id") REFERENCES "public"."leave_allocation_requests"("id") ON DELETE no action ON UPDATE no action;
