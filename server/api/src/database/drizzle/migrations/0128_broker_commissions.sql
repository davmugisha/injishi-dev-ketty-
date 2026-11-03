-- A broker's commission, earned and collected (2026-11-02, phase 3). Earned at check-out on a stay that
-- happened: a percent deal's percent of the room price for the nights stayed (one per booking), or a bulk
-- deal's sum once the group's last room checked out (one per group). Collected from the hotel's payouts,
-- oldest first; once all of it is, the broker's 85% is paid to their MoMo number and Injishi keeps 15%.
ALTER TYPE "payout_source" ADD VALUE IF NOT EXISTS 'broker_commission';--> statement-breakpoint
CREATE TYPE "broker_commission_status" AS ENUM ('owed', 'collected');--> statement-breakpoint
CREATE TABLE "broker_commissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "broker_id" uuid NOT NULL REFERENCES "brokers"("id"),
  "deal_id" uuid NOT NULL REFERENCES "broker_hotel_deals"("id"),
  "group_id" uuid NOT NULL REFERENCES "broker_booking_groups"("id"),
  "booking_id" uuid REFERENCES "bookings"("id"),
  "org_id" uuid NOT NULL REFERENCES "orgs"("id"),
  "kind" "broker_deal_kind" NOT NULL,
  "base_rwf" integer,
  "nights_stayed" integer,
  "commission_rwf" integer NOT NULL,
  "injishi_rwf" integer NOT NULL,
  "broker_rwf" integer NOT NULL,
  "collected_rwf" integer DEFAULT 0 NOT NULL,
  "status" "broker_commission_status" DEFAULT 'owed' NOT NULL,
  "earned_at" timestamp with time zone DEFAULT now() NOT NULL,
  "collected_at" timestamp with time zone,
  "payout_id" uuid REFERENCES "payouts"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "broker_commissions_split_ck" CHECK ("injishi_rwf" + "broker_rwf" = "commission_rwf" AND "commission_rwf" > 0),
  CONSTRAINT "broker_commissions_collected_ck" CHECK ("collected_rwf" BETWEEN 0 AND "commission_rwf"),
  CONSTRAINT "broker_commissions_status_ck" CHECK (("status" = 'collected') = ("collected_rwf" = "commission_rwf" AND "collected_at" IS NOT NULL)),
  CONSTRAINT "broker_commissions_kind_ck" CHECK (("kind" = 'percent') = ("booking_id" IS NOT NULL))
);--> statement-breakpoint
CREATE UNIQUE INDEX "broker_commissions_booking_uk" ON "broker_commissions" ("booking_id") WHERE "booking_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "broker_commissions_group_bulk_uk" ON "broker_commissions" ("group_id") WHERE "kind" = 'bulk_fixed';--> statement-breakpoint
CREATE INDEX "broker_commissions_org_owed_idx" ON "broker_commissions" ("org_id", "earned_at") WHERE "status" = 'owed';--> statement-breakpoint
CREATE INDEX "broker_commissions_broker_idx" ON "broker_commissions" ("broker_id", "earned_at");--> statement-breakpoint
CREATE TABLE "broker_commission_deductions" (
  "commission_id" uuid NOT NULL REFERENCES "broker_commissions"("id"),
  -- The stay whose check-out paid it, and the hotel payout it came off (none when all of it went).
  "booking_id" uuid NOT NULL REFERENCES "bookings"("id"),
  "payout_id" uuid REFERENCES "payouts"("id"),
  "amount_rwf" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "broker_commission_deductions_amount_ck" CHECK ("amount_rwf" > 0)
);--> statement-breakpoint
CREATE UNIQUE INDEX "broker_commission_deductions_pk" ON "broker_commission_deductions" ("commission_id", "booking_id");--> statement-breakpoint
CREATE INDEX "broker_commission_deductions_payout_idx" ON "broker_commission_deductions" ("payout_id");--> statement-breakpoint
CREATE TABLE "broker_payout_accounts" (
  "broker_id" uuid PRIMARY KEY NOT NULL REFERENCES "brokers"("id"),
  "account_name" text NOT NULL,
  "momo_network" "momo_network" NOT NULL,
  "momo_phone" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "broker_payout_accounts_phone_ck" CHECK ("momo_phone" ~ '^[+]250(72|73|78|79)[0-9]{7}$'),
  CONSTRAINT "broker_payout_accounts_name_ck" CHECK (length(btrim("account_name")) > 0)
);
