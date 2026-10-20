CREATE TABLE "employee_dependants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"name" text NOT NULL,
	"relation" text NOT NULL,
	"sex" "hr_sex",
	"date_of_birth" date,
	"phone" text,
	"is_emergency_contact" boolean DEFAULT false NOT NULL,
	"medical_dependant" boolean DEFAULT false NOT NULL,
	"beneficiary_percent" numeric(5, 2),
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employee_dependants_relation_ck" CHECK ("employee_dependants"."relation" IN ('spouse', 'child', 'parent', 'sibling', 'other')),
	CONSTRAINT "employee_dependants_share_ck" CHECK ("employee_dependants"."beneficiary_percent" IS NULL OR ("employee_dependants"."beneficiary_percent" > 0 AND "employee_dependants"."beneficiary_percent" <= 100)),
	CONSTRAINT "employee_dependants_status_ck" CHECK ("employee_dependants"."status" IN ('active', 'removed'))
);
--> statement-breakpoint
CREATE TABLE "hr_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"checklist" text NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"detail" text,
	"owner_only" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"done_at" timestamp with time zone,
	"done_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_checklist_items_code_uk" UNIQUE("employee_id","checklist","code"),
	CONSTRAINT "hr_checklist_items_checklist_ck" CHECK ("hr_checklist_items"."checklist" IN ('onboarding', 'offboarding')),
	CONSTRAINT "hr_checklist_items_done_ck" CHECK (("hr_checklist_items"."done_at" IS NULL) = ("hr_checklist_items"."done_by_user_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "hr_team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"status" "department_member_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"department_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"lead_employee_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "hr_catalog_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_teams_code_ck" CHECK ("hr_teams"."code" ~ '^[a-z0-9-]{1,12}$')
);
--> statement-breakpoint
CREATE TABLE "roster_cover_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"label" text NOT NULL,
	"shift_template_ids" jsonb NOT NULL,
	"min_by_weekday" integer[] NOT NULL,
	"note" text,
	"set_by_employee_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "hr_catalog_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roster_cover_requirements_min_ck" CHECK (cardinality("roster_cover_requirements"."min_by_weekday") = 7 AND 0 <= ALL("roster_cover_requirements"."min_by_weekday")),
	CONSTRAINT "roster_cover_requirements_shifts_ck" CHECK (jsonb_typeof("roster_cover_requirements"."shift_template_ids") = 'array' AND jsonb_array_length("roster_cover_requirements"."shift_template_ids") BETWEEN 1 AND 12)
);
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "grade" text;--> statement-breakpoint
ALTER TABLE "employment_contracts" ADD COLUMN "probation_ends_on" date;--> statement-breakpoint
ALTER TABLE "employment_contracts" ADD COLUMN "change_reason" text;--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "verified_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "attendance_requests" ADD COLUMN "evidence" text;--> statement-breakpoint
ALTER TABLE "attendance_requests" ADD COLUMN "manager_confirmed_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "attendance_requests" ADD COLUMN "manager_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "employee_dependants" ADD CONSTRAINT "employee_dependants_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_dependants" ADD CONSTRAINT "employee_dependants_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_checklist_items" ADD CONSTRAINT "hr_checklist_items_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_checklist_items" ADD CONSTRAINT "hr_checklist_items_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_checklist_items" ADD CONSTRAINT "hr_checklist_items_done_by_user_id_users_id_fk" FOREIGN KEY ("done_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_team_members" ADD CONSTRAINT "hr_team_members_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_team_members" ADD CONSTRAINT "hr_team_members_team_id_hr_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."hr_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_team_members" ADD CONSTRAINT "hr_team_members_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_teams" ADD CONSTRAINT "hr_teams_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_teams" ADD CONSTRAINT "hr_teams_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_teams" ADD CONSTRAINT "hr_teams_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_teams" ADD CONSTRAINT "hr_teams_lead_employee_id_employees_id_fk" FOREIGN KEY ("lead_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_cover_requirements" ADD CONSTRAINT "roster_cover_requirements_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_cover_requirements" ADD CONSTRAINT "roster_cover_requirements_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_cover_requirements" ADD CONSTRAINT "roster_cover_requirements_team_id_hr_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."hr_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_cover_requirements" ADD CONSTRAINT "roster_cover_requirements_set_by_employee_id_employees_id_fk" FOREIGN KEY ("set_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "employee_dependants_employee_idx" ON "employee_dependants" USING btree ("employee_id","status");--> statement-breakpoint
CREATE INDEX "hr_checklist_items_org_idx" ON "hr_checklist_items" USING btree ("org_id","checklist");--> statement-breakpoint
CREATE UNIQUE INDEX "hr_team_members_active_uk" ON "hr_team_members" USING btree ("employee_id") WHERE "hr_team_members"."status" = 'active';--> statement-breakpoint
CREATE INDEX "hr_team_members_team_idx" ON "hr_team_members" USING btree ("team_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "hr_teams_name_uk" ON "hr_teams" USING btree ("property_id",lower("name")) WHERE "hr_teams"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "hr_teams_code_uk" ON "hr_teams" USING btree ("org_id","code") WHERE "hr_teams"."status" = 'active';--> statement-breakpoint
CREATE INDEX "hr_teams_org_idx" ON "hr_teams" USING btree ("org_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "roster_cover_requirements_label_uk" ON "roster_cover_requirements" USING btree ("team_id",lower("label")) WHERE "roster_cover_requirements"."status" = 'active';--> statement-breakpoint
CREATE INDEX "roster_cover_requirements_property_idx" ON "roster_cover_requirements" USING btree ("property_id","status");--> statement-breakpoint
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_requests" ADD CONSTRAINT "attendance_requests_manager_confirmed_by_user_id_users_id_fk" FOREIGN KEY ("manager_confirmed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_contracts" ADD CONSTRAINT "employment_contracts_probation_ck" CHECK ("employment_contracts"."probation_ends_on" IS NULL OR "employment_contracts"."probation_ends_on" >= "employment_contracts"."starts_on");