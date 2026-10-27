-- 073-gtbank-payments, build task 1: the bank record, the registration fee
-- attempt purpose, and the refund owed states.
--
-- WHY `payment_attempt_purpose` IS RECREATED RATHER THAN ALTERED: the rebuilt
-- `payment_attempts_purpose_shape` CHECK names 'registration_fee', and every
-- pending migration runs in ONE transaction, where Postgres refuses to use a
-- value `ALTER TYPE ... ADD VALUE` added (`unsafe use of new value`). A type
-- CREATEd inside a transaction may be used inside it (library-docs, the Drizzle
-- row; worked example 0005). Every other type keeps a plain ADD VALUE
-- because nothing in this migration names their new values.
--
-- `waitlist_signups` is deliberately untouched: 4f32a8f1 removed its schema
-- code and kept the table and its rows; dropping it is a separate forward
-- migration.
CREATE TYPE "public"."payment_direction" AS ENUM('collection', 'disbursement', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."payment_transaction_status" AS ENUM('queued', 'sending', 'pending', 'successful', 'failed', 'rejected', 'reversed', 'refunded', 'unknown', 'expired', 'not_sent');--> statement-breakpoint
ALTER TYPE "public"."escrow_status" ADD VALUE 'refund_pending';--> statement-breakpoint
ALTER TYPE "public"."money_override_action" ADD VALUE 'resend_disbursement';--> statement-breakpoint
ALTER TYPE "public"."money_override_action" ADD VALUE 'treasury_adjustment';--> statement-breakpoint
ALTER TYPE "public"."money_override_action" ADD VALUE 'confirm_received';--> statement-breakpoint
ALTER TYPE "public"."money_override_action" ADD VALUE 'cancel_service';--> statement-breakpoint
ALTER TYPE "public"."money_override_state" ADD VALUE 'rejected';--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'refund_pending';--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"provider" text NOT NULL,
	"adapter_mode" "adapter_mode" NOT NULL,
	"direction" "payment_direction" NOT NULL,
	"operation" text NOT NULL,
	"payment_attempt_id" uuid,
	"original_transaction_id" uuid,
	"payout_id" uuid,
	"booking_id" uuid,
	"money_override_id" uuid,
	"idempotency_key" text NOT NULL,
	"reference" text NOT NULL,
	"provider_reference" text,
	"amount_rwf" bigint NOT NULL,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"fee_rwf" bigint DEFAULT 0 NOT NULL,
	"fee_reported" boolean DEFAULT false NOT NULL,
	"status" "payment_transaction_status" NOT NULL,
	"queue_reason" text,
	"provider_status" text,
	"failure_reason" text,
	"payer_msisdn" text,
	"payer_network" text,
	"payer_purge_after" timestamp with time zone,
	"payee_full_name" text,
	"payee_id_type" text,
	"payee_id_number" text,
	"payee_destination" text,
	"payee_network_or_bank" text,
	"payee_account" text,
	"payee_phone" text,
	"reversal_flagged_at" timestamp with time zone,
	"reversal_kind" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"final_at" timestamp with time zone,
	"last_pulled_at" timestamp with time zone,
	"resolved_by_user_id" uuid,
	"resolved_at" timestamp with time zone,
	"resolution_outcome" text,
	"resolution_note" text,
	"written_off_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_transactions_idempotency_key_uk" UNIQUE("idempotency_key"),
	CONSTRAINT "payment_transactions_reference_uk" UNIQUE("reference"),
	CONSTRAINT "payment_transactions_operation_shape" CHECK (("payment_transactions"."direction" = 'collection'
            AND "payment_transactions"."operation" IN ('escrow_capture', 'one_time_fee', 'recurring_charge'))
        OR ("payment_transactions"."direction" = 'disbursement'
            AND "payment_transactions"."operation" IN ('refund', 'escrow_release_guest', 'escrow_release_host', 'payout'))
        OR ("payment_transactions"."direction" = 'adjustment' AND "payment_transactions"."operation" = 'adjustment')),
	CONSTRAINT "payment_transactions_amount_shape" CHECK (("payment_transactions"."direction" = 'adjustment' AND "payment_transactions"."amount_rwf" <> 0)
        OR ("payment_transactions"."direction" <> 'adjustment' AND "payment_transactions"."amount_rwf" > 0)),
	CONSTRAINT "payment_transactions_fee_non_negative" CHECK ("payment_transactions"."fee_rwf" >= 0),
	CONSTRAINT "payment_transactions_workspace_shape" CHECK ("payment_transactions"."workspace_id" IS NOT NULL OR "payment_transactions"."direction" = 'adjustment'),
	CONSTRAINT "payment_transactions_adjustment_shape" CHECK ("payment_transactions"."direction" <> 'adjustment'
        OR ("payment_transactions"."status" = 'successful' AND "payment_transactions"."money_override_id" IS NOT NULL)),
	CONSTRAINT "payment_transactions_queue_shape" CHECK (("payment_transactions"."status" = 'queued' AND "payment_transactions"."queue_reason" IS NOT NULL
            AND "payment_transactions"."queue_reason" IN ('awaiting_dispatch', 'insufficient_funds', 'payee_details_missing',
             'provider_unavailable', 'over_limit'))
        OR ("payment_transactions"."status" <> 'queued' AND "payment_transactions"."queue_reason" IS NULL)),
	CONSTRAINT "payment_transactions_payer_shape" CHECK ("payment_transactions"."direction" = 'collection'
        OR ("payment_transactions"."payer_msisdn" IS NULL AND "payment_transactions"."payer_network" IS NULL
            AND "payment_transactions"."payer_purge_after" IS NULL)),
	CONSTRAINT "payment_transactions_payee_shape" CHECK (("payment_transactions"."direction" <> 'disbursement'
            AND "payment_transactions"."payee_full_name" IS NULL AND "payment_transactions"."payee_id_type" IS NULL
            AND "payment_transactions"."payee_id_number" IS NULL AND "payment_transactions"."payee_destination" IS NULL
            AND "payment_transactions"."payee_network_or_bank" IS NULL AND "payment_transactions"."payee_account" IS NULL
            AND "payment_transactions"."payee_phone" IS NULL)
        OR ("payment_transactions"."direction" = 'disbursement'
            AND "payment_transactions"."payee_account" IS NOT NULL
            AND "payment_transactions"."payee_destination" IS NOT NULL
            AND "payment_transactions"."payee_destination" IN ('momo', 'bank')
            AND (("payment_transactions"."status" = 'queued' AND "payment_transactions"."queue_reason" IS NOT NULL
                  AND "payment_transactions"."queue_reason" = 'payee_details_missing')
              OR ("payment_transactions"."status" = 'failed' AND "payment_transactions"."sent_at" IS NULL)
              OR ("payment_transactions"."payee_full_name" IS NOT NULL
                  AND "payment_transactions"."payee_id_type" IS NOT NULL
                  AND "payment_transactions"."payee_id_type" IN ('national_id', 'passport')
                  AND "payment_transactions"."payee_id_number" IS NOT NULL
                  AND "payment_transactions"."payee_phone" IS NOT NULL)))),
	CONSTRAINT "payment_transactions_reversal_shape" CHECK (("payment_transactions"."reversal_flagged_at" IS NULL AND "payment_transactions"."reversal_kind" IS NULL)
        OR ("payment_transactions"."reversal_flagged_at" IS NOT NULL AND "payment_transactions"."reversal_kind" IS NOT NULL
            AND "payment_transactions"."reversal_kind" IN ('reversal', 'double_refund'))),
	CONSTRAINT "payment_transactions_resolution_shape" CHECK (("payment_transactions"."resolved_at" IS NULL AND "payment_transactions"."resolution_outcome" IS NULL
            AND "payment_transactions"."resolved_by_user_id" IS NULL)
        OR ("payment_transactions"."resolved_at" IS NOT NULL AND "payment_transactions"."resolved_by_user_id" IS NOT NULL
            AND "payment_transactions"."resolution_outcome" IS NOT NULL
            AND "payment_transactions"."resolution_outcome" IN ('failed', 'successful', 'stands', 'cancel_service')
            AND "payment_transactions"."resolution_note" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "payment_attempts" DROP CONSTRAINT "payment_attempts_purpose_shape";--> statement-breakpoint
ALTER TABLE "payment_attempts" ALTER COLUMN "purpose" DROP DEFAULT;--> statement-breakpoint
ALTER TYPE "public"."payment_attempt_purpose" RENAME TO "payment_attempt_purpose_old";--> statement-breakpoint
CREATE TYPE "public"."payment_attempt_purpose" AS ENUM('booking', 'service_order', 'registration_fee');--> statement-breakpoint
ALTER TABLE "payment_attempts" ALTER COLUMN "purpose" TYPE "public"."payment_attempt_purpose" USING "purpose"::text::"public"."payment_attempt_purpose";--> statement-breakpoint
ALTER TABLE "payment_attempts" ALTER COLUMN "purpose" SET DEFAULT 'booking';--> statement-breakpoint
DROP TYPE "public"."payment_attempt_purpose_old";--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD COLUMN "subscription_invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "money_overrides" ADD COLUMN "details" jsonb;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_payment_attempt_id_payment_attempts_id_fk" FOREIGN KEY ("payment_attempt_id") REFERENCES "public"."payment_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_original_transaction_id_payment_transactions_id_fk" FOREIGN KEY ("original_transaction_id") REFERENCES "public"."payment_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_payout_id_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_money_override_id_money_overrides_id_fk" FOREIGN KEY ("money_override_id") REFERENCES "public"."money_overrides"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_transactions_provider_reference_uk" ON "payment_transactions" USING btree ("provider","provider_reference") WHERE "payment_transactions"."provider_reference" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_transactions_attempt_uk" ON "payment_transactions" USING btree ("payment_attempt_id") WHERE "payment_transactions"."payment_attempt_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "payment_transactions_due_idx" ON "payment_transactions" USING btree ("status","next_attempt_at") WHERE "payment_transactions"."status" IN ('queued', 'sending', 'pending', 'unknown');--> statement-breakpoint
CREATE INDEX "payment_transactions_original_idx" ON "payment_transactions" USING btree ("original_transaction_id");--> statement-breakpoint
CREATE INDEX "payment_transactions_booking_idx" ON "payment_transactions" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "payment_transactions_workspace_idx" ON "payment_transactions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "payment_transactions_balance_idx" ON "payment_transactions" USING btree ("provider","adapter_mode","status");--> statement-breakpoint
CREATE INDEX "payment_attempts_subscription_invoice_idx" ON "payment_attempts" USING btree ("subscription_invoice_id");--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_purpose_shape" CHECK (("payment_attempts"."purpose" = 'booking'
            AND "payment_attempts"."room_type_id" IS NOT NULL AND "payment_attempts"."check_in" IS NOT NULL
            AND "payment_attempts"."check_out" IS NOT NULL AND "payment_attempts"."guest_count" IS NOT NULL
            AND "payment_attempts"."service_order_id" IS NULL AND "payment_attempts"."subscription_invoice_id" IS NULL)
        OR ("payment_attempts"."purpose" = 'service_order'
            AND "payment_attempts"."service_order_id" IS NOT NULL
            AND "payment_attempts"."room_type_id" IS NULL AND "payment_attempts"."check_in" IS NULL
            AND "payment_attempts"."check_out" IS NULL AND "payment_attempts"."guest_count" IS NULL
            AND "payment_attempts"."subscription_invoice_id" IS NULL)
        OR ("payment_attempts"."purpose" = 'registration_fee'
            AND "payment_attempts"."subscription_invoice_id" IS NOT NULL
            AND "payment_attempts"."service_order_id" IS NULL
            AND "payment_attempts"."room_type_id" IS NULL AND "payment_attempts"."check_in" IS NULL
            AND "payment_attempts"."check_out" IS NULL AND "payment_attempts"."guest_count" IS NULL));

-- 073-gtbank-payments.
-- Hand written below this line: drizzle cannot declare it, because
-- money.ts imports residence.ts. Regenerating this migration drops it;
-- append it again.
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_subscription_invoice_id_subscription_invoices_id_fk" FOREIGN KEY ("subscription_invoice_id") REFERENCES "public"."subscription_invoices"("id") ON DELETE no action ON UPDATE no action;
