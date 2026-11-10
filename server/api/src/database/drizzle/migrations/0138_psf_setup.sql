-- PSF's own setup (2026-11-06, the owner): the National Manager sets the split, the levels and bands,
-- and the fields of the public form.

-- The split: a history, the newest row is the rate. A change applies to new payments only.
CREATE TABLE "psf_split_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"district_percent" smallint NOT NULL,
	"set_by_user_id" uuid REFERENCES "users"("id"),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "psf_split_rates_percent_ck" CHECK ("district_percent" BETWEEN 0 AND 100)
);
--> statement-breakpoint
INSERT INTO "psf_split_rates" ("district_percent") VALUES (60);
--> statement-breakpoint
ALTER TABLE "psf_fee_allocations" ADD COLUMN "district_percent" smallint DEFAULT 60 NOT NULL;
--> statement-breakpoint

-- Levels: Golden Circle and the rest become rows, so PSF can add one without a release.
CREATE TABLE "psf_levels" (
	"code" text PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"blurb_en" text,
	"sort_order" smallint NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_by_user_id" uuid REFERENCES "users"("id"),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "psf_levels" ("code", "name_en", "blurb_en", "sort_order", "active") VALUES
	('golden_circle', 'Golden Circle', 'For large companies and major investors.', 10, true),
	('indashyikirwa', 'Indashyikirwa', 'For established businesses leading their sector.', 20, true),
	('indatwa', 'Indatwa', 'For small and growing businesses. Pick the band you can afford.', 30, true),
	('ordinary', 'Ordinary', 'Retired.', 90, false),
	('junior_giants', 'Junior Giants', 'Retired.', 91, false);
--> statement-breakpoint
ALTER TABLE "psf_membership_tiers" ALTER COLUMN "family" TYPE text USING "family"::text;
--> statement-breakpoint
ALTER TABLE "psf_membership_tiers" ADD CONSTRAINT "psf_membership_tiers_family_fk" FOREIGN KEY ("family") REFERENCES "psf_levels"("code");
--> statement-breakpoint
DROP TYPE "public"."psf_membership_family";
--> statement-breakpoint

-- The public form: one row for each built-in field PSF has changed; no row means the form's own wording.
CREATE TABLE "psf_form_field_settings" (
	"field_key" text PRIMARY KEY NOT NULL,
	"label" text,
	"help_text" text,
	"required" boolean,
	"visible" boolean DEFAULT true NOT NULL,
	"sort_order" smallint,
	"updated_by_user_id" uuid REFERENCES "users"("id"),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Which step an extra question sits on.
ALTER TABLE "psf_membership_form_fields" ADD COLUMN "step" text DEFAULT 'business' NOT NULL;
--> statement-breakpoint
ALTER TABLE "psf_membership_form_fields" ADD CONSTRAINT "psf_membership_form_fields_step_ck" CHECK ("step" IN ('business', 'place', 'you', 'membership'));
