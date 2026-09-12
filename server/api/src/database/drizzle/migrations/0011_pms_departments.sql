-- ADR-016 migration phase 1 - departments, outlets, department members.
--
-- The first of nine phases, and it has to be first: `folio_charges.department_id`
-- is a required foreign key on a revenue charge, so no charge can post until
-- every property has a department set to point at (AC-14).
--
-- Additive only. No enum is recreated and no column changes type, so this does
-- not need the recreate dance that migrations 0005 and 0009 record.
--
-- The two backfills at the bottom are what make AC-14 true for rows that
-- ALREADY exist. No later phase would do it, and a property with no Rooms
-- department is a property whose first room charge fails.
CREATE TYPE "public"."department_category" AS ENUM('rooms', 'fnb', 'spa_recreation', 'other_operated', 'misc_income', 'admin_general', 'sales_marketing', 'it', 'engineering', 'utilities', 'hr');--> statement-breakpoint
CREATE TYPE "public"."department_member_status" AS ENUM('active', 'removed');--> statement-breakpoint
CREATE TYPE "public"."department_position" AS ENUM('department_head', 'supervisor', 'staff');--> statement-breakpoint
CREATE TYPE "public"."department_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."department_type" AS ENUM('operated', 'undistributed');--> statement-breakpoint
CREATE TYPE "public"."outlet_kind" AS ENUM('restaurant', 'bar', 'lounge', 'banquet', 'room_service', 'spa', 'gym', 'pool', 'gift_shop', 'parking', 'laundry', 'business_center', 'other');--> statement-breakpoint
CREATE TABLE "department_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" uuid NOT NULL,
	"org_membership_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"department_position" "department_position" DEFAULT 'staff' NOT NULL,
	"job_titles" jsonb,
	"is_primary" boolean DEFAULT false NOT NULL,
	"status" "department_member_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"property_id" uuid,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"department_type" "department_type" NOT NULL,
	"department_category" "department_category" NOT NULL,
	"is_revenue_center" boolean DEFAULT false NOT NULL,
	"guest_requestable" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "department_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "departments_revenue_center_is_operated" CHECK ("departments"."is_revenue_center" = false OR "departments"."department_type" = 'operated')
);
--> statement-breakpoint
CREATE TABLE "outlets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"outlet_kind" "outlet_kind" DEFAULT 'other' NOT NULL,
	"hours" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "department_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "room_types" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "department_members" ADD CONSTRAINT "department_members_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_members" ADD CONSTRAINT "department_members_org_membership_id_org_memberships_id_fk" FOREIGN KEY ("org_membership_id") REFERENCES "public"."org_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_members" ADD CONSTRAINT "department_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_members" ADD CONSTRAINT "department_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "department_members_department_idx" ON "department_members" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "department_members_user_idx" ON "department_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "department_members_active_uk" ON "department_members" USING btree ("department_id","user_id") WHERE "department_members"."status" = 'active';--> statement-breakpoint
CREATE INDEX "departments_property_idx" ON "departments" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "departments_workspace_idx" ON "departments" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "departments_org_idx" ON "departments" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_property_category_uk" ON "departments" USING btree ("property_id","department_category") WHERE "departments"."property_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "outlets_department_idx" ON "outlets" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "outlets_workspace_idx" ON "outlets" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "room_types_department_idx" ON "room_types" USING btree ("department_id");
--> statement-breakpoint
-- The USALI template, applied to every property that already exists.
--
-- One department per accounting category, which is the set §14.2 calls "the
-- USALI department set". Names are editable afterwards; the categories are not.
-- `guest_requestable` is true only where a guest genuinely contacts the
-- department directly: the front desk (Rooms), the restaurant (F and B), the spa,
-- and Engineering, because a broken tap is reported by the person looking at it.
--
-- ON CONFLICT DO NOTHING against `departments_property_category_uk`, so running
-- this twice cannot double a property's department list. That matters more than
-- it looks: the Rooms lookup a room charge does would become ambiguous.
INSERT INTO "departments" (
  "org_id", "property_id", "workspace_id", "name",
  "department_type", "department_category",
  "is_revenue_center", "guest_requestable", "sort_order"
)
SELECT
  p."org_id", p."id", p."workspace_id", t.name,
  t.dept_type::"public"."department_type",
  t.dept_category::"public"."department_category",
  t.is_revenue, t.guest_requestable, t.sort_order
FROM "properties" p
CROSS JOIN (VALUES
  ('Rooms',                              'operated',       'rooms',           true,  true,   10),
  ('Food and Beverage',                  'operated',       'fnb',             true,  true,   20),
  ('Spa and Recreation',                 'operated',       'spa_recreation',  true,  true,   30),
  ('Other Operated Departments',         'operated',       'other_operated',  true,  false,  40),
  ('Miscellaneous Income',               'operated',       'misc_income',     true,  false,  50),
  ('Administrative and General',         'undistributed',  'admin_general',   false, false,  60),
  ('Sales and Marketing',                'undistributed',  'sales_marketing', false, false,  70),
  ('Information and Telecommunications', 'undistributed',  'it',              false, false,  80),
  ('Engineering and Maintenance',        'undistributed',  'engineering',     false, true,   90),
  ('Utilities',                          'undistributed',  'utilities',       false, false, 100),
  ('Human Resources',                    'undistributed',  'hr',              false, false, 110)
) AS t(name, dept_type, dept_category, is_revenue, guest_requestable, sort_order)
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Every existing room type now points at its property's Rooms department, so a
-- room charge is attributable the first time one posts (AC-14). Only fills the
-- blanks, so a later run never moves a room type an operator repointed by hand.
UPDATE "room_types" rt
SET "department_id" = d."id"
FROM "departments" d
WHERE d."property_id" = rt."property_id"
  AND d."department_category" = 'rooms'
  AND rt."department_id" IS NULL;
