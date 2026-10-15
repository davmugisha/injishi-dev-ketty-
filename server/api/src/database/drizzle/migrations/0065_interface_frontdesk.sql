CREATE TYPE "public"."booking_channel" AS ENUM('marketplace', 'direct', 'phone', 'travel_agent', 'corporate', 'channel_manager', 'walk_in');--> statement-breakpoint
CREATE TABLE "message_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"body_en" text NOT NULL,
	"body_rw" text,
	"body_fr" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "channel" "booking_channel";--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "adults" smallint;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "children" smallint;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "eta" time;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "desk_note" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "no_show_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "no_show_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "no_show_reason" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "guest_stays" ADD COLUMN "reference" text;--> statement-breakpoint
ALTER TABLE "guest_stays" ADD COLUMN "desk_note" text;--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "message_templates_org_key_uk" ON "message_templates" USING btree ("org_id","key");--> statement-breakpoint
CREATE INDEX "message_templates_workspace_idx" ON "message_templates" USING btree ("workspace_id","active");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_show_by_user_id_users_id_fk" FOREIGN KEY ("no_show_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "guest_stays_reference_uk" ON "guest_stays" USING btree ("reference") WHERE "guest_stays"."reference" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_show_shape" CHECK ("bookings"."no_show_at" IS NULL OR "bookings"."status" = 'no_show');--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_party_split" CHECK (("bookings"."adults" IS NULL OR ("bookings"."adults" > 0 AND "bookings"."adults" + coalesce("bookings"."children", 0) = "bookings"."guest_count"))
          AND ("bookings"."children" IS NULL OR "bookings"."children" >= 0));