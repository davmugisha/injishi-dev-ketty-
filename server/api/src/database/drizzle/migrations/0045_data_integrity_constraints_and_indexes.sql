ALTER TABLE "stay_identities" DROP CONSTRAINT "stay_identities_guest_stay_id_guest_stays_id_fk";
--> statement-breakpoint
ALTER TABLE "ebm_invoice_lines" DROP CONSTRAINT "ebm_invoice_lines_ebm_invoice_id_ebm_invoices_id_fk";
--> statement-breakpoint
ALTER TABLE "folio_charges" DROP CONSTRAINT "folio_charges_folio_id_folios_id_fk";
--> statement-breakpoint
ALTER TABLE "folios" DROP CONSTRAINT "folios_property_id_properties_id_fk";
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "locked_nightly_rate_rwf" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "gross_rwf" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "stay_identities" ADD CONSTRAINT "stay_identities_guest_stay_id_guest_stays_id_fk" FOREIGN KEY ("guest_stay_id") REFERENCES "public"."guest_stays"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebm_invoice_lines" ADD CONSTRAINT "ebm_invoice_lines_ebm_invoice_id_ebm_invoices_id_fk" FOREIGN KEY ("ebm_invoice_id") REFERENCES "public"."ebm_invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folio_charges" ADD CONSTRAINT "folio_charges_folio_id_folios_id_fk" FOREIGN KEY ("folio_id") REFERENCES "public"."folios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folios" ADD CONSTRAINT "folios_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listings_workspace_idx" ON "listings" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "rate_plans_workspace_idx" ON "rate_plans" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "room_types_workspace_idx" ON "room_types" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "rooms_workspace_idx" ON "rooms" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_property_label_uk" ON "rooms" USING btree ("property_id","label") WHERE "rooms"."label" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "guest_stays_booking_idx" ON "guest_stays" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "escrows_workspace_idx" ON "escrows" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "escrows_booking_idx" ON "escrows" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "lease_signatures_lease_idx" ON "lease_signatures" USING btree ("lease_id");--> statement-breakpoint
CREATE INDEX "payment_attempts_booking_idx" ON "payment_attempts" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "message_attachments_message_idx" ON "message_attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "threads_booking_idx" ON "threads" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "ebm_invoice_lines_invoice_idx" ON "ebm_invoice_lines" USING btree ("ebm_invoice_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_workspace_idx" ON "ledger_entries" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "folio_charges_workspace_idx" ON "folio_charges" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "housekeeping_tasks_workspace_idx" ON "housekeeping_tasks" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "service_orders_property_idx" ON "service_orders" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "service_orders_booking_idx" ON "service_orders" USING btree ("booking_id");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_dates_ordered" CHECK ("bookings"."check_out" > "bookings"."check_in");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_guest_count_positive" CHECK ("bookings"."guest_count" > 0);--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_amounts_non_negative" CHECK ("bookings"."locked_nightly_rate_rwf" >= 0 AND "bookings"."gross_rwf" >= 0 AND ("bookings"."refund_rwf" IS NULL OR "bookings"."refund_rwf" >= 0));--> statement-breakpoint
ALTER TABLE "escrows" ADD CONSTRAINT "escrows_amount_non_negative" CHECK ("escrows"."amount_rwf" IS NULL OR "escrows"."amount_rwf" >= 0);--> statement-breakpoint
ALTER TABLE "payment_compensations" ADD CONSTRAINT "payment_compensations_kind_known" CHECK ("payment_compensations"."kind" IN ('refund', 'void-pending', 'release-escrow'));--> statement-breakpoint
ALTER TABLE "ebm_connections" ADD CONSTRAINT "ebm_connections_account_status_known" CHECK ("ebm_connections"."account_status" IS NULL OR "ebm_connections"."account_status" IN ('submitted', 'approved', 'disabled'));