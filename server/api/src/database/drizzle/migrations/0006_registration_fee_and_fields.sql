-- D23/D24 — registration fee timing and the registration form fields.
--
-- APPLYING THIS TO A DATABASE THAT ALREADY HAS ORGS:
-- `orgs_identifier_shape` requires a TIN on every hospitality org and a UPI on
-- every residence org. Rows written before D24 may have neither, and
-- ADD CONSTRAINT validates existing rows, so it will fail on them. Correct those
-- rows first:
--
--   SELECT id, legal_name, domain, tin, upi FROM orgs
--    WHERE (domain = 'hospitality' AND tin IS NULL)
--       OR (domain = 'residence'   AND upi IS NULL);
--
-- On an empty database, or one rebuilt by `node tools/demo-up.mjs --reset`,
-- there is nothing to correct and this applies clean.

CREATE TABLE "org_certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"kind" "org_certificate_kind" NOT NULL,
	"kind_other" text,
	"object_key" text,
	"certificate_number" text,
	"issued_by" text,
	"issued_on" date,
	"expires_on" date,
	"verified_at" timestamp with time zone,
	"verified_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_certificates_kind_other_shape" CHECK (("org_certificates"."kind" = 'other' AND "org_certificates"."kind_other" IS NOT NULL)
          OR ("org_certificates"."kind" <> 'other' AND "org_certificates"."kind_other" IS NULL))
);--> statement-breakpoint
CREATE TABLE "registration_fees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_type" "registration_business_type" NOT NULL,
	"amount_rwf" bigint,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "orgs" DROP CONSTRAINT "orgs_domain_shape";--> statement-breakpoint
ALTER TABLE "orgs" ALTER COLUMN "tin" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orgs" ALTER COLUMN "registration_status" SET DEFAULT 'pending_payment';--> statement-breakpoint
ALTER TABLE "subscription_invoices" ALTER COLUMN "subscription_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "accommodation_class_other" text;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "chamber_of_tourism_member" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "psf_member" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "sector_id" integer;--> statement-breakpoint
ALTER TABLE "subscription_invoices" ADD COLUMN "invoice_kind" "invoice_kind" DEFAULT 'subscription' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "gender" "gender";--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "country" char(2) DEFAULT 'RW' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "sector_id" integer;--> statement-breakpoint
ALTER TABLE "org_certificates" ADD CONSTRAINT "org_certificates_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_certificates" ADD CONSTRAINT "org_certificates_object_key_stored_objects_object_key_fk" FOREIGN KEY ("object_key") REFERENCES "public"."stored_objects"("object_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_certificates" ADD CONSTRAINT "org_certificates_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "org_certificates_org_idx" ON "org_certificates" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "org_certificates_expiry_idx" ON "org_certificates" USING btree ("expires_on") WHERE "org_certificates"."expires_on" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "registration_fees_lookup_idx" ON "registration_fees" USING btree ("business_type","effective_from");--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_invoices_registration_fee_uk" ON "subscription_invoices" USING btree ("org_id") WHERE "subscription_invoices"."invoice_kind" = 'registration_fee';--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_identifier_shape" CHECK (("orgs"."domain" = 'hospitality' AND "orgs"."tin" IS NOT NULL)
          OR ("orgs"."domain" = 'residence' AND "orgs"."upi" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_accommodation_class_other_shape" CHECK (("orgs"."accommodation_class" = 'other' AND "orgs"."accommodation_class_other" IS NOT NULL)
          OR ("orgs"."accommodation_class" IS DISTINCT FROM 'other' AND "orgs"."accommodation_class_other" IS NULL));--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_domain_shape" CHECK (("orgs"."domain" = 'hospitality' AND "orgs"."accommodation_class" IS NOT NULL)
          OR ("orgs"."domain" = 'residence' AND "orgs"."residence_class" IS NOT NULL AND "orgs"."tourism_license_number" IS NULL AND NOT "orgs"."psf_member"));--> statement-breakpoint
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_kind_shape" CHECK (("subscription_invoices"."invoice_kind" = 'subscription' AND "subscription_invoices"."subscription_id" IS NOT NULL)
          OR ("subscription_invoices"."invoice_kind" = 'registration_fee' AND "subscription_invoices"."subscription_id" IS NULL
              AND "subscription_invoices"."period_start" IS NULL AND "subscription_invoices"."period_end" IS NULL));--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_address_country_shape" CHECK ("user_profiles"."country" = 'RW'
          OR ("user_profiles"."district_id" IS NULL AND "user_profiles"."sector_id" IS NULL AND "user_profiles"."village_id" IS NULL));
