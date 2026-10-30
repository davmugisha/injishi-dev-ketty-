-- The desk changes a confirmed reservation (2026-10-30, the owner's decisions): its dates, its room type,
-- its number of guests. A change reprices the stay. When it costs more the desk chooses each time: the
-- difference goes on the guest's bill, or the guest is asked to pay it now by MoMo and the change applies
-- once they have. When it costs less the difference stays on the bill as credit, used against extras, and
-- what is left is refunded at check out.
--
-- New enum values first. They are compared as text below (`purpose::text`), so this one migration can add
-- them and describe their rows: Postgres refuses a new enum value used in the transaction that adds it.
ALTER TYPE "public"."payment_attempt_purpose" ADD VALUE IF NOT EXISTS 'booking_change';--> statement-breakpoint
ALTER TYPE "public"."escrow_source" ADD VALUE IF NOT EXISTS 'booking_change';--> statement-breakpoint
-- The room money the guest has paid for this booking. Null until the first change: until then it is what it
-- always was, the locked nightly charge times the nights, less any refund. Once a change reprices the stay
-- the nightly charge no longer says what was paid, so this does: the prepayment the bill credits at check in.
ALTER TABLE "bookings" ADD COLUMN "paid_room_rwf" bigint;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_paid_room_nonnegative" CHECK ("paid_room_rwf" IS NULL OR "paid_room_rwf" >= 0);--> statement-breakpoint
CREATE TABLE "booking_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"status" text NOT NULL,
	"settlement" text NOT NULL,
	"from_check_in" date NOT NULL,
	"from_check_out" date NOT NULL,
	"from_room_type_id" uuid NOT NULL,
	"from_adults" smallint NOT NULL,
	"from_children" smallint NOT NULL,
	"to_check_in" date NOT NULL,
	"to_check_out" date NOT NULL,
	"to_room_type_id" uuid NOT NULL,
	"to_adults" smallint NOT NULL,
	"to_children" smallint NOT NULL,
	"from_nightly_rwf" bigint NOT NULL,
	"to_nightly_rwf" bigint NOT NULL,
	"paid_room_rwf" bigint NOT NULL,
	"new_room_rwf" bigint NOT NULL,
	"difference_rwf" bigint NOT NULL,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_at" timestamp with time zone,
	CONSTRAINT "booking_changes_status_ck" CHECK ("status" IN ('applied', 'awaiting_payment', 'abandoned')),
	CONSTRAINT "booking_changes_settlement_ck" CHECK ("settlement" IN ('none', 'bill', 'credit', 'momo')),
	-- What the difference says is what the settlement must be: nothing owed either way, more owed on the bill
	-- or by MoMo, credit when it costs less.
	CONSTRAINT "booking_changes_settlement_shape" CHECK (
		("difference_rwf" = 0 AND "settlement" = 'none')
		OR ("difference_rwf" > 0 AND "settlement" IN ('bill', 'momo'))
		OR ("difference_rwf" < 0 AND "settlement" = 'credit')),
	CONSTRAINT "booking_changes_applied_shape" CHECK (("status" = 'applied') = ("applied_at" IS NOT NULL)),
	CONSTRAINT "booking_changes_awaiting_momo" CHECK ("status" <> 'awaiting_payment' OR "settlement" = 'momo'),
	CONSTRAINT "booking_changes_dates_ordered" CHECK ("to_check_out" > "to_check_in" AND "from_check_out" > "from_check_in"),
	CONSTRAINT "booking_changes_money_nonnegative" CHECK ("from_nightly_rwf" >= 0 AND "to_nightly_rwf" >= 0 AND "paid_room_rwf" >= 0 AND "new_room_rwf" >= 0)
);--> statement-breakpoint
ALTER TABLE "booking_changes" ADD CONSTRAINT "booking_changes_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_changes" ADD CONSTRAINT "booking_changes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_changes" ADD CONSTRAINT "booking_changes_from_room_type_id_room_types_id_fk" FOREIGN KEY ("from_room_type_id") REFERENCES "public"."room_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_changes" ADD CONSTRAINT "booking_changes_to_room_type_id_room_types_id_fk" FOREIGN KEY ("to_room_type_id") REFERENCES "public"."room_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_changes" ADD CONSTRAINT "booking_changes_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_changes_booking_idx" ON "booking_changes" ("booking_id", "created_at");--> statement-breakpoint
-- At most one change waits on a MoMo payment per booking: a second would price against a stay that may move.
CREATE UNIQUE INDEX "booking_changes_one_awaiting_uk" ON "booking_changes" ("booking_id") WHERE "status" = 'awaiting_payment';--> statement-breakpoint
-- A MoMo request for a change's difference names the change it pays for.
ALTER TABLE "payment_attempts" ADD COLUMN "booking_change_id" uuid;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_booking_change_id_booking_changes_id_fk" FOREIGN KEY ("booking_change_id") REFERENCES "public"."booking_changes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" DROP CONSTRAINT "payment_attempts_purpose_shape";--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_purpose_shape" CHECK (
	("purpose"::text = 'booking'
		AND "room_type_id" IS NOT NULL AND "check_in" IS NOT NULL
		AND "check_out" IS NOT NULL AND "guest_count" IS NOT NULL
		AND "service_order_id" IS NULL AND "subscription_invoice_id" IS NULL AND "booking_change_id" IS NULL)
	OR ("purpose"::text = 'service_order'
		AND "service_order_id" IS NOT NULL
		AND "room_type_id" IS NULL AND "check_in" IS NULL
		AND "check_out" IS NULL AND "guest_count" IS NULL
		AND "subscription_invoice_id" IS NULL AND "booking_change_id" IS NULL)
	OR ("purpose"::text = 'registration_fee'
		AND "subscription_invoice_id" IS NOT NULL
		AND "service_order_id" IS NULL AND "room_type_id" IS NULL
		AND "check_in" IS NULL AND "check_out" IS NULL AND "guest_count" IS NULL AND "booking_change_id" IS NULL)
	OR ("purpose"::text = 'booking_change'
		AND "booking_change_id" IS NOT NULL AND "booking_id" IS NOT NULL
		AND "service_order_id" IS NULL AND "subscription_invoice_id" IS NULL
		AND "room_type_id" IS NULL AND "check_in" IS NULL AND "check_out" IS NULL AND "guest_count" IS NULL));
