-- A broker's bookings at a hotel (2026-11-02, phase 2). Under a running deal a broker books one room or many
-- at once, a guest's name on every room; each room is its own booking, tied to the others by a group. Paid
-- at the hotel, the bookings are written at once and carry no payment; paid by MoMo, one payment covers the
-- group and the bookings are written only when it lands, each with its own share in escrow.
ALTER TYPE "payment_attempt_purpose" ADD VALUE IF NOT EXISTS 'broker_group';--> statement-breakpoint
CREATE TYPE "broker_booking_payment" AS ENUM ('at_hotel', 'momo');--> statement-breakpoint
CREATE TYPE "broker_group_status" AS ENUM ('awaiting_payment', 'booked', 'failed');--> statement-breakpoint
CREATE TABLE "broker_booking_groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "reference" text NOT NULL,
  "broker_id" uuid NOT NULL REFERENCES "brokers"("id"),
  "deal_id" uuid NOT NULL REFERENCES "broker_hotel_deals"("id"),
  "org_id" uuid NOT NULL REFERENCES "orgs"("id"),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id"),
  "check_in" date NOT NULL,
  "check_out" date NOT NULL,
  "payment" "broker_booking_payment" NOT NULL,
  "status" "broker_group_status" NOT NULL,
  "total_rwf" integer NOT NULL,
  "contact_phone" text NOT NULL,
  "note" text,
  "rooms" jsonb NOT NULL,
  "failure_reason" text,
  "created_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "broker_booking_groups_reference_uk" UNIQUE ("reference"),
  CONSTRAINT "broker_booking_groups_dates_ck" CHECK ("check_out" > "check_in"),
  CONSTRAINT "broker_booking_groups_total_ck" CHECK ("total_rwf" > 0)
);--> statement-breakpoint
CREATE INDEX "broker_booking_groups_broker_idx" ON "broker_booking_groups" ("broker_id", "created_at");--> statement-breakpoint
CREATE INDEX "broker_booking_groups_org_idx" ON "broker_booking_groups" ("org_id", "created_at");--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "broker_group_id" uuid REFERENCES "broker_booking_groups"("id");--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "broker_id" uuid REFERENCES "brokers"("id");--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "broker_deal_id" uuid REFERENCES "broker_hotel_deals"("id");--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "guest_name" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "guest_phone" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_broker_shape" CHECK (
  ("broker_group_id" IS NULL AND "broker_id" IS NULL AND "broker_deal_id" IS NULL)
  OR ("broker_group_id" IS NOT NULL AND "broker_id" IS NOT NULL AND "broker_deal_id" IS NOT NULL AND "guest_name" IS NOT NULL)
);--> statement-breakpoint
CREATE INDEX "bookings_broker_group_idx" ON "bookings" ("broker_group_id") WHERE "broker_group_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD COLUMN "broker_group_id" uuid REFERENCES "broker_booking_groups"("id");--> statement-breakpoint
ALTER TABLE "payment_attempts" DROP CONSTRAINT "payment_attempts_purpose_shape";--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_purpose_shape" CHECK (
	("purpose"::text = 'booking'
		AND "room_type_id" IS NOT NULL AND "check_in" IS NOT NULL
		AND "check_out" IS NOT NULL AND "guest_count" IS NOT NULL
		AND "service_order_id" IS NULL AND "subscription_invoice_id" IS NULL AND "booking_change_id" IS NULL
		AND "broker_group_id" IS NULL)
	OR ("purpose"::text = 'service_order'
		AND "service_order_id" IS NOT NULL
		AND "room_type_id" IS NULL AND "check_in" IS NULL
		AND "check_out" IS NULL AND "guest_count" IS NULL
		AND "subscription_invoice_id" IS NULL AND "booking_change_id" IS NULL AND "broker_group_id" IS NULL)
	OR ("purpose"::text = 'registration_fee'
		AND "subscription_invoice_id" IS NOT NULL
		AND "service_order_id" IS NULL AND "room_type_id" IS NULL
		AND "check_in" IS NULL AND "check_out" IS NULL AND "guest_count" IS NULL AND "booking_change_id" IS NULL
		AND "broker_group_id" IS NULL)
	OR ("purpose"::text = 'booking_change'
		AND "booking_change_id" IS NOT NULL AND "booking_id" IS NOT NULL
		AND "service_order_id" IS NULL AND "subscription_invoice_id" IS NULL
		AND "room_type_id" IS NULL AND "check_in" IS NULL AND "check_out" IS NULL AND "guest_count" IS NULL
		AND "broker_group_id" IS NULL)
	OR ("purpose"::text = 'broker_group'
		AND "broker_group_id" IS NOT NULL
		AND "service_order_id" IS NULL AND "subscription_invoice_id" IS NULL AND "booking_change_id" IS NULL
		AND "room_type_id" IS NULL AND "check_in" IS NULL AND "check_out" IS NULL AND "guest_count" IS NULL)
);
