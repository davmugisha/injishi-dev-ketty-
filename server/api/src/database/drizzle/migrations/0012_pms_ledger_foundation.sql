-- ADR-016 migration phase 2 - the ledger, alone.
--
-- Its own phase on purpose. An enum recreate is the thing that has bitten this
-- project twice (migrations 0005 and 0009 record the rule), so it gets a phase
-- of its own where a failure takes down nothing else.
--
-- THIS PHASE IS FORWARD ONLY, by design. The account rows go into a
-- pre-existing table and once any `ledger_entries` row references one it cannot
-- be deleted; enum values cannot be removed at all. That is correct for money
-- reference data, and it is still a migration with no undo.
--
-- WHY THE ENUM IS RECREATED RATHER THAN ALTERED:
-- `ALTER TYPE ... ADD VALUE` is legal inside a transaction, but Postgres then
-- refuses to USE the new value until that transaction commits, and
-- `drizzle-kit migrate` applies every pending migration in ONE transaction.
-- Phase 3's folio charge writes 'folio_post', so a plain ADD VALUE here is the
-- one that would break.
--
-- `ledger_transactions.kind` is NOT NULL and carries no DEFAULT, so the swap
-- needs no DROP DEFAULT dance. It is the only column of this type.
ALTER TYPE "public"."ledger_txn_kind" RENAME TO "ledger_txn_kind_old";--> statement-breakpoint
CREATE TYPE "public"."ledger_txn_kind" AS ENUM('capture', 'refund', 'forfeiture', 'payout', 'rent_settle', 'caution_settle', 'placement_disburse', 'subscription_charge', 'override', 'chargeback', 'folio_post', 'folio_settle');--> statement-breakpoint
ALTER TABLE "ledger_transactions" ALTER COLUMN "kind" TYPE "public"."ledger_txn_kind" USING "kind"::text::"public"."ledger_txn_kind";--> statement-breakpoint
DROP TYPE "public"."ledger_txn_kind_old";--> statement-breakpoint
-- The chart of accounts (ADR-016 D-c, D-d, D-e).
--
-- Shipped by migration rather than by a seed script, because a ledger write on
-- a fresh database must not be able to fail for a missing account (AC-13).
-- `ledger_entries.account_id` is NOT NULL and there has never been one account
-- row in any environment.
--
-- `workspace_id` stays NULL on every one. The schema forces it: `code` is
-- globally unique, so per-property accounts would need a prefix every platform
-- report then parses back off (D-c).
--
-- Thirteen accounts, not seventeen. `RECEIVABLE_FOLIO`, `ESCROW_HELD`,
-- `GUEST_DEPOSITS` and `CLEARING_PROVIDER` are deliberately NOT created:
-- under single-sided entries (D-b) nothing would ever post to them, and a chart
-- with dead codes in it is a chart nobody trusts. They arrive with double entry.
--
-- ON CONFLICT (code) DO NOTHING, so this is safe against a database where
-- somebody already inserted one by hand.
INSERT INTO "ledger_accounts" ("code", "type", "workspace_id")
VALUES
  ('REVENUE_ROOMS',           'revenue',   NULL),
  ('REVENUE_FNB',             'revenue',   NULL),
  ('REVENUE_SPA_RECREATION',  'revenue',   NULL),
  ('REVENUE_OTHER_OPERATED',  'revenue',   NULL),
  ('REVENUE_MISC_INCOME',     'revenue',   NULL),
  ('TAX_PAYABLE',             'liability', NULL),
  ('SERVICE_CHARGE',          'revenue',   NULL),
  ('DISCOUNTS_ALLOWED',       'revenue',   NULL),
  ('ADJUSTMENTS',             'revenue',   NULL),
  ('REFUNDS_PAID',            'asset',     NULL),
  ('CASH_MOBILE_MONEY',       'asset',     NULL),
  ('CASH_CARD',               'asset',     NULL),
  ('CASH_ON_HAND',            'asset',     NULL)
ON CONFLICT ("code") DO NOTHING;
