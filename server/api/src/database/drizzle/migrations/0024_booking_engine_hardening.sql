CREATE TABLE "payment_compensations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"workspace_id" uuid NOT NULL,
	"original_ref" text NOT NULL,
	"amount_rwf" bigint NOT NULL,
	"booking_id" uuid,
	"memo" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_compensations_key_uk" UNIQUE("idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "sweep_claimed_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "escrows" ADD COLUMN "attempt_fingerprint" text;--> statement-breakpoint
CREATE INDEX "payment_compensations_due_idx" ON "payment_compensations" USING btree ("next_at") WHERE "payment_compensations"."done_at" IS NULL;