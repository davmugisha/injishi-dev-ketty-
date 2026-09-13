CREATE TYPE "public"."org_membership_status" AS ENUM('active', 'removed');--> statement-breakpoint
CREATE TYPE "public"."registration_transition_trigger" AS ENUM('registrant', 'officer', 'staff', 'system');--> statement-breakpoint
CREATE TABLE "org_registration_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"from_status" "org_registration_status",
	"to_status" "org_registration_status" NOT NULL,
	"trigger" "registration_transition_trigger" NOT NULL,
	"actor_user_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_registration_events_actor_shape" CHECK (("org_registration_events"."trigger" = 'system' AND "org_registration_events"."actor_user_id" IS NULL)
          OR ("org_registration_events"."trigger" <> 'system' AND "org_registration_events"."actor_user_id" IS NOT NULL))
);
--> statement-breakpoint
-- ===========================================================================
-- org_memberships.status: free text becomes org_membership_status (ADR-049, AC-R10).
--
-- Hand ordered. drizzle-kit emitted SET DEFAULT with the enum BEFORE converting
-- the column, and Postgres refuses to cast a column whose default is already a
-- different type. So: drop the default, convert, then restore it, the skeleton
-- migrations 0005, 0009 and 0016 record for enum work.
--
-- CREATE TYPE and using it in the same transaction is fine. The rule those
-- migrations guard against is ALTER TYPE ... ADD VALUE, which this does not do.
-- A value outside the enum fails the USING cast LOUDLY rather than being kept.
-- ===========================================================================
ALTER TABLE "org_memberships" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "org_memberships" ALTER COLUMN "status" SET DATA TYPE "public"."org_membership_status" USING "status"::"public"."org_membership_status";--> statement-breakpoint
ALTER TABLE "org_memberships" ALTER COLUMN "status" SET DEFAULT 'active'::"public"."org_membership_status";--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "contract_version" text;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "contract_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "contract_accepted_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "org_registration_events" ADD CONSTRAINT "org_registration_events_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_registration_events" ADD CONSTRAINT "org_registration_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "org_registration_events_org_idx" ON "org_registration_events" USING btree ("org_id","occurred_at");--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_contract_accepted_by_user_id_users_id_fk" FOREIGN KEY ("contract_accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_contract_shape" CHECK (("orgs"."contract_version" IS NULL AND "orgs"."contract_accepted_at" IS NULL AND "orgs"."contract_accepted_by_user_id" IS NULL)
          OR ("orgs"."contract_version" IS NOT NULL AND "orgs"."contract_accepted_at" IS NOT NULL AND "orgs"."contract_accepted_by_user_id" IS NOT NULL));