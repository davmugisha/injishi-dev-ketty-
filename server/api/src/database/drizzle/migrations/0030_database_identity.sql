-- What this database is (ADR-043). A real database keeps this table EMPTY; a
-- database built for sample data holds one `sample` row, written only by
-- `scripts/mark-sample-database.mjs --sample`. A demo API process refuses to
-- boot without the row, and only a demo process holds the fixed sign in code.
--
-- The two triggers below are the whole guarantee, which is why they are in the
-- database and not in the script: they hold against every client.
--   * INSERT is refused while `users` holds a row, so a database that ever held
--     real accounts can never be turned into a sample one.
--   * UPDATE may move `seeded_at` only. `kind`, `marked_at` and `marked_by`
--     are fixed from the moment of marking.
-- There is deliberately no DELETE trigger: deleting the row makes the database
-- real, the safe direction.
--
-- On production this migration adds an empty table and two triggers that never
-- fire. It is inert there.
CREATE TABLE "database_identity" (
	"id" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"kind" text NOT NULL,
	"marked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"marked_by" text NOT NULL,
	"seeded_at" timestamp with time zone,
	CONSTRAINT "database_identity_one_row" CHECK ("database_identity"."id"),
	CONSTRAINT "database_identity_kind_sample" CHECK ("database_identity"."kind" = 'sample')
);
--> statement-breakpoint
-- SHARE mode blocks a concurrent INSERT into `users` until this transaction
-- ends, so a user created at the same instant cannot slip past the check.
CREATE FUNCTION "database_identity_refuse_mark_with_users"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	LOCK TABLE "users" IN SHARE MODE;
	IF EXISTS (SELECT 1 FROM "users") THEN
		RAISE EXCEPTION 'This database holds user accounts, so it cannot be marked as sample data. Only an empty database can be marked.'
			USING ERRCODE = 'check_violation';
	END IF;
	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "database_identity_before_insert"
	BEFORE INSERT ON "database_identity"
	FOR EACH ROW EXECUTE FUNCTION "database_identity_refuse_mark_with_users"();
--> statement-breakpoint
CREATE FUNCTION "database_identity_refuse_remark"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	IF NEW."kind" IS DISTINCT FROM OLD."kind"
		OR NEW."marked_at" IS DISTINCT FROM OLD."marked_at"
		OR NEW."marked_by" IS DISTINCT FROM OLD."marked_by" THEN
		RAISE EXCEPTION 'The database marker is fixed once written: only seeded_at may change.'
			USING ERRCODE = 'check_violation';
	END IF;
	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "database_identity_before_update"
	BEFORE UPDATE ON "database_identity"
	FOR EACH ROW EXECUTE FUNCTION "database_identity_refuse_remark"();
