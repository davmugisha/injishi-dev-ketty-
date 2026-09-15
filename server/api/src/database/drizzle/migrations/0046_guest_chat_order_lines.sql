ALTER TYPE "public"."message_body_type" ADD VALUE 'system';--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "service_order_id" uuid;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_service_order_id_service_orders_id_fk" FOREIGN KEY ("service_order_id") REFERENCES "public"."service_orders"("id") ON DELETE no action ON UPDATE no action;