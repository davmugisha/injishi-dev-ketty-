-- Rentals rebuild, P1 (blueprint 1.5, step 8): ONE deposit record, lease_deposits, carried over
-- from caution_holds and caution_settlements (both stay until 0089 drops them).
CREATE TABLE "lease_deposits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"lease_id" uuid NOT NULL,
	"agreed_rwf" bigint NOT NULL,
	"charge_id" uuid NOT NULL,
	"status" "lease_deposit_status" DEFAULT 'awaiting' NOT NULL,
	"kept_rwf" bigint,
	"refunded_rwf" bigint,
	"deductions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"refund_method" "deposit_refund_method",
	"refund_payout_id" uuid,
	"refund_reference" text,
	"settled_at" timestamp with time zone,
	"settled_by_user_id" uuid,
	"tenant_disputed_at" timestamp with time zone,
	"dispute_note" text,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lease_deposits_lease_uk" UNIQUE("lease_id"),
	CONSTRAINT "lease_deposits_charge_uk" UNIQUE("charge_id"),
	CONSTRAINT "lease_deposits_idempotency_key_uk" UNIQUE("idempotency_key"),
	CONSTRAINT "lease_deposits_refund_payout_uk" UNIQUE("refund_payout_id"),
	CONSTRAINT "lease_deposits_agreed_positive" CHECK ("lease_deposits"."agreed_rwf" > 0),
	CONSTRAINT "lease_deposits_amounts_not_negative" CHECK (("lease_deposits"."kept_rwf" IS NULL OR "lease_deposits"."kept_rwf" >= 0) AND ("lease_deposits"."refunded_rwf" IS NULL OR "lease_deposits"."refunded_rwf" >= 0)),
	CONSTRAINT "lease_deposits_settled_shape" CHECK (("lease_deposits"."status" = 'settled') = ("lease_deposits"."settled_at" IS NOT NULL AND "lease_deposits"."kept_rwf" IS NOT NULL
            AND "lease_deposits"."refunded_rwf" IS NOT NULL AND "lease_deposits"."refund_method" IS NOT NULL)),
	CONSTRAINT "lease_deposits_refund_shape" CHECK ("lease_deposits"."refund_method" IS NULL OR (("lease_deposits"."refund_method" = 'none') = ("lease_deposits"."refunded_rwf" = 0))),
	CONSTRAINT "lease_deposits_refund_payout_shape" CHECK ("lease_deposits"."refund_payout_id" IS NULL OR "lease_deposits"."refund_method" = 'gateway'),
	CONSTRAINT "lease_deposits_dispute_shape" CHECK ("lease_deposits"."tenant_disputed_at" IS NULL OR "lease_deposits"."status" = 'settled'),
	CONSTRAINT "lease_deposits_deductions_list" CHECK (jsonb_typeof("lease_deposits"."deductions") = 'array')
);
--> statement-breakpoint
ALTER TABLE "lease_deposits" ADD CONSTRAINT "lease_deposits_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_deposits" ADD CONSTRAINT "lease_deposits_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_deposits" ADD CONSTRAINT "lease_deposits_charge_id_lease_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."lease_charges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_deposits" ADD CONSTRAINT "lease_deposits_refund_payout_id_payouts_id_fk" FOREIGN KEY ("refund_payout_id") REFERENCES "public"."payouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_deposits" ADD CONSTRAINT "lease_deposits_settled_by_user_id_users_id_fk" FOREIGN KEY ("settled_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lease_deposits_scope_status_idx" ON "lease_deposits" USING btree ("workspace_id","status");--> statement-breakpoint
-- One deposit per caution hold, on the deposit charge 0078 made for it.
--   agreed     the lease's deposit, or the amount held when the lease named none
--   status     held while the hold is held; settled once refunded or forfeited
--   settlement kept = the settlement's forfeited amount (all of it for a forfeited hold with no
--              settlement row); refunded = what was paid less what was kept, so kept + refunded
--              always equals what was paid (a settlement whose own figures disagree is counted);
--              the refund was recorded (the landlord holds deposits); a disputed settlement keeps
--              its dispute; the settlement's reason labels the deduction
WITH src AS (
  SELECT h."id" AS hold_id, h."lease_id", h."status" AS hold_status, h."amount_rwf" AS held,
         h."updated_at" AS hold_updated_at, l."workspace_id", l."deposit_rwf",
         c."id" AS charge_id, c."paid_rwf" AS paid,
         s."refunded_rwf" AS s_refunded, s."forfeited_rwf" AS s_forfeited, s."reason" AS s_reason,
         s."is_disputed" AS s_disputed, s."settled_at" AS s_settled_at, s."idempotency_key" AS s_key
    FROM "caution_holds" h
    JOIN "leases" l ON l."id" = h."lease_id"
    JOIN "lease_charges" c ON c."lease_id" = h."lease_id" AND c."kind" = 'deposit'
    LEFT JOIN "caution_settlements" s ON s."caution_hold_id" = h."id"
   WHERE h."amount_rwf" > 0
), shaped AS (
  SELECT src.*,
         hold_status IN ('refunded', 'forfeited') AS settled,
         least(paid, greatest(0, coalesce(s_forfeited, CASE WHEN hold_status = 'forfeited' THEN paid ELSE 0 END))) AS kept
    FROM src
)
INSERT INTO "lease_deposits" ("workspace_id", "lease_id", "agreed_rwf", "charge_id", "status", "kept_rwf",
                              "refunded_rwf", "deductions", "refund_method", "settled_at", "tenant_disputed_at",
                              "idempotency_key", "created_at")
