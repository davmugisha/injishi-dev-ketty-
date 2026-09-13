-- ADR-050 Migration D — outlets grow parties (slice 4, task 20).
--
-- HAND CORRECTED after `drizzle-kit generate`, in one place. Read it before
-- regenerating, or it goes missing:
--
-- 1. The last statement INSERTS the `outlets.allowed_relationships` row into
--    `config_entries` (ADR-050 D-i). The generator knows nothing about data.
--    It lives here rather than in `seed-content.mjs` because it is the RULE,
--    not sample data: every database, production included, needs it the moment
--    the column exists, and a missing row would make the service refuse every
--    tenant. Guarded by NOT EXISTS, so a row an operator has since versioned is
--    never overwritten.
--
-- Two things that look like they need care and do not:
--
-- - Every new NOT NULL column on `outlets` carries a default, so no backfill.
--   Every outlet on disk is a hotel selling under its own TIN, which is exactly
--   what `relationship_type = hotel_operated` says, and why the new check
--   (`outlets_operator_named`) holds for every existing row with no party.
-- - `outlets.property_id` loses NOT NULL with nothing written: no row changes.
--
-- `outlet_tenancies.ended_reason` is not in the child's data model table. The
-- API table's `end` verb takes a `reason`, and this is where it is kept.
CREATE TYPE "public"."outlet_party_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."outlet_relationship_type" AS ENUM('hotel_operated', 'third_party_managed', 'leased_tenant', 'concession', 'franchise', 'revenue_share');--> statement-breakpoint
CREATE TYPE "public"."outlet_tenancy_status" AS ENUM('invited', 'requested', 'active', 'ended');--> statement-breakpoint
CREATE TYPE "public"."revenue_share_basis" AS ENUM('gross', 'net');--> statement-breakpoint
CREATE TABLE "outlet_parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"org_id" uuid,
	"legal_name" text NOT NULL,
	"tin" text,
	"contact_name" text,
	"contact_phone" text,
	"contact_email" text,
	"status" "outlet_party_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outlet_tenancies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"host_property_id" uuid NOT NULL,
	"host_org_id" uuid NOT NULL,
	"tenant_org_id" uuid NOT NULL,
	"status" "outlet_tenancy_status" NOT NULL,
	"invited_by_user_id" uuid,
	"invited_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"ended_reason" text,
	"revenue_share_bps" integer,
	"revenue_share_basis" "revenue_share_basis",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outlet_tenancies_share_bps_range" CHECK ("outlet_tenancies"."revenue_share_bps" IS NULL OR ("outlet_tenancies"."revenue_share_bps" >= 0 AND "outlet_tenancies"."revenue_share_bps" <= 10000))
);
--> statement-breakpoint
ALTER TABLE "outlets" ALTER COLUMN "property_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "operator_party_id" uuid;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "owner_party_id" uuid;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "relationship_type" "outlet_relationship_type" DEFAULT 'hotel_operated' NOT NULL;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "amenity_code" text;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "rra_branch_id" text DEFAULT '00' NOT NULL;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "guest_visible" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "address" jsonb;--> statement-breakpoint
ALTER TABLE "outlet_parties" ADD CONSTRAINT "outlet_parties_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlet_parties" ADD CONSTRAINT "outlet_parties_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlet_tenancies" ADD CONSTRAINT "outlet_tenancies_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlet_tenancies" ADD CONSTRAINT "outlet_tenancies_host_property_id_properties_id_fk" FOREIGN KEY ("host_property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlet_tenancies" ADD CONSTRAINT "outlet_tenancies_host_org_id_orgs_id_fk" FOREIGN KEY ("host_org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlet_tenancies" ADD CONSTRAINT "outlet_tenancies_tenant_org_id_orgs_id_fk" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlet_tenancies" ADD CONSTRAINT "outlet_tenancies_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "outlet_parties_org_uk" ON "outlet_parties" USING btree ("org_id") WHERE "outlet_parties"."org_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "outlet_parties_workspace_idx" ON "outlet_parties" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "outlet_tenancies_active_uk" ON "outlet_tenancies" USING btree ("outlet_id") WHERE "outlet_tenancies"."status" = 'active';--> statement-breakpoint
CREATE INDEX "outlet_tenancies_host_property_idx" ON "outlet_tenancies" USING btree ("host_property_id","status");--> statement-breakpoint
CREATE INDEX "outlet_tenancies_tenant_org_idx" ON "outlet_tenancies" USING btree ("tenant_org_id");--> statement-breakpoint
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_operator_party_id_outlet_parties_id_fk" FOREIGN KEY ("operator_party_id") REFERENCES "public"."outlet_parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_owner_party_id_outlet_parties_id_fk" FOREIGN KEY ("owner_party_id") REFERENCES "public"."outlet_parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_amenity_code_amenities_code_fk" FOREIGN KEY ("amenity_code") REFERENCES "public"."amenities"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outlets_property_idx" ON "outlets" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "outlets_property_amenity_uk" ON "outlets" USING btree ("property_id","amenity_code") WHERE "outlets"."amenity_code" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "outlets_slug_uk" ON "outlets" USING btree ("slug") WHERE "outlets"."slug" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_operator_named" CHECK ("outlets"."relationship_type" = 'hotel_operated' OR "outlets"."operator_party_id" IS NOT NULL);--> statement-breakpoint
INSERT INTO "config_entries" ("config_type", "value", "effective_from", "version", "locked_on_use")
SELECT 'outlets.allowed_relationships',
       '{"restaurant":["hotel_operated","third_party_managed","leased_tenant","concession","franchise","revenue_share"],"bar":["hotel_operated","third_party_managed","leased_tenant","concession","franchise","revenue_share"],"*":["hotel_operated"]}'::jsonb,
       now(), 1, false
 WHERE NOT EXISTS (SELECT 1 FROM "config_entries" WHERE "config_type" = 'outlets.allowed_relationships');
