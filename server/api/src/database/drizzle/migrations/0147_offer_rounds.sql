CREATE TYPE "public"."offer_side" AS ENUM('business', 'candidate');--> statement-breakpoint
CREATE TABLE "offer_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"side" "offer_side" NOT NULL,
	"amount_rwf" bigint NOT NULL,
	"starts_on" date,
	"note" text,
	"by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "expected_wage_rwf" bigint;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "agreed_wage_rwf" bigint;--> statement-breakpoint
ALTER TABLE "offer_rounds" ADD CONSTRAINT "offer_rounds_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_rounds" ADD CONSTRAINT "offer_rounds_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_rounds" ADD CONSTRAINT "offer_rounds_by_user_id_users_id_fk" FOREIGN KEY ("by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "offer_rounds_candidate_idx" ON "offer_rounds" USING btree ("candidate_id","created_at");--> statement-breakpoint
-- An offer made before the talk was kept becomes its first round.
INSERT INTO "offer_rounds" ("org_id", "candidate_id", "side", "amount_rwf", "starts_on", "created_at") SELECT "org_id", "id", 'business', "offer_wage_rwf", "offer_starts_on", "updated_at" FROM "candidates" WHERE "offer_wage_rwf" IS NOT NULL;
