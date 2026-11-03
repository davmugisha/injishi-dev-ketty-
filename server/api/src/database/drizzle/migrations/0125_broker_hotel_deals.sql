-- A broker's commission deal with a hotel (2026-11-02, the owner's call). The broker brings the hotel bookings,
-- the hotel pays a commission on the stays they become, and Injishi takes 15% of it. A deal is a percent of each
-- booking (`percent_bp`, basis points: 7.5% is 750) or one sum for a booking of at least `min_rooms` rooms
-- (`amount_rwf`). The broker proposes, the hotel's owner accepts or declines, either side ends a running deal.
-- One proposed or running deal per broker and hotel. No money moves here: that is the next phase.
CREATE TYPE "broker_deal_kind" AS ENUM ('percent', 'bulk_fixed');--> statement-breakpoint
CREATE TYPE "broker_deal_status" AS ENUM ('proposed', 'active', 'declined', 'withdrawn', 'ended');--> statement-breakpoint
CREATE TABLE "broker_hotel_deals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "broker_id" uuid NOT NULL REFERENCES "brokers"("id"),
  "org_id" uuid NOT NULL REFERENCES "orgs"("id"),
  "kind" "broker_deal_kind" NOT NULL,
  "percent_bp" integer,
  "amount_rwf" integer,
  "min_rooms" integer,
  "starts_on" date,
  "ends_on" date,
  "note" text,
  "status" "broker_deal_status" DEFAULT 'proposed' NOT NULL,
  "proposed_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "decided_by_user_id" uuid REFERENCES "users"("id"),
  "decided_at" timestamp with time zone,
  "decision_note" text,
  "closed_by_user_id" uuid REFERENCES "users"("id"),
  "closed_by" text,
  "closed_at" timestamp with time zone,
  "close_note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "broker_hotel_deals_terms_ck" CHECK (
    ("kind" = 'percent' AND "percent_bp" BETWEEN 100 AND 3000 AND "percent_bp" % 50 = 0 AND "amount_rwf" IS NULL AND "min_rooms" IS NULL)
    OR ("kind" = 'bulk_fixed' AND "percent_bp" IS NULL AND "amount_rwf" BETWEEN 1000 AND 50000000 AND "min_rooms" BETWEEN 2 AND 500)
  ),
  CONSTRAINT "broker_hotel_deals_dates_ck" CHECK ("starts_on" IS NULL OR "ends_on" IS NULL OR "ends_on" > "starts_on"),
  CONSTRAINT "broker_hotel_deals_closed_by_ck" CHECK ("closed_by" IS NULL OR "closed_by" IN ('broker', 'hotel'))
);--> statement-breakpoint
CREATE INDEX "broker_hotel_deals_broker_idx" ON "broker_hotel_deals" ("broker_id", "created_at");--> statement-breakpoint
CREATE INDEX "broker_hotel_deals_org_idx" ON "broker_hotel_deals" ("org_id", "created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "broker_hotel_deals_one_live_uk" ON "broker_hotel_deals" ("broker_id", "org_id") WHERE "status" IN ('proposed', 'active');
