-- Rentals rebuild, P1 (blueprint 1.5, step 6): rent_charges becomes lease_charges, the charges of
-- a lease: each calendar month's rent and, new here, the deposit.
--
-- Rent is by calendar month (decision of 2026-10-24). A carried-over charge keeps its month and
-- its amount; its period becomes the days of that month the lease covers (from the billing start
-- in the first month, to the end date in the last), which is exactly the period the rent schedule
-- (`rentSchedule` in contracts) gives that month, so the rent job never raises it twice. Its due
-- day is kept. The status swaps to the new type: paid stays paid, due and overdue become open
-- (overdue is worked out, never stored). rent_status, now unused, is dropped.
--
-- Each deposit the old caution_holds recorded becomes a paid deposit charge, due on the lease's
-- start date. The payments that pay these charges are made in 0079.
ALTER TABLE "rent_charges" RENAME TO "lease_charges";--> statement-breakpoint
ALTER INDEX "rent_charges_pkey" RENAME TO "lease_charges_pkey";--> statement-breakpoint
ALTER TABLE "lease_charges" RENAME CONSTRAINT "rent_charges_lease_id_leases_id_fk" TO "lease_charges_lease_id_leases_id_fk";--> statement-breakpoint
ALTER TABLE "lease_charges" RENAME CONSTRAINT "rent_charges_idempotency_key_uk" TO "lease_charges_idempotency_key_uk";--> statement-breakpoint
ALTER TABLE "rent_payments" RENAME CONSTRAINT "rent_payments_rent_charge_id_rent_charges_id_fk" TO "rent_payments_rent_charge_id_lease_charges_id_fk";--> statement-breakpoint
ALTER TABLE "lease_charges" RENAME COLUMN "period_month" TO "period_start";--> statement-breakpoint
ALTER TABLE "lease_charges" RENAME COLUMN "due_date" TO "due_on";--> statement-breakpoint
ALTER TABLE "lease_charges" RENAME COLUMN "paid_amount_rwf" TO "paid_rwf";--> statement-breakpoint
DROP INDEX "rent_charges_lease_period_uk";--> statement-breakpoint
ALTER TABLE "lease_charges" ADD COLUMN "kind" "lease_charge_kind" DEFAULT 'rent' NOT NULL;--> statement-breakpoint
ALTER TABLE "lease_charges" ADD COLUMN "period_end" date;--> statement-breakpoint
ALTER TABLE "lease_charges" ADD COLUMN "waived_reason" text;--> statement-breakpoint
ALTER TABLE "lease_charges" ALTER COLUMN "period_start" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "lease_charges" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "lease_charges" ALTER COLUMN "status" SET DATA TYPE "public"."lease_charge_status" USING (
  CASE WHEN "status" = 'paid' THEN 'paid' ELSE 'open' END
)::"public"."lease_charge_status";--> statement-breakpoint
ALTER TABLE "lease_charges" ALTER COLUMN "status" SET DEFAULT 'open';--> statement-breakpoint
DROP TYPE "public"."rent_status";--> statement-breakpoint
-- Calendar periods. A charge that cannot be placed in its own calendar month (two charges of one
-- lease in one month) has no honest place in the new schedule: that stops the migration.
DO $$
DECLARE dupes text;
BEGIN
  SELECT string_agg(DISTINCT l."reference" || ' ' || to_char(c."period_start", 'YYYY-MM'), ', ') INTO dupes
    FROM "lease_charges" c
    JOIN "leases" l ON l."id" = c."lease_id"
   WHERE EXISTS (SELECT 1 FROM "lease_charges" o
                  WHERE o."lease_id" = c."lease_id" AND o."id" <> c."id"
                    AND date_trunc('month', o."period_start") = date_trunc('month', c."period_start"));
  IF dupes IS NOT NULL THEN
    RAISE EXCEPTION '0078: these leases have two rent charges in one calendar month: %. Merge them, then migrate again.', dupes;
  END IF;
