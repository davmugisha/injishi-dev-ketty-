CREATE TYPE "public"."entitlement_source" AS ENUM('backfill', 'registration', 'plan', 'admin');--> statement-breakpoint
CREATE TYPE "public"."grant_family" AS ENUM('business', 'staff', 'oversight', 'self', 'device');--> statement-breakpoint
ALTER TYPE "public"."audit_subject_type" ADD VALUE 'entitlement';--> statement-breakpoint
ALTER TYPE "public"."audit_subject_type" ADD VALUE 'role';--> statement-breakpoint
ALTER TYPE "public"."audit_subject_type" ADD VALUE 'membership';--> statement-breakpoint
ALTER TYPE "public"."audit_subject_type" ADD VALUE 'ownership_transfer';--> statement-breakpoint
ALTER TYPE "public"."audit_subject_type" ADD VALUE 'device';--> statement-breakpoint
ALTER TYPE "public"."escalation_type" ADD VALUE 'business_kind_unresolved';--> statement-breakpoint
CREATE TABLE "org_product_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"product_id" text NOT NULL,
	"property_id" uuid,
	"source" "entitlement_source" NOT NULL,
	"enabled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disabled_at" timestamp with time zone,
	"set_by_user_id" uuid,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "actor_membership_id" uuid;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "grant_family" "grant_family";--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "role_keys" text[];--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "permissions" text[];--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "scope" jsonb;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "device_id" uuid;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "device_user_session_id" uuid;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "override_by_membership_id" uuid;--> statement-breakpoint
ALTER TABLE "org_product_entitlements" ADD CONSTRAINT "org_product_entitlements_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_product_entitlements" ADD CONSTRAINT "org_product_entitlements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_product_entitlements" ADD CONSTRAINT "org_product_entitlements_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_product_entitlements" ADD CONSTRAINT "org_product_entitlements_set_by_user_id_users_id_fk" FOREIGN KEY ("set_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "org_product_entitlements_open_uk" ON "org_product_entitlements" USING btree ("org_id","product_id",coalesce("property_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "org_product_entitlements"."disabled_at" IS NULL;--> statement-breakpoint
CREATE INDEX "org_product_entitlements_org_idx" ON "org_product_entitlements" USING btree ("org_id");--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_membership_id_org_memberships_id_fk" FOREIGN KEY ("actor_membership_id") REFERENCES "public"."org_memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_override_by_membership_id_org_memberships_id_fk" FOREIGN KEY ("override_by_membership_id") REFERENCES "public"."org_memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- ADR-076 slice G, by hand below this marker. Everything above was generated
-- from the schema; regenerating this migration drops what follows, so append it
-- again.
--
-- The eleven products (ADR-074 D-a). A new product is a migration (D-q).
INSERT INTO "products" ("id") VALUES
  ('account'), ('admin'), ('membership'), ('marketplace'), ('finance'), ('pay'),
  ('pms'), ('outlets'), ('pos'), ('hr'), ('residence')
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
-- The switch on backfill (ADR-076 G3, A-13). Every org gets `account`. An org
-- that is `active` or `suspended` also gets what it could reach the day before,
-- by domain, NOT its kind's set, so nothing changes for a business that already
-- exists: hospitality gets marketplace, pms, outlets, pos, hr, finance and pay;
-- residence gets marketplace, residence, hr, finance and pay. Each row covers
-- every branch (`property_id` null) and says `source = 'backfill'`.
--
-- An org that already holds ANY row for a product, open or closed, is left
-- alone for that product, so rerunning this changes nothing even after staff
-- have switched a product off somewhere. `seed-sample.mjs` runs the same
-- statement after seeding, because the seeds write orgs after migrations run.
INSERT INTO "org_product_entitlements" ("org_id", "product_id", "property_id", "source")
SELECT o."id", p."product_id", NULL, 'backfill'
FROM "orgs" o
CROSS JOIN LATERAL unnest(
  CASE
    WHEN o."registration_status" IN ('active', 'suspended') AND o."domain" = 'hospitality'
      THEN ARRAY['account', 'marketplace', 'pms', 'outlets', 'pos', 'hr', 'finance', 'pay']
    WHEN o."registration_status" IN ('active', 'suspended') AND o."domain" = 'residence'
      THEN ARRAY['account', 'marketplace', 'residence', 'hr', 'finance', 'pay']
    ELSE ARRAY['account']
  END
) AS p("product_id")
WHERE NOT EXISTS (
  SELECT 1 FROM "org_product_entitlements" e
  WHERE e."org_id" = o."id" AND e."product_id" = p."product_id"
);
