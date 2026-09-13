CREATE TYPE "public"."waitlist_audience" AS ENUM('traveller', 'owner');--> statement-breakpoint
CREATE TYPE "public"."waitlist_property_type" AS ENUM('hotel', 'guest_house', 'apartment', 'lodge', 'villa', 'hostel', 'homestay', 'campsite');--> statement-breakpoint
CREATE TYPE "public"."waitlist_size_band" AS ENUM('1_5', '6_20', '21_50', '50_plus');--> statement-breakpoint
CREATE TABLE "waitlist_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audience" "waitlist_audience" NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"business_name" text,
	"district_id" integer,
	"property_type" "waitlist_property_type",
	"size_band" "waitlist_size_band",
	"marketing_opt_in" boolean DEFAULT false NOT NULL,
	"unsubscribe_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"invited_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_owner_complete" CHECK (("waitlist_signups"."audience" <> 'owner') OR (
        "waitlist_signups"."phone" IS NOT NULL
        AND "waitlist_signups"."business_name" IS NOT NULL
        AND "waitlist_signups"."district_id" IS NOT NULL
        AND "waitlist_signups"."property_type" IS NOT NULL
        AND "waitlist_signups"."size_band" IS NOT NULL
      )),
	CONSTRAINT "waitlist_owner_phone_rw" CHECK (("waitlist_signups"."audience" <> 'owner') OR ("waitlist_signups"."phone" ~ '^[+]250(72|73|78|79)[0-9]{7}$'))
);
--> statement-breakpoint
ALTER TABLE "waitlist_signups" ADD CONSTRAINT "waitlist_signups_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_signups_email_uk" ON "waitlist_signups" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_signups_unsubscribe_token_uk" ON "waitlist_signups" USING btree ("unsubscribe_token");--> statement-breakpoint
CREATE INDEX "waitlist_signups_created_at_idx" ON "waitlist_signups" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "waitlist_signups_district_idx" ON "waitlist_signups" USING btree ("district_id");