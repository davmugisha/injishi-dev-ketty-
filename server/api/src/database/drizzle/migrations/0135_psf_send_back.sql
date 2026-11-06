-- PSF never rejects (2026-11-05, the owner: "nta reject ibaho"): a District Manager sends an application or a
-- card back with what to fix. It stays open, keeps its docID and any fee paid, and returns to the queue when
-- the business resends it. Declined rows from before this stay as history.
ALTER TABLE "psf_membership_applications" ADD COLUMN "returned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD COLUMN "returned_by_user_id" uuid REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD COLUMN "return_note" text;--> statement-breakpoint
ALTER TABLE "psf_membership_claims" ADD COLUMN "returned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "psf_membership_claims" ADD COLUMN "returned_by_user_id" uuid REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "psf_membership_claims" ADD COLUMN "return_note" text;
