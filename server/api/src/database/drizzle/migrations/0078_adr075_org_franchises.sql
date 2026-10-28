-- ADR-075 A1 task 5: whether a business is part of a franchise, and how (O-7, AC-8). One row per franchised org,
-- written in the registration's create transaction; no row means No. Each role is held to its own fields.
--
-- Written by hand, as 0075 to 0077 were: generating would also drop the waitlist drift 0075 describes.
CREATE TYPE "public"."franchise_role" AS ENUM('franchisee', 'franchisor');--> statement-breakpoint
CREATE TABLE "org_franchises" (
	"org_id" uuid PRIMARY KEY NOT NULL,
	"role" "franchise_role" NOT NULL,
	"brand_name" text NOT NULL,
	"franchisor_legal_name" text,
	"franchisor_country" char(2),
	"agreement_object_id" uuid,
	"franchised_locations" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_franchises_role_shape" CHECK (("org_franchises"."role" = 'franchisee' AND "org_franchises"."franchisor_legal_name" IS NOT NULL AND "org_franchises"."franchisor_country" IS NOT NULL AND "org_franchises"."franchised_locations" IS NULL)
          OR ("org_franchises"."role" = 'franchisor' AND "org_franchises"."franchisor_legal_name" IS NULL AND "org_franchises"."franchisor_country" IS NULL AND "org_franchises"."agreement_object_id" IS NULL AND "org_franchises"."franchised_locations" > 0))
);
--> statement-breakpoint
ALTER TABLE "org_franchises" ADD CONSTRAINT "org_franchises_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_franchises" ADD CONSTRAINT "org_franchises_agreement_object_id_stored_objects_id_fk" FOREIGN KEY ("agreement_object_id") REFERENCES "public"."stored_objects"("id") ON DELETE no action ON UPDATE no action;
