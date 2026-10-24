-- Rentals rebuild, P1 (blueprint 1.5, step 1): new values on existing enum types, and nothing else.
--
-- migrate.mjs applies every pending migration in ONE transaction, and a value added with
-- ALTER TYPE ... ADD VALUE cannot be used before that transaction commits. So no later migration
-- in the same run (0074-0080) may use any value added here; they only exist for the code that
-- runs after the deploy. Where a migration needs a new value at once (lease status `signed`,
-- the charge statuses) it creates a new type and swaps the column over instead (see 0077, 0078).
--
-- Values: stored object kinds for unit media, signatures, lease PDFs, payment slips and filing
-- proofs; audit subjects tenant, rental_unit, payout_account, deposit; payout values for deposit
-- refunds and fixer payments (payee tenant/vendor, source deposit_refund/repair, destination
-- momo_pay, status failed); the rentals outbox events; the `file` message type.
ALTER TYPE "public"."audit_subject_type" ADD VALUE 'tenant';--> statement-breakpoint
ALTER TYPE "public"."audit_subject_type" ADD VALUE 'rental_unit';--> statement-breakpoint
ALTER TYPE "public"."audit_subject_type" ADD VALUE 'payout_account';--> statement-breakpoint
ALTER TYPE "public"."audit_subject_type" ADD VALUE 'deposit';--> statement-breakpoint
ALTER TYPE "public"."domain_event_type" ADD VALUE 'lease.sent';--> statement-breakpoint
ALTER TYPE "public"."domain_event_type" ADD VALUE 'lease.signed';--> statement-breakpoint
ALTER TYPE "public"."domain_event_type" ADD VALUE 'lease.activated';--> statement-breakpoint
ALTER TYPE "public"."domain_event_type" ADD VALUE 'lease.ending';--> statement-breakpoint
ALTER TYPE "public"."domain_event_type" ADD VALUE 'lease.ended';--> statement-breakpoint
ALTER TYPE "public"."domain_event_type" ADD VALUE 'rent.charged';--> statement-breakpoint
ALTER TYPE "public"."domain_event_type" ADD VALUE 'rent.reminder';--> statement-breakpoint
ALTER TYPE "public"."domain_event_type" ADD VALUE 'rent.paid';--> statement-breakpoint
ALTER TYPE "public"."domain_event_type" ADD VALUE 'rent.payment_failed';--> statement-breakpoint
ALTER TYPE "public"."domain_event_type" ADD VALUE 'payout.paid';--> statement-breakpoint
ALTER TYPE "public"."domain_event_type" ADD VALUE 'payout.failed';--> statement-breakpoint
ALTER TYPE "public"."domain_event_type" ADD VALUE 'notice.filed';--> statement-breakpoint
ALTER TYPE "public"."domain_event_type" ADD VALUE 'notice.acknowledged';--> statement-breakpoint
ALTER TYPE "public"."domain_event_type" ADD VALUE 'deposit.settled';--> statement-breakpoint
ALTER TYPE "public"."message_body_type" ADD VALUE 'file';--> statement-breakpoint
ALTER TYPE "public"."payout_destination" ADD VALUE 'momo_pay';--> statement-breakpoint
ALTER TYPE "public"."payout_payee_type" ADD VALUE 'tenant';--> statement-breakpoint
ALTER TYPE "public"."payout_payee_type" ADD VALUE 'vendor';--> statement-breakpoint
ALTER TYPE "public"."payout_source" ADD VALUE 'deposit_refund';--> statement-breakpoint
ALTER TYPE "public"."payout_source" ADD VALUE 'repair';--> statement-breakpoint
ALTER TYPE "public"."payout_status" ADD VALUE 'failed';--> statement-breakpoint
ALTER TYPE "public"."stored_object_kind" ADD VALUE 'unit_photo';--> statement-breakpoint
ALTER TYPE "public"."stored_object_kind" ADD VALUE 'unit_video';--> statement-breakpoint
ALTER TYPE "public"."stored_object_kind" ADD VALUE 'lease_signature';--> statement-breakpoint
ALTER TYPE "public"."stored_object_kind" ADD VALUE 'lease_contract';--> statement-breakpoint
ALTER TYPE "public"."stored_object_kind" ADD VALUE 'payment_receipt';--> statement-breakpoint
ALTER TYPE "public"."stored_object_kind" ADD VALUE 'filing_proof';
