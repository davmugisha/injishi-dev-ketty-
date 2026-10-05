CREATE TYPE "public"."hr_paid_method" AS ENUM('bank', 'momo', 'cash');--> statement-breakpoint
CREATE TYPE "public"."hr_loan_kind" AS ENUM('loan', 'advance');--> statement-breakpoint
CREATE TYPE "public"."hr_loan_paid_out" AS ENUM('payslip', 'outside');--> statement-breakpoint
CREATE TYPE "public"."hr_pay_adjustment_side" AS ENUM('earning', 'deduction');--> statement-breakpoint
CREATE TYPE "public"."hr_pay_adjustment_source" AS ENUM('manual', 'leave', 'asset_fine', 'held_payslip', 'late_claim');--> statement-breakpoint
CREATE TYPE "public"."hr_pay_adjustment_status" AS ENUM('open', 'waived', 'paid');--> statement-breakpoint
CREATE TYPE "public"."hr_pay_amount_type" AS ENUM('fixed', 'percent_basic', 'percent_gross', 'per_day_worked', 'per_hour_worked', 'per_child');--> statement-breakpoint
CREATE TYPE "public"."hr_pay_claim_kind" AS ENUM('reimbursement', 'leave_encashment');--> statement-breakpoint
CREATE TYPE "public"."hr_pay_claim_status" AS ENUM('requested', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."hr_pay_component_kind" AS ENUM('allowance', 'deduction');--> statement-breakpoint
CREATE TYPE "public"."hr_pay_condition_field" AS ENUM('sex', 'marital_status', 'children', 'years_of_service', 'prior_experience', 'employee_type', 'job_position', 'department', 'branch', 'wage_basis');--> statement-breakpoint
CREATE TYPE "public"."hr_pay_condition_op" AS ENUM('eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in');--> statement-breakpoint
CREATE TYPE "public"."hr_pay_declaration_kind" AS ENUM('paye', 'rssb');--> statement-breakpoint
CREATE TYPE "public"."hr_pay_export_kind" AS ENUM('bank', 'momo');--> statement-breakpoint
CREATE TYPE "public"."hr_pay_target_mode" AS ENUM('include', 'exclude');--> statement-breakpoint
ALTER TYPE "public"."stored_object_kind" ADD VALUE 'hr_pay_file';--> statement-breakpoint
CREATE TABLE "employee_loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"kind" "hr_loan_kind" NOT NULL,
	"amount_rwf" bigint NOT NULL,
	"given_on" date NOT NULL,
	"installments" integer NOT NULL,
	"first_period" text NOT NULL,
	"paid_out" "hr_loan_paid_out" NOT NULL,
	"reason" text,
	"paid_out_payslip_id" uuid,
	"settled_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employee_loans_idempotency_uk" UNIQUE("org_id","idempotency_key"),
	CONSTRAINT "employee_loans_amount_ck" CHECK ("employee_loans"."amount_rwf" > 0),
	CONSTRAINT "employee_loans_installments_ck" CHECK ("employee_loans"."installments" BETWEEN 1 AND 120),
	CONSTRAINT "employee_loans_period_ck" CHECK (first_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
CREATE TABLE "loan_installments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"loan_id" uuid NOT NULL,
	"period" text NOT NULL,
	"amount_rwf" bigint NOT NULL,
	"deferred_from" text,
	"payslip_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loan_installments_period_uk" UNIQUE("loan_id","period"),
	CONSTRAINT "loan_installments_amount_ck" CHECK ("loan_installments"."amount_rwf" > 0),
	CONSTRAINT "loan_installments_period_ck" CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
CREATE TABLE "pay_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"side" "hr_pay_adjustment_side" NOT NULL,
	"amount_rwf" bigint NOT NULL,
	"taxable" boolean NOT NULL,
	"contributable" boolean NOT NULL,
	"corrects_period" text NOT NULL,
	"reason" text NOT NULL,
	"source" "hr_pay_adjustment_source" NOT NULL,
	"source_id" uuid,
	"status" "hr_pay_adjustment_status" DEFAULT 'open' NOT NULL,
	"payslip_id" uuid,
	"created_by_user_id" uuid,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pay_adjustments_amount_ck" CHECK ("pay_adjustments"."amount_rwf" > 0),
	CONSTRAINT "pay_adjustments_period_ck" CHECK (corrects_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "pay_adjustments_paid_ck" CHECK (("pay_adjustments"."status" = 'paid') = ("pay_adjustments"."payslip_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "pay_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"kind" "hr_pay_claim_kind" NOT NULL,
	"amount_rwf" bigint,
	"leave_type_id" uuid,
	"days" numeric(5, 1),
	"period" text NOT NULL,
	"receipt_key" text,
	"reason" text NOT NULL,
	"status" "hr_pay_claim_status" DEFAULT 'requested' NOT NULL,
	"requested_by_user_id" uuid,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"payslip_id" uuid,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pay_claims_idempotency_uk" UNIQUE("org_id","idempotency_key"),
	CONSTRAINT "pay_claims_kind_ck" CHECK (("pay_claims"."kind" = 'reimbursement' AND "pay_claims"."amount_rwf" IS NOT NULL AND "pay_claims"."amount_rwf" > 0 AND "pay_claims"."leave_type_id" IS NULL AND "pay_claims"."days" IS NULL)
        OR ("pay_claims"."kind" = 'leave_encashment' AND "pay_claims"."leave_type_id" IS NOT NULL AND "pay_claims"."days" IS NOT NULL AND "pay_claims"."days" > 0 AND "pay_claims"."amount_rwf" IS NULL)),
	CONSTRAINT "pay_claims_period_ck" CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
CREATE TABLE "pay_component_targets" (
	"org_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"mode" "hr_pay_target_mode" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pay_component_targets_pk" PRIMARY KEY("component_id","employee_id")
);
--> statement-breakpoint
CREATE TABLE "pay_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"kind" "hr_pay_component_kind" NOT NULL,
	"taxable" boolean DEFAULT true NOT NULL,
	"in_contribution_base" boolean DEFAULT false NOT NULL,
	"before_tax" boolean DEFAULT false NOT NULL,
	"amount_type" "hr_pay_amount_type" NOT NULL,
	"amount_rwf" bigint,
	"rate" numeric(5, 2),
	"cap_rwf" bigint,
	"condition_field" "hr_pay_condition_field",
	"condition_op" "hr_pay_condition_op",
	"condition_value" text,
	"applies_all_active" boolean DEFAULT false NOT NULL,
	"one_off_period" text,
	"status" "hr_catalog_status" DEFAULT 'active' NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pay_components_amount_ck" CHECK (("pay_components"."amount_type" IN ('percent_basic', 'percent_gross') AND "pay_components"."rate" IS NOT NULL AND "pay_components"."rate" > 0 AND "pay_components"."rate" <= 100 AND "pay_components"."amount_rwf" IS NULL)
        OR ("pay_components"."amount_type" NOT IN ('percent_basic', 'percent_gross') AND "pay_components"."amount_rwf" IS NOT NULL AND "pay_components"."amount_rwf" > 0 AND "pay_components"."rate" IS NULL)),
	CONSTRAINT "pay_components_cap_ck" CHECK ("pay_components"."cap_rwf" IS NULL OR "pay_components"."cap_rwf" > 0),
	CONSTRAINT "pay_components_condition_ck" CHECK (("pay_components"."condition_field" IS NULL) = ("pay_components"."condition_op" IS NULL) AND ("pay_components"."condition_field" IS NULL) = ("pay_components"."condition_value" IS NULL)),
	CONSTRAINT "pay_components_before_tax_ck" CHECK ("pay_components"."kind" = 'deduction' OR NOT "pay_components"."before_tax"),
	CONSTRAINT "pay_components_period_ck" CHECK (one_off_period IS NULL OR one_off_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
CREATE TABLE "pay_declarations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"pay_run_id" uuid NOT NULL,
	"kind" "hr_pay_declaration_kind" NOT NULL,
	"format_version" text NOT NULL,
	"file_key" text NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pay_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"pay_run_id" uuid NOT NULL,
	"kind" "hr_pay_export_kind" NOT NULL,
	"file_key" text NOT NULL,
	"row_count" integer NOT NULL,
	"total_rwf" bigint NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pay_structure_components" (
	"org_id" uuid NOT NULL,
	"structure_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	CONSTRAINT "pay_structure_components_pk" PRIMARY KEY("structure_id","component_id")
);
--> statement-breakpoint
CREATE TABLE "pay_structures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "hr_catalog_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payslips" DROP CONSTRAINT "payslips_net_ck";--> statement-breakpoint
ALTER TABLE "employment_contracts" ADD COLUMN "pay_structure_id" uuid;--> statement-breakpoint
ALTER TABLE "employment_contracts" ADD COLUMN "notice_days" integer;--> statement-breakpoint
ALTER TABLE "employment_contracts" ADD COLUMN "document_key" text;--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN "non_income_rwf" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN "snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN "paid_method" "hr_paid_method";--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN "paid_reference" text;--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN "marked_paid_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hr_settings" ADD COLUMN "pay_run_auto_draft_day" integer;--> statement-breakpoint
ALTER TABLE "hr_settings" ADD COLUMN "rssb_employer_number" text;--> statement-breakpoint
ALTER TABLE "employee_loans" ADD CONSTRAINT "employee_loans_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_loans" ADD CONSTRAINT "employee_loans_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_loans" ADD CONSTRAINT "employee_loans_paid_out_payslip_id_payslips_id_fk" FOREIGN KEY ("paid_out_payslip_id") REFERENCES "public"."payslips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_loans" ADD CONSTRAINT "employee_loans_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_installments" ADD CONSTRAINT "loan_installments_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_installments" ADD CONSTRAINT "loan_installments_loan_id_employee_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."employee_loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_installments" ADD CONSTRAINT "loan_installments_payslip_id_payslips_id_fk" FOREIGN KEY ("payslip_id") REFERENCES "public"."payslips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_adjustments" ADD CONSTRAINT "pay_adjustments_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_adjustments" ADD CONSTRAINT "pay_adjustments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_adjustments" ADD CONSTRAINT "pay_adjustments_payslip_id_payslips_id_fk" FOREIGN KEY ("payslip_id") REFERENCES "public"."payslips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_adjustments" ADD CONSTRAINT "pay_adjustments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_claims" ADD CONSTRAINT "pay_claims_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_claims" ADD CONSTRAINT "pay_claims_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_claims" ADD CONSTRAINT "pay_claims_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_claims" ADD CONSTRAINT "pay_claims_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_claims" ADD CONSTRAINT "pay_claims_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_claims" ADD CONSTRAINT "pay_claims_payslip_id_payslips_id_fk" FOREIGN KEY ("payslip_id") REFERENCES "public"."payslips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_component_targets" ADD CONSTRAINT "pay_component_targets_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_component_targets" ADD CONSTRAINT "pay_component_targets_component_id_pay_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."pay_components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_component_targets" ADD CONSTRAINT "pay_component_targets_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_components" ADD CONSTRAINT "pay_components_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_components" ADD CONSTRAINT "pay_components_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_declarations" ADD CONSTRAINT "pay_declarations_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_declarations" ADD CONSTRAINT "pay_declarations_pay_run_id_pay_runs_id_fk" FOREIGN KEY ("pay_run_id") REFERENCES "public"."pay_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_declarations" ADD CONSTRAINT "pay_declarations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_exports" ADD CONSTRAINT "pay_exports_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_exports" ADD CONSTRAINT "pay_exports_pay_run_id_pay_runs_id_fk" FOREIGN KEY ("pay_run_id") REFERENCES "public"."pay_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_exports" ADD CONSTRAINT "pay_exports_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_structure_components" ADD CONSTRAINT "pay_structure_components_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_structure_components" ADD CONSTRAINT "pay_structure_components_structure_id_pay_structures_id_fk" FOREIGN KEY ("structure_id") REFERENCES "public"."pay_structures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_structure_components" ADD CONSTRAINT "pay_structure_components_component_id_pay_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."pay_components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_structures" ADD CONSTRAINT "pay_structures_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "employee_loans_employee_idx" ON "employee_loans" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "loan_installments_period_idx" ON "loan_installments" USING btree ("org_id","period");--> statement-breakpoint
CREATE UNIQUE INDEX "pay_adjustments_idempotency_uk" ON "pay_adjustments" USING btree ("org_id","idempotency_key") WHERE "pay_adjustments"."idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "pay_adjustments_employee_idx" ON "pay_adjustments" USING btree ("employee_id","status");--> statement-breakpoint
CREATE INDEX "pay_claims_employee_idx" ON "pay_claims" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "pay_claims_period_idx" ON "pay_claims" USING btree ("org_id","period");--> statement-breakpoint
CREATE INDEX "pay_component_targets_employee_idx" ON "pay_component_targets" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pay_components_code_uk" ON "pay_components" USING btree ("org_id","code") WHERE "pay_components"."status" = 'active';--> statement-breakpoint
CREATE INDEX "pay_declarations_run_idx" ON "pay_declarations" USING btree ("pay_run_id");--> statement-breakpoint
CREATE INDEX "pay_exports_run_idx" ON "pay_exports" USING btree ("pay_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pay_structures_name_uk" ON "pay_structures" USING btree ("org_id",lower("name")) WHERE "pay_structures"."status" = 'active';--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_marked_paid_by_user_id_users_id_fk" FOREIGN KEY ("marked_paid_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_contracts" ADD CONSTRAINT "employment_contracts_notice_ck" CHECK ("employment_contracts"."notice_days" IS NULL OR "employment_contracts"."notice_days" BETWEEN 0 AND 365);--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_paid_ck" CHECK (("payslips"."paid_at" IS NULL) = ("payslips"."paid_method" IS NULL) AND ("payslips"."paid_at" IS NULL OR "payslips"."status" = 'confirmed'));--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_net_ck" CHECK ("payslips"."net_rwf" = "payslips"."gross_rwf" + "payslips"."non_income_rwf" - "payslips"."paye_rwf" - "payslips"."employee_contributions_rwf" - "payslips"."other_deductions_rwf");--> statement-breakpoint
ALTER TABLE "hr_settings" ADD CONSTRAINT "hr_settings_draft_day_ck" CHECK ("hr_settings"."pay_run_auto_draft_day" IS NULL OR "hr_settings"."pay_run_auto_draft_day" BETWEEN 1 AND 28);

-- ADR-058, payroll in full (slice 6).
-- Hand written below this line: drizzle cannot declare it, because
-- people-pay.ts imports people.ts. Regenerating this migration drops it;
-- append it again (scratchpad py-0060-hand.mjs in the session that wrote it).
ALTER TABLE "employment_contracts" ADD CONSTRAINT "employment_contracts_pay_structure_id_fk" FOREIGN KEY ("pay_structure_id") REFERENCES "public"."pay_structures"("id") ON DELETE no action ON UPDATE no action;
