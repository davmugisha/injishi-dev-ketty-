-- ADR-009 — the inventory write path.
--
-- WHY `audit_subject_type` IS RECREATED RATHER THAN ALTERED:
-- the same rule migration 0005 records. `ALTER TYPE ... ADD VALUE` is legal
-- inside a transaction, but Postgres then refuses to USE the new value until
-- that transaction commits, and `drizzle-kit migrate` applies every pending
-- migration in ONE transaction. Nothing in THIS migration writes the literal
-- 'property', so a plain ADD VALUE would in fact survive today. It is recreated
-- anyway so the next migration that does need to write it is not the one that
-- discovers the rule, which is exactly how 0005 was found the hard way.
--
-- `audit_events.subject_type` is nullable and carries no default, so the swap
-- needs no DROP DEFAULT dance.
ALTER TYPE "public"."audit_subject_type" RENAME TO "audit_subject_type_old";--> statement-breakpoint
CREATE TYPE "public"."audit_subject_type" AS ENUM('user', 'org', 'lease', 'booking', 'payment', 'config', 'property');--> statement-breakpoint
ALTER TABLE "audit_events" ALTER COLUMN "subject_type" TYPE "public"."audit_subject_type" USING "subject_type"::text::"public"."audit_subject_type";--> statement-breakpoint
DROP TYPE "public"."audit_subject_type_old";--> statement-breakpoint
-- D24's address shape, now on a property as well as on its org and its owner.
-- Both nullable: the rows that predate this have neither, and the publish rule
-- requires the sector rather than the database doing it.
ALTER TABLE "properties" ADD COLUMN "sector_id" integer;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "address_text" text;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "properties_sector_idx" ON "properties" USING btree ("sector_id");
