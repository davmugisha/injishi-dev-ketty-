CREATE TYPE "public"."hr_day_kind" AS ENUM('weekday', 'weekly_off', 'public_holiday');--> statement-breakpoint
CREATE TYPE "public"."hr_attendance_request_status" AS ENUM('requested', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."hr_comment_subject" AS ENUM('leave_request', 'shift_request', 'attendance_request', 'allocation_request', 'asset_request', 'pay_claim', 'ticket', 'resignation');--> statement-breakpoint
CREATE TYPE "public"."hr_kiosk_status" AS ENUM('pairing', 'active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."hr_rotation_rule" AS ENUM('every_n_days', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."hr_shift_request_kind" AS ENUM('change', 'swap');--> statement-breakpoint
CREATE TYPE "public"."hr_shift_request_status" AS ENUM('requested', 'awaiting_colleague', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."hr_attendance_source" ADD VALUE 'phone';--> statement-breakpoint
ALTER TYPE "public"."hr_attendance_source" ADD VALUE 'kiosk';--> statement-breakpoint
CREATE TABLE "attendance_kiosks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"name" text NOT NULL,
	"token_hash" text,
	"pairing_code_hash" text,
	"pairing_expires_at" timestamp with time zone,
	"allowed_ips" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" "hr_kiosk_status" DEFAULT 'pairing' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"property_id" uuid,
	"grace_in_minutes" integer DEFAULT 0 NOT NULL,
	"grace_out_minutes" integer DEFAULT 0 NOT NULL,
	"overtime_cutoff_minutes" integer,
	"overtime_auto_approve" boolean DEFAULT false NOT NULL,
	"overtime_min_minutes" integer DEFAULT 0 NOT NULL,
	"link_window_minutes" integer DEFAULT 180 NOT NULL,
	"stale_open_hours" integer DEFAULT 16 NOT NULL,
	"default_shift_minutes" integer DEFAULT 480 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_policies_scope_uk" UNIQUE NULLS NOT DISTINCT("org_id","property_id"),
	CONSTRAINT "attendance_policies_ranges_ck" CHECK ("attendance_policies"."grace_in_minutes" BETWEEN 0 AND 240 AND "attendance_policies"."grace_out_minutes" BETWEEN 0 AND 240
        AND ("attendance_policies"."overtime_cutoff_minutes" IS NULL OR "attendance_policies"."overtime_cutoff_minutes" BETWEEN 0 AND 1440)
        AND "attendance_policies"."overtime_min_minutes" BETWEEN 0 AND 1440
        AND "attendance_policies"."link_window_minutes" BETWEEN 0 AND 720
        AND "attendance_policies"."stale_open_hours" BETWEEN 1 AND 72
        AND "attendance_policies"."default_shift_minutes" BETWEEN 30 AND 1440)
);
--> statement-breakpoint
CREATE TABLE "attendance_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"clock_in_at" timestamp with time zone NOT NULL,
	"clock_out_at" timestamp with time zone NOT NULL,
	"record_id" uuid,
	"reason" text NOT NULL,
	"status" "hr_attendance_request_status" DEFAULT 'requested' NOT NULL,
	"routed_to_employee_id" uuid,
	"requested_by_user_id" uuid,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"result_record_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_requests_times_ck" CHECK ("attendance_requests"."clock_out_at" > "attendance_requests"."clock_in_at")
);
--> statement-breakpoint
CREATE TABLE "branch_clock_settings" (
	"property_id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"geofence_radius_m" integer DEFAULT 150 NOT NULL,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branch_clock_settings_radius_ck" CHECK ("branch_clock_settings"."geofence_radius_m" BETWEEN 25 AND 2000),
	CONSTRAINT "branch_clock_settings_centre_ck" CHECK (("branch_clock_settings"."latitude" IS NULL AND "branch_clock_settings"."longitude" IS NULL)
        OR ("branch_clock_settings"."latitude" BETWEEN -90 AND 90 AND "branch_clock_settings"."longitude" BETWEEN -180 AND 180))
);
--> statement-breakpoint
CREATE TABLE "employee_kiosk_pins" (
	"employee_id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"pin_hash" text NOT NULL,
	"set_by_user_id" uuid,
	"set_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_request_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"subject_type" "hr_comment_subject" NOT NULL,
	"subject_id" uuid NOT NULL,
	"author_user_id" uuid,
	"author_employee_id" uuid,
	"body" text NOT NULL,
	"file_keys" text[] DEFAULT '{}'::text[] NOT NULL,
	"internal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_request_comments_author_ck" CHECK ("hr_request_comments"."author_user_id" IS NOT NULL OR "hr_request_comments"."author_employee_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "kiosk_pin_locks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"kiosk_id" uuid,
	"employee_id" uuid NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kiosk_pin_locks_uk" UNIQUE NULLS NOT DISTINCT("kiosk_id","employee_id")
);
--> statement-breakpoint
CREATE TABLE "org_holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"property_id" uuid,
	"name" text NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"recurring_yearly" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_holidays_dates_ck" CHECK ("org_holidays"."to_date" >= "org_holidays"."from_date" AND "org_holidays"."to_date" - "org_holidays"."from_date" <= 31)
);
--> statement-breakpoint
CREATE TABLE "org_weekly_offs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"property_id" uuid,
	"weekday" smallint NOT NULL,
	"weeks" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_weekly_offs_uk" UNIQUE NULLS NOT DISTINCT("org_id","property_id","weekday"),
	CONSTRAINT "org_weekly_offs_weekday_ck" CHECK ("org_weekly_offs"."weekday" BETWEEN 0 AND 6),
	CONSTRAINT "org_weekly_offs_weeks_ck" CHECK ("org_weekly_offs"."weeks" <@ ARRAY[1,2,3,4,5]::integer[])
);
--> statement-breakpoint
CREATE TABLE "roster_publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"department_id" uuid,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"entry_count" integer NOT NULL,
	"published_by_user_id" uuid NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roster_publications_range_ck" CHECK ("roster_publications"."to_date" >= "roster_publications"."from_date" AND "roster_publications"."to_date" - "roster_publications"."from_date" <= 30)
);
--> statement-breakpoint
CREATE TABLE "rotation_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"pattern_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"start_step" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rotation_assignments_dates_ck" CHECK ("rotation_assignments"."ends_on" IS NULL OR "rotation_assignments"."ends_on" >= "rotation_assignments"."starts_on"),
	CONSTRAINT "rotation_assignments_step_ck" CHECK ("rotation_assignments"."start_step" >= 0)
);
--> statement-breakpoint
CREATE TABLE "rotation_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"name" text NOT NULL,
	"steps" jsonb NOT NULL,
	"rule" "hr_rotation_rule" NOT NULL,
	"rule_value" integer NOT NULL,
	"status" "hr_catalog_status" DEFAULT 'active' NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rotation_patterns_steps_ck" CHECK (jsonb_typeof("rotation_patterns"."steps") = 'array' AND jsonb_array_length("rotation_patterns"."steps") BETWEEN 2 AND 28),
	CONSTRAINT "rotation_patterns_rule_ck" CHECK (("rotation_patterns"."rule" = 'every_n_days' AND "rotation_patterns"."rule_value" BETWEEN 1 AND 28)
        OR ("rotation_patterns"."rule" = 'weekly' AND "rotation_patterns"."rule_value" BETWEEN 0 AND 6)
        OR ("rotation_patterns"."rule" = 'monthly' AND "rotation_patterns"."rule_value" BETWEEN 1 AND 28))
);
--> statement-breakpoint
CREATE TABLE "shift_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"kind" "hr_shift_request_kind" NOT NULL,
	"shift_template_id" uuid,
	"swap_employee_id" uuid,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"reason" text NOT NULL,
	"status" "hr_shift_request_status" NOT NULL,
	"colleague_accepted_at" timestamp with time zone,
	"colleague_accepted_by_user_id" uuid,
	"routed_to_employee_id" uuid,
	"requested_by_user_id" uuid,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shift_requests_kind_ck" CHECK (("shift_requests"."kind" = 'change' AND "shift_requests"."shift_template_id" IS NOT NULL AND "shift_requests"."swap_employee_id" IS NULL)
        OR ("shift_requests"."kind" = 'swap' AND "shift_requests"."swap_employee_id" IS NOT NULL AND "shift_requests"."shift_template_id" IS NULL)),
	CONSTRAINT "shift_requests_dates_ck" CHECK ("shift_requests"."to_date" >= "shift_requests"."from_date" AND "shift_requests"."to_date" - "shift_requests"."from_date" <= 30),
	CONSTRAINT "shift_requests_self_ck" CHECK ("shift_requests"."swap_employee_id" IS NULL OR "shift_requests"."swap_employee_id" <> "shift_requests"."employee_id")
);
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "in_latitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "in_longitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "in_accuracy_m" integer;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "in_distance_m" integer;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "out_latitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "out_longitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "out_accuracy_m" integer;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "out_distance_m" integer;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "kiosk_id" uuid;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "late_minutes" integer;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "early_minutes" integer;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "worked_minutes" integer;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "overtime_minutes" integer;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "approved_overtime_minutes" integer;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "day_kind" "hr_day_kind";--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "auto_closed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "roster_entries" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "roster_entries" ADD COLUMN "rotation_assignment_id" uuid;--> statement-breakpoint
ALTER TABLE "roster_entries" ADD COLUMN "shift_request_id" uuid;--> statement-breakpoint
ALTER TABLE "shift_templates" ADD COLUMN "min_work_minutes" integer;--> statement-breakpoint
ALTER TABLE "shift_templates" ADD COLUMN "auto_clock_out_minutes" integer;--> statement-breakpoint
ALTER TABLE "attendance_kiosks" ADD CONSTRAINT "attendance_kiosks_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_kiosks" ADD CONSTRAINT "attendance_kiosks_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_kiosks" ADD CONSTRAINT "attendance_kiosks_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_policies" ADD CONSTRAINT "attendance_policies_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_policies" ADD CONSTRAINT "attendance_policies_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_requests" ADD CONSTRAINT "attendance_requests_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_requests" ADD CONSTRAINT "attendance_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_requests" ADD CONSTRAINT "attendance_requests_record_id_attendance_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."attendance_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_requests" ADD CONSTRAINT "attendance_requests_routed_to_employee_id_employees_id_fk" FOREIGN KEY ("routed_to_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_requests" ADD CONSTRAINT "attendance_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_requests" ADD CONSTRAINT "attendance_requests_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_requests" ADD CONSTRAINT "attendance_requests_result_record_id_attendance_records_id_fk" FOREIGN KEY ("result_record_id") REFERENCES "public"."attendance_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_clock_settings" ADD CONSTRAINT "branch_clock_settings_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_clock_settings" ADD CONSTRAINT "branch_clock_settings_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_kiosk_pins" ADD CONSTRAINT "employee_kiosk_pins_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_kiosk_pins" ADD CONSTRAINT "employee_kiosk_pins_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_kiosk_pins" ADD CONSTRAINT "employee_kiosk_pins_set_by_user_id_users_id_fk" FOREIGN KEY ("set_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_request_comments" ADD CONSTRAINT "hr_request_comments_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_request_comments" ADD CONSTRAINT "hr_request_comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_request_comments" ADD CONSTRAINT "hr_request_comments_author_employee_id_employees_id_fk" FOREIGN KEY ("author_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kiosk_pin_locks" ADD CONSTRAINT "kiosk_pin_locks_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kiosk_pin_locks" ADD CONSTRAINT "kiosk_pin_locks_kiosk_id_attendance_kiosks_id_fk" FOREIGN KEY ("kiosk_id") REFERENCES "public"."attendance_kiosks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kiosk_pin_locks" ADD CONSTRAINT "kiosk_pin_locks_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_holidays" ADD CONSTRAINT "org_holidays_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_holidays" ADD CONSTRAINT "org_holidays_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_weekly_offs" ADD CONSTRAINT "org_weekly_offs_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_weekly_offs" ADD CONSTRAINT "org_weekly_offs_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_publications" ADD CONSTRAINT "roster_publications_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_publications" ADD CONSTRAINT "roster_publications_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_publications" ADD CONSTRAINT "roster_publications_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_publications" ADD CONSTRAINT "roster_publications_published_by_user_id_users_id_fk" FOREIGN KEY ("published_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotation_assignments" ADD CONSTRAINT "rotation_assignments_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotation_assignments" ADD CONSTRAINT "rotation_assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotation_assignments" ADD CONSTRAINT "rotation_assignments_pattern_id_rotation_patterns_id_fk" FOREIGN KEY ("pattern_id") REFERENCES "public"."rotation_patterns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotation_assignments" ADD CONSTRAINT "rotation_assignments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotation_patterns" ADD CONSTRAINT "rotation_patterns_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotation_patterns" ADD CONSTRAINT "rotation_patterns_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotation_patterns" ADD CONSTRAINT "rotation_patterns_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_requests" ADD CONSTRAINT "shift_requests_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_requests" ADD CONSTRAINT "shift_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_requests" ADD CONSTRAINT "shift_requests_shift_template_id_shift_templates_id_fk" FOREIGN KEY ("shift_template_id") REFERENCES "public"."shift_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_requests" ADD CONSTRAINT "shift_requests_swap_employee_id_employees_id_fk" FOREIGN KEY ("swap_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_requests" ADD CONSTRAINT "shift_requests_colleague_accepted_by_user_id_users_id_fk" FOREIGN KEY ("colleague_accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_requests" ADD CONSTRAINT "shift_requests_routed_to_employee_id_employees_id_fk" FOREIGN KEY ("routed_to_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_requests" ADD CONSTRAINT "shift_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_requests" ADD CONSTRAINT "shift_requests_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_kiosks_token_uk" ON "attendance_kiosks" USING btree ("token_hash") WHERE "attendance_kiosks"."token_hash" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "attendance_kiosks_property_idx" ON "attendance_kiosks" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "attendance_requests_employee_idx" ON "attendance_requests" USING btree ("employee_id","work_date");--> statement-breakpoint
CREATE INDEX "attendance_requests_open_idx" ON "attendance_requests" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "hr_request_comments_subject_idx" ON "hr_request_comments" USING btree ("subject_type","subject_id","created_at");--> statement-breakpoint
CREATE INDEX "org_holidays_org_idx" ON "org_holidays" USING btree ("org_id","from_date");--> statement-breakpoint
CREATE INDEX "roster_publications_property_idx" ON "roster_publications" USING btree ("property_id","from_date");--> statement-breakpoint
CREATE UNIQUE INDEX "rotation_assignments_open_uk" ON "rotation_assignments" USING btree ("employee_id") WHERE "rotation_assignments"."ends_on" IS NULL;--> statement-breakpoint
CREATE INDEX "rotation_assignments_pattern_idx" ON "rotation_assignments" USING btree ("pattern_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rotation_patterns_name_uk" ON "rotation_patterns" USING btree ("property_id",lower("name")) WHERE "rotation_patterns"."status" = 'active';--> statement-breakpoint
CREATE INDEX "shift_requests_employee_idx" ON "shift_requests" USING btree ("employee_id","from_date");--> statement-breakpoint
CREATE INDEX "shift_requests_open_idx" ON "shift_requests" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "roster_entries_rotation_idx" ON "roster_entries" USING btree ("rotation_assignment_id","work_date") WHERE "roster_entries"."rotation_assignment_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "shift_templates" ADD CONSTRAINT "shift_templates_minutes_ck" CHECK (("shift_templates"."min_work_minutes" IS NULL OR "shift_templates"."min_work_minutes" BETWEEN 0 AND 1440)
        AND ("shift_templates"."auto_clock_out_minutes" IS NULL OR "shift_templates"."auto_clock_out_minutes" BETWEEN 0 AND 720));--> statement-breakpoint
-- ADR-058, time (slice 4). Hand written, below this marker: drizzle cannot declare these
-- foreign keys without making people.ts and people-time.ts import each other, and
-- it does not write data. Regenerating this migration drops them, so append this
-- block again (the session script tm-0057-hand.mjs did).
--
-- Every entry slice 1 wrote was visible to its person the moment it was
-- written, so it is published as of then (058-time AC-TM1): no existing shift
-- disappears from anyone's view.
UPDATE "roster_entries" SET "published_at" = "created_at" WHERE "published_at" IS NULL;--> statement-breakpoint
ALTER TABLE "roster_entries" ADD CONSTRAINT "roster_entries_rotation_assignment_id_fk" FOREIGN KEY ("rotation_assignment_id") REFERENCES "public"."rotation_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_entries" ADD CONSTRAINT "roster_entries_shift_request_id_fk" FOREIGN KEY ("shift_request_id") REFERENCES "public"."shift_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_kiosk_id_fk" FOREIGN KEY ("kiosk_id") REFERENCES "public"."attendance_kiosks"("id") ON DELETE no action ON UPDATE no action;
