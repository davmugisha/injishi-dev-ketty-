ALTER TABLE "bookings" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancelled_by" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "refund_rwf" bigint;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancellation_shape" CHECK ("bookings"."cancelled_at" IS NULL OR ("bookings"."status" = 'cancelled' AND "bookings"."cancelled_by" IN ('guest', 'host') AND "bookings"."refund_rwf" IS NOT NULL));