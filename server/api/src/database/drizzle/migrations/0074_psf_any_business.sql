-- THE PSF PATH: a business of any sector registers on Injishi to join the
-- Private Sector Federation, and pays its membership fee here.
--
-- What this adds, agreed with the owner on 2026-10-15:
--   * `enterprise`, a third business domain beside hospitality and residence,
--     priced on its own `registration_business_type` row. Its TIN is optional;
--     `orgs.registration_kind` says what stands in for it (RCA, RGB, other or
--     none) and `orgs_registration_shape` holds the rule.
--   * PSF's sector catalogue, `psf_clusters` and `psf_associations`, seeded
--     below from the associations PSF publishes per cluster. Admin edits it.
--     Specialized (women, youth, disability) is `orgs.owner_groups`, a marker
--     on a business of any sector, not a cluster to pick.
--   * Business codes, `orgs.business_code`: the district's letters and a
--     number (`KIC0001`), counted per district in `business_code_counters`.
--     Every business that already paid its registration fee is given one below,
--     numbered in the order it registered.
--   * The new membership flow: an officer APPROVES (`approved`, which waits on
--     the payment), the business pays through Injishi, and the payment makes it
--     a member. The tiers become Golden Circle (5,000,000 and up, the new
--     `minimum` price kind), Indashyikirwa, and Indatwa in four bands.
--
-- NEW ENUM VALUES ARE NEVER USED HERE, the rule 0005, 0009, 0012 and 0063
-- record: `ALTER TYPE ... ADD VALUE` is legal inside a transaction, but Postgres
-- refuses to USE the new value until that transaction commits, and the
-- migrator applies every pending migration in ONE transaction. So every check
-- and index below that means `enterprise`, `approved` or `minimum` says so by
-- naming the OLD values it is not (`domain NOT IN ('hospitality', 'residence')`),
-- which needs no new value at all. Casting to text would also dodge the rule,
-- but an enum to text cast is not immutable, and an index predicate must be.
-- The rows that carry the new values (the 2026-10-15 tiers, the 5,000
-- enterprise fee) are written by the seeds after the migrator commits, and by
-- admin in production. The two enums CREATEd here are new types, which is a
-- different act, and usable at once.
--
-- FORWARD ONLY, like every migration here. Postgres cannot drop an enum value.
CREATE TYPE "public"."enterprise_registration_kind" AS ENUM('tin', 'rca', 'rgb', 'other', 'none');--> statement-breakpoint
CREATE TYPE "public"."psf_owner_group" AS ENUM('women', 'youth', 'pwd');--> statement-breakpoint
ALTER TYPE "public"."domain_kind" ADD VALUE 'enterprise';--> statement-breakpoint
ALTER TYPE "public"."psf_application_status" ADD VALUE 'approved' BEFORE 'member';--> statement-breakpoint
ALTER TYPE "public"."psf_membership_family" ADD VALUE 'indatwa' BEFORE 'ordinary';--> statement-breakpoint
ALTER TYPE "public"."psf_price_kind" ADD VALUE 'minimum' BEFORE 'set_by_psf';--> statement-breakpoint
ALTER TYPE "public"."registration_business_type" ADD VALUE 'enterprise';--> statement-breakpoint
CREATE TABLE "business_code_counters" (
	"district_id" integer PRIMARY KEY NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "psf_associations" (
	"code" text PRIMARY KEY NOT NULL,
	"cluster_code" text NOT NULL,
	"name_en" text NOT NULL,
	"acronym" text,
	"sort_order" smallint NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "psf_clusters" (
	"code" text PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_rw" text,
	"description" text,
	"sort_order" smallint NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orgs" DROP CONSTRAINT "orgs_domain_shape";--> statement-breakpoint
ALTER TABLE "orgs" DROP CONSTRAINT "orgs_identifier_shape";--> statement-breakpoint
ALTER TABLE "psf_membership_applications" DROP CONSTRAINT "psf_membership_applications_decision_shape";--> statement-breakpoint
ALTER TABLE "psf_membership_tiers" DROP CONSTRAINT "psf_membership_tiers_price_shape";--> statement-breakpoint
DROP INDEX "psf_membership_applications_one_open_uk";--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ALTER COLUMN "registration_number" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "business_code" text;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "psf_association_code" text;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "owner_groups" "psf_owner_group"[] DEFAULT '{}'::psf_owner_group[] NOT NULL;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "registration_kind" "enterprise_registration_kind";--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "registration_number" text;--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD COLUMN "declared_fee_rwf" bigint;--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD COLUMN "approved_membership_number" text;--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD COLUMN "approved_fee_rwf" bigint;--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD COLUMN "paid_amount_rwf" bigint;--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD COLUMN "payment_ref" text;--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD COLUMN "payment_mode" "adapter_mode";--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD COLUMN "remitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD COLUMN "remittance_ref" text;--> statement-breakpoint
ALTER TABLE "business_code_counters" ADD CONSTRAINT "business_code_counters_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psf_associations" ADD CONSTRAINT "psf_associations_cluster_code_psf_clusters_code_fk" FOREIGN KEY ("cluster_code") REFERENCES "public"."psf_clusters"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psf_associations" ADD CONSTRAINT "psf_associations_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psf_clusters" ADD CONSTRAINT "psf_clusters_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "psf_associations_cluster_idx" ON "psf_associations" USING btree ("cluster_code");--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_psf_association_code_psf_associations_code_fk" FOREIGN KEY ("psf_association_code") REFERENCES "public"."psf_associations"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orgs_psf_association_idx" ON "orgs" USING btree ("psf_association_code");--> statement-breakpoint
CREATE UNIQUE INDEX "psf_membership_applications_one_open_uk" ON "psf_membership_applications" USING btree ("org_id") WHERE "psf_membership_applications"."status" NOT IN ('member', 'declined', 'withdrawn');--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_business_code_uk" UNIQUE("business_code");--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_registration_shape" CHECK (("orgs"."domain" IN ('hospitality', 'residence') AND "orgs"."registration_kind" IS NULL AND "orgs"."registration_number" IS NULL)
          OR ("orgs"."domain" NOT IN ('hospitality', 'residence') AND "orgs"."registration_kind" IS NOT NULL
              AND ("orgs"."registration_kind" = 'tin') = ("orgs"."tin" IS NOT NULL)
              AND ("orgs"."registration_kind" IN ('rca', 'rgb', 'other')) = ("orgs"."registration_number" IS NOT NULL)));--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_domain_shape" CHECK (("orgs"."domain" = 'hospitality' AND "orgs"."accommodation_class" IS NOT NULL)
          OR ("orgs"."domain" = 'residence' AND "orgs"."residence_class" IS NOT NULL AND "orgs"."tourism_license_number" IS NULL AND NOT "orgs"."psf_member")
          OR ("orgs"."domain" NOT IN ('hospitality', 'residence') AND "orgs"."accommodation_class" IS NULL AND "orgs"."residence_class" IS NULL
              AND "orgs"."tourism_license_number" IS NULL AND "orgs"."psf_association_code" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_identifier_shape" CHECK (("orgs"."domain" = 'hospitality' AND "orgs"."tin" IS NOT NULL)
          OR ("orgs"."domain" = 'residence' AND "orgs"."upi" IS NOT NULL)
          OR ("orgs"."domain" NOT IN ('hospitality', 'residence')));--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD CONSTRAINT "psf_membership_applications_payment_shape" CHECK (("psf_membership_applications"."status" IN ('submitted', 'member', 'declined', 'withdrawn') OR ("psf_membership_applications"."approved_membership_number" IS NOT NULL AND "psf_membership_applications"."approved_fee_rwf" IS NOT NULL))
          AND (("psf_membership_applications"."paid_at" IS NULL) = ("psf_membership_applications"."paid_amount_rwf" IS NULL)
               AND ("psf_membership_applications"."paid_at" IS NULL) = ("psf_membership_applications"."payment_ref" IS NULL)
               AND ("psf_membership_applications"."paid_at" IS NULL) = ("psf_membership_applications"."payment_mode" IS NULL))
          AND ("psf_membership_applications"."paid_at" IS NULL OR "psf_membership_applications"."status" = 'member')
          AND ("psf_membership_applications"."remitted_at" IS NULL OR "psf_membership_applications"."paid_at" IS NOT NULL)
          AND (("psf_membership_applications"."remitted_at" IS NULL) = ("psf_membership_applications"."remittance_ref" IS NULL)));--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD CONSTRAINT "psf_membership_applications_registration_shape" CHECK (("psf_membership_applications"."registration_type" = 'none') = ("psf_membership_applications"."registration_number" IS NULL));--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD CONSTRAINT "psf_membership_applications_decision_shape" CHECK (("psf_membership_applications"."status" NOT IN ('submitted', 'withdrawn')) = ("psf_membership_applications"."decided_at" IS NOT NULL AND "psf_membership_applications"."decided_by_user_id" IS NOT NULL AND "psf_membership_applications"."decision_body_code" IS NOT NULL)
          AND ("psf_membership_applications"."status" = 'declined') = ("psf_membership_applications"."decline_reason" IS NOT NULL)
          AND ("psf_membership_applications"."decline_reason" IS DISTINCT FROM 'other' OR "psf_membership_applications"."decision_note" IS NOT NULL)
          AND ("psf_membership_applications"."status" = 'withdrawn') = ("psf_membership_applications"."withdrawn_at" IS NOT NULL AND "psf_membership_applications"."withdrawn_by_user_id" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "psf_membership_tiers" ADD CONSTRAINT "psf_membership_tiers_price_shape" CHECK (("psf_membership_tiers"."price_kind" = 'fixed' AND "psf_membership_tiers"."annual_fee_rwf" IS NOT NULL AND "psf_membership_tiers"."annual_fee_rwf" > 0
            AND "psf_membership_tiers"."annual_fee_min_rwf" IS NULL AND "psf_membership_tiers"."annual_fee_max_rwf" IS NULL)
          OR ("psf_membership_tiers"."price_kind" = 'range' AND "psf_membership_tiers"."annual_fee_rwf" IS NULL
            AND "psf_membership_tiers"."annual_fee_min_rwf" IS NOT NULL AND "psf_membership_tiers"."annual_fee_max_rwf" IS NOT NULL
            AND "psf_membership_tiers"."annual_fee_min_rwf" > 0 AND "psf_membership_tiers"."annual_fee_min_rwf" < "psf_membership_tiers"."annual_fee_max_rwf")
          OR ("psf_membership_tiers"."price_kind" NOT IN ('fixed', 'range', 'set_by_psf') AND "psf_membership_tiers"."annual_fee_rwf" IS NULL
            AND "psf_membership_tiers"."annual_fee_min_rwf" IS NOT NULL AND "psf_membership_tiers"."annual_fee_min_rwf" > 0 AND "psf_membership_tiers"."annual_fee_max_rwf" IS NULL)
          OR ("psf_membership_tiers"."price_kind" = 'set_by_psf' AND "psf_membership_tiers"."annual_fee_rwf" IS NULL
            AND "psf_membership_tiers"."annual_fee_min_rwf" IS NULL AND "psf_membership_tiers"."annual_fee_max_rwf" IS NULL));
--> statement-breakpoint
-- PSF's clusters. Agriculture, Industry, Trade and Services; the fifth,
-- Specialized, is `orgs.owner_groups`.
INSERT INTO "psf_clusters" ("code", "name_en", "description", "sort_order") VALUES
  ('agriculture', 'Agriculture & Livestock', 'Farming, livestock, cooperatives and the processors close to them.', 10),
  ('industry', 'Industry', 'Factories, mining, energy, construction, workshops and crafts.', 20),
  ('trade', 'Trade', 'Wholesale, retail, import, export and distribution.', 30),
  ('services', 'Services', 'Hospitality, tourism, transport, finance, health and professional services.', 40)
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
-- The associations PSF lists per cluster (psf.org.rw, its cluster pages, read
-- 2026-10-15), and one "other" per cluster so every business has a home until
-- admin adds the association it names.
INSERT INTO "psf_associations" ("code", "cluster_code", "name_en", "acronym", "sort_order") VALUES
  ('coffee_cooperatives', 'agriculture', 'Rwanda Coffee Cooperatives Federation', NULL, 10),
  ('poultry', 'agriculture', 'Rwanda Poultry Industry Association', NULL, 20),
  ('pig_farmers', 'agriculture', 'Rwanda Pig Farmers Association', NULL, 30),
  ('agriculture_other', 'agriculture', 'Other farming or livestock business', NULL, 990),
  ('ram', 'industry', 'Rwanda Association of Manufacturers', 'RAM', 10),
  ('rma', 'industry', 'Rwanda Mining Association', 'RMA', 20),
  ('epd', 'industry', 'Energy Private Developers', 'EPD', 30),
  ('icar', 'industry', 'Infrastructure Contractors Association of Rwanda', 'ICAR', 40),
  ('apromet', 'industry', 'Metal Works Association', 'APROMET', 50),
  ('rta', 'industry', 'Rwanda Tailors Association', 'RTA', 60),
  ('approjubar', 'industry', 'Beverage Producers Association', 'APPROJUBAR', 70),
  ('raprolep', 'industry', 'Leather Products Association', 'RAPROLEP', 80),
  ('ammirwa', 'industry', 'Maize Millers Association', 'AMMIRWA', 90),
  ('rfma', 'industry', 'Rice Millers Association', 'RFMA', 100),
  ('acper', 'industry', 'Cassava Processors Association', 'ACPER', 110),
  ('apior', 'industry', 'Printers Association', 'APIOR', 120),
  ('rwvca', 'industry', 'Wood Value Chain Association', 'RWVCA', 130),
  ('rapesh', 'industry', 'Handicrafts Association', 'RAPESH', 140),
  ('industry_other', 'industry', 'Other factory, workshop or craft', NULL, 990),
  ('asimper', 'trade', 'Petroleum Products Importers Association', 'ASIMPER', 10),
  ('acgdr', 'trade', 'Wholesalers and Retailers Association', 'ACGDR', 20),
  ('automobile_dealers', 'trade', 'Automobile Dealers Association', NULL, 30),
  ('appor', 'trade', 'Pharmacists Association', 'APPOR', 40),
  ('hides_skins', 'trade', 'Hides and Skins Traders Association', NULL, 50),
  ('onion_traders', 'trade', 'Onion Traders Association', NULL, 60),
  ('actr', 'trade', 'Cross-Border Traders Association', 'ACTR', 70),
  ('trade_other', 'trade', 'Other shop, trader or distributor', NULL, 990),
  ('rha', 'services', 'Rwanda Hospitality Association', 'RHA', 10),
  ('rtta', 'services', 'Rwanda Tours and Travel Association', 'RTTA', 20),
  ('rata', 'services', 'Rwanda Association of Travel Agencies', 'RATA', 30),
  ('rsga', 'services', 'Rwanda Safari Guides Association', 'RSGA', 40),
  ('community_tourism', 'services', 'Rwanda Community Tourism Association', NULL, 50),
  ('rhtea', 'services', 'Rwanda Hospitality and Tourism Educators Association', 'RHTEA', 60),
  ('artr', 'services', 'Association of Regional Transporters Rwanda', 'ARTR', 70),
  ('atpr', 'services', 'Passenger Transporters Association', 'ATPR', 80),
  ('rwaffa', 'services', 'Rwanda Freight Forwarders Association', 'RWAFFA', 90),
  ('rga', 'services', 'Rwanda Garages Association', 'RGA', 100),
  ('rba', 'services', 'Rwanda Bankers Association', 'RBA', 110),
  ('amir', 'services', 'Association of Microfinance Institutions in Rwanda', 'AMIR', 120),
  ('forex_bureaus', 'services', 'Forex Bureaus Association', NULL, 130),
  ('ict_chamber', 'services', 'Rwanda ICT Chamber', NULL, 140),
  ('bar_association', 'services', 'Rwanda Bar Association', NULL, 150),
  ('medical_facilities', 'services', 'Private Medical Facilities Association', NULL, 160),
  ('services_other', 'services', 'Other service business', NULL, 990)
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
-- Every hotel, guest house and bar is PSF's hospitality association, so the
-- officer's register files the businesses already here under Services.
UPDATE "orgs" SET "psf_association_code" = 'rha'
 WHERE "domain" = 'hospitality' AND "psf_association_code" IS NULL;--> statement-breakpoint
-- A code for every business that already paid its fee, numbered per district
-- in the order it registered. The letters are `DISTRICT_LETTERS` in
-- `@injishi/contracts`, written out once here because this runs once; a
-- district outside the national table takes its name's first three letters,
-- which is the same fallback the contract uses.
WITH "letters" ("district_id", "letters") AS (VALUES
  (101, 'NRG'), (102, 'GAS'), (103, 'KIC'),
  (201, 'NZA'), (202, 'GIS'), (203, 'NRU'), (204, 'HUY'), (205, 'NMG'), (206, 'RUH'), (207, 'MUH'), (208, 'KAM'),
  (301, 'KAR'), (302, 'RUT'), (303, 'RUB'), (304, 'NBH'), (305, 'NGR'), (306, 'RUS'), (307, 'NMS'),
  (401, 'RUL'), (402, 'GAK'), (403, 'MUS'), (404, 'BUR'), (405, 'GIC'),
  (501, 'RWA'), (502, 'NGT'), (503, 'GAT'), (504, 'KAY'), (505, 'KIR'), (506, 'NGM'), (507, 'BUG')
), "numbered" AS (
  SELECT "o"."id", "o"."district_id",
         row_number() OVER (PARTITION BY "o"."district_id" ORDER BY "o"."created_at", "o"."id") AS "n"
    FROM "orgs" "o"
   WHERE "o"."registration_status" <> 'pending_payment'
     AND "o"."district_id" IS NOT NULL
     AND "o"."business_code" IS NULL
)
UPDATE "orgs" SET "business_code" =
       coalesce("l"."letters", rpad(upper(left(regexp_replace("d"."name", '[^A-Za-z]', '', 'g'), 3)), 3, 'X'))
       || CASE WHEN "n"."n" < 10000 THEN lpad("n"."n"::text, 4, '0') ELSE "n"."n"::text END
  FROM "numbered" "n"
  JOIN "districts" "d" ON "d"."id" = "n"."district_id"
  LEFT JOIN "letters" "l" ON "l"."district_id" = "n"."district_id"
 WHERE "orgs"."id" = "n"."id";--> statement-breakpoint
-- The counters start where the backfill stopped, so the next business in each
-- district takes the next number.
INSERT INTO "business_code_counters" ("district_id", "last_number")
SELECT "district_id", count(*)::int FROM "orgs"
 WHERE "business_code" IS NOT NULL AND "district_id" IS NOT NULL
 GROUP BY "district_id"
ON CONFLICT ("district_id") DO UPDATE SET "last_number" = EXCLUDED."last_number";
