-- Rentals rebuild, P1 (blueprint 1.5, step 9): where a landlord's rent is paid out.
--
-- `payout_accounts` is feat/rentals' `org_payout_accounts` (its 0079), reshaped: a bank account
-- number is kept only as AES-256-GCM ciphertext (the EBM token cipher, under
-- PAYOUT_ACCOUNT_ENCRYPTION_KEY) beside its last four digits, the MoMo network is an enum built
-- from contracts' `MomoNetwork`, and a retired account says when and by whom. One active primary
-- account per org. Nothing is backfilled: no landlord had one before this.
--
-- `payouts` gains the account it went to and what both sides are shown without decrypting
-- anything (payee, masked destination), the rail's reference, a note and who made it. Its new
-- enum values (destination momo_pay, payee tenant/vendor, source deposit_refund/repair, status
-- failed) came in 0073 and are not used here, so this runs in the same transaction as 0073.
CREATE TYPE "public"."momo_network" AS ENUM('mtn', 'airtel');--> statement-breakpoint
CREATE TYPE "public"."payout_account_kind" AS ENUM('bank', 'momo', 'momo_pay');--> statement-breakpoint
CREATE TYPE "public"."payout_account_status" AS ENUM('active', 'retired');--> statement-breakpoint
CREATE TABLE "payout_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" "payout_account_kind" NOT NULL,
	"account_name" text NOT NULL,
	"bank_name" text,
	"account_number_ciphertext" text,
	"account_last4" text,
	"momo_network" "momo_network",
	"momo_phone" text,
	"merchant_code" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"status" "payout_account_status" DEFAULT 'active' NOT NULL,
	"verified_name" text,
	"created_by_user_id" uuid,
	"retired_at" timestamp with time zone,
	"retired_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payout_accounts_name_present" CHECK (length(btrim("payout_accounts"."account_name")) > 0),
	CONSTRAINT "payout_accounts_kind_shape" CHECK (("payout_accounts"."kind" = 'bank' AND "payout_accounts"."bank_name" IS NOT NULL AND "payout_accounts"."account_number_ciphertext" IS NOT NULL
            AND "payout_accounts"."account_last4" ~ '^[0-9]{4}$'
            AND "payout_accounts"."momo_network" IS NULL AND "payout_accounts"."momo_phone" IS NULL AND "payout_accounts"."merchant_code" IS NULL)
        OR ("payout_accounts"."kind" = 'momo' AND "payout_accounts"."momo_network" IS NOT NULL AND "payout_accounts"."momo_phone" ~ '^[+]250(72|73|78|79)[0-9]{7}$'
            AND "payout_accounts"."bank_name" IS NULL AND "payout_accounts"."account_number_ciphertext" IS NULL AND "payout_accounts"."account_last4" IS NULL
            AND "payout_accounts"."merchant_code" IS NULL)
        OR ("payout_accounts"."kind" = 'momo_pay' AND "payout_accounts"."merchant_code" ~ '^[0-9]{4,10}$'
            AND "payout_accounts"."bank_name" IS NULL AND "payout_accounts"."account_number_ciphertext" IS NULL AND "payout_accounts"."account_last4" IS NULL
            AND "payout_accounts"."momo_network" IS NULL AND "payout_accounts"."momo_phone" IS NULL)),
	CONSTRAINT "payout_accounts_primary_active" CHECK (NOT ("payout_accounts"."is_primary" AND "payout_accounts"."status" = 'retired')),
	CONSTRAINT "payout_accounts_retired_shape" CHECK (("payout_accounts"."status" = 'retired') = ("payout_accounts"."retired_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "payout_account_id" uuid;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "payee_name" text;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "destination_masked" text;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "adapter_ref" text;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "created_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "payout_accounts" ADD CONSTRAINT "payout_accounts_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_accounts" ADD CONSTRAINT "payout_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_accounts" ADD CONSTRAINT "payout_accounts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_accounts" ADD CONSTRAINT "payout_accounts_retired_by_user_id_users_id_fk" FOREIGN KEY ("retired_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payout_accounts_primary_uk" ON "payout_accounts" USING btree ("org_id") WHERE "payout_accounts"."is_primary" AND "payout_accounts"."status" = 'active';--> statement-breakpoint
CREATE INDEX "payout_accounts_org_idx" ON "payout_accounts" USING btree ("org_id","status");--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_payout_account_id_payout_accounts_id_fk" FOREIGN KEY ("payout_account_id") REFERENCES "public"."payout_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payouts_account_idx" ON "payouts" USING btree ("payout_account_id");
