-- Rentals rebuild, P1 (blueprint 1.5, step 7): ONE payment record. rent_payments becomes
-- lease_payments; what a payment paid moves to lease_payment_allocations; rent_reminders becomes
-- lease_reminders.
--
-- The old rent roll mostly kept a paid amount on each charge and no payment at all. So, per
-- charge: the old payments that were received pay it first; whatever the rent roll says was paid
-- beyond them becomes one "recorded, migrated from the rent roll" payment (or "... deposit
-- record" for the deposit charges 0078 made). Afterwards, on every charge, the live allocations
-- add up to paid_rwf, which a DO block checks before the migration may finish.
-- 1. rent_payments becomes lease_payments ----------------------------------------------------------
ALTER TABLE "rent_payments" RENAME TO "lease_payments";--> statement-breakpoint
ALTER INDEX "rent_payments_pkey" RENAME TO "lease_payments_pkey";--> statement-breakpoint
ALTER TABLE "lease_payments" RENAME CONSTRAINT "rent_payments_workspace_id_workspaces_id_fk" TO "lease_payments_workspace_id_workspaces_id_fk";--> statement-breakpoint
ALTER TABLE "lease_payments" RENAME CONSTRAINT "rent_payments_property_id_properties_id_fk" TO "lease_payments_property_id_properties_id_fk";--> statement-breakpoint
ALTER TABLE "lease_payments" RENAME CONSTRAINT "rent_payments_lease_id_leases_id_fk" TO "lease_payments_lease_id_leases_id_fk";--> statement-breakpoint
ALTER TABLE "lease_payments" RENAME CONSTRAINT "rent_payments_recorded_by_user_id_users_id_fk" TO "lease_payments_recorded_by_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "lease_payments" RENAME CONSTRAINT "rent_payments_rent_charge_id_lease_charges_id_fk" TO "lease_payments_rent_charge_id_lease_charges_id_fk";--> statement-breakpoint
ALTER TABLE "lease_payments" RENAME CONSTRAINT "rent_payments_idempotency_key_uk" TO "lease_payments_idempotency_key_uk";--> statement-breakpoint
ALTER TABLE "lease_payments" DROP CONSTRAINT "rent_payments_amount_positive";--> statement-breakpoint
ALTER TABLE "lease_payments" DROP CONSTRAINT "rent_payments_method_known";--> statement-breakpoint
ALTER TABLE "lease_payments" DROP CONSTRAINT "rent_payments_status_known";--> statement-breakpoint
ALTER TABLE "lease_payments" DROP CONSTRAINT "rent_payments_verified_shape";--> statement-breakpoint
DROP INDEX "rent_payments_scope_status_idx";--> statement-breakpoint
DROP INDEX "rent_payments_lease_idx";--> statement-breakpoint
ALTER TABLE "lease_payments" RENAME COLUMN "provider_ref" TO "reference";--> statement-breakpoint
ALTER TABLE "lease_payments" RENAME COLUMN "verified_at" TO "succeeded_at";--> statement-breakpoint
ALTER TABLE "lease_payments" ALTER COLUMN "reference" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "lease_payments" ALTER COLUMN "rent_charge_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "lease_payments" ALTER COLUMN "received_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "lease_payments" ALTER COLUMN "received_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "lease_payments" ALTER COLUMN "method" SET DATA TYPE "public"."lease_payment_method" USING "method"::"public"."lease_payment_method";--> statement-breakpoint
-- verified is succeeded and failed stays failed. A payment still pending or of unknown result was
-- only ever a claim: it never counted, and nothing will answer it now, so it expires (with the
-- reason) rather than wait forever.
ALTER TABLE "lease_payments" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "lease_payments" ADD COLUMN "failure_reason" text;--> statement-breakpoint
UPDATE "lease_payments"
   SET "failure_reason" = 'Not confirmed before payments became records (migration 0079); it never counted as paid.'
 WHERE "status" IN ('pending', 'unknown');--> statement-breakpoint
ALTER TABLE "lease_payments" ALTER COLUMN "status" SET DATA TYPE "public"."lease_payment_status" USING (
  CASE "status"
    WHEN 'verified' THEN 'succeeded'
    WHEN 'failed' THEN 'failed'
    ELSE 'expired'
  END
)::"public"."lease_payment_status";--> statement-breakpoint
ALTER TABLE "lease_payments" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "lease_payments" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "lease_payments" ADD COLUMN "channel" "lease_payment_channel";--> statement-breakpoint
ALTER TABLE "lease_payments" ADD COLUMN "currency" char(3) DEFAULT 'RWF' NOT NULL;--> statement-breakpoint
ALTER TABLE "lease_payments" ADD COLUMN "payer_user_id" uuid;--> statement-breakpoint
ALTER TABLE "lease_payments" ADD COLUMN "payer_masked" text;--> statement-breakpoint
ALTER TABLE "lease_payments" ADD COLUMN "adapter_ref" text;--> statement-breakpoint
ALTER TABLE "lease_payments" ADD COLUMN "adapter_mode" "adapter_mode";--> statement-breakpoint
ALTER TABLE "lease_payments" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lease_payments" ADD COLUMN "received_on" date;--> statement-breakpoint
ALTER TABLE "lease_payments" ADD COLUMN "receipt_object_id" uuid;--> statement-breakpoint
ALTER TABLE "lease_payments" ADD COLUMN "reversed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lease_payments" ADD COLUMN "reversed_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "lease_payments" ADD COLUMN "reverse_reason" text;--> statement-breakpoint
ALTER TABLE "lease_payments" ADD COLUMN "payout_id" uuid;--> statement-breakpoint
ALTER TABLE "lease_payments" ADD COLUMN "receipt_number" text;--> statement-breakpoint
ALTER TABLE "lease_payments" ADD COLUMN "legacy" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- The old rows were written on the rent roll (no gateway existed for rent): recorded, legacy.
UPDATE "lease_payments" p
   SET "tenant_id" = l."tenant_id",
       "channel" = 'recorded',
       "legacy" = true,
       "received_on" = (coalesce(p."received_at", p."created_at") AT TIME ZONE 'Africa/Kigali')::date,
       "succeeded_at" = CASE WHEN p."status" = 'succeeded' THEN coalesce(p."succeeded_at", p."received_at", p."created_at") END
  FROM "leases" l WHERE l."id" = p."lease_id";--> statement-breakpoint
-- 2. Allocations -------------------------------------------------------------------------------------
CREATE TABLE "lease_payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"charge_id" uuid NOT NULL,
	"amount_rwf" bigint NOT NULL,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lease_payment_allocations_amount_positive" CHECK ("lease_payment_allocations"."amount_rwf" > 0)
);
--> statement-breakpoint
-- A received old payment pays the charge it named, oldest payment first, up to what the rent roll
-- says that charge was paid. Whatever a payment holds beyond that is the tenant's credit.
WITH ordered AS (
  SELECT p."id" AS payment_id, p."rent_charge_id" AS charge_id, p."amount_rwf", c."paid_rwf",
         coalesce(sum(p."amount_rwf") OVER (PARTITION BY p."rent_charge_id"
                    ORDER BY p."succeeded_at", p."id" ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS before
    FROM "lease_payments" p
    JOIN "lease_charges" c ON c."id" = p."rent_charge_id"
   WHERE p."status" = 'succeeded'
)
INSERT INTO "lease_payment_allocations" ("payment_id", "charge_id", "amount_rwf", "created_at")
SELECT payment_id, charge_id, least("amount_rwf", "paid_rwf" - before), now()
  FROM ordered
 WHERE least("amount_rwf", "paid_rwf" - before) > 0;--> statement-breakpoint
-- What the rent roll says was paid beyond the payments on record (most of it: the old rent roll
-- kept a paid amount and no payment) becomes one "recorded, migrated from the rent roll" payment
-- per charge, for exactly that amount, allocated to it. A charge whose paid amount was more than
-- the charge keeps the extra as the tenant's credit on that payment.
CREATE TEMP TABLE "_m0079_gaps" ON COMMIT DROP AS
SELECT c."id" AS charge_id, c."kind", c."lease_id", c."amount_rwf", c."paid_rwf", c."paid_at", c."due_on",
       c."paid_rwf" - coalesce((SELECT sum(a."amount_rwf") FROM "lease_payment_allocations" a WHERE a."charge_id" = c."id"), 0) AS gap,
       gen_random_uuid() AS payment_id
  FROM "lease_charges" c;--> statement-breakpoint
DELETE FROM "_m0079_gaps" WHERE gap <= 0;--> statement-breakpoint
INSERT INTO "lease_payments" ("id", "workspace_id", "property_id", "lease_id", "tenant_id", "channel", "method",
                              "amount_rwf", "status", "reference", "received_on", "succeeded_at",
                              "idempotency_key", "legacy", "created_at")
SELECT g.payment_id, l."workspace_id", l."property_id", l."id", l."tenant_id", 'recorded', 'other',
       g.gap, 'succeeded',
       CASE WHEN g."kind" = 'deposit' THEN 'Migrated from the deposit record' ELSE 'Migrated from the rent roll' END,
       coalesce((g."paid_at" AT TIME ZONE 'Africa/Kigali')::date, g."due_on"),
       coalesce(g."paid_at", g."due_on"::timestamp AT TIME ZONE 'Africa/Kigali'),
       l."workspace_id" || ':migrated-' || g."kind" || ':' || g.charge_id,
       true, now()
  FROM "_m0079_gaps" g JOIN "leases" l ON l."id" = g."lease_id";--> statement-breakpoint
INSERT INTO "lease_payment_allocations" ("payment_id", "charge_id", "amount_rwf", "created_at")
SELECT g.payment_id, g.charge_id,
       least(g.gap, g."amount_rwf" - coalesce((SELECT sum(a."amount_rwf") FROM "lease_payment_allocations" a WHERE a."charge_id" = g.charge_id), 0)),
       now()
  FROM "_m0079_gaps" g
 WHERE least(g.gap, g."amount_rwf" - coalesce((SELECT sum(a."amount_rwf") FROM "lease_payment_allocations" a WHERE a."charge_id" = g.charge_id), 0)) > 0;--> statement-breakpoint
-- paid_rwf is what the allocations say, which caps it at the charge; the status follows the money
-- (paid exactly when fully paid; a waived charge stays waived).
CREATE TEMP TABLE "_m0079_status" ON COMMIT DROP AS
SELECT c."id",
       c."status" AS old_status, c."paid_rwf" AS old_paid,
       coalesce((SELECT sum(a."amount_rwf") FROM "lease_payment_allocations" a WHERE a."charge_id" = c."id" AND a."released_at" IS NULL), 0) AS paid
  FROM "lease_charges" c;--> statement-breakpoint
UPDATE "lease_charges" c
   SET "paid_rwf" = s.paid,
       "status" = CASE WHEN c."status" = 'waived' THEN 'waived'
                       WHEN s.paid >= c."amount_rwf" THEN 'paid' ELSE 'open' END::"lease_charge_status",
       "paid_at" = CASE WHEN c."status" <> 'waived' AND s.paid >= c."amount_rwf"
                        THEN coalesce(c."paid_at", c."updated_at") END
  FROM "_m0079_status" s WHERE s."id" = c."id";--> statement-breakpoint
-- A waived charge that is in fact fully paid is paid.
UPDATE "lease_charges" SET "status" = 'paid', "waived_reason" = NULL, "paid_at" = coalesce("paid_at", "updated_at")
 WHERE "status" = 'waived' AND "paid_rwf" = "amount_rwf";--> statement-breakpoint
ALTER TABLE "lease_payment_allocations" ADD CONSTRAINT "lease_payment_allocations_payment_id_lease_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."lease_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_payment_allocations" ADD CONSTRAINT "lease_payment_allocations_charge_id_lease_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."lease_charges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lease_payment_allocations_live_uk" ON "lease_payment_allocations" USING btree ("payment_id","charge_id") WHERE "lease_payment_allocations"."released_at" IS NULL;--> statement-breakpoint
CREATE INDEX "lease_payment_allocations_charge_idx" ON "lease_payment_allocations" USING btree ("charge_id");--> statement-breakpoint
ALTER TABLE "lease_charges" ADD CONSTRAINT "lease_charges_paid_range" CHECK ("lease_charges"."paid_rwf" BETWEEN 0 AND "lease_charges"."amount_rwf");--> statement-breakpoint
ALTER TABLE "lease_charges" ADD CONSTRAINT "lease_charges_paid_shape" CHECK (("lease_charges"."status" = 'paid') = ("lease_charges"."paid_rwf" = "lease_charges"."amount_rwf"));--> statement-breakpoint
ALTER TABLE "lease_charges" ADD CONSTRAINT "lease_charges_paid_at_shape" CHECK ("lease_charges"."status" <> 'paid' OR "lease_charges"."paid_at" IS NOT NULL);--> statement-breakpoint
-- 3. The payment record's rules ---------------------------------------------------------------------
ALTER TABLE "lease_payments" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lease_payments" ALTER COLUMN "channel" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lease_payments" ADD CONSTRAINT "lease_payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_payments" ADD CONSTRAINT "lease_payments_payer_user_id_users_id_fk" FOREIGN KEY ("payer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_payments" ADD CONSTRAINT "lease_payments_receipt_object_id_stored_objects_id_fk" FOREIGN KEY ("receipt_object_id") REFERENCES "public"."stored_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_payments" ADD CONSTRAINT "lease_payments_reversed_by_user_id_users_id_fk" FOREIGN KEY ("reversed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_payments" ADD CONSTRAINT "lease_payments_payout_id_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_payments" ADD CONSTRAINT "lease_payments_payout_uk" UNIQUE("payout_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lease_payments_receipt_number_uk" ON "lease_payments" USING btree ("workspace_id","receipt_number") WHERE "lease_payments"."receipt_number" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "lease_payments_scope_status_idx" ON "lease_payments" USING btree ("workspace_id","status","succeeded_at");--> statement-breakpoint
CREATE INDEX "lease_payments_lease_idx" ON "lease_payments" USING btree ("lease_id");--> statement-breakpoint
CREATE INDEX "lease_payments_adapter_ref_idx" ON "lease_payments" USING btree ("adapter_ref");--> statement-breakpoint
CREATE INDEX "lease_payments_pending_idx" ON "lease_payments" USING btree ("expires_at") WHERE "lease_payments"."status" = 'pending';--> statement-breakpoint
ALTER TABLE "lease_payments" ADD CONSTRAINT "lease_payments_amount_positive" CHECK ("lease_payments"."amount_rwf" > 0);--> statement-breakpoint
ALTER TABLE "lease_payments" ADD CONSTRAINT "lease_payments_channel_shape" CHECK (("lease_payments"."channel" = 'gateway' AND "lease_payments"."method" IN ('mtn_momo', 'airtel_money', 'card')
            AND "lease_payments"."payer_user_id" IS NOT NULL AND "lease_payments"."adapter_mode" IS NOT NULL AND NOT "lease_payments"."legacy")
        OR ("lease_payments"."channel" = 'recorded' AND "lease_payments"."status" IN ('succeeded', 'reversed')
            AND "lease_payments"."received_on" IS NOT NULL AND ("lease_payments"."recorded_by_user_id" IS NOT NULL OR "lease_payments"."legacy")
            AND "lease_payments"."payout_id" IS NULL)
        OR ("lease_payments"."legacy" AND "lease_payments"."channel" = 'recorded' AND "lease_payments"."status" IN ('failed', 'expired')));--> statement-breakpoint
ALTER TABLE "lease_payments" ADD CONSTRAINT "lease_payments_succeeded_shape" CHECK (("lease_payments"."status" IN ('succeeded', 'reversed')) = ("lease_payments"."succeeded_at" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "lease_payments" ADD CONSTRAINT "lease_payments_reversed_shape" CHECK (("lease_payments"."status" = 'reversed') = ("lease_payments"."reversed_at" IS NOT NULL)
        AND ("lease_payments"."reversed_at" IS NULL OR "lease_payments"."reverse_reason" IS NOT NULL));--> statement-breakpoint
-- 4. rent_reminders becomes lease_reminders ----------------------------------------------------------
ALTER TABLE "rent_reminders" RENAME TO "lease_reminders";--> statement-breakpoint
ALTER INDEX "rent_reminders_pkey" RENAME TO "lease_reminders_pkey";--> statement-breakpoint
ALTER INDEX "rent_reminders_scope_sent_idx" RENAME TO "lease_reminders_scope_sent_idx";--> statement-breakpoint
ALTER INDEX "rent_reminders_lease_idx" RENAME TO "lease_reminders_lease_idx";--> statement-breakpoint
ALTER TABLE "lease_reminders" RENAME CONSTRAINT "rent_reminders_workspace_id_workspaces_id_fk" TO "lease_reminders_workspace_id_workspaces_id_fk";--> statement-breakpoint
ALTER TABLE "lease_reminders" RENAME CONSTRAINT "rent_reminders_property_id_properties_id_fk" TO "lease_reminders_property_id_properties_id_fk";--> statement-breakpoint
ALTER TABLE "lease_reminders" RENAME CONSTRAINT "rent_reminders_lease_id_leases_id_fk" TO "lease_reminders_lease_id_leases_id_fk";--> statement-breakpoint
ALTER TABLE "lease_reminders" RENAME CONSTRAINT "rent_reminders_sent_by_user_id_users_id_fk" TO "lease_reminders_sent_by_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "lease_reminders" DROP CONSTRAINT "rent_reminders_channel_known";--> statement-breakpoint
ALTER TABLE "lease_reminders" ALTER COLUMN "channel" SET DATA TYPE "public"."lease_reminder_channel" USING "channel"::"public"."lease_reminder_channel";--> statement-breakpoint
-- The old reminders were all sent by hand.
ALTER TABLE "lease_reminders" ADD COLUMN "charge_id" uuid;--> statement-breakpoint
ALTER TABLE "lease_reminders" ADD COLUMN "kind" "lease_reminder_kind" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "lease_reminders" ADD CONSTRAINT "lease_reminders_charge_id_lease_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."lease_charges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lease_reminders_auto_uk" ON "lease_reminders" USING btree ("charge_id","kind") WHERE "lease_reminders"."kind" <> 'manual';--> statement-breakpoint
ALTER TABLE "lease_reminders" ADD CONSTRAINT "lease_reminders_charge_shape" CHECK ("lease_reminders"."kind" = 'manual' OR "lease_reminders"."charge_id" IS NOT NULL);--> statement-breakpoint
-- 5. The invariant every later write keeps ---------------------------------------------------------
DO $$
DECLARE
  bad text; n_payments integer; n_migrated integer; n_alloc integer; n_expired integer;
  n_credit integer; credit bigint; n_reopened integer; n_capped integer;
BEGIN
  SELECT string_agg(c."id"::text, ', ') INTO bad
    FROM "lease_charges" c
   WHERE c."paid_rwf" <> coalesce((SELECT sum(a."amount_rwf") FROM "lease_payment_allocations" a
                                    WHERE a."charge_id" = c."id" AND a."released_at" IS NULL), 0);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION '0079: allocations do not add up to paid_rwf on charge(s) %', bad;
  END IF;
  SELECT count(*), count(*) FILTER (WHERE "reference" LIKE 'Migrated from%'), count(*) FILTER (WHERE "status" = 'expired')
    INTO n_payments, n_migrated, n_expired FROM "lease_payments";
  SELECT count(*) INTO n_alloc FROM "lease_payment_allocations";
  SELECT count(*), coalesce(sum(p."amount_rwf" - coalesce(a.s, 0)), 0) INTO n_credit, credit
    FROM "lease_payments" p
    LEFT JOIN (SELECT "payment_id", sum("amount_rwf") AS s FROM "lease_payment_allocations" GROUP BY 1) a ON a."payment_id" = p."id"
   WHERE p."status" = 'succeeded' AND p."amount_rwf" > coalesce(a.s, 0);
  SELECT count(*) FILTER (WHERE s.old_status = 'paid' AND c."status" = 'open'),
         count(*) FILTER (WHERE s.paid < s.old_paid)
    INTO n_reopened, n_capped
    FROM "_m0079_status" s JOIN "lease_charges" c ON c."id" = s."id";
  RAISE NOTICE '0079: % payment(s) (% migrated from the rent roll or the deposit record, % unconfirmed claim(s) expired), % allocation(s); % payment(s) leave % RWF of tenant credit; % charge(s) marked paid without the money reopened; % paid amount(s) capped at the charge',
    n_payments, n_migrated, n_expired, n_alloc, n_credit, credit, n_reopened, n_capped;
END $$;--> statement-breakpoint
DROP TABLE "_m0079_status";--> statement-breakpoint
DROP TABLE "_m0079_gaps";
