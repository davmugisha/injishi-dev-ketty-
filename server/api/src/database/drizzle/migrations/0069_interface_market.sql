CREATE TABLE "market_property_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"stock_photo" text NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"gallery" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"highlights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"nearby" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"house_rule_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"map_label" text,
	"bedrooms" integer,
	"floor_area_sqm" integer,
	"available_from" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "market_property_profiles_property_id_unique" UNIQUE("property_id"),
	CONSTRAINT "market_property_profiles_kind" CHECK ("market_property_profiles"."kind" IN ('hotel', 'lodge', 'tented', 'guest', 'apartment', 'villa', 'house', 'studio')),
	CONSTRAINT "market_property_profiles_bedrooms" CHECK ("market_property_profiles"."bedrooms" IS NULL OR "market_property_profiles"."bedrooms" >= 0),
	CONSTRAINT "market_property_profiles_area" CHECK ("market_property_profiles"."floor_area_sqm" IS NULL OR "market_property_profiles"."floor_area_sqm" > 0),
	CONSTRAINT "market_property_profiles_lists" CHECK (jsonb_typeof("market_property_profiles"."gallery") = 'array' AND jsonb_typeof("market_property_profiles"."highlights") = 'array'
          AND jsonb_typeof("market_property_profiles"."nearby") = 'array' AND jsonb_typeof("market_property_profiles"."house_rule_items") = 'array')
);
--> statement-breakpoint
CREATE TABLE "market_room_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_type_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"bed" text DEFAULT '' NOT NULL,
	"size_sqm" integer,
	"highlight" text DEFAULT '' NOT NULL,
	"stock_photo" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "market_room_profiles_room_type_id_unique" UNIQUE("room_type_id"),
	CONSTRAINT "market_room_profiles_size" CHECK ("market_room_profiles"."size_sqm" IS NULL OR "market_room_profiles"."size_sqm" > 0)
);
--> statement-breakpoint
CREATE TABLE "user_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"granted" boolean NOT NULL,
	"policy_version" text NOT NULL,
	"source" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_consents_purpose" CHECK ("user_consents"."purpose" IN ('booking_messages', 'share_phone_with_hosts', 'review_reminders', 'marketing_offers', 'personalisation')),
	CONSTRAINT "user_consents_source" CHECK ("user_consents"."source" IN ('account', 'checkout')),
	CONSTRAINT "user_consents_booking_messages_required" CHECK ("user_consents"."purpose" <> 'booking_messages' OR "user_consents"."granted")
);
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "locale" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_items" ADD COLUMN "id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_items" ADD COLUMN "saved_price_rwf" bigint;--> statement-breakpoint
ALTER TABLE "market_property_profiles" ADD CONSTRAINT "market_property_profiles_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_property_profiles" ADD CONSTRAINT "market_property_profiles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_room_profiles" ADD CONSTRAINT "market_room_profiles_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_room_profiles" ADD CONSTRAINT "market_room_profiles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "market_property_profiles_scope_idx" ON "market_property_profiles" USING btree ("workspace_id","kind");--> statement-breakpoint
CREATE INDEX "market_room_profiles_scope_idx" ON "market_room_profiles" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "user_consents_latest_idx" ON "user_consents" USING btree ("user_id","purpose","recorded_at");--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_id_unique" UNIQUE("id");--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_locale" CHECK ("user_profiles"."locale" IN ('en', 'rw', 'fr'));