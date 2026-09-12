CREATE TYPE "public"."ebm_connection_status" AS ENUM('connected', 'revoked');--> statement-breakpoint
CREATE TABLE "ebm_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"status" "ebm_connection_status" DEFAULT 'connected' NOT NULL,
	"tin" text NOT NULL,
	"account_name" text,
	"account_status" text,
	"branch_id" text,
	"vat_registered" boolean,
	"scopes" text[] DEFAULT '{}'::text[] NOT NULL,
	"access_token_ciphertext" text NOT NULL,
	"refresh_token_ciphertext" text,
	"access_token_expires_at" timestamp with time zone NOT NULL,
	"accommodation_item_id" integer,
	"service_fee_item_id" integer,
	"walk_in_customer_id" integer,
	"connected_by_user_id" uuid,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ebm_connections_org_uk" UNIQUE("org_id"),
	CONSTRAINT "ebm_connections_revoked_shape" CHECK (("ebm_connections"."status" = 'revoked') = ("ebm_connections"."revoked_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "ebm_oauth_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_hash" text NOT NULL,
	"code_verifier_ciphertext" text NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ebm_oauth_states_state_hash_uk" UNIQUE("state_hash")
);
--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD COLUMN "org_id" uuid;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD COLUMN "external_invoice_id" integer;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD COLUMN "next_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD COLUMN "emitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ebm_connections" ADD CONSTRAINT "ebm_connections_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebm_connections" ADD CONSTRAINT "ebm_connections_connected_by_user_id_users_id_fk" FOREIGN KEY ("connected_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebm_oauth_states" ADD CONSTRAINT "ebm_oauth_states_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebm_oauth_states" ADD CONSTRAINT "ebm_oauth_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD CONSTRAINT "ebm_invoices_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ebm_invoices_due_idx" ON "ebm_invoices" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ebm_invoices_external_invoice_uk" ON "ebm_invoices" USING btree ("org_id","external_invoice_id") WHERE "ebm_invoices"."external_invoice_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD CONSTRAINT "ebm_invoices_emitted_shape" CHECK ("ebm_invoices"."status" <> 'emitted' OR ("ebm_invoices"."emitted_at" IS NOT NULL AND "ebm_invoices"."external_invoice_id" IS NOT NULL));