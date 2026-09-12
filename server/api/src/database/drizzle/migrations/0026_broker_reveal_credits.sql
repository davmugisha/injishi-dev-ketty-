CREATE TABLE "broker_reveal_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broker_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"reveal_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "broker_reveal_credits_reveal_uk" UNIQUE("reveal_id")
);
--> statement-breakpoint
ALTER TABLE "broker_reveal_credits" ADD CONSTRAINT "broker_reveal_credits_broker_id_brokers_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_reveal_credits" ADD CONSTRAINT "broker_reveal_credits_reveal_id_contact_reveals_id_fk" FOREIGN KEY ("reveal_id") REFERENCES "public"."contact_reveals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "broker_reveal_credits_broker_idx" ON "broker_reveal_credits" USING btree ("broker_id","created_at");