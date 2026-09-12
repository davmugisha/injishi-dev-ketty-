CREATE TYPE "public"."housekeeping_status" AS ENUM('clean', 'dirty', 'inspected', 'out_of_order');--> statement-breakpoint
CREATE TYPE "public"."rate_derivation_kind" AS ENUM('percentage', 'fixed_amount');--> statement-breakpoint
CREATE TYPE "public"."rate_plan_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TABLE "bed_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_type_room_id" uuid NOT NULL,
	"label" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bed_types" (
	"code" text PRIMARY KEY NOT NULL,
	"ota_code" text,
	"label_en" text NOT NULL,
	"label_rw" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "beds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bed_configuration_id" uuid NOT NULL,
	"bed_type_code" text NOT NULL,
	"bed_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "beds_count_positive" CHECK ("beds"."bed_count" > 0)
);
--> statement-breakpoint
CREATE TABLE "meal_plans" (
	"code" text PRIMARY KEY NOT NULL,
	"ota_code" text,
	"label_en" text NOT NULL,
	"label_rw" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_type_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "rate_plan_status" DEFAULT 'active' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"base_price_rwf" bigint,
	"caution_rwf" bigint,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"base_occupancy" integer,
	"single_occupancy_price_rwf" bigint,
	"cancellation_tier" "cancellation_tier",
	"non_refundable" boolean DEFAULT false NOT NULL,
	"booking_mode" "booking_mode",
	"approval_policy" "approval_policy",
	"meal_plan_code" text,
	"min_stay" integer,
	"max_stay" integer,
	"advance_notice_hours" integer,
	"weekly_discount_pct" numeric,
	"monthly_discount_pct" numeric,
	"parent_rate_plan_id" uuid,
	"derivation_kind" "rate_derivation_kind",
	"derivation_value" numeric,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_plans_approval_policy_shape" CHECK (("rate_plans"."booking_mode" = 'request_to_book') OR ("rate_plans"."approval_policy" IS NULL)),
	CONSTRAINT "rate_plans_derivation_shape" CHECK (("rate_plans"."parent_rate_plan_id" IS NULL AND "rate_plans"."derivation_kind" IS NULL AND "rate_plans"."derivation_value" IS NULL)
          OR ("rate_plans"."parent_rate_plan_id" IS NOT NULL AND "rate_plans"."derivation_kind" IS NOT NULL AND "rate_plans"."derivation_value" IS NOT NULL)),
	CONSTRAINT "rate_plans_no_self_parent" CHECK ("rate_plans"."parent_rate_plan_id" <> "rate_plans"."id")
);
--> statement-breakpoint
CREATE TABLE "room_type_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_type_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "date_overrides_room_type_day_uk";--> statement-breakpoint
ALTER TABLE "amenities" ADD COLUMN "ota_code" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "rate_plan_id" uuid;--> statement-breakpoint
ALTER TABLE "date_overrides" ADD COLUMN "rate_plan_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "date_overrides" ADD COLUMN "min_stay_arrival" integer;--> statement-breakpoint
ALTER TABLE "date_overrides" ADD COLUMN "max_stay_arrival" integer;--> statement-breakpoint
ALTER TABLE "date_overrides" ADD COLUMN "closed_on_arrival" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "date_overrides" ADD COLUMN "closed_on_departure" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "room_types" ADD COLUMN "max_guests" integer;--> statement-breakpoint
ALTER TABLE "room_types" ADD COLUMN "max_adults" integer;--> statement-breakpoint
ALTER TABLE "room_types" ADD COLUMN "max_children" integer;--> statement-breakpoint
ALTER TABLE "room_types" ADD COLUMN "max_infants" integer;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "housekeeping_status" "housekeeping_status" DEFAULT 'clean' NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "housekeeping_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "housekeeping_updated_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "bed_configurations" ADD CONSTRAINT "bed_configurations_room_type_room_id_room_type_rooms_id_fk" FOREIGN KEY ("room_type_room_id") REFERENCES "public"."room_type_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beds" ADD CONSTRAINT "beds_bed_configuration_id_bed_configurations_id_fk" FOREIGN KEY ("bed_configuration_id") REFERENCES "public"."bed_configurations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beds" ADD CONSTRAINT "beds_bed_type_code_bed_types_code_fk" FOREIGN KEY ("bed_type_code") REFERENCES "public"."bed_types"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_meal_plan_code_meal_plans_code_fk" FOREIGN KEY ("meal_plan_code") REFERENCES "public"."meal_plans"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_parent_rate_plan_id_rate_plans_id_fk" FOREIGN KEY ("parent_rate_plan_id") REFERENCES "public"."rate_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_type_rooms" ADD CONSTRAINT "room_type_rooms_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bed_configurations_room_idx" ON "bed_configurations" USING btree ("room_type_room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bed_configurations_one_default_uk" ON "bed_configurations" USING btree ("room_type_room_id") WHERE "bed_configurations"."is_default";--> statement-breakpoint
CREATE INDEX "beds_configuration_idx" ON "beds" USING btree ("bed_configuration_id");--> statement-breakpoint
CREATE INDEX "rate_plans_room_type_idx" ON "rate_plans" USING btree ("room_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rate_plans_one_default_per_room_type_uk" ON "rate_plans" USING btree ("room_type_id") WHERE "rate_plans"."is_default";--> statement-breakpoint
CREATE INDEX "room_type_rooms_room_type_idx" ON "room_type_rooms" USING btree ("room_type_id");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_rate_plan_id_rate_plans_id_fk" FOREIGN KEY ("rate_plan_id") REFERENCES "public"."rate_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "date_overrides" ADD CONSTRAINT "date_overrides_rate_plan_id_rate_plans_id_fk" FOREIGN KEY ("rate_plan_id") REFERENCES "public"."rate_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_housekeeping_updated_by_user_id_users_id_fk" FOREIGN KEY ("housekeeping_updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "date_overrides_product_day_uk" ON "date_overrides" USING btree ("room_type_id","rate_plan_id","day");--> statement-breakpoint
CREATE INDEX "date_overrides_rate_plan_idx" ON "date_overrides" USING btree ("rate_plan_id");--> statement-breakpoint
CREATE INDEX "rooms_housekeeping_idx" ON "rooms" USING btree ("property_id","housekeeping_status");