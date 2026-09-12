-- ADR-012 (AC-14) - a retried money command must not act twice.
--
-- The two operator commands that move money and had nowhere to record the
-- client key: recording a rent payment, and returning a caution deposit.
-- `ledger_transactions`, `escrows`, `payouts`, `subscription_invoices`,
-- `ebm_invoices` and `money_overrides` already carry one; these two were the
-- gap, and architecture-schema.md already mandates the column on every money
-- operation.
--
-- Nullable, because every existing row predates the rule and inventing a key
-- for history would be a lie. UNIQUE tolerates any number of NULLs in Postgres,
-- so the constraint binds only rows a command actually wrote.
--
-- Additive only: no column changes type, nothing is dropped, no enum is
-- touched, so this does not need the recreate dance that 0005 and 0009 record.
ALTER TABLE "caution_settlements" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "rent_charges" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "caution_settlements" ADD CONSTRAINT "caution_settlements_idempotency_key_uk" UNIQUE("idempotency_key");--> statement-breakpoint
ALTER TABLE "rent_charges" ADD CONSTRAINT "rent_charges_idempotency_key_uk" UNIQUE("idempotency_key");