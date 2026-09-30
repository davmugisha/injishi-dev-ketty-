CREATE TABLE "identity_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"document_number" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registration_drafts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pre_arrival_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"guest_user_id" uuid NOT NULL,
	"document_type" "document_type" NOT NULL,
	"document_number" text NOT NULL,
	"issuing_country" text NOT NULL,
	"id_photo_object_id" uuid,
	"address_text" text NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pre_arrival_identities_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
ALTER TABLE "identity_challenges" ADD CONSTRAINT "identity_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_drafts" ADD CONSTRAINT "registration_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_arrival_identities" ADD CONSTRAINT "pre_arrival_identities_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_arrival_identities" ADD CONSTRAINT "pre_arrival_identities_guest_user_id_users_id_fk" FOREIGN KEY ("guest_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_arrival_identities" ADD CONSTRAINT "pre_arrival_identities_id_photo_object_id_stored_objects_id_fk" FOREIGN KEY ("id_photo_object_id") REFERENCES "public"."stored_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "identity_challenges_user_id_idx" ON "identity_challenges" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pre_arrival_identities_guest_user_idx" ON "pre_arrival_identities" USING btree ("guest_user_id");--> statement-breakpoint
CREATE INDEX "pre_arrival_identities_id_photo_idx" ON "pre_arrival_identities" USING btree ("id_photo_object_id");