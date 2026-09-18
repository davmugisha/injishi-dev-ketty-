CREATE TYPE "public"."compensation_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."payroll_run_status" AS ENUM('draft', 'pending_approval', 'approved', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payslip_status" AS ENUM('pending', 'paid', 'failed');--> statement-breakpoint
CREATE TABLE "payroll_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"status" "payroll_run_status" DEFAULT 'draft' NOT NULL,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"total_gross_rwf" bigint DEFAULT 0 NOT NULL,
	"total_net_rwf" bigint DEFAULT 0 NOT NULL,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payroll_runs_workspace_period_uk" UNIQUE("workspace_id","period_start","period_end")
);
--> statement-breakpoint
CREATE TABLE "payslips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payroll_run_id" uuid NOT NULL,
	"department_member_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"gross_rwf" bigint NOT NULL,
	"paye_rwf" bigint DEFAULT 0 NOT NULL,
	"rssb_employee_rwf" bigint DEFAULT 0 NOT NULL,
	"rssb_employer_rwf" bigint DEFAULT 0 NOT NULL,
	"net_rwf" bigint NOT NULL,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"status" "payslip_status" DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp with time zone,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payslips_run_member_uk" UNIQUE("payroll_run_id","department_member_id"),
	CONSTRAINT "payslips_idempotency_key_uk" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "staff_compensation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_member_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"base_salary_rwf" bigint NOT NULL,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"status" "compensation_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payroll_run_id_payroll_runs_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_department_member_id_department_members_id_fk" FOREIGN KEY ("department_member_id") REFERENCES "public"."department_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_compensation" ADD CONSTRAINT "staff_compensation_department_member_id_department_members_id_fk" FOREIGN KEY ("department_member_id") REFERENCES "public"."department_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_compensation" ADD CONSTRAINT "staff_compensation_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payroll_runs_workspace_idx" ON "payroll_runs" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "payslips_run_idx" ON "payslips" USING btree ("payroll_run_id");--> statement-breakpoint
CREATE INDEX "payslips_member_idx" ON "payslips" USING btree ("department_member_id");--> statement-breakpoint
CREATE INDEX "staff_compensation_member_idx" ON "staff_compensation" USING btree ("department_member_id");--> statement-breakpoint
CREATE INDEX "staff_compensation_workspace_idx" ON "staff_compensation" USING btree ("workspace_id");