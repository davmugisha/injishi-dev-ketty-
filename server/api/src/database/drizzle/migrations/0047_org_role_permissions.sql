CREATE TABLE "org_role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"org_role" "org_role" NOT NULL,
	"permission" text NOT NULL,
	"granted" boolean NOT NULL,
	"set_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_role_permissions_role_permission_uk" UNIQUE("org_id","org_role","permission"),
	CONSTRAINT "org_role_permissions_not_owner" CHECK ("org_role_permissions"."org_role" <> 'owner'),
	CONSTRAINT "org_role_permissions_not_locked" CHECK ("org_role_permissions"."permission" <> 'team.manage')
);
--> statement-breakpoint
ALTER TABLE "org_role_permissions" ADD CONSTRAINT "org_role_permissions_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_role_permissions" ADD CONSTRAINT "org_role_permissions_set_by_user_id_users_id_fk" FOREIGN KEY ("set_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "org_role_permissions_org_idx" ON "org_role_permissions" USING btree ("org_id");