SELECT "workspace_id", "lease_id",
       CASE WHEN "deposit_rwf" > 0 THEN "deposit_rwf" ELSE held END,
       charge_id,
       CASE WHEN settled THEN 'settled' WHEN paid >= 1 THEN 'held' ELSE 'awaiting' END::"lease_deposit_status",
       CASE WHEN settled THEN kept END,
       CASE WHEN settled THEN paid - kept END,
       CASE WHEN settled AND kept > 0
            THEN jsonb_build_array(jsonb_build_object('label', coalesce(nullif(btrim(s_reason), ''), 'Kept from the deposit'), 'amountRwf', kept))
            ELSE '[]'::jsonb END,
       CASE WHEN settled THEN (CASE WHEN paid - kept > 0 THEN 'recorded' ELSE 'none' END)::"deposit_refund_method" END,
       CASE WHEN settled THEN coalesce(s_settled_at, hold_updated_at) END,
       CASE WHEN settled AND s_disputed THEN coalesce(s_settled_at, hold_updated_at) END,
       CASE WHEN settled THEN s_key END,
       now()
  FROM shaped;--> statement-breakpoint
DO $$
DECLARE
  n_dep integer; n_held integer; n_settled integer; n_holds integer; n_mismatch integer; n_no_record integer;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE "status" = 'held'), count(*) FILTER (WHERE "status" = 'settled')
    INTO n_dep, n_held, n_settled FROM "lease_deposits";
  SELECT count(*) INTO n_holds FROM "caution_holds" WHERE "amount_rwf" > 0;
  IF n_dep <> n_holds THEN
    RAISE EXCEPTION '0080: % caution hold(s) but % deposit record(s)', n_holds, n_dep;
  END IF;
  SELECT count(*) INTO n_mismatch
    FROM "caution_settlements" s JOIN "caution_holds" h ON h."id" = s."caution_hold_id"
   WHERE coalesce(s."refunded_rwf", 0) + coalesce(s."forfeited_rwf", 0) <> h."amount_rwf";
  SELECT count(*) INTO n_no_record
    FROM "leases" l
   WHERE l."deposit_rwf" > 0 AND l."status" IN ('signed', 'active', 'ending', 'ended')
     AND NOT EXISTS (SELECT 1 FROM "lease_deposits" d WHERE d."lease_id" = l."id");
  RAISE NOTICE '0080: % deposit(s) (% held, % settled); % settlement(s) whose own figures did not add up to the hold, refund set to what was paid less what was kept; % signed lease(s) agree a deposit the old records never showed as paid (no deposit record; nothing is invented)',
    n_dep, n_held, n_settled, n_mismatch, n_no_record;
END $$;
