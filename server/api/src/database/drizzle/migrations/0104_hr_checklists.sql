CREATE TYPE "public"."hr_checklist_kind" AS ENUM('onboarding', 'offboarding');--> statement-breakpoint
CREATE TABLE "checklist_template_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"by_employee" boolean DEFAULT false NOT NULL,
	"due_after_days" integer DEFAULT 0 NOT NULL,
	"job_position_id" uuid
);
--> statement-breakpoint
CREATE TABLE "checklist_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"kind" "hr_checklist_kind" NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_checklist_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"checklist_id" uuid NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"by_employee" boolean DEFAULT false NOT NULL,
	"due_on" date NOT NULL,
	"done_at" timestamp with time zone,
	"done_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "employee_checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"kind" "hr_checklist_kind" NOT NULL,
	"template_name" text NOT NULL,
	"anchor_on" date NOT NULL,
	"started_by_user_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checklist_template_items" ADD CONSTRAINT "checklist_template_items_template_id_checklist_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."checklist_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_template_items" ADD CONSTRAINT "checklist_template_items_job_position_id_job_positions_id_fk" FOREIGN KEY ("job_position_id") REFERENCES "public"."job_positions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_checklist_tasks" ADD CONSTRAINT "employee_checklist_tasks_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_checklist_tasks" ADD CONSTRAINT "employee_checklist_tasks_checklist_id_employee_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."employee_checklists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_checklist_tasks" ADD CONSTRAINT "employee_checklist_tasks_done_by_user_id_users_id_fk" FOREIGN KEY ("done_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_checklists" ADD CONSTRAINT "employee_checklists_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_checklists" ADD CONSTRAINT "employee_checklists_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_checklists" ADD CONSTRAINT "employee_checklists_started_by_user_id_users_id_fk" FOREIGN KEY ("started_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checklist_template_items_template_idx" ON "checklist_template_items" USING btree ("template_id","sort_order");--> statement-breakpoint
CREATE INDEX "checklist_templates_org_idx" ON "checklist_templates" USING btree ("org_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_templates_one_default_uk" ON "checklist_templates" USING btree ("org_id","kind") WHERE "checklist_templates"."is_default";--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_templates_name_uk" ON "checklist_templates" USING btree ("org_id","kind",lower("name"));--> statement-breakpoint
CREATE INDEX "employee_checklist_tasks_checklist_idx" ON "employee_checklist_tasks" USING btree ("checklist_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_checklists_one_per_kind_uk" ON "employee_checklists" USING btree ("employee_id","kind");--> statement-breakpoint
CREATE INDEX "employee_checklists_org_idx" ON "employee_checklists" USING btree ("org_id","kind");