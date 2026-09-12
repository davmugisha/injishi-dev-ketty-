-- ADR-016 migration phase 9 - the service catalog, orders, and message routing.
--
-- The last phase, and the one that unblocks `menu.manage` and `order.advance`:
-- the food and beverage gap ADR-012 recorded as owing its own decision.
--
-- Additive. Five new tables plus five nullable columns on `threads`, so it
-- rolls back by dropping exactly what it added. The existing
-- `threads_scope_exactly_one` check is untouched: a department is a second axis
-- over a thread, not a fourth subject it could be about.
CREATE TYPE "public"."fulfillment_type" AS ENUM('in_room_delivery', 'pickup', 'appointment', 'onsite', 'instant');--> statement-breakpoint
CREATE TYPE "public"."service_catalog_status" AS ENUM('active', 'out_of_stock', 'archived');--> statement-breakpoint
CREATE TYPE "public"."service_order_channel" AS ENUM('guest_app', 'in_room_device', 'front_desk', 'staff', 'api');--> statement-breakpoint
CREATE TYPE "public"."service_order_status" AS ENUM('submitted', 'acknowledged', 'in_progress', 'ready', 'delivered', 'completed', 'cancelled', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."thread_kind" AS ENUM('reservation', 'department_request', 'dispute');--> statement-breakpoint
CREATE TABLE "service_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" uuid NOT NULL,
	"outlet_id" uuid,
	"property_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"guest_visible" boolean DEFAULT true NOT NULL,
	"status" "department_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_category_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"outlet_id" uuid,
	"property_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"photo_object_keys" jsonb,
	"price_rwf" bigint NOT NULL,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"tax_code" "tax_code" DEFAULT 'TAX_B' NOT NULL,
	"fulfillment_type" "fulfillment_type" DEFAULT 'in_room_delivery' NOT NULL,
	"prep_time_minutes" integer,
	"options" jsonb,
	"availability" jsonb,
	"guest_orderable" boolean DEFAULT true NOT NULL,
	"stock_qty" integer,
	"status" "service_catalog_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_order_id" uuid NOT NULL,
	"status" "service_order_status" NOT NULL,
	"actor_user_id" uuid,
	"note" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_order_id" uuid NOT NULL,
	"service_item_id" uuid,
	"name_snapshot" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_rwf" bigint NOT NULL,
	"selected_options" jsonb,
	"line_total_rwf" bigint NOT NULL,
	"tax_code" "tax_code",
	"tax_rate" numeric,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"outlet_id" uuid,
	"folio_id" uuid,
	"guest_stay_id" uuid,
	"booking_id" uuid,
	"ordered_by_user_id" uuid,
	"room_id" uuid,
	"channel" "service_order_channel" DEFAULT 'front_desk' NOT NULL,
	"status" "service_order_status" DEFAULT 'submitted' NOT NULL,
	"fulfillment_type" "fulfillment_type" DEFAULT 'in_room_delivery' NOT NULL,
	"requested_for_at" timestamp with time zone,
	"subtotal_rwf" bigint DEFAULT 0 NOT NULL,
	"tax_rwf" bigint DEFAULT 0 NOT NULL,
	"total_rwf" bigint DEFAULT 0 NOT NULL,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"guest_note" text,
	"assigned_to_user_id" uuid,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_orders_number_uk" UNIQUE("order_number"),
	CONSTRAINT "service_orders_idempotency_key_uk" UNIQUE("idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "thread_kind" "thread_kind" DEFAULT 'reservation' NOT NULL;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "subject" text;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "service_order_id" uuid;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "maintenance_ticket_id" uuid;--> statement-breakpoint
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_items" ADD CONSTRAINT "service_items_service_category_id_service_categories_id_fk" FOREIGN KEY ("service_category_id") REFERENCES "public"."service_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_items" ADD CONSTRAINT "service_items_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_items" ADD CONSTRAINT "service_items_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_items" ADD CONSTRAINT "service_items_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_items" ADD CONSTRAINT "service_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_order_events" ADD CONSTRAINT "service_order_events_service_order_id_service_orders_id_fk" FOREIGN KEY ("service_order_id") REFERENCES "public"."service_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_order_events" ADD CONSTRAINT "service_order_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_order_items" ADD CONSTRAINT "service_order_items_service_order_id_service_orders_id_fk" FOREIGN KEY ("service_order_id") REFERENCES "public"."service_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_order_items" ADD CONSTRAINT "service_order_items_service_item_id_service_items_id_fk" FOREIGN KEY ("service_item_id") REFERENCES "public"."service_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_folio_id_folios_id_fk" FOREIGN KEY ("folio_id") REFERENCES "public"."folios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_guest_stay_id_guest_stays_id_fk" FOREIGN KEY ("guest_stay_id") REFERENCES "public"."guest_stays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_ordered_by_user_id_users_id_fk" FOREIGN KEY ("ordered_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_categories_department_idx" ON "service_categories" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "service_categories_workspace_idx" ON "service_categories" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "service_items_category_idx" ON "service_items" USING btree ("service_category_id");--> statement-breakpoint
CREATE INDEX "service_items_department_idx" ON "service_items" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "service_items_workspace_idx" ON "service_items" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "service_order_events_order_idx" ON "service_order_events" USING btree ("service_order_id");--> statement-breakpoint
CREATE INDEX "service_order_items_order_idx" ON "service_order_items" USING btree ("service_order_id");--> statement-breakpoint
CREATE INDEX "service_orders_board_idx" ON "service_orders" USING btree ("department_id","status");--> statement-breakpoint
CREATE INDEX "service_orders_workspace_idx" ON "service_orders" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "service_orders_folio_idx" ON "service_orders" USING btree ("folio_id");--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_service_order_id_service_orders_id_fk" FOREIGN KEY ("service_order_id") REFERENCES "public"."service_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_maintenance_ticket_id_maintenance_tickets_id_fk" FOREIGN KEY ("maintenance_ticket_id") REFERENCES "public"."maintenance_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "threads_department_idx" ON "threads" USING btree ("department_id");