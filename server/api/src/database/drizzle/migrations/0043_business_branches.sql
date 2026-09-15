CREATE TABLE "org_membership_branches" (
	"org_membership_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_membership_branches_org_membership_id_property_id_pk" PRIMARY KEY("org_membership_id","property_id")
);
--> statement-breakpoint
ALTER TABLE "outlets" ALTER COLUMN "rra_branch_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "outlets" ALTER COLUMN "rra_branch_id" DROP NOT NULL;--> statement-breakpoint
-- ADR-054: nothing ever read the outlet's '00' default, so it means "use the branch's". Hand added.
UPDATE "outlets" SET "rra_branch_id" = NULL WHERE "rra_branch_id" = '00';--> statement-breakpoint
ALTER TABLE "org_invitations" ADD COLUMN "branch_property_ids" uuid[];--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "is_head_office" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "rra_branch_id" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "archived_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "org_membership_branches" ADD CONSTRAINT "org_membership_branches_org_membership_id_org_memberships_id_fk" FOREIGN KEY ("org_membership_id") REFERENCES "public"."org_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_membership_branches" ADD CONSTRAINT "org_membership_branches_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "org_membership_branches_property_idx" ON "org_membership_branches" USING btree ("property_id");--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_archived_by_user_id_users_id_fk" FOREIGN KEY ("archived_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- ADR-054 AC-X1: each hospitality org's oldest property (created_at, then id) becomes its head
-- office, BEFORE the partial unique index exists. Residence orgs are untouched. Hand added.
UPDATE "properties" SET "is_head_office" = true
WHERE "id" IN (
  SELECT DISTINCT ON (p."org_id") p."id"
  FROM "properties" p
  JOIN "orgs" o ON o."id" = p."org_id"
  WHERE o."domain" = 'hospitality'
  ORDER BY p."org_id", p."created_at", p."id"
);--> statement-breakpoint
CREATE UNIQUE INDEX "properties_one_head_office_uk" ON "properties" USING btree ("org_id") WHERE "properties"."is_head_office" AND "properties"."archived_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "properties_org_rra_branch_uk" ON "properties" USING btree ("org_id","rra_branch_id") WHERE "properties"."rra_branch_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_rra_branch_id_ck" CHECK ("properties"."rra_branch_id" ~ '^[0-9]{2}$');--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_head_office_not_archived_ck" CHECK (NOT ("properties"."is_head_office" AND "properties"."archived_at" IS NOT NULL));