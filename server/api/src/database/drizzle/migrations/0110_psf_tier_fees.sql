-- WHAT A BAND COSTS, BY PLACE (2026-10-20). A business no longer types its
-- membership amount: PSF officers set it. A null district is the national
-- price (a national officer sets it); a district row wins inside its district
-- (its district or province officer sets it). No row: the band's own starting
-- price applies.
CREATE TABLE "psf_tier_fees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tier_code" text NOT NULL,
	"district_id" integer,
	"annual_fee_rwf" bigint NOT NULL,
	"set_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "psf_tier_fees_positive" CHECK ("psf_tier_fees"."annual_fee_rwf" > 0)
);
--> statement-breakpoint
ALTER TABLE "psf_tier_fees" ADD CONSTRAINT "psf_tier_fees_tier_code_psf_membership_tiers_code_fk" FOREIGN KEY ("tier_code") REFERENCES "public"."psf_membership_tiers"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psf_tier_fees" ADD CONSTRAINT "psf_tier_fees_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psf_tier_fees" ADD CONSTRAINT "psf_tier_fees_set_by_user_id_users_id_fk" FOREIGN KEY ("set_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "psf_tier_fees_place_uk" ON "psf_tier_fees" USING btree ("tier_code",coalesce("district_id", 0));