-- Ownership transfer requests (Team → Transfer ownership). ADDITIVE ONLY: one new enum and one new table.
--
-- A business's owner asks for the business to pass to another active, identity-verified member of its team, after a
-- fresh email step-up; that member accepts (or declines) after a fresh step-up of their own. Nothing changes hands
-- until they accept: the request is a row here, and the ownership change itself is the existing `org_memberships`
-- rows, rewritten in one transaction when the request is accepted (the new owner becomes `owner`, the person who asked
-- takes the role they chose). Every step is in `audit_events` as well.
--
--   * one open request per business at most (`ownership_transfers_one_pending_uk`);
--   * a request lives 7 days (`expires_at`), the same life as every invitation;
--   * a request goes pending → accepted | declined | cancelled | expired, once, and never back;
--   * the person asking and the person asked are never the same, and the role the old owner keeps is never `owner`.
--
-- No existing table, column, row or constraint is changed. Safe to run twice.
--
-- Rollback (not run by the migrator): drizzle/rollbacks/0155_ownership_transfers.down.sql
DO $$ BEGIN
  CREATE TYPE "public"."ownership_transfer_status" AS ENUM('pending', 'accepted', 'declined', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ownership_transfers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "orgs"("id") ON DELETE CASCADE,
  "from_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "to_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "previous_owner_role" "org_role" NOT NULL,
  "status" "ownership_transfer_status" DEFAULT 'pending' NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "decided_at" timestamp with time zone,
  "decided_by_user_id" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ownership_transfers_two_people" CHECK ("from_user_id" <> "to_user_id"),
  CONSTRAINT "ownership_transfers_previous_role_not_owner" CHECK ("previous_owner_role" <> 'owner')
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ownership_transfers_one_pending_uk" ON "ownership_transfers" ("org_id") WHERE "status" = 'pending';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ownership_transfers_to_user_idx" ON "ownership_transfers" ("to_user_id", "status");
