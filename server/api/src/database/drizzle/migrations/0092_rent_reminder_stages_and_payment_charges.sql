-- The rent cycle, WP 1.6 (blueprint 1.2, 2.6): the overdue reminder goes out three times (on the
-- first overdue day, then 7 and 14 days later), so a reminder row carries which `stage` of its kind
-- it is and the one-per-charge rule becomes one per (charge, kind, stage). A gateway payment keeps
-- the charges the tenant picked (`requested_charge_ids`) until it settles and they are allocated.
DROP INDEX "lease_reminders_auto_uk";--> statement-breakpoint
ALTER TABLE "lease_payments" ADD COLUMN "requested_charge_ids" uuid[];--> statement-breakpoint
ALTER TABLE "lease_reminders" ADD COLUMN "stage" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "lease_reminders_auto_uk" ON "lease_reminders" USING btree ("charge_id","kind","stage") WHERE "lease_reminders"."kind" <> 'manual';--> statement-breakpoint
ALTER TABLE "lease_reminders" ADD CONSTRAINT "lease_reminders_stage_range" CHECK ("lease_reminders"."stage" BETWEEN 0 AND 9);