END $$;--> statement-breakpoint
WITH m AS (
  SELECT c."id", l."billing_starts_on", l."end_date",
         date_trunc('month', c."period_start")::date AS first,
         (date_trunc('month', c."period_start") + interval '1 month' - interval '1 day')::date AS last
    FROM "lease_charges" c JOIN "leases" l ON l."id" = c."lease_id"
)
UPDATE "lease_charges" c
   SET "period_start" = CASE WHEN m."billing_starts_on" BETWEEN m.first AND m.last THEN m."billing_starts_on" ELSE m.first END,
       "period_end" = CASE WHEN m."end_date" BETWEEN m.first AND m.last THEN m."end_date" ELSE m.last END
  FROM m
 WHERE m."id" = c."id";--> statement-breakpoint
-- A carried-over charge with no due day falls due as the schedule says: the lease's due day in
-- that month, kept inside the period.
UPDATE "lease_charges" c
   SET "due_on" = least(c."period_end", greatest(c."period_start",
         (date_trunc('month', c."period_start") + make_interval(days => l."rent_due_day" - 1))::date))
  FROM "leases" l
 WHERE l."id" = c."lease_id" AND c."due_on" IS NULL;--> statement-breakpoint
-- The deposit each caution hold recorded: a deposit charge, paid when the hold was taken.
INSERT INTO "lease_charges" ("lease_id", "kind", "due_on", "amount_rwf", "paid_rwf", "status", "paid_at", "created_at")
SELECT h."lease_id", 'deposit', l."start_date", h."amount_rwf", h."amount_rwf", 'paid', h."held_at", h."created_at"
  FROM "caution_holds" h
  JOIN "leases" l ON l."id" = h."lease_id"
 WHERE h."amount_rwf" > 0;--> statement-breakpoint
ALTER TABLE "lease_charges" ALTER COLUMN "amount_rwf" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lease_charges" ALTER COLUMN "paid_rwf" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lease_charges" ALTER COLUMN "due_on" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "lease_charges_rent_period_uk" ON "lease_charges" USING btree ("lease_id","period_start") WHERE "lease_charges"."kind" = 'rent';--> statement-breakpoint
CREATE UNIQUE INDEX "lease_charges_deposit_uk" ON "lease_charges" USING btree ("lease_id") WHERE "lease_charges"."kind" = 'deposit';--> statement-breakpoint
CREATE INDEX "lease_charges_open_due_idx" ON "lease_charges" USING btree ("due_on") WHERE "lease_charges"."status" = 'open';--> statement-breakpoint
ALTER TABLE "lease_charges" ADD CONSTRAINT "lease_charges_amount_positive" CHECK ("lease_charges"."amount_rwf" > 0);--> statement-breakpoint
ALTER TABLE "lease_charges" ADD CONSTRAINT "lease_charges_period_shape" CHECK (("lease_charges"."kind" = 'rent' AND "lease_charges"."period_start" IS NOT NULL AND "lease_charges"."period_end" IS NOT NULL AND "lease_charges"."period_end" >= "lease_charges"."period_start")
        OR ("lease_charges"."kind" = 'deposit' AND "lease_charges"."period_start" IS NULL AND "lease_charges"."period_end" IS NULL));--> statement-breakpoint
ALTER TABLE "lease_charges" ADD CONSTRAINT "lease_charges_waived_shape" CHECK (("lease_charges"."status" = 'waived') = ("lease_charges"."waived_reason" IS NOT NULL));--> statement-breakpoint
DO $$
DECLARE n_rent integer; n_dep integer; n_partial integer; n_holds_skipped integer;
BEGIN
  SELECT count(*) FILTER (WHERE "kind" = 'rent'), count(*) FILTER (WHERE "kind" = 'deposit'),
         count(*) FILTER (WHERE "kind" = 'rent' AND ("period_start" > date_trunc('month', "period_start")
                                                    OR "period_end" < (date_trunc('month', "period_start") + interval '1 month' - interval '1 day')::date))
    INTO n_rent, n_dep, n_partial FROM "lease_charges";
  SELECT count(*) INTO n_holds_skipped FROM "caution_holds" WHERE "amount_rwf" IS NULL OR "amount_rwf" <= 0;
  RAISE NOTICE '0078: % rent charge(s) carried over (% covering part of a month, amounts kept); % deposit charge(s) from caution holds; % hold(s) with no amount skipped',
    n_rent, n_partial, n_dep, n_holds_skipped;
END $$;
