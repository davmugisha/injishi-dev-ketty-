CREATE TYPE "public"."cash_movement_kind" AS ENUM('paid_in', 'paid_out');--> statement-breakpoint
CREATE TYPE "public"."cashier_shift_status" AS ENUM('open', 'closed', 'reviewed');--> statement-breakpoint
CREATE TYPE "public"."kitchen_ticket_status" AS ENUM('queued', 'preparing', 'ready', 'served', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."pos_approval_status" AS ENUM('approved', 'pending_approval', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."pos_discount_kind" AS ENUM('amount', 'percent');--> statement-breakpoint
CREATE TYPE "public"."pos_line_status" AS ENUM('draft', 'sent', 'voided');--> statement-breakpoint
CREATE TYPE "public"."pos_order_status" AS ENUM('draft', 'submitted', 'in_progress', 'ready', 'delivered', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."pos_order_type" AS ENUM('dine_in', 'takeaway', 'delivery', 'room_service', 'event');--> statement-breakpoint
CREATE TYPE "public"."pos_payment_method" AS ENUM('cash', 'mtn_momo', 'airtel_money', 'card', 'bank_transfer', 'voucher', 'customer_credit');--> statement-breakpoint
CREATE TYPE "public"."pos_payment_status" AS ENUM('initiated', 'pending', 'successful', 'failed', 'cancelled', 'expired', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."pos_print_kind" AS ENUM('kitchen_ticket', 'bill', 'receipt');--> statement-breakpoint
CREATE TYPE "public"."pos_station_kind" AS ENUM('kitchen', 'bar');--> statement-breakpoint
CREATE TYPE "public"."pos_tax_mode" AS ENUM('exclusive', 'inclusive');--> statement-breakpoint
CREATE TYPE "public"."restaurant_table_status" AS ENUM('available', 'occupied', 'reserved', 'bill_requested', 'cleaning');--> statement-breakpoint
CREATE TYPE "public"."table_session_status" AS ENUM('open', 'closed');--> statement-breakpoint
ALTER TYPE "public"."org_role" ADD VALUE 'cashier';--> statement-breakpoint
ALTER TYPE "public"."org_role" ADD VALUE 'waiter';--> statement-breakpoint
ALTER TYPE "public"."org_role" ADD VALUE 'bartender';--> statement-breakpoint
ALTER TYPE "public"."org_role" ADD VALUE 'kitchen';--> statement-breakpoint
ALTER TYPE "public"."org_role" ADD VALUE 'stock_controller';--> statement-breakpoint
CREATE TABLE "cash_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"kind" "cash_movement_kind" NOT NULL,
	"amount_rwf" bigint NOT NULL,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"reason" text NOT NULL,
	"status" "pos_approval_status" NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_movements_amount_positive" CHECK ("cash_movements"."amount_rwf" > 0),
	CONSTRAINT "cash_movements_decided_shape" CHECK (("cash_movements"."status" = 'pending_approval') = ("cash_movements"."decided_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "cashier_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"register_id" uuid NOT NULL,
	"cashier_user_id" uuid NOT NULL,
	"status" "cashier_shift_status" DEFAULT 'open' NOT NULL,
	"opening_float_rwf" bigint NOT NULL,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"expected_cash_rwf" bigint,
	"counted_cash_rwf" bigint,
	"variance_rwf" bigint,
	"close_note" text,
	"handover_note" text,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cashier_shifts_float_nonnegative" CHECK ("cashier_shifts"."opening_float_rwf" >= 0),
	CONSTRAINT "cashier_shifts_closed_shape" CHECK (("cashier_shifts"."status" = 'open') = ("cashier_shifts"."closed_at" IS NULL)
          AND ("cashier_shifts"."status" = 'open' OR ("cashier_shifts"."expected_cash_rwf" IS NOT NULL AND "cashier_shifts"."counted_cash_rwf" IS NOT NULL AND "cashier_shifts"."variance_rwf" IS NOT NULL))
          AND ("cashier_shifts"."status" = 'reviewed') = ("cashier_shifts"."reviewed_at" IS NOT NULL AND "cashier_shifts"."reviewed_by_user_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "dining_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dining_areas_outlet_name_uk" UNIQUE("outlet_id","name")
);
--> statement-breakpoint
CREATE TABLE "kitchen_ticket_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"ticket_item_id" uuid,
	"from_status" "kitchen_ticket_status",
	"to_status" "kitchen_ticket_status" NOT NULL,
	"actor_user_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kitchen_ticket_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"order_line_id" uuid NOT NULL,
	"status" "kitchen_ticket_status" DEFAULT 'queued' NOT NULL,
	"quantity" integer NOT NULL,
	"name" text NOT NULL,
	"options" text[] DEFAULT '{}'::text[] NOT NULL,
	"note" text,
	CONSTRAINT "kitchen_ticket_items_line_uk" UNIQUE("order_line_id")
);
--> statement-breakpoint
CREATE TABLE "kitchen_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"station_id" uuid NOT NULL,
	"ticket_number" text NOT NULL,
	"round" smallint NOT NULL,
	"status" "kitchen_ticket_status" DEFAULT 'queued' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"served_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "kitchen_tickets_order_station_round_uk" UNIQUE("order_id","station_id","round"),
	CONSTRAINT "kitchen_tickets_workspace_number_uk" UNIQUE("workspace_id","ticket_number")
);
--> statement-breakpoint
CREATE TABLE "pos_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"outlet_id" uuid,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos_counters" (
	"workspace_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"period" text NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "pos_counters_workspace_id_kind_period_pk" PRIMARY KEY("workspace_id","kind","period")
);
--> statement-breakpoint
CREATE TABLE "pos_item_routes" (
	"service_item_id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"station_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos_order_discounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"order_line_id" uuid,
	"kind" "pos_discount_kind" NOT NULL,
	"value" integer NOT NULL,
	"amount_rwf" bigint NOT NULL,
	"reason" text NOT NULL,
	"status" "pos_approval_status" NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pos_order_discounts_amount_positive" CHECK ("pos_order_discounts"."amount_rwf" > 0 AND "pos_order_discounts"."value" > 0),
	CONSTRAINT "pos_order_discounts_decided_shape" CHECK (("pos_order_discounts"."status" = 'pending_approval') = ("pos_order_discounts"."decided_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "pos_order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"from_status" "pos_order_status",
	"to_status" "pos_order_status",
	"data" jsonb,
	"actor_user_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos_order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"service_item_id" uuid,
	"name_snapshot" text NOT NULL,
	"sku_snapshot" text,
	"quantity" integer NOT NULL,
	"unit_price_rwf" bigint NOT NULL,
	"selected_options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note" text,
	"status" "pos_line_status" DEFAULT 'draft' NOT NULL,
	"tax_code" "tax_code" NOT NULL,
	"tax_rate_bps" integer NOT NULL,
	"line_discount_rwf" bigint DEFAULT 0 NOT NULL,
	"order_discount_share_rwf" bigint DEFAULT 0 NOT NULL,
	"gross_rwf" bigint NOT NULL,
	"discount_rwf" bigint DEFAULT 0 NOT NULL,
	"tax_rwf" bigint NOT NULL,
	"total_rwf" bigint NOT NULL,
	"station_id" uuid,
	"sent_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"voided_by_user_id" uuid,
	"void_reason" text,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pos_order_lines_quantity_range" CHECK ("pos_order_lines"."quantity" >= 1 AND "pos_order_lines"."quantity" <= 500),
	CONSTRAINT "pos_order_lines_void_shape" CHECK (("pos_order_lines"."status" = 'voided') = ("pos_order_lines"."voided_at" IS NOT NULL AND "pos_order_lines"."voided_by_user_id" IS NOT NULL AND "pos_order_lines"."void_reason" IS NOT NULL)),
	CONSTRAINT "pos_order_lines_sent_shape" CHECK ("pos_order_lines"."status" = 'draft' OR "pos_order_lines"."sent_at" IS NOT NULL OR "pos_order_lines"."status" = 'voided'),
	CONSTRAINT "pos_order_lines_amounts" CHECK ("pos_order_lines"."unit_price_rwf" >= 0 AND "pos_order_lines"."discount_rwf" >= 0 AND "pos_order_lines"."discount_rwf" <= "pos_order_lines"."gross_rwf" AND "pos_order_lines"."tax_rwf" >= 0)
);
--> statement-breakpoint
CREATE TABLE "pos_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"property_id" uuid,
	"tax_entity_org_id" uuid NOT NULL,
	"order_number" text NOT NULL,
	"order_type" "pos_order_type" NOT NULL,
	"status" "pos_order_status" DEFAULT 'draft' NOT NULL,
	"table_session_id" uuid,
	"waiter_user_id" uuid,
	"created_by_user_id" uuid NOT NULL,
	"guest_note" text,
	"tax_mode" "pos_tax_mode" NOT NULL,
	"gross_rwf" bigint DEFAULT 0 NOT NULL,
	"discount_rwf" bigint DEFAULT 0 NOT NULL,
	"tax_rwf" bigint DEFAULT 0 NOT NULL,
	"total_rwf" bigint DEFAULT 0 NOT NULL,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"split_from_order_id" uuid,
	"submitted_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_user_id" uuid,
	"cancel_reason" text,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pos_orders_workspace_number_uk" UNIQUE("workspace_id","order_number"),
	CONSTRAINT "pos_orders_idempotency_key_uk" UNIQUE("idempotency_key"),
	CONSTRAINT "pos_orders_table_shape" CHECK (("pos_orders"."order_type" = 'dine_in') = ("pos_orders"."table_session_id" IS NOT NULL)),
	CONSTRAINT "pos_orders_cancel_shape" CHECK (("pos_orders"."status" = 'cancelled') = ("pos_orders"."cancelled_at" IS NOT NULL AND "pos_orders"."cancelled_by_user_id" IS NOT NULL AND "pos_orders"."cancel_reason" IS NOT NULL)),
	CONSTRAINT "pos_orders_amounts_nonnegative" CHECK ("pos_orders"."gross_rwf" >= 0 AND "pos_orders"."discount_rwf" >= 0 AND "pos_orders"."tax_rwf" >= 0 AND "pos_orders"."total_rwf" >= 0)
);
--> statement-breakpoint
CREATE TABLE "pos_outlet_settings" (
	"outlet_id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"tax_mode" "pos_tax_mode" DEFAULT 'exclusive' NOT NULL,
	"discount_limit_bps" integer DEFAULT 1000 NOT NULL,
	"enabled_methods" "pos_payment_method"[] DEFAULT '{cash,mtn_momo,airtel_money,card}'::pos_payment_method[] NOT NULL,
	"receipt_header" text DEFAULT '' NOT NULL,
	"receipt_footer" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pos_outlet_settings_discount_limit_range" CHECK ("pos_outlet_settings"."discount_limit_bps" >= 0 AND "pos_outlet_settings"."discount_limit_bps" <= 10000)
);
--> statement-breakpoint
CREATE TABLE "pos_payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"from_status" "pos_payment_status",
	"to_status" "pos_payment_status" NOT NULL,
	"note" text,
	"actor_user_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"shift_id" uuid,
	"method" "pos_payment_method" NOT NULL,
	"amount_rwf" bigint NOT NULL,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"tendered_rwf" bigint,
	"change_rwf" bigint DEFAULT 0 NOT NULL,
	"tip_rwf" bigint DEFAULT 0 NOT NULL,
	"refunded_rwf" bigint DEFAULT 0 NOT NULL,
	"status" "pos_payment_status" NOT NULL,
	"demo_reference" text NOT NULL,
	"simulated" boolean NOT NULL,
	"payer_phone_masked" text,
	"voucher_code" text,
	"failure_reason" text,
	"idempotency_key" text NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pos_payments_idempotency_key_uk" UNIQUE("idempotency_key"),
	CONSTRAINT "pos_payments_demo_reference_uk" UNIQUE("demo_reference"),
	CONSTRAINT "pos_payments_amounts" CHECK ("pos_payments"."amount_rwf" > 0 AND "pos_payments"."change_rwf" >= 0 AND "pos_payments"."tip_rwf" >= 0
          AND "pos_payments"."refunded_rwf" >= 0 AND "pos_payments"."refunded_rwf" <= "pos_payments"."amount_rwf"),
	CONSTRAINT "pos_payments_cash_shape" CHECK ("pos_payments"."method" = 'cash' OR ("pos_payments"."change_rwf" = 0 AND "pos_payments"."tendered_rwf" IS NULL)),
	CONSTRAINT "pos_payments_refunded_shape" CHECK (("pos_payments"."status" = 'refunded') = ("pos_payments"."refunded_rwf" = "pos_payments"."amount_rwf" AND "pos_payments"."refunded_rwf" > 0))
);
--> statement-breakpoint
CREATE TABLE "pos_print_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"station_id" uuid,
	"kind" "pos_print_kind" NOT NULL,
	"source_id" uuid NOT NULL,
	"copy_number" smallint NOT NULL,
	"printer_name" text,
	"payload" jsonb NOT NULL,
	"requested_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pos_print_jobs_copy_uk" UNIQUE("kind","source_id","copy_number")
);
--> statement-breakpoint
CREATE TABLE "pos_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"shift_id" uuid,
	"amount_rwf" bigint NOT NULL,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"reason" text NOT NULL,
	"demo_reference" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"refunded_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pos_refunds_idempotency_key_uk" UNIQUE("idempotency_key"),
	CONSTRAINT "pos_refunds_demo_reference_uk" UNIQUE("demo_reference"),
	CONSTRAINT "pos_refunds_amount_positive" CHECK ("pos_refunds"."amount_rwf" > 0)
);
--> statement-breakpoint
CREATE TABLE "pos_registers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"name" text NOT NULL,
	"device_label" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pos_registers_outlet_name_uk" UNIQUE("outlet_id","name")
);
--> statement-breakpoint
CREATE TABLE "preparation_stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "pos_station_kind" NOT NULL,
	"printer_name" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "preparation_stations_outlet_name_uk" UNIQUE("outlet_id","name")
);
--> statement-breakpoint
CREATE TABLE "restaurant_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"area_id" uuid NOT NULL,
	"label" text NOT NULL,
	"seats" smallint NOT NULL,
	"status" "restaurant_table_status" DEFAULT 'available' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restaurant_tables_outlet_label_uk" UNIQUE("outlet_id","label"),
	CONSTRAINT "restaurant_tables_seats_range" CHECK ("restaurant_tables"."seats" >= 1 AND "restaurant_tables"."seats" <= 100)
);
--> statement-breakpoint
CREATE TABLE "table_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"status" "table_session_status" DEFAULT 'open' NOT NULL,
	"guest_count" smallint NOT NULL,
	"waiter_user_id" uuid,
	"opened_by_user_id" uuid NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by_user_id" uuid,
	"merged_into_session_id" uuid,
	CONSTRAINT "table_sessions_closed_shape" CHECK (("table_sessions"."status" = 'closed') = ("table_sessions"."closed_at" IS NOT NULL AND "table_sessions"."closed_by_user_id" IS NOT NULL)),
	CONSTRAINT "table_sessions_guest_range" CHECK ("table_sessions"."guest_count" >= 1 AND "table_sessions"."guest_count" <= 200)
);
--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_shift_id_cashier_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."cashier_shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_register_id_pos_registers_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."pos_registers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_cashier_user_id_users_id_fk" FOREIGN KEY ("cashier_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dining_areas" ADD CONSTRAINT "dining_areas_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dining_areas" ADD CONSTRAINT "dining_areas_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_ticket_events" ADD CONSTRAINT "kitchen_ticket_events_ticket_id_kitchen_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."kitchen_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_ticket_events" ADD CONSTRAINT "kitchen_ticket_events_ticket_item_id_kitchen_ticket_items_id_fk" FOREIGN KEY ("ticket_item_id") REFERENCES "public"."kitchen_ticket_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_ticket_events" ADD CONSTRAINT "kitchen_ticket_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_ticket_items" ADD CONSTRAINT "kitchen_ticket_items_ticket_id_kitchen_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."kitchen_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_ticket_items" ADD CONSTRAINT "kitchen_ticket_items_order_line_id_pos_order_lines_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."pos_order_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_tickets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_tickets_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_tickets_order_id_pos_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."pos_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_tickets_station_id_preparation_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."preparation_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_audit_events" ADD CONSTRAINT "pos_audit_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_audit_events" ADD CONSTRAINT "pos_audit_events_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_audit_events" ADD CONSTRAINT "pos_audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_counters" ADD CONSTRAINT "pos_counters_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_item_routes" ADD CONSTRAINT "pos_item_routes_service_item_id_service_items_id_fk" FOREIGN KEY ("service_item_id") REFERENCES "public"."service_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_item_routes" ADD CONSTRAINT "pos_item_routes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_item_routes" ADD CONSTRAINT "pos_item_routes_station_id_preparation_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."preparation_stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_order_discounts" ADD CONSTRAINT "pos_order_discounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_order_discounts" ADD CONSTRAINT "pos_order_discounts_order_id_pos_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."pos_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_order_discounts" ADD CONSTRAINT "pos_order_discounts_order_line_id_pos_order_lines_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."pos_order_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_order_discounts" ADD CONSTRAINT "pos_order_discounts_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_order_discounts" ADD CONSTRAINT "pos_order_discounts_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_order_events" ADD CONSTRAINT "pos_order_events_order_id_pos_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."pos_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_order_events" ADD CONSTRAINT "pos_order_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_order_lines" ADD CONSTRAINT "pos_order_lines_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_order_lines" ADD CONSTRAINT "pos_order_lines_order_id_pos_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."pos_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_order_lines" ADD CONSTRAINT "pos_order_lines_service_item_id_service_items_id_fk" FOREIGN KEY ("service_item_id") REFERENCES "public"."service_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_order_lines" ADD CONSTRAINT "pos_order_lines_station_id_preparation_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."preparation_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_order_lines" ADD CONSTRAINT "pos_order_lines_voided_by_user_id_users_id_fk" FOREIGN KEY ("voided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_order_lines" ADD CONSTRAINT "pos_order_lines_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_tax_entity_org_id_orgs_id_fk" FOREIGN KEY ("tax_entity_org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_table_session_id_table_sessions_id_fk" FOREIGN KEY ("table_session_id") REFERENCES "public"."table_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_waiter_user_id_users_id_fk" FOREIGN KEY ("waiter_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_cancelled_by_user_id_users_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_outlet_settings" ADD CONSTRAINT "pos_outlet_settings_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_outlet_settings" ADD CONSTRAINT "pos_outlet_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_payment_events" ADD CONSTRAINT "pos_payment_events_payment_id_pos_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."pos_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_payment_events" ADD CONSTRAINT "pos_payment_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_payments" ADD CONSTRAINT "pos_payments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_payments" ADD CONSTRAINT "pos_payments_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_payments" ADD CONSTRAINT "pos_payments_order_id_pos_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."pos_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_payments" ADD CONSTRAINT "pos_payments_shift_id_cashier_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."cashier_shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_payments" ADD CONSTRAINT "pos_payments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_print_jobs" ADD CONSTRAINT "pos_print_jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_print_jobs" ADD CONSTRAINT "pos_print_jobs_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_print_jobs" ADD CONSTRAINT "pos_print_jobs_station_id_preparation_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."preparation_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_print_jobs" ADD CONSTRAINT "pos_print_jobs_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_refunds" ADD CONSTRAINT "pos_refunds_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_refunds" ADD CONSTRAINT "pos_refunds_payment_id_pos_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."pos_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_refunds" ADD CONSTRAINT "pos_refunds_shift_id_cashier_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."cashier_shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_refunds" ADD CONSTRAINT "pos_refunds_refunded_by_user_id_users_id_fk" FOREIGN KEY ("refunded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_registers" ADD CONSTRAINT "pos_registers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_registers" ADD CONSTRAINT "pos_registers_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preparation_stations" ADD CONSTRAINT "preparation_stations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preparation_stations" ADD CONSTRAINT "preparation_stations_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_tables" ADD CONSTRAINT "restaurant_tables_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_tables" ADD CONSTRAINT "restaurant_tables_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_tables" ADD CONSTRAINT "restaurant_tables_area_id_dining_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."dining_areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_table_id_restaurant_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."restaurant_tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_waiter_user_id_users_id_fk" FOREIGN KEY ("waiter_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_opened_by_user_id_users_id_fk" FOREIGN KEY ("opened_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_closed_by_user_id_users_id_fk" FOREIGN KEY ("closed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cash_movements_shift_idx" ON "cash_movements" USING btree ("shift_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cashier_shifts_one_open_per_register_uk" ON "cashier_shifts" USING btree ("register_id") WHERE "cashier_shifts"."status" = 'open';--> statement-breakpoint
CREATE UNIQUE INDEX "cashier_shifts_one_open_per_cashier_uk" ON "cashier_shifts" USING btree ("workspace_id","cashier_user_id") WHERE "cashier_shifts"."status" = 'open';--> statement-breakpoint
CREATE INDEX "cashier_shifts_outlet_idx" ON "cashier_shifts" USING btree ("outlet_id","opened_at");--> statement-breakpoint
CREATE INDEX "kitchen_ticket_events_ticket_idx" ON "kitchen_ticket_events" USING btree ("ticket_id","occurred_at");--> statement-breakpoint
CREATE INDEX "kitchen_ticket_items_ticket_idx" ON "kitchen_ticket_items" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "kitchen_tickets_station_status_idx" ON "kitchen_tickets" USING btree ("station_id","status");--> statement-breakpoint
CREATE INDEX "pos_audit_events_workspace_idx" ON "pos_audit_events" USING btree ("workspace_id","occurred_at");--> statement-breakpoint
CREATE INDEX "pos_audit_events_entity_idx" ON "pos_audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "pos_order_discounts_order_idx" ON "pos_order_discounts" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "pos_order_events_order_idx" ON "pos_order_events" USING btree ("order_id","occurred_at");--> statement-breakpoint
CREATE INDEX "pos_order_lines_order_idx" ON "pos_order_lines" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "pos_orders_outlet_status_idx" ON "pos_orders" USING btree ("outlet_id","status");--> statement-breakpoint
CREATE INDEX "pos_orders_session_idx" ON "pos_orders" USING btree ("table_session_id");--> statement-breakpoint
CREATE INDEX "pos_orders_workspace_created_idx" ON "pos_orders" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "pos_payment_events_payment_idx" ON "pos_payment_events" USING btree ("payment_id","occurred_at");--> statement-breakpoint
CREATE INDEX "pos_payments_order_idx" ON "pos_payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "pos_payments_shift_idx" ON "pos_payments" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "pos_payments_workspace_created_idx" ON "pos_payments" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "pos_print_jobs_outlet_idx" ON "pos_print_jobs" USING btree ("outlet_id","created_at");--> statement-breakpoint
CREATE INDEX "pos_refunds_payment_idx" ON "pos_refunds" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "restaurant_tables_area_idx" ON "restaurant_tables" USING btree ("area_id");--> statement-breakpoint
CREATE UNIQUE INDEX "table_sessions_one_open_uk" ON "table_sessions" USING btree ("table_id") WHERE "table_sessions"."status" = 'open';--> statement-breakpoint
CREATE INDEX "table_sessions_outlet_idx" ON "table_sessions" USING btree ("outlet_id","status